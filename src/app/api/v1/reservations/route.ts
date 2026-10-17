import { z } from "zod";
import { api } from "@/server/http";
import { ReservationBody } from "@/lib/types/sales";

const Q = z.object({ status: z.string().optional(), customerId: z.string().uuid().optional(), unitId: z.string().uuid().optional() });

export const GET = api({ perm: ["reservation.manage", "sale.view", "debt.view"], query: Q }, async ({ query, db }) => {
  const p: unknown[] = [];
  const c: string[] = [];
  if (query.status) { p.push(query.status.split(",")); c.push(`r.status = ANY($${p.length})`); }
  if (query.customerId) { p.push(query.customerId); c.push(`r.customer_id = $${p.length}`); }
  if (query.unitId) { p.push(query.unitId); c.push(`r.unit_id = $${p.length}`); }
  const items = await db((tx) =>
    tx.q(`SELECT r.id, r.code, r.status, r.doc_date AS "docDate", r.hold_until AS "holdUntil", (r.hold_until < app.today_vn() AND r.status IN ('active','expired')) AS overdue,
                 r.customer_id AS "customerId", c.full_name AS "customerName", c.phone AS "customerPhone", r.unit_id AS "unitId", u.asset_code AS "assetCode",
                 m.name AS "modelName", r.price_snapshot_vnd AS "priceSnapshot", r.min_deposit_vnd AS "minDeposit", b.paid_net AS "received", b.held,
                 r.applied_vnd AS applied, r.forfeited_vnd AS forfeited, r.sale_id AS "saleId", r.note, app.user_display_name(r.created_by) AS "createdByName"
          FROM public.reservations r JOIN public.customers c ON c.id = r.customer_id JOIN public.watch_units u ON u.id = r.unit_id
          JOIN public.watch_models m ON m.id = u.model_id LEFT JOIN public.v_doc_balances b ON b.doc_type = 'reservation' AND b.doc_id = r.id
          ${c.length ? "WHERE " + c.join(" AND ") : ""} ORDER BY (r.status IN ('active','expired')) DESC, r.hold_until, r.created_at DESC LIMIT 200`, p),
  );
  return { items };
});

// Giữ hàng + nhận cọc (BR-RSV-01/02)
export const POST = api({ perm: "reservation.manage", body: ReservationBody, idempotent: "required" }, async ({ body, db }) => {
  return db((tx) =>
    tx.fn("app.fn_create_reservation", [body.unitId, body.customerId, body.holdUntil ?? null, body.method, body.deposit, body.note ?? null, body.cashTendered ?? null]),
  );
});
