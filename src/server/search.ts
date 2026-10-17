import "server-only";
// Tìm toàn cục cho bảng lệnh Ctrl+K (FR-NAV-01). Mỗi nhóm CHỈ chạy khi người gọi có quyền xem nhóm đó; mọi truy vấn chạy dưới wf_app
// nên RLS vẫn là lớp chặn thật (CTV chỉ thấy chiếc đang giữ, người chỉ có customer.view_own chỉ thấy khách mình tạo…).
// KHÔNG trả giá vốn/lợi nhuận/giá thu; SĐT khách chỉ trả 3 số cuối. Tối đa 5 dòng mỗi nhóm.
import type { Tx } from "./db";
import type { Permission } from "@/lib/permissions";

export const SEARCH_LIMIT = 5;

type CanFn = (p: Permission | Permission[]) => boolean;

export type SearchUnit = { id: string; assetCode: string; serialNo: string | null; title: string; status: string; exact: boolean };
export type SearchCustomer = { id: string; code: string; fullName: string; phoneTail: string | null };
export type SearchDoc = { id: string; code: string; status: string; docDate: string | null; subtitle: string | null };
export type SearchPart = { id: string; code: string; name: string };

export type SearchResult = {
  q: string;
  units?: SearchUnit[];
  customers?: SearchCustomer[];
  sales?: SearchDoc[];
  repairs?: SearchDoc[];
  purchases?: SearchDoc[];
  reservations?: SearchDoc[];
  parts?: SearchPart[];
  /** Chiếc khớp CHÍNH XÁC mã nội bộ/serial (Enter nhảy thẳng) */
  exactUnitId: string | null;
};

/** Thoát ký tự đại diện của LIKE để người dùng gõ % _ không khớp mọi thứ */
const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const digits = (s: string) => s.replace(/\D/g, "");

export async function searchAll(tx: Tx, q: string, can: CanFn): Promise<SearchResult> {
  const raw = q.trim();
  const like = esc(raw);
  // Gõ sai nhẹ (pg_trgm) chỉ khi đủ dài và KHÔNG có chữ số: mã/serial/SĐT tìm theo chuỗi con chính xác (trigram trên chuỗi số cho kết quả nhiễu)
  const fuzzy = raw.length >= 4 && !/\d/.test(raw);
  const out: SearchResult = { q: raw, exactUnitId: null };
  const L = SEARCH_LIMIT;

  const tasks: Array<() => Promise<void>> = [];
  // Các truy vấn dùng chung MỘT kết nối (một transaction) ⇒ chạy tuần tự, không xếp hàng ngầm trên cùng client của driver.
  if (can(["catalog.view", "collab.view_own"])) {
    tasks.push(
      async () => {
        const rows = await tx.q<{ id: string; asset_code: string; serial_no: string | null; model_name: string; brand_name: string; status: string; exact: boolean }>(
          `SELECT u.id, u.asset_code, u.serial_no, u.status, m.name AS model_name, b.name AS brand_name,
                  coalesce(upper(u.asset_code) = upper($1) OR (u.serial_norm IS NOT NULL AND u.serial_norm = app.norm_serial($1)), false) AS exact
           FROM public.watch_units u JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
           WHERE u.search_text LIKE '%' || app.norm_text($2) || '%' OR u.serial_norm = app.norm_serial($1)
                 ${fuzzy ? "OR app.norm_text($1) <% u.search_text" : ""}
           ORDER BY exact DESC, (u.status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting')) DESC,
                    word_similarity(app.norm_text($1), u.search_text) DESC, u.created_at DESC
           LIMIT ${L}`,
          [raw, like],
        );
        out.units = rows.map((r) => ({
          id: r.id,
          assetCode: r.asset_code,
          serialNo: r.serial_no,
          // Tên loại thường đã có tên hãng ở đầu ("Casio MTP-V001L") ⇒ không lặp
          title: r.model_name.toLowerCase().startsWith(r.brand_name.toLowerCase()) ? r.model_name : `${r.brand_name} ${r.model_name}`.trim(),
          status: r.status,
          exact: r.exact,
        }));
        out.exactUnitId = out.units.find((u) => u.exact)?.id ?? null;
      },
    );
  }
  if (can(["customer.view", "customer.view_own"])) {
    tasks.push(
      async () => {
        const d = digits(raw);
        const usePhone = d.length >= 3;
        const rows = await tx.q<{ id: string; code: string; full_name: string; phone_norm: string | null }>(
          `SELECT c.id, c.code, c.full_name, c.phone_norm FROM public.customers c
           WHERE c.anonymized_at IS NULL AND (c.search_text LIKE '%' || app.norm_text($1) || '%'
                 ${usePhone ? "OR c.phone_norm LIKE '%' || app.norm_phone($2::text) || '%'" : ""}
                 ${fuzzy ? "OR app.norm_text($3) <% c.search_text" : ""})
           ORDER BY coalesce(c.phone_norm = app.norm_phone($2::text), false) DESC, word_similarity(app.norm_text($3), c.search_text) DESC, c.full_name
           LIMIT ${L}`,
          [like, usePhone ? d : null, raw],
        );
        out.customers = rows.map((r) => ({ id: r.id, code: r.code, fullName: r.full_name, phoneTail: r.phone_norm ? r.phone_norm.slice(-3) : null }));
      },
    );
  }
  const docs = async (sql: string, params: unknown[]): Promise<SearchDoc[]> =>
    (await tx.q<{ id: string; code: string; status: string; doc_date: string | null; subtitle: string | null }>(sql, params)).map((r) => ({
      id: r.id, code: r.code, status: r.status, docDate: r.doc_date, subtitle: r.subtitle,
    }));
  if (can(["sale.view", "sale.view_own"])) {
    tasks.push(
      async () => {
        out.sales = await docs(
          `SELECT s.id, s.code, s.status, s.doc_date::text AS doc_date, c.full_name AS subtitle
           FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
           WHERE s.code IS NOT NULL AND upper(s.code) LIKE '%' || upper($1) || '%'
           ORDER BY (upper(s.code) = upper($2)) DESC, s.confirmed_at DESC NULLS LAST LIMIT ${L}`,
          [like, raw],
        );
      },
    );
  }
  if (can("repair.view")) {
    tasks.push(
      async () => {
        out.repairs = await docs(
          `SELECT o.id, o.code, o.status, (o.received_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS doc_date, c.full_name AS subtitle
           FROM public.repair_orders o LEFT JOIN public.customers c ON c.id = o.customer_id
           WHERE upper(o.code) LIKE '%' || upper($1) || '%'
           ORDER BY (upper(o.code) = upper($2)) DESC, o.received_at DESC LIMIT ${L}`,
          [like, raw],
        );
      },
    );
  }
  if (can("purchase.view")) {
    tasks.push(
      async () => {
        out.purchases = await docs(
          `SELECT r.id, r.code, r.status, r.doc_date::text AS doc_date, coalesce(r.source_name, r.seller_name) AS subtitle
           FROM public.purchase_receipts r
           WHERE r.code IS NOT NULL AND upper(r.code) LIKE '%' || upper($1) || '%'
           ORDER BY (upper(r.code) = upper($2)) DESC, r.created_at DESC LIMIT ${L}`,
          [like, raw],
        );
      },
    );
  }
  if (can("reservation.manage")) {
    tasks.push(
      async () => {
        out.reservations = await docs(
          `SELECT r.id, r.code, r.status, r.hold_until::text AS doc_date, c.full_name AS subtitle
           FROM public.reservations r JOIN public.customers c ON c.id = r.customer_id
           WHERE upper(r.code) LIKE '%' || upper($1) || '%'
           ORDER BY (upper(r.code) = upper($2)) DESC, r.created_at DESC LIMIT ${L}`,
          [like, raw],
        );
      },
    );
  }
  if (can("part.view")) {
    tasks.push(
      async () => {
        out.parts = await tx.q<SearchPart>(
          `SELECT p.id, p.code, p.name FROM public.parts p
           WHERE p.is_active AND (p.search_text LIKE '%' || app.norm_text($1) || '%' ${fuzzy ? "OR app.norm_text($2) <% p.search_text" : ""})
           ORDER BY word_similarity(app.norm_text($2), p.search_text) DESC, p.name LIMIT ${L}`,
          [like, raw],
        );
      },
    );
  }
  for (const t of tasks) await t();
  return out;
}
