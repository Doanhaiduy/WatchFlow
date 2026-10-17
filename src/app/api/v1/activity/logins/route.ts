import { api } from "@/server/http";
import { ActivityQuery, listLogins } from "@/server/activity";

/** Lịch sử đăng nhập / sự kiện bảo mật tài khoản (đọc lại audit_logs action auth.*) — chỉ audit.view. */
export const GET = api({ perm: "audit.view", query: ActivityQuery }, async ({ query, db }) => db((tx) => listLogins(tx, query)));
