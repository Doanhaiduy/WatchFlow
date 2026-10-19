// Luồng nghiệp vụ chính qua giao diện (bản gọn, CF-13…18): ghi đơn bán (390px), tạo khách, nhận máy sửa, CTV báo bán, các màn báo cáo/hướng dẫn đạt axe.
import { test, expect } from "@playwright/test";
import { login, checkPage } from "./helpers";

test("ghi đơn bán: chọn chiếc → nhập khách → lưu → màn đơn có mã HD-", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "Luồng ghi đơn kiểm ở 390px");
  await login(page, "sales");
  await page.goto("/ban-hang/moi");
  await expect(page.getByRole("heading", { name: "Ghi đơn bán", level: 1 })).toBeVisible();
  const row = page.locator(".wf-ir").first();
  await expect(row).toBeVisible();
  await row.click();
  await page.getByLabel("Họ tên khách").fill(`Khách e2e ${Date.now().toString().slice(-6)}`);
  const save = page.getByRole("button", { name: /^Lưu đơn/ });
  await expect(save).toBeEnabled({ timeout: 20_000 });
  await save.click();
  await expect(page).toHaveURL(/\/ban-hang\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /HD-\d{4}-\d+/ })).toBeVisible();
  await checkPage(page, info, "don-ban-ket-qua");
});

test("khách hàng: tạo nhanh rồi mở hồ sơ", async ({ page }, info) => {
  await login(page, "sales");
  await page.goto("/khach-hang");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const name = `Khách thử ${Date.now().toString().slice(-6)}`;
  await page.getByLabel("Họ tên").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(page).toHaveURL(/\/khach-hang\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await checkPage(page, info, "khach-hang-chi-tiet");
});

test("sửa chữa: nhận máy cho khách (một trang)", async ({ page }, info) => {
  await login(page, "owner");
  await page.goto("/sua-chua/moi");
  await page.getByLabel("Họ tên khách").fill(`Khách sửa ${Date.now().toString().slice(-6)}`);
  await page.getByPlaceholder("0901 234 567").fill("0977123456").catch(() => page.getByLabel("Số điện thoại").fill("0977123456"));
  await page.getByLabel("Thương hiệu").fill("Seiko");
  await page.getByLabel("Loại / tên").fill("5 Sports");
  await page.getByLabel("Lỗi / yêu cầu của khách").fill("Chạy chậm, cần lau dầu");
  await page.getByRole("button", { name: /Nhận máy & lập phiếu/ }).click();
  await expect(page.getByText(/Đã nhận máy SC-/)).toBeVisible({ timeout: 30_000 });
  await checkPage(page, info, "sua-chua-da-nhan");
});

test("chủ cửa hàng: báo cáo, hướng dẫn, CTV, sửa chữa đạt axe", async ({ page }, info) => {
  await login(page, "owner");
  for (const [path, name] of [["/bao-cao", "bao-cao"], ["/bao-cao/revenue", "bao-cao-revenue"], ["/bao-cao/collab", "bao-cao-collab"], ["/huong-dan", "huong-dan"],
    ["/cong-tac-vien", "cong-tac-vien"], ["/cong-tac-vien/giao-hang", "ctv-giao-hang"], ["/cong-tac-vien/bao-ban", "ctv-bao-ban"],
    ["/sua-chua", "sua-chua"], ["/quan-tri/nhat-ky", "qt-nhat-ky"], ["/quan-tri/he-thong", "qt-he-thong"], ["/thong-bao", "thong-bao"]] as const) {
    await page.goto(path);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    await checkPage(page, info, `owner-${name}`);
  }
});
