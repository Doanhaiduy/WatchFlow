// Luồng nghiệp vụ chính qua giao diện: POS bán 1 chiếc (390px), tạo khách, nhận máy sửa, các màn báo cáo/hướng dẫn đạt axe.
import { test, expect } from "@playwright/test";
import { login, checkPage } from "./helpers";

test("POS: tìm chiếc → giỏ → thanh toán tiền mặt → màn kết quả có mã HD-", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "Luồng POS kiểm ở 390px");
  await login(page, "sales");
  await page.goto("/ban-hang/moi");
  await expect(page.getByRole("heading", { name: "Bán hàng", level: 1 })).toBeVisible();
  const row = page.locator(".wf-ir").first();
  await expect(row).toBeVisible();
  await row.click();
  const pay = page.getByRole("button", { name: "Thanh toán", exact: true });
  await expect(pay).toBeEnabled({ timeout: 20_000 });
  await pay.click();
  await page.getByRole("button", { name: /Xác nhận thu/ }).click();
  await expect(page.getByRole("heading", { name: /Phiếu HD-\d{4}-\d+/ })).toBeVisible({ timeout: 30_000 });
  await checkPage(page, info, "pos-ket-qua");
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

test("sửa chữa: nhận máy cho khách", async ({ page }, info) => {
  await login(page, "owner");
  await page.goto("/sua-chua/moi");
  await page.getByPlaceholder("Tìm tên hoặc số điện thoại…").fill("0901");
  const first = page.locator(".wf-ir").first();
  await first.waitFor({ timeout: 20_000 });
  await first.click();
  await page.getByRole("button", { name: "Tiếp", exact: true }).click();
  await page.getByLabel("Thương hiệu").fill("Seiko");
  await page.getByLabel("Loại / tên").fill("5 Sports");
  await page.getByRole("button", { name: "Tiếp", exact: true }).click();
  await page.getByLabel("Lỗi / yêu cầu của khách").fill("Chạy chậm, cần lau dầu");
  await page.getByRole("button", { name: "Tiếp", exact: true }).click();
  await page.getByRole("button", { name: "Tiếp", exact: true }).click();
  await page.getByRole("button", { name: /Nhận máy & lập phiếu/ }).click();
  await expect(page.getByText(/Đã nhận máy SC-/)).toBeVisible({ timeout: 30_000 });
  await checkPage(page, info, "sua-chua-da-nhan");
});

test("chủ cửa hàng: báo cáo, hướng dẫn, CTV, sửa chữa, kiểm kê đạt axe", async ({ page }, info) => {
  await login(page, "owner");
  for (const [path, name] of [["/bao-cao", "bao-cao"], ["/bao-cao/revenue", "bao-cao-revenue"], ["/huong-dan", "huong-dan"], ["/cong-tac-vien", "cong-tac-vien"],
    ["/sua-chua", "sua-chua"], ["/kiem-ke", "kiem-ke"], ["/quan-tri/he-thong", "qt-he-thong"], ["/thong-bao", "thong-bao"]] as const) {
    await page.goto(path);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    await checkPage(page, info, `owner-${name}`);
  }
});
