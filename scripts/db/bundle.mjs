// Dựng DB MỚI hoàn toàn từ đầu (môi trường mới): áp mọi migration theo thứ tự + đặt mật khẩu wf_api, rồi ghi app_migrations.
// Dùng: node scripts/db/bundle.mjs --apply <chuỗi chủ DB> [--allow-remote] --api-password <mật khẩu wf_api>
// (staging/production ở máy công ty: ⏭ cloud)
import { argValue, hasFlag, assertLocalUrl } from "../lib/env.mjs";
import { migrate } from "./migrate.mjs";

const url = argValue("--apply");
const apiPassword = argValue("--api-password");
if (!url || !apiPassword) { console.error("Dùng: --apply <chuỗi chủ DB> --api-password <mật khẩu> [--allow-remote]"); process.exit(1); }
assertLocalUrl(url, { allowRemote: hasFlag("--allow-remote") });
migrate({ url, apiPassword }).then((n) => console.log(`✔ Đã dựng DB (${n} migration).`)).catch((e) => { console.error(e.message); process.exit(1); });
