import crypto from "node:crypto";
import { api } from "@/server/http";
import { hashPassword } from "@/server/auth/password";
import { CreateUserBody, Paging } from "@/lib/types/admin";

export const GET = api({ perm: "user.manage", query: Paging }, async ({ query, db }) => {
  return db(async (tx) => {
    const off = (query.page - 1) * query.pageSize;
    const p: unknown[] = [];
    let where = "";
    if (query.q) {
      p.push(query.q);
      where = "WHERE u.search_text LIKE '%' || app.norm_text($1) || '%'";
    }
    const items = await tx.q(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.phone, u.status, u.must_change_password AS "mustChangePassword",
              u.mfa_enabled AS "mfaEnabled", u.last_login_at AS "lastLoginAt", u.version,
              coalesce((SELECT json_agg(r.code ORDER BY r.code) FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id), '[]') AS roles
       FROM public.users u ${where} ORDER BY u.full_name LIMIT ${query.pageSize} OFFSET ${off}`,
      p,
    );
    const total = (await tx.one<{ n: number }>(`SELECT count(*)::int n FROM public.users u ${where}`, p))?.n ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total };
  });
});

export const POST = api({ perm: "user.manage", body: CreateUserBody, idempotent: "optional" }, async ({ body, db }) => {
  // Mật khẩu tạm do máy sinh — hiện MỘT lần cho người tạo; người dùng buộc đổi ở lần đăng nhập đầu
  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const hash = await hashPassword(tempPassword);
  const id = await db((tx) => tx.fn<string>("app.fn_create_user", [body.email, body.fullName, body.phone ?? null, hash, body.roles]));
  return { id, tempPassword };
});
