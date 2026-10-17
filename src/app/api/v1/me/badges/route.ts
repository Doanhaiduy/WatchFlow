import { api } from "@/server/http";
import { loadBadges } from "@/server/badges";

// Số việc cần xử lý theo quyền (huy hiệu dock/sidebar/menu). Nhẹ: vài truy vấn đếm; làm mới 60 giây ở client.
export const GET = api({}, async ({ db, can }) => db((tx) => loadBadges(tx, can)));
