import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { RepairLineBody } from "@/lib/types/repairs";

// Thêm dòng dịch vụ/linh kiện/chi phí khác. Giá mặc định: loại việc / giá bán linh kiện; đổi giá cần repair.price.edit (FR-REP-06/09)
export const POST = api({ perm: "repair.update", body: RepairLineBody }, async ({ params, body, db, can }) => {
  return db(async (tx) => {
    let def = 0;
    if (body.lineType === "service") {
      if (!body.serviceTypeId) throw new ApiError(422, "WF-VALIDATION", "Chọn loại việc.");
      def = (await tx.one<{ p: number }>("SELECT default_price_vnd AS p FROM public.service_types WHERE id = $1", [body.serviceTypeId]))?.p ?? 0;
    } else if (body.lineType === "part") {
      if (!body.partId) throw new ApiError(422, "WF-VALIDATION", "Chọn linh kiện.");
      def = (await tx.one<{ p: number }>("SELECT sale_price_vnd AS p FROM public.parts WHERE id = $1", [body.partId]))?.p ?? 0;
    }
    const price = body.unitPrice ?? def;
    if (price !== def && !can("repair.price.edit")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền sửa giá dòng sửa chữa.");
    const no = (await tx.one<{ n: number }>("SELECT coalesce(max(line_no),0)::int + 1 AS n FROM public.repair_lines WHERE order_id = $1", [params.id]))!.n;
    const r = await tx.one<{ id: string }>(
      `INSERT INTO public.repair_lines (order_id, line_no, line_type, service_type_id, part_id, description, qty, unit_price_vnd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [params.id, no, body.lineType, body.serviceTypeId ?? null, body.partId ?? null, body.description ?? null, body.qty, price]);
    return { id: r!.id };
  });
});
