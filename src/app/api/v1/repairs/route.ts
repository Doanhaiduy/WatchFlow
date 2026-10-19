import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { REPAIR_LIST_SELECT } from "@/server/repairs";
import { CreateRepairBody, RepairListQuery } from "@/lib/types/repairs";

// Sửa chữa chỉ dành cho chủ (repair.*). Danh sách chỉ phiếu của khách (phiếu "sửa nội bộ" cũ không còn hiện).
export const GET = api({ perm: "repair.view", query: RepairListQuery }, async ({ query, db }) => {
  return db(async (tx) => {
    const p: unknown[] = [];
    const c: string[] = ["o.kind = 'customer'"];
    if (query.status) { p.push(query.status.split(",")); c.push(`o.status = ANY($${p.length})`); }
    if (query.customerId) { p.push(query.customerId); c.push(`o.customer_id = $${p.length}`); }
    if (query.q) {
      p.push(query.q);
      const i = p.length;
      c.push(`(o.code = upper($${i}) OR c.search_text LIKE '%' || app.norm_text($${i}) || '%' OR c.phone_norm = app.norm_phone($${i})
               OR u.asset_code = upper($${i}) OR u.serial_norm = app.norm_serial($${i}) OR cw.serial_norm = app.norm_serial($${i}))`);
    }
    const where = "WHERE " + c.join(" AND ");
    const items = await tx.q(`${REPAIR_LIST_SELECT} ${where} ORDER BY (o.status IN ('delivered','cancelled')), o.received_at DESC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, p);
    const counts = await tx.q<{ status: string; n: number }>("SELECT status, count(*)::int n FROM public.repair_orders WHERE kind = 'customer' GROUP BY status");
    return { items, counts: Object.fromEntries(counts.map((x) => [x.status, x.n])), page: query.page, pageSize: query.pageSize };
  });
});

// Nhận máy: khách (có SĐT) + máy + tình trạng + lỗi + hẹn trả. Khách mới nhập ngay trên form (dùng lại khách trùng SĐT).
export const POST = api({ perm: "repair.create", body: CreateRepairBody, idempotent: "required" }, async ({ body, db, can }) => {
  return db(async (tx) => {
    let customerId = body.customerId ?? null;
    if (!customerId) {
      const c = body.customer!;
      const dup = await tx.one<{ id: string }>("SELECT id FROM public.customers WHERE phone_norm = app.norm_phone($1) AND anonymized_at IS NULL ORDER BY created_at LIMIT 1", [c.phone]);
      if (dup) customerId = dup.id;
      else {
        if (!can("customer.create")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền tạo khách hàng mới.");
        customerId = (await tx.one<{ id: string }>("INSERT INTO public.customers (full_name, phone, created_by) VALUES ($1,$2, app.current_user_id()) RETURNING id", [c.fullName, c.phone]))!.id;
      }
    }
    const payload = {
      kind: "customer", chargeMode: body.warrantyId ? "warranty_free" : "paid", warrantyId: body.warrantyId ?? null,
      customerId, customerWatchId: body.customerWatchId ?? null,
      brandText: body.customerWatchId ? null : body.brandText ?? null, modelText: body.customerWatchId ? null : body.modelText ?? null, serialNo: body.customerWatchId ? null : body.serialNo ?? null,
      intakeCondition: body.intakeCondition ?? null, complaint: body.complaint, expectedDate: body.expectedDate ?? null,
    };
    return tx.fn("app.fn_create_repair", [JSON.stringify(payload)]);
  });
});
