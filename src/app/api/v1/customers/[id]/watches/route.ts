import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { CustomerWatchBody } from "@/lib/types/customers";

export const GET = api({ perm: ["customer.view", "customer.view_own"] }, async ({ params, db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT w.id, w.brand_text AS "brandText", w.model_text AS "modelText", w.serial_no AS "serialNo", w.unit_id AS "unitId", w.note, w.created_at AS "createdAt"
          FROM public.customer_watches w WHERE w.customer_id = $1 ORDER BY w.created_at DESC`, [params.id]),
  );
  return { items };
});

export const POST = api({ perm: ["customer.create", "customer.manage"], body: CustomerWatchBody }, async ({ params, body, db }) => {
  if (!body.brandText && !body.modelText && !body.serialNo) throw new ApiError(422, "WF-VALIDATION", "Nhập ít nhất thương hiệu, loại hoặc serial.");
  const r = await db((tx) =>
    tx.one<{ id: string }>(
      `INSERT INTO public.customer_watches (customer_id, brand_text, model_text, serial_no, note, created_by)
       VALUES ($1,$2,$3,$4,$5, app.current_user_id()) RETURNING id`,
      [params.id, body.brandText ?? null, body.modelText ?? null, body.serialNo ?? null, body.note ?? null],
    ),
  );
  return { id: r!.id };
});
