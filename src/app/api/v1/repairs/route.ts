import { api } from "@/server/http";
import { REPAIR_LIST_SELECT } from "@/server/repairs";
import { CreateRepairBody, RepairListQuery } from "@/lib/types/repairs";

export const GET = api({ perm: "repair.view", query: RepairListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = [];
    if (query.status) { p.push(query.status.split(",")); c.push(`o.status = ANY($${p.length})`); }
    if (query.kind) { p.push(query.kind); c.push(`o.kind = $${p.length}`); }
    if (query.q) {
      p.push(query.q);
      const i = p.length;
      c.push(`(o.code = upper($${i}) OR c.search_text LIKE '%' || app.norm_text($${i}) || '%' OR c.phone_norm = app.norm_phone($${i})
               OR u.asset_code = upper($${i}) OR u.serial_norm = app.norm_serial($${i}) OR cw.serial_norm = app.norm_serial($${i}))`);
    }
    const where = c.length ? "WHERE " + c.join(" AND ") : "";
    const items = await tx.q(`${REPAIR_LIST_SELECT} ${where} ORDER BY (o.status IN ('delivered','cancelled')), o.received_at DESC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const counts = await tx.q<{ status: string; n: number }>("SELECT status, count(*)::int n FROM public.repair_orders GROUP BY status");
    return { items, counts: Object.fromEntries(counts.map((x) => [x.status, x.n])), page: query.page, pageSize: query.pageSize };
  });
});

// Nhận máy (FR-REP-01…05): khách + máy + tình trạng + lỗi; ảnh tùy chọn (tải sau khi có id); cọc tùy chọn
export const POST = api({ perm: "repair.create", body: CreateRepairBody, idempotent: "required" }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_create_repair", [JSON.stringify(body)]));
});
