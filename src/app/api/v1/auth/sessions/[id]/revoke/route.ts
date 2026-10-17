import { api } from "@/server/http";
import { revokeSession } from "@/server/auth/service";
import { ApiError } from "@/server/errors";

export const POST = api({ auth: "auth" }, async ({ user, params }) => {
  if (!/^[0-9a-f-]{36}$/.test(params.id ?? "")) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy phiên.");
  if (!(await revokeSession(user.userId, params.id!))) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy phiên.");
  return { ok: true };
});
