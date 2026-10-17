import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { RoleBody } from "@/lib/types/admin";

export const GET = api({}, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT r.id, r.code, r.name_vi AS "nameVi", r.description, r.is_system AS "isSystem", r.max_discount_pct::float AS "maxDiscountPct",
                 r.is_active AS "isActive", r.version,
                 coalesce((SELECT json_agg(rp.permission_code ORDER BY rp.permission_code) FROM public.role_permissions rp WHERE rp.role_id = r.id), '[]') AS permissions
          FROM public.roles r ORDER BY r.is_system DESC, r.name_vi`),
  );
  return { items };
});

export const POST = api({ perm: "role.manage", body: RoleBody }, async ({ body, db, requireReauth }) => {
  requireReauth();
  if (!body.code || !body.nameVi) throw new ApiError(422, "WF-VALIDATION", "Nhập mã và tên vai trò.");
  const id = await db((tx) =>
    tx.fn<string>("app.fn_upsert_role", [null, body.code, body.nameVi, body.description ?? null, body.maxDiscountPct ?? 0, body.isActive ?? true]),
  );
  return { id };
});
