import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { pushConfigured } from "@/server/push";

const B64 = /^[A-Za-z0-9_-]+={0,2}$/;
const Sub = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(20).max(200).regex(B64), auth: z.string().min(8).max(100).regex(B64) }),
});

/** Đăng ký thiết bị (trình duyệt) này nhận thông báo đẩy. Cùng endpoint đã thuộc người khác ⇒ chuyển cho người đăng nhập (máy dùng chung). */
export const POST = api({ body: Sub }, async ({ body, db, userAgent }) => {
  if (!pushConfigured()) throw new ApiError(503, "WF-PUSH-DISABLED", "Máy chủ chưa bật thông báo đẩy.");
  const id = await db((tx) => tx.fn<string>("app.fn_register_push_subscription", [body.endpoint, body.keys.p256dh, body.keys.auth, userAgent]));
  return { id };
});

const Del = z.object({ endpoint: z.string().max(1000) });

/** Hủy đăng ký thiết bị CỦA MÌNH theo endpoint (không có/không phải của mình ⇒ removed=false, không lộ thiết bị người khác). */
export const DELETE = api({ body: Del }, async ({ body, db }) => {
  const removed = await db((tx) => tx.fn<boolean>("app.fn_remove_push_subscription", [body.endpoint]));
  return { removed };
});
