// Tạo chủ cửa hàng đầu tiên (mật khẩu tạm, buộc đổi lần đầu, bắt đầu TOTP). Dùng: node scripts/env/bootstrap-owner.mjs --env <env> --email … --name …
// Chạy bằng chuỗi chủ DB. Từ chối nếu đã có owner hoạt động. In mật khẩu tạm MỘT lần ra màn hình.
import crypto from "node:crypto";
import { hash } from "@node-rs/argon2";
import { argValue } from "../lib/env.mjs";
import { ownerUrl, connect, targetEnv } from "../lib/db.mjs";

const email = argValue("--email");
const name = argValue("--name");
if (!email || !name) { console.error("Dùng: --email <email> --name <họ tên>"); process.exit(1); }
const c = await connect(ownerUrl({ env: targetEnv() }));
try {
  const has = await c.query("SELECT 1 FROM public.users u JOIN public.user_roles ur ON ur.user_id=u.id JOIN public.roles r ON r.id=ur.role_id WHERE r.code='owner' AND u.status='active'");
  if (has.rowCount) { console.error("Đã có chủ cửa hàng hoạt động — dùng giao diện Quản trị để thêm người."); process.exit(1); }
  const temp = crypto.randomBytes(10).toString("base64url");
  const pwHash = await hash(temp, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await c.query("BEGIN");
  const r = await c.query("INSERT INTO public.users (email, full_name, password_hash, must_change_password) VALUES ($1,$2,$3,true) RETURNING id", [email, name, pwHash]);
  await c.query("INSERT INTO public.user_roles (user_id, role_id) SELECT $1, id FROM public.roles WHERE code='owner'", [r.rows[0].id]);
  await c.query("INSERT INTO public.audit_logs (action, entity_table, entity_id, level) VALUES ('user.bootstrap_owner','users',$1,'high')", [r.rows[0].id]);
  await c.query("COMMIT");
  console.log(`✔ Đã tạo chủ cửa hàng ${email}. Mật khẩu tạm (hiện một lần): ${temp}\nĐăng nhập → đổi mật khẩu → thiết lập xác thực 2 bước.`);
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
