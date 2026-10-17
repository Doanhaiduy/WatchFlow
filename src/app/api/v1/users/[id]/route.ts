import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { UpdateUserBody } from "@/lib/types/admin";

export const GET = api({ perm: "user.manage" }, async ({ params, db }) => {
  const u = await db((tx) =>
    tx.one(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.phone, u.status, u.must_change_password AS "mustChangePassword",
              u.mfa_enabled AS "mfaEnabled", u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt", u.version,
              coalesce((SELECT json_agg(r.code ORDER BY r.code) FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '[]') AS roles
       FROM public.users u WHERE u.id = $1`,
      [params.id],
    ),
  );
  if (!u) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy người dùng.");
  return u;
});

export const PATCH = api({ perm: "user.manage", body: UpdateUserBody }, async ({ req, params, body, db }) => {
  const ifMatch = req.headers.get("if-match");
  return db((tx) => tx.fn("app.fn_update_user", [params.id, body.fullName ?? null, body.phone ?? null, body.email ?? null, ifMatch ? Number(ifMatch) : null]));
});
