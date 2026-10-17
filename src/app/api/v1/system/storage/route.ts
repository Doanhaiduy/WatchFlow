import { api } from "@/server/http";
import { loadStorageSummary } from "@/server/storage-monitor";

// Dung lượng kho lưu trữ theo bucket, tăng trưởng/ngày, ước tính ngày đầy. Cần system.health (kiểm lại trong app.fn_storage_usage).
export const GET = api({ perm: ["system.health"] }, async ({ db }) => db((tx) => loadStorageSummary(tx)));
