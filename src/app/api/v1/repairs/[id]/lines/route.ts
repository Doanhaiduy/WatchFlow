import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { RepairLineBody } from "@/lib/types/repairs";

// Thêm khoản sửa: dịch vụ (giá mặc định theo loại việc) hoặc khoản khác (nhập nội dung + tiền). Đổi giá cần repair.price.edit (FR-REP-06/09)
export const POST = api({ perm: "repair.update", body: RepairLineBody }, async ({ params, body, db, can }) => {
  return db(async (tx) => {
    let def = 0;
    if (body.lineType === "service") {
      if (!body.serviceTypeId) throw new ApiError(422, "WF-VALIDATION", "Chọn loại việc.");
      def = (await tx.one<{ p: number }>("SELECT default_price_vnd AS p FROM public.service_types WHERE id = $1", [body.serviceTypeId]))?.p ?? 0;
    } else if (!body.description?.trim()) {
      throw new ApiError(422, "WF-VALIDATION", "Nhập nội dung khoản này.");
    }
    const price = body.unitPrice ?? def;
    if (body.lineType === "service" && price !== def && !can("repair.price.edit")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền sửa giá dòng sửa chữa.");
    const no = (await tx.one<{ n: number }>("SELECT coalesce(max(line_no),0)::int + 1 AS n FROM public.repair_lines WHERE order_id = $1", [params.id]))!.n;
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.repair_lines (order_id, line_no, line_type, service_type_id, description, qty, unit_price_vnd)
       VALUES ($1,$2,$3,$4,$5,1,$6) RETURNING id`,
      [params.id, no, body.lineType, body.lineType === "service" ? body.serviceTypeId : null, body.description ?? null, price]);
    return { id: r!.id };
  });
});
