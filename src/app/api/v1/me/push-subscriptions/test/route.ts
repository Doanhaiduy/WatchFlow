import { api } from "@/server/http";
import { sendTestPush } from "@/server/push";

/** "Gửi thử": gửi một thông báo thử tới các thiết bị đang bật của chính mình. Chỉ chạy khi máy chủ có khóa VAPID. */
export const POST = api({}, async ({ user }) => sendTestPush(user.userId));
