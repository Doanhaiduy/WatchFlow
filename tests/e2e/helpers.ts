// Tiện ích e2e: đăng nhập theo vai trò (owner kèm TOTP), quét axe, chụp ảnh màn hình theo dự án (390 / 1366).
import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TOTP, Secret } from "otpauth";
import pg from "pg";

type Acc = { password: string; totpSecret: string; users: { role: string; email: string; id: string }[] };
export const ACC: Acc = JSON.parse(process.env.E2E_ACCOUNTS ?? "{}");

async function resetTotpStep(email: string) {
  const c = new pg.Client({ connectionString: process.env.E2E_OWNER_DB_URL });
  await c.connect();
  try { await c.query("UPDATE public.user_mfa SET last_used_step = NULL WHERE user_id = (SELECT id FROM public.users WHERE email = $1)", [email]); } finally { await c.end(); }
}

export async function login(page: Page, role: "owner" | "sales" | "warehouse" | "collaborator") {
  const u = ACC.users.find((x) => x.role === role)!;
  await page.goto("/dang-nhap");
  await page.waitForLoadState("networkidle").catch(() => {});
  // Điền lại tới khi giá trị "dính" (trường hợp hydrate xong sau khi điền)
  let attempt = 0;
  await expect(async () => {
    // Dev server đôi khi chưa hydrate kịp (biên dịch lười): tải lại trang từ lần thử thứ 3
    if (attempt++ >= 3 && attempt % 3 === 1) { await page.reload(); await page.waitForLoadState("networkidle").catch(() => {}); }
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(ACC.password);
    await expect(page.getByRole("button", { name: /Đăng nhập/ })).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  if (role === "owner") {
    await resetTotpStep(u.email);
    await page.waitForURL(/xac-thuc-2-buoc/);
    const code = new TOTP({ secret: Secret.fromBase32(ACC.totpSecret), algorithm: "SHA1", digits: 6, period: 30 }).generate();
    await page.locator('input[autocomplete="one-time-code"]').first().click();
    await page.keyboard.type(code);
  }
  await page.waitForURL((url) => !/dang-nhap|xac-thuc-2-buoc/.test(url.pathname), { timeout: 30_000 });
}

/** Không tràn ngang + axe không có lỗi mức nghiêm trọng/critical + ảnh chụp */
export async function checkPage(page: Page, info: TestInfo, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} — ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  await info.attach(`axe-${name}.json`, { body: JSON.stringify(res.violations, null, 1), contentType: "application/json" });
  await page.screenshot({ path: `test-results/screens/${info.project.name}/${name}.png`, fullPage: true });
  expect(summary, `${name}: axe`).toEqual([]);
}
