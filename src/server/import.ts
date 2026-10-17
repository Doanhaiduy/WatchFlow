import "server-only";
// Nhập Excel hàng loạt (FR-IMP-01…04). Trình duyệt đọc tệp và gửi các dòng dạng JSON (≤ 300); máy chủ KHÔNG mở tệp.
// Hai bước: xem trước (chỉ đọc, không ghi gì) → ghi (kiểm tra lại từng dòng, không tin kết quả xem trước).
//  - Khách: INSERT từng dòng trong điểm lưu riêng (một dòng hỏng không làm hỏng lô), CCCD mã hóa như khi tạo khách.
//  - Đồng hồ / linh kiện: MỘT phiếu nhập loại `opening` (nháp → app.fn_confirm_purchase) trong cùng transaction ⇒ giá vốn/kho/audit nhất quán.
import { z } from "zod";
import type { Tx } from "./db";
import { ApiError, mapDbError } from "./errors";
import { piiColumns } from "./customers";
import { blindIndex } from "./pii";
import { saveDraft } from "./purchases";
import type { PurchaseBody } from "@/lib/types/purchases";
import type { CommitItem, CommitResult, Preview, PreviewRow, RowStatus } from "@/lib/import/types";
import {
  IMPORT_MAX_ROWS, foldText, normSerial, normalizeIdNumber, normalizePhoneVN, parseCondition, parseCount, parseGrade, parseMoneyVnd,
  type ImportKind, type WatchCondition,
} from "@/lib/import/columns";

export const ImportRowsSchema = z
  .array(z.object({ line: z.number().int().min(1).max(1_000_000), cells: z.record(z.string().max(30), z.string().max(2000)) }))
  .min(1, "Tệp không có dòng dữ liệu nào.")
  .max(IMPORT_MAX_ROWS, `Mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} dòng. Hãy chia tệp thành nhiều phần.`);

export const ImportOptionsSchema = z.object({
  /** Đồng hồ: tự tạo hãng/loại chưa có (cần catalog.manage) */
  createMissingModels: z.boolean().optional(),
  /** Đồng hồ: vị trí kho dùng khi ô trống */
  defaultLocationId: z.string().uuid().nullable().optional(),
});
export const ImportPreviewBody = z.object({ rows: ImportRowsSchema, options: ImportOptionsSchema.optional() });
export const ImportCommitBody = z.object({
  rows: ImportRowsSchema,
  options: ImportOptionsSchema.optional(),
  /** Các dòng (số dòng trong tệp) người dùng chọn nhập. Bỏ trống ⇒ mọi dòng hợp lệ/cảnh báo (KHÔNG gồm dòng trùng). */
  include: z.array(z.number().int()).max(IMPORT_MAX_ROWS).optional(),
});
export type ImportRows = z.infer<typeof ImportRowsSchema>;
export type ImportOptions = z.infer<typeof ImportOptionsSchema>;

type Cells = Record<string, string>;
const get = (c: Cells, k: string) => (c[k] ?? "").replace(/\s+/g, " ").trim();
const getRaw = (c: Cells, k: string) => (c[k] ?? "").trim();

function mkPreview(kind: ImportKind, rows: PreviewRow[], notices: string[]): Preview {
  const counts: Record<RowStatus, number> = { ok: 0, warning: 0, error: 0, duplicate: 0 };
  for (const r of rows) counts[r.status]++;
  return { kind, total: rows.length, counts, rows, notices };
}
const worst = (cur: RowStatus, next: RowStatus): RowStatus => {
  const rank: Record<RowStatus, number> = { ok: 0, warning: 1, duplicate: 2, error: 3 };
  return rank[next] > rank[cur] ? next : cur;
};
const defaultInclude = (s: RowStatus) => s === "ok" || s === "warning";
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

// ============================================================================================ KHÁCH HÀNG

type CustomerPlan = { line: number; fullName: string; phone: string | null; email: string | null; address: string | null; groupId: string | null; note: string | null; idNumber: string | null };

async function analyzeCustomers(tx: Tx, rows: ImportRows) {
  const groups = await tx.q<{ id: string; name: string }>("SELECT id, name FROM public.customer_groups WHERE is_active");
  const groupBy = new Map(groups.map((g) => [foldText(g.name), g]));
  // Trùng với khách có sẵn: theo SĐT chuẩn hóa và theo chỉ mục băm số giấy tờ (không giải mã gì) — trong phạm vi khách người gọi được thấy (RLS)
  const plans: (CustomerPlan | null)[] = [];
  const out: PreviewRow[] = [];
  const phones = new Set<string>();
  const bidxs = new Set<string>();
  for (const r of rows) {
    const c = r.cells;
    const msgs: string[] = [];
    let status = "ok" as RowStatus;
    const err = (m: string) => { msgs.push(m); status = worst(status, "error"); };
    const warn = (m: string) => { msgs.push(m); status = worst(status, "warning"); };
    const fullName = get(c, "fullName");
    if (!fullName) err("Thiếu họ tên.");
    else if (fullName.length > 120) err("Họ tên quá dài (tối đa 120 ký tự).");
    const ph = normalizePhoneVN(getRaw(c, "phone"));
    if (ph.error) err(ph.error);
    if (ph.fixed) warn("SĐT thiếu số 0 đầu — đã thêm lại.");
    const emailRaw = get(c, "email").toLowerCase();
    if (emailRaw && (emailRaw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))) err("Email không hợp lệ.");
    const address = get(c, "address");
    if (address.length > 300) err("Địa chỉ quá dài (tối đa 300 ký tự).");
    const note = getRaw(c, "note");
    if (note.length > 1000) err("Ghi chú quá dài (tối đa 1000 ký tự).");
    let groupId: string | null = null;
    const groupName = get(c, "group");
    if (groupName) {
      const g = groupBy.get(foldText(groupName));
      if (g) groupId = g.id;
      else warn(`Chưa có nhóm khách “${groupName}” — để trống nhóm.`);
    }
    const idn = normalizeIdNumber(getRaw(c, "idNumber"));
    if (idn.error) err(idn.error);
    if (idn.fixed) warn("CCCD/CMND thiếu số 0 đầu — đã thêm lại.");
    if (ph.phone) phones.add(ph.phone);
    if (idn.value) bidxs.add(blindIndex(idn.value));
    out.push({ line: r.line, label: fullName || "(chưa có tên)", detail: [ph.phone, groupName, idn.value ? "có CCCD" : ""].filter(Boolean).join(" · "), status, messages: msgs, include: false });
    plans.push(status === "error" ? null : { line: r.line, fullName, phone: ph.phone, email: emailRaw || null, address: address || null, groupId, note: note || null, idNumber: idn.value });
  }
  const dbPhones = phones.size
    ? await tx.q<{ phone_norm: string; code: string; full_name: string }>(
        "SELECT phone_norm, code, full_name FROM public.customers WHERE phone_norm = ANY($1::text[]) AND anonymized_at IS NULL", [[...phones]])
    : [];
  const dbIds = bidxs.size
    ? await tx.q<{ id_number_bidx: string; code: string; full_name: string }>(
        "SELECT id_number_bidx, code, full_name FROM public.customers WHERE id_number_bidx = ANY($1::text[]) AND anonymized_at IS NULL", [[...bidxs]])
    : [];
  const seenPhone = new Map<string, number>();
  const seenId = new Map<string, number>();
  out.forEach((o, i) => {
    const p = plans[i];
    if (p) {
      const dup = (m: string) => { o.messages.push(m); o.status = worst(o.status, "duplicate"); };
      if (p.phone) {
        const d = dbPhones.find((x) => x.phone_norm === p.phone);
        if (d) dup(`Trùng SĐT với khách có sẵn: ${d.full_name} (${d.code}).`);
        const first = seenPhone.get(p.phone);
        if (first !== undefined) dup(`Trùng SĐT với dòng ${first} trong tệp.`);
        else seenPhone.set(p.phone, p.line);
      }
      if (p.idNumber) {
        const b = blindIndex(p.idNumber);
        const d = dbIds.find((x) => x.id_number_bidx === b);
        if (d) dup(`Trùng số giấy tờ với khách có sẵn: ${d.full_name} (${d.code}).`);
        const first = seenId.get(b);
        if (first !== undefined) dup(`Trùng số giấy tờ với dòng ${first} trong tệp.`);
        else seenId.set(b, p.line);
      }
    }
    o.include = defaultInclude(o.status);
  });
  return { out, plans, notices: [] as string[] };
}

export async function previewCustomers(tx: Tx, rows: ImportRows): Promise<Preview> {
  const a = await analyzeCustomers(tx, rows);
  return mkPreview("customers", a.out, a.notices);
}

export async function commitCustomers(tx: Tx, rows: ImportRows, include?: number[]): Promise<CommitResult> {
  const a = await analyzeCustomers(tx, rows);
  const want = new Set(include ?? a.out.filter((o) => defaultInclude(o.status)).map((o) => o.line));
  const items: CommitItem[] = [];
  const failed: CommitResult["failed"] = [];
  let skipped = 0;
  for (let i = 0; i < a.out.length; i++) {
    const o = a.out[i]!;
    const p = a.plans[i];
    if (!p || !want.has(o.line)) { skipped++; continue; }
    const pii = piiColumns(p.idNumber);
    await tx.q("SAVEPOINT imp_row");
    try {
      const r = await tx.one<{ id: string; code: string }>(
        `INSERT INTO public.customers (full_name, phone, email, address, group_id, note, id_number_enc, id_number_bidx, id_number_last3, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, app.current_user_id()) RETURNING id, code`,
        [p.fullName, p.phone, p.email, p.address, p.groupId, p.note, pii.enc, pii.bidx, pii.last3],
      );
      await tx.q("RELEASE SAVEPOINT imp_row");
      items.push({ line: p.line, id: r!.id, code: r!.code, label: p.fullName, href: `/khach-hang/${r!.id}` });
    } catch (e) {
      await tx.q("ROLLBACK TO SAVEPOINT imp_row");
      const m = mapDbError(e);
      failed.push({ line: p.line, label: p.fullName, message: m?.detail ?? "Không lưu được dòng này." });
    }
  }
  await tx.fn("app.fn_audit_import", ["customers", { rows: rows.length, created: items.length, failed: failed.length, skipped }]);
  return { kind: "customers", receipt: null, items, failed, skipped };
}

// ============================================================================================ ĐỒNG HỒ

type ModelRow = { id: string; code: string; name: string; brandId: string; brand: string };
type WatchPlan = {
  line: number; label: string; modelId: string | null; newModel: { key: string; brandName: string; name: string } | null; brandId: string | null;
  serial: string | null; condition: WatchCondition; grade: string | null; initialStatus: "in_stock" | "inspecting"; cost: number; listPrice: number | null;
  locationId: string | null; note: string | null;
};

const CONDITION_VI: Record<WatchCondition, string> = { new: "Mới", used: "Cũ", refurbished: "Đã sửa" };

async function analyzeWatches(tx: Tx, rows: ImportRows, opt: ImportOptions, can: (p: "catalog.manage") => boolean) {
  const models = await tx.q<ModelRow>(
    `SELECT m.id, m.code, m.name, b.id AS "brandId", b.name AS brand FROM public.watch_models m JOIN public.brands b ON b.id = m.brand_id WHERE m.is_active AND b.is_active`);
  const brands = await tx.q<{ id: string; name: string }>("SELECT id, name FROM public.brands WHERE is_active");
  const locs = await tx.q<{ id: string; name: string }>("SELECT id, name FROM public.storage_locations WHERE is_active");
  const brandBy = new Map(brands.map((b) => [foldText(b.name), b]));
  const locBy = new Map(locs.map((l) => [foldText(l.name), l]));
  const defLoc = opt.defaultLocationId ? locs.find((l) => l.id === opt.defaultLocationId) ?? null : null;
  const canCreate = !!opt.createMissingModels && can("catalog.manage");
  const out: PreviewRow[] = [];
  const plans: (WatchPlan | null)[] = [];
  const newModels = new Map<string, { brandName: string; name: string }>();
  let inspecting = 0;
  let noPrice = 0;
  let noSerial = 0;
  for (const r of rows) {
    const c = r.cells;
    const msgs: string[] = [];
    let status = "ok" as RowStatus;
    const err = (m: string) => { msgs.push(m); status = worst(status, "error"); };
    const warn = (m: string) => { msgs.push(m); status = worst(status, "warning"); };
    const brandName = get(c, "brand");
    const modelName = get(c, "model");
    let modelId: string | null = null;
    let brandId: string | null = null;
    let newModel: WatchPlan["newModel"] = null;
    let label = [brandName, modelName].filter(Boolean).join(" ") || "(chưa có loại)";
    if (!modelName) err("Thiếu loại/model.");
    else {
      const fm = foldText(modelName);
      const fb = brandName ? foldText(brandName) : "";
      const brand = fb ? brandBy.get(fb) : undefined;
      if (brandName && !brand && !canCreate) err(`Chưa có hãng “${brandName}” — tạo ở Đồng hồ → Loại & hãng.`);
      else {
        let cand = models.filter((m) => foldText(m.code) === fm || foldText(m.name) === fm || foldText(`${m.brand} ${m.name}`) === fm);
        if (brand) cand = cand.filter((m) => m.brandId === brand.id);
        if (cand.length === 1) {
          modelId = cand[0]!.id;
          brandId = cand[0]!.brandId;
          label = `${cand[0]!.brand} ${cand[0]!.name}`;
          if (brandName && !brand) err(`Hãng “${brandName}” không khớp loại này.`);
        } else if (cand.length > 1) err(`Tên “${modelName}” trùng nhiều loại — ghi thêm cột Hãng hoặc dùng mã loại.`);
        else if (canCreate) {
          if (!brandName) err(`Chưa có loại “${modelName}” — ghi cột Hãng để tự tạo loại mới, hoặc tạo ở Đồng hồ → Loại & hãng.`);
          else {
            const key = `${fb}|${fm}`;
            newModels.set(key, { brandName: brand?.name ?? brandName, name: modelName });
            newModel = { key, brandName: brand?.name ?? brandName, name: modelName };
            brandId = brand?.id ?? null;
            warn(`Chưa có loại “${modelName}” — sẽ tự tạo loại mới${brand ? "" : ` và hãng “${brandName}”`}.`);
          }
        } else err(`Chưa có loại “${modelName}”${brandName ? ` của hãng ${brandName}` : ""} — tạo ở Đồng hồ → Loại & hãng${opt.createMissingModels ? " (bạn không có quyền tự tạo loại)" : ", hoặc bật “tự tạo loại mới” nếu bạn có quyền"}.`);
      }
    }
    const condition = parseCondition(getRaw(c, "condition"));
    if (!getRaw(c, "condition")) err("Thiếu tình trạng (Mới / Cũ / Đã sửa).");
    else if (!condition) err(`Tình trạng “${getRaw(c, "condition")}” không hợp lệ — dùng Mới / Cũ / Đã sửa.`);
    const gr = parseGrade(getRaw(c, "grade"));
    if (gr.error) err(gr.error);
    const cost = parseMoneyVnd(getRaw(c, "cost"));
    if (!getRaw(c, "cost")) err("Thiếu giá vốn (giá thu).");
    else if (cost.error) err(`Giá vốn: ${cost.error}.`);
    else if (cost.value === 0) warn("Giá vốn bằng 0đ.");
    const lp = parseMoneyVnd(getRaw(c, "listPrice"));
    if (lp.error) err(`Giá niêm yết: ${lp.error}.`);
    if (!getRaw(c, "listPrice")) noPrice++;
    let locationId: string | null = null;
    const locName = get(c, "location");
    if (locName) {
      const l = locBy.get(foldText(locName));
      if (l) locationId = l.id;
      else err(`Chưa có vị trí kho “${locName}” — tạo ở Vị trí kho hoặc chọn vị trí mặc định.`);
    } else if (defLoc) locationId = defLoc.id;
    else err("Thiếu vị trí kho (hoặc chọn vị trí mặc định khi nhập).");
    const serialRaw = getRaw(c, "serial");
    if (serialRaw.length > 60) err("Serial quá dài (tối đa 60 ký tự).");
    if (!serialRaw) { noSerial++; }
    const note = getRaw(c, "note");
    if (note.length > 500) err("Ghi chú quá dài (tối đa 500 ký tự).");
    const initialStatus = condition && condition !== "new" ? "inspecting" : "in_stock";
    if (initialStatus === "inspecting") inspecting++;
    out.push({
      line: r.line, label,
      detail: [serialRaw ? `S/N ${serialRaw}` : "không serial", condition ? CONDITION_VI[condition] + (gr.value ? ` ${gr.value}` : "") : "", cost.value !== null ? `vốn ${vnd(cost.value)}` : ""].filter(Boolean).join(" · "),
      status, messages: msgs, include: false,
    });
    plans.push(status === "error" || !condition || cost.value === null ? null : {
      line: r.line, label, modelId, newModel, brandId, serial: serialRaw || null, condition, grade: gr.value, initialStatus, cost: cost.value,
      listPrice: lp.value, locationId, note: note || null,
    });
  }
  // Serial: trùng trong kho (cùng hãng) hoặc trong tệp
  const pairsB: string[] = [];
  const pairsS: string[] = [];
  plans.forEach((p) => { if (p?.brandId && normSerial(p.serial)) { pairsB.push(p.brandId); pairsS.push(normSerial(p.serial)!); } });
  const dbDup = pairsB.length
    ? await tx.q<{ brand_id: string; serial_norm: string; asset_code: string }>(
        `SELECT w.brand_id, w.serial_norm, w.asset_code FROM public.watch_units w JOIN unnest($1::uuid[], $2::text[]) AS t(b, s) ON w.brand_id = t.b AND w.serial_norm = t.s
         WHERE w.status <> 'cancelled'`, [pairsB, pairsS])
    : [];
  const seen = new Map<string, number>();
  out.forEach((o, i) => {
    const p = plans[i];
    if (p && normSerial(p.serial)) {
      const sn = normSerial(p.serial)!;
      const brandKey = p.brandId ?? p.newModel?.brandName.toLowerCase() ?? "?";
      const d = p.brandId ? dbDup.find((x) => x.brand_id === p.brandId && x.serial_norm === sn) : undefined;
      if (d) { o.messages.push(`Serial ${p.serial} đã có trong kho (${d.asset_code}, cùng hãng).`); o.status = "error"; plans[i] = null; }
      else {
        const k = `${brandKey}|${sn}`;
        const first = seen.get(k);
        if (first !== undefined) { o.messages.push(`Serial ${p.serial} trùng với dòng ${first} trong tệp.`); o.status = "error"; plans[i] = null; }
        else seen.set(k, p.line);
      }
    } else if (p) o.messages.push("Không có serial — nhập là “không serial”.");
    if (p && !normSerial(p.serial)) o.status = worst(o.status, "warning");
    o.include = defaultInclude(o.status);
  });
  const notices: string[] = [];
  if (inspecting) notices.push(`${inspecting} dòng hàng cũ/đã sửa sẽ vào kho ở trạng thái “Chờ kiểm tra” (cần hạng tình trạng + ảnh mới chuyển sang Sẵn sàng bán).`);
  if (noPrice) notices.push(`${noPrice} dòng chưa có giá niêm yết (sẽ để 0đ — đặt giá ở màn đồng hồ sau).`);
  if (noSerial) notices.push(`${noSerial} dòng không có serial.`);
  if (newModels.size) notices.push(`Sẽ tự tạo ${newModels.size} loại mới.`);
  return { out, plans, notices, newModels };
}

export async function previewWatches(tx: Tx, rows: ImportRows, opt: ImportOptions, can: (p: "catalog.manage") => boolean): Promise<Preview> {
  const a = await analyzeWatches(tx, rows, opt, can);
  return mkPreview("watches", a.out, a.notices);
}

function slug(s: string, max: number): string {
  return foldText(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
}

/** Đổi "Dòng N" (số thứ tự dòng của phiếu) trong lỗi DB thành số dòng của tệp */
function remapLine(e: unknown, lineMap: number[]): never {
  const m = mapDbError(e);
  if (m) {
    m.detail = m.detail.replace(/Dòng (\d+)/g, (_x, n: string) => `Dòng ${lineMap[Number(n) - 1] ?? n} của tệp`);
    throw m;
  }
  throw e;
}

export async function commitWatches(tx: Tx, rows: ImportRows, opt: ImportOptions, include: number[] | undefined, can: (p: "catalog.manage") => boolean): Promise<CommitResult> {
  const a = await analyzeWatches(tx, rows, opt, can);
  const want = new Set(include ?? a.out.filter((o) => defaultInclude(o.status)).map((o) => o.line));
  const chosen = a.plans.filter((p): p is WatchPlan => !!p && want.has(p.line));
  const skipped = a.out.length - chosen.length;
  if (!chosen.length) throw new ApiError(422, "WF-VALIDATION", "Không có dòng hợp lệ nào để nhập. Hãy sửa lỗi trong tệp rồi xem trước lại.");
  // Tạo hãng/loại mới (chỉ khi người dùng bật tùy chọn và có catalog.manage — đã tính trong phân tích)
  const modelOf = new Map<string, string>();
  for (const p of chosen) {
    if (!p.newModel || modelOf.has(p.newModel.key)) continue;
    const nm = p.newModel;
    let brand = await tx.one<{ id: string }>("SELECT id FROM public.brands WHERE lower(name) = lower($1)", [nm.brandName]);
    if (!brand) brand = await tx.one<{ id: string }>("INSERT INTO public.brands (name, created_by) VALUES ($1, app.current_user_id()) RETURNING id", [nm.brandName]);
    const base = `${slug(nm.brandName, 14)}-${slug(nm.name, 24)}`.replace(/^-|-$/g, "") || "MODEL";
    let code = base;
    for (let n = 2; await tx.one("SELECT 1 FROM public.watch_models WHERE upper(code) = $1", [code.toUpperCase()]); n++) code = `${base}-${n}`;
    const m = await tx.one<{ id: string }>(
      "INSERT INTO public.watch_models (code, brand_id, name, created_by) VALUES ($1,$2,$3, app.current_user_id()) RETURNING id", [code, brand!.id, nm.name]);
    modelOf.set(nm.key, m!.id);
  }
  const body = {
    kind: "opening" as const,
    note: `Nhập tồn đầu kỳ từ Excel (${chosen.length} chiếc)`,
    lines: chosen.map((p) => ({
      lineType: "watch" as const, modelId: (p.modelId ?? modelOf.get(p.newModel!.key))!, serialNo: p.serial, hasSerial: !!normSerial(p.serial),
      condition: p.condition, conditionGrade: p.grade, conditionNote: p.note, initialStatus: p.initialStatus, locationId: p.locationId,
      listPrice: p.listPrice, unitPrice: p.cost, note: null,
    })),
    costs: [],
  } as unknown as z.infer<typeof PurchaseBody>;
  const lineMap = chosen.map((p) => p.line);
  const id = await saveDraft(tx, null, body);
  let conf: { id: string; code: string; units: { lineNo: number; unitId: string; assetCode: string }[] };
  try { conf = await tx.fn("app.fn_confirm_purchase", [id]); } catch (e) { remapLine(e, lineMap); }
  const items: CommitItem[] = conf.units.map((u) => {
    const p = chosen[u.lineNo - 1]!;
    return { line: p.line, id: u.unitId, code: u.assetCode, label: p.label, href: `/dong-ho/${u.unitId}`, note: p.initialStatus === "inspecting" ? "Chờ kiểm tra" : undefined };
  });
  await tx.fn("app.fn_audit_import", ["watches", { rows: rows.length, created: items.length, skipped, receipt: conf.code }]);
  return { kind: "watches", receipt: { id: conf.id, code: conf.code, href: `/nhap-hang/${conf.id}` }, items, failed: [], skipped };
}

// ============================================================================================ LINH KIỆN

type PartPlan = {
  line: number; label: string; existingId: string | null; code: string; name: string; categoryId: string | null; uom: string; qty: number; cost: number | null;
  reorder: number; salePrice: number; note: string | null;
};

async function analyzeParts(tx: Tx, rows: ImportRows, can: (p: "part.manage") => boolean) {
  const cats = await tx.q<{ id: string; name: string }>("SELECT id, name FROM public.part_categories WHERE is_active");
  const catBy = new Map(cats.map((c) => [foldText(c.name), c]));
  const codes = rows.map((r) => get(r.cells, "code").toUpperCase()).filter(Boolean);
  const existing = codes.length
    ? await tx.q<{ id: string; code: string; name: string }>("SELECT id, code, name FROM public.parts WHERE upper(code) = ANY($1::text[])", [codes])
    : [];
  const exBy = new Map(existing.map((p) => [p.code.toUpperCase(), p]));
  const canManage = can("part.manage");
  const out: PreviewRow[] = [];
  const plans: (PartPlan | null)[] = [];
  const seen = new Map<string, number>();
  let zero = 0;
  for (const r of rows) {
    const c = r.cells;
    const msgs: string[] = [];
    let status = "ok" as RowStatus;
    const err = (m: string) => { msgs.push(m); status = worst(status, "error"); };
    const dup = (m: string) => { msgs.push(m); status = worst(status, "duplicate"); };
    const code = get(c, "code");
    const name = get(c, "name");
    if (!code) err("Thiếu mã linh kiện.");
    else if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,40}$/.test(code)) err("Mã chỉ gồm chữ, số và . _ / - (tối đa 41 ký tự).");
    const ex = code ? exBy.get(code.toUpperCase()) : undefined;
    if (code) {
      const first = seen.get(code.toUpperCase());
      if (first !== undefined) err(`Mã ${code} trùng với dòng ${first} trong tệp.`);
      else seen.set(code.toUpperCase(), r.line);
    }
    if (!ex) {
      if (!name) err("Thiếu tên linh kiện.");
      else if (name.length > 160) err("Tên quá dài (tối đa 160 ký tự).");
    }
    const catName = get(c, "category");
    let categoryId: string | null = null;
    if (!ex) {
      if (!catName) err("Thiếu danh mục.");
      else {
        const cat = catBy.get(foldText(catName));
        if (cat) categoryId = cat.id;
        else err(`Chưa có danh mục “${catName}” — tạo ở Linh kiện → Danh mục.`);
      }
      if (!canManage) err("Bạn không có quyền tạo linh kiện mới (part.manage).");
    }
    const uom = get(c, "uom") || "cái";
    if (uom.length > 20) err("Đơn vị quá dài (tối đa 20 ký tự).");
    const qty = parseCount(getRaw(c, "qty"));
    if (qty.error) err(`Tồn đầu: ${qty.error}.`);
    const cost = parseMoneyVnd(getRaw(c, "cost"));
    if (cost.error) err(`Giá vốn: ${cost.error}.`);
    const q = qty.value ?? 0;
    if (q > 0 && cost.value === null && !cost.error) err("Thiếu giá vốn (bắt buộc khi có tồn đầu).");
    const re = parseCount(getRaw(c, "reorder"));
    if (re.error) err(`Ngưỡng cảnh báo: ${re.error}.`);
    const sp = parseMoneyVnd(getRaw(c, "salePrice"));
    if (sp.error) err(`Giá bán: ${sp.error}.`);
    if (q === 0) zero++;
    if (ex) dup(`Mã đã có: ${ex.name}. ${q > 0 ? `Chọn nhập để CỘNG ${q} vào tồn hiện có (giá vốn bình quân tự tính lại); thông tin khác giữ nguyên.` : "Không có tồn đầu để cộng — bỏ qua."}`);
    const note = getRaw(c, "note");
    if (note.length > 1000) err("Ghi chú quá dài (tối đa 1000 ký tự).");
    out.push({
      line: r.line, label: `${code || "?"} — ${ex?.name ?? (name || "(chưa có tên)")}`,
      detail: [ex ? "đã có" : "tạo mới", q > 0 ? `tồn ${q.toLocaleString("vi-VN")} ${uom}` : "chưa nhập kho", cost.value !== null ? `vốn ${vnd(cost.value)}/${uom}` : ""].filter(Boolean).join(" · "),
      status, messages: msgs, include: false,
    });
    plans.push(status === "error" ? null : {
      line: r.line, label: `${code} — ${ex?.name ?? name}`, existingId: ex?.id ?? null, code, name, categoryId, uom, qty: q, cost: cost.value, reorder: re.value ?? 0, salePrice: sp.value ?? 0, note: note || null,
    });
  }
  out.forEach((o) => (o.include = defaultInclude(o.status)));
  const notices: string[] = [];
  if (zero) notices.push(`${zero} dòng không có tồn đầu: chỉ tạo linh kiện, không tạo phiếu nhập kho cho dòng đó.`);
  return { out, plans, notices };
}

export async function previewParts(tx: Tx, rows: ImportRows, can: (p: "part.manage") => boolean): Promise<Preview> {
  const a = await analyzeParts(tx, rows, can);
  return mkPreview("parts", a.out, a.notices);
}

export async function commitParts(tx: Tx, rows: ImportRows, include: number[] | undefined, can: (p: "part.manage") => boolean): Promise<CommitResult> {
  const a = await analyzeParts(tx, rows, can);
  const want = new Set(include ?? a.out.filter((o) => defaultInclude(o.status)).map((o) => o.line));
  const chosen = a.plans.filter((p): p is PartPlan => !!p && want.has(p.line));
  const skipped = a.out.length - chosen.length;
  // Dòng "đã có" không có tồn đầu thì không còn việc gì
  const work = chosen.filter((p) => !(p.existingId && p.qty === 0));
  if (!work.length) throw new ApiError(422, "WF-VALIDATION", "Không có dòng hợp lệ nào để nhập. Hãy sửa lỗi trong tệp rồi xem trước lại.");
  const ids = new Map<number, string>();
  const created: number[] = [];
  for (const p of work) {
    if (p.existingId) { ids.set(p.line, p.existingId); continue; }
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.parts (code, name, category_id, uom, specs, sale_price_vnd, reorder_level, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7, app.current_user_id()) RETURNING id`,
      [p.code, p.name, p.categoryId, p.uom, p.note, p.salePrice, p.reorder]);
    ids.set(p.line, r!.id);
    created.push(p.line);
  }
  const stockLines = work.filter((p) => p.qty > 0);
  let receipt: CommitResult["receipt"] = null;
  if (stockLines.length) {
    const body = {
      kind: "opening" as const, note: `Nhập tồn đầu kỳ linh kiện từ Excel (${stockLines.length} mã)`,
      lines: stockLines.map((p) => ({ lineType: "part" as const, partId: ids.get(p.line)!, qty: p.qty, unitPrice: p.cost!, note: null })), costs: [],
    } as unknown as z.infer<typeof PurchaseBody>;
    const id = await saveDraft(tx, null, body);
    let conf: { id: string; code: string };
    try { conf = await tx.fn("app.fn_confirm_purchase", [id]); } catch (e) { remapLine(e, stockLines.map((p) => p.line)); }
    receipt = { id: conf.id, code: conf.code, href: `/nhap-hang/${conf.id}` };
  }
  const items: CommitItem[] = work.map((p) => ({
    line: p.line, id: ids.get(p.line)!, code: p.code, label: p.label, href: `/linh-kien/${ids.get(p.line)!}`,
    note: `${created.includes(p.line) ? "Tạo mới" : "Cộng tồn"}${p.qty > 0 ? ` · +${p.qty.toLocaleString("vi-VN")} ${p.uom}` : ""}`,
  }));
  await tx.fn("app.fn_audit_import", ["parts", { rows: rows.length, created: created.length, stocked: stockLines.length, skipped, receipt: receipt?.code ?? null }]);
  return { kind: "parts", receipt, items, failed: [], skipped };
}
