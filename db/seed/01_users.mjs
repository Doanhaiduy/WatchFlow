// Seed demo: 4 tài khoản (owner, sales, warehouse, collaborator). Owner đã bật TOTP (khóa trong .local/demo-accounts.txt).
import crypto from "node:crypto";
import { hash } from "@node-rs/argon2";
import { Secret } from "otpauth";
import { encrypt } from "../../scripts/lib/crypto.mjs";

export const DEMO_USERS = [
  { role: "owner", email: "chu@watchflow.local", name: "Trần Minh Chủ", phone: "0901000001" },
  { role: "sales", email: "banhang@watchflow.local", name: "Lê Thu Bán", phone: "0901000002" },
  { role: "warehouse", email: "kho@watchflow.local", name: "Phạm Văn Kho", phone: "0901000003" },
  { role: "collaborator", email: "ctv@watchflow.local", name: "Võ Thị Cộng Tác", phone: "0901000004" },
  { role: "collaborator", email: "ctv2@watchflow.local", name: "Đặng Hữu Tác", phone: "0901000005" },
];

export default async function (c, ctx) {
  const pwHash = await hash(ctx.accounts.password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  ctx.accounts.users = [];
  for (const u of DEMO_USERS) {
    const r = await c.query(
      `INSERT INTO public.users (email, full_name, phone, password_hash, must_change_password, email_verified_at, password_changed_at)
       VALUES ($1,$2,$3,$4,false,now(),now())
       ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, must_change_password=false, status='active',
         failed_login_count=0, locked_until=NULL
       RETURNING id`, [u.email, u.name, u.phone, pwHash]);
    const id = r.rows[0].id;
    await c.query(`INSERT INTO public.user_roles (user_id, role_id) SELECT $1, id FROM public.roles WHERE code=$2 ON CONFLICT DO NOTHING`, [id, u.role]);
    ctx.accounts.users.push({ role: u.role, email: u.email, id });
  }
  // TOTP cho owner
  const owner = ctx.accounts.users.find((u) => u.role === "owner");
  if (!ctx.accounts.totpSecret) ctx.accounts.totpSecret = new Secret({ size: 20 }).base32;
  if (!ctx.accounts.recoveryCodes) ctx.accounts.recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex"));
  const enc = encrypt(ctx.accounts.totpSecret, ctx.env.PII_KEY_V1);
  const codes = ctx.accounts.recoveryCodes.map((x) => crypto.createHash("sha256").update(x).digest("hex"));
  await c.query(
    `INSERT INTO public.user_mfa (user_id, totp_secret_enc, enabled_at, recovery_codes_hash) VALUES ($1,$2,now(),$3)
     ON CONFLICT (user_id) DO UPDATE SET totp_secret_enc=EXCLUDED.totp_secret_enc, enabled_at=now(), recovery_codes_hash=EXCLUDED.recovery_codes_hash, last_used_step=NULL`,
    [owner.id, enc, codes]);
  await c.query(`UPDATE public.users SET mfa_enabled=true WHERE id=$1`, [owner.id]);
  await c.query(`UPDATE public.settings SET value='"Đồng Hồ Minh Châu (demo)"' WHERE key='store.name'`);
  await c.query(`UPDATE public.settings SET value='"12 Lê Lợi, Q.1, TP.HCM"' WHERE key='store.address'`);
  await c.query(`UPDATE public.settings SET value='"0909 123 456"' WHERE key='store.phone'`);
}
