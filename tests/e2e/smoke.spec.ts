// Kiểm giao diện theo vai trò ở 390px và 1366px: đăng nhập thật, mở các màn chính, không tràn ngang, axe, ảnh chụp (ui-design-system §11).
import { test, expect } from "@playwright/test";
import { login, checkPage } from "./helpers";

test("đăng nhập: trang công khai đạt axe", async ({ page }, info) => {
  await page.goto("/dang-nhap");
  await expect(page.getByLabel("Email")).toBeVisible();
  await checkPage(page, info, "dang-nhap");
});

test("chủ cửa hàng: các màn chính", async ({ page }, info) => {
  await login(page, "owner");
  for (const [path, name] of [["/", "tong-quan"], ["/dong-ho", "dong-ho"], ["/dong-ho/moi", "them-dong-ho"], ["/ban-hang", "ban-hang"], ["/ban-hang/moi", "ghi-don"],
    ["/khach-hang", "khach-hang"], ["/cong-tac-vien", "cong-tac-vien"], ["/sua-chua/moi", "nhan-may-sua"], ["/nhap-excel", "nhap-excel"],
    ["/quan-tri/nguoi-dung", "qt-nguoi-dung"], ["/quan-tri/vai-tro", "qt-vai-tro"], ["/cai-dat", "cai-dat"]] as const) {
    await page.goto(path);
    await expect(page.locator("main, [role=main]").first()).toBeVisible();
    await checkPage(page, info, `owner-${name}`);
  }
});

test("nhân viên bán hàng: không thấy mục quản trị/giá vốn", async ({ page }, info) => {
  await login(page, "sales");
  await page.goto("/dong-ho");
  await checkPage(page, info, "sales-dong-ho");
  await expect(page.getByText(/Giá thu|Giá vốn/)).toHaveCount(0);
  await page.goto("/quan-tri/nguoi-dung");
  await expect(page.getByText(/không có quyền/i)).toBeVisible();
});

test("cộng tác viên: các màn của tôi, không có doanh thu/giá vốn", async ({ page }, info) => {
  await login(page, "collaborator");
  await expect(page).toHaveURL(/\/ctv/);
  await checkPage(page, info, "ctv-trang-chu");
  for (const [path, name] of [["/ctv/don", "ctv-bao-ban"], ["/ctv/thong-ke", "ctv-thong-ke"]] as const) {
    await page.goto(path);
    await checkPage(page, info, name);
  }
  await expect(page.getByText(/Doanh thu|Giá vốn|Giá thu|Lãi/)).toHaveCount(0);
});
