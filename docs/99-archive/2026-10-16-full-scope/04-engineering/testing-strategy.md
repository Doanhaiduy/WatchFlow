# Chiến lược kiểm thử

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Danh mục ca cụ thể: `06-quality/test-plan`, `golden-scenarios`

## 1. Nguyên tắc

1. **Test chạy trên PostgreSQL thật dưới vai trò `wf_app`** (không superuser, không mock DB). Quy tắc nghiệp vụ nằm trong DB nên test DB là test chính.
2. **Ví dụ số trong docs thành test** (kịch bản vàng): số trong `golden-scenarios` là kết quả mong đợi; code khác số ⇒ lỗi.
3. **Mỗi request đồng thời là một kết nối riêng** (smoke test một phiên không thấy race — bài học dự án mẫu: 13/13 ca đồng thời thất bại trên DB gốc).
4. **Test phải có khả năng thất bại**: với CT/PT, có ít nhất một lần chạy "đột biến" (bỏ khóa/ràng buộc/RLS cố ý) để chứng minh test bắt được lỗi.
5. Không gọi dịch vụ ngoài khi test (máy chủ giả loopback; `AI_OFFLINE=1`). Thời gian: mọi `fn_*` lấy "hôm nay" từ `app.today_vn()`; DB test đặt đồng hồ giả bằng `SET app.test_today = '2026-11-03'` (chỉ có hiệu lực ở DB test, production bỏ qua) để chạy kịch bản vàng có ngày cố định (hạn đổi trả, khóa kỳ, tồn lâu…).
6. Test chạy lại được trên DB đã từng chạy (tên/thời gian duy nhất, tự dọn) hoặc dựng DB sạch mỗi lần.

## 2. Kim tự tháp

| Tầng | Công cụ | Phạm vi | Chạy ở |
|---|---|---|---|
| Đơn vị | `vitest` | `lib/money.ts` (làm tròn, `allocate`), `lib/dates.ts`, định dạng, tính hạn mức giảm giá, chuẩn hóa serial/điện thoại, ánh xạ lỗi | PR, CI |
| Cấu trúc DB | `pnpm db:audit` | Mọi bảng RLS + FORCE; hàm `SECURITY DEFINER` có `search_path`; quyền `anon/authenticated` = 0; FK có index; owner đúng; permission seed = hằng TS | PR, CI |
| Hàm DB / tích hợp API | `scripts/test-api` (harness: `as(user)`, `test`, `eq`, `ok`, `section`) | Từng `fn_*` + endpoint: thành công, từ chối quyền, sai trạng thái, idempotency | PR, CI |
| **Kịch bản vàng (SC)** | `scripts/test-api/sc-*.mjs` | Chuỗi nghiệp vụ có số liệu; kiểm kho, tiền, giá vốn, công nợ, báo cáo | PR, CI |
| **Đồng thời (CT)** | `scripts/test-api/ct-*.mjs` | `Promise.all` nhiều kết nối; kiểm đúng một bên thắng + `fn_consistency_check()` sạch | PR (bộ nhanh), nightly (đầy đủ) |
| **Phân quyền (PT)** | `scripts/test-api/pt-*.mjs` | Ma trận vai trò × endpoint/báo cáo/xuất file; truy vấn trực tiếp dưới `wf_app` | PR, CI |
| E2E giao diện | Playwright (mobile 390px + desktop) | POS bán nhanh, nhận máy sửa, nhập hàng, thu nợ, chốt ngày; a11y (axe); chụp ảnh sáng/tối | Trước phát hành |
| Tải nhẹ | script riêng | POS với 20 người dùng đồng thời, báo cáo nặng | Trước go-live |
| Khôi phục | thủ công + script | Dựng DB từ bản sao lưu, đăng nhập, chạy `fn_consistency_check` | Trước go-live, hằng quý |

## 3. Harness `test-api` (port từ Lưu Xá)

- `node --no-warnings scripts/test-api.mjs` dựng DB thử `watchflow_test` (migrate + seed tối thiểu) và máy chủ Next thử (cổng 3100) rồi chạy các bộ; `-- --serve` giữ máy chủ; `-- --no-server --db watchflow_test --only <tiền-tố>` chạy nhanh một bộ.
- Mỗi bộ export `async function run({ as, test, eq, ok, section, BASE, Client, pgConfig })`.
  - `as("sales")` đăng nhập tài khoản demo theo vai trò và trả client HTTP có cookie + CSRF.
  - `Client`/`pgConfig` để mở kết nối DB **riêng** cho CT và để kiểm số liệu trực tiếp (đọc bằng vai trò `wf_worker`/kiểm tra, ghi bằng API).
- Helper có sẵn: `seedUnit({model, cost,…})` (tạo chiếc qua phiếu nhập thật), `seedPart`, `seedCustomer`, `openAccount`, `confirmPurchase`, `confirmSale`…; không chèn SQL thẳng vào bảng nghiệp vụ để dựng tiền đề (phải đi qua `fn_*` để giữ bất biến).
- Mỗi bộ SC kết thúc bằng `await consistency()` ⇒ gọi `app.fn_consistency_check()` và khẳng định không vi phạm.

## 4. Kịch bản vàng (SC) — cách viết

1. Dựng tiền đề bằng helper (ngày cố định, giá cố định).
2. Thực hiện từng bước qua API như người dùng.
3. Sau **mỗi bước** khẳng định: trạng thái chiếc, tồn linh kiện, số dư từng quỹ, công nợ, giá vốn, doanh thu/lãi từ `rpt_*`.
4. Cuối cùng khẳng định hằng đẳng thức chính (vd. Doanh thu − Thực thu = Δ công nợ) và `consistency()`.
Số mong đợi lấy từ `golden-scenarios` (copy nguyên, ghi ID trong tên test).

## 5. Đồng thời (CT) — cách viết

```js
// ví dụ CT-01
const units = await seedUnit({ cost: 6_000_000, price: 8_500_000 });
const [a, b] = await Promise.allSettled([
  confirmSaleAs("sales", { unit: units.id, customer: c1 }),   // mỗi lời gọi một kết nối + một phiên HTTP
  confirmSaleAs("owner", { unit: units.id, customer: c2 }),
]);
ok(count(a, b, "fulfilled") === 1 && count(a, b, "rejected") === 1);
eq(await unitStatus(units.id), "sold");
eq(await effectiveSaleLines(units.id), 1);
await consistency();
```
Chạy lặp (vd. 20 lần) để bắt race hiếm; ca nhanh trong PR, ca đầy đủ ban đêm.

## 6. Phân quyền (PT)

- Ma trận sinh từ `security-model`: với mỗi vai trò × (endpoint nhạy cảm, báo cáo, xuất file, in PDF) khẳng định `200` + **không có trường nhạy cảm** hoặc `403`.
- Kiểm trực tiếp dưới `wf_app`: không `set app.current_user_id` ⇒ 0 dòng ở **mọi bảng** `public`; thử `UPDATE/DELETE/TRUNCATE` bảng bất biến ⇒ lỗi; thử `UPDATE watch_units SET status=…` trực tiếp ⇒ lỗi; mass-assignment (tự đổi vai trò, trạng thái, `paid`, `amount_due`) ⇒ lỗi.
- Test sinh tự động duyệt `permissions` seed để mỗi quyền nhạy cảm có ít nhất một ca PT.

## 7. CI (GitHub Actions)

Mỗi PR/push: cài đặt → `typecheck` → `lint` → `vitest` → dựng PostgreSQL 16 dịch vụ → `db:migrate` hai lần (idempotent) → `db:audit` → `test:api` (bộ SC + PT + CT nhanh) → `build`. Nightly: CT đầy đủ (lặp), `fn_consistency_check`, kiểm link docs. Kết quả lỗi chặn gộp PR.

## 8. Dữ liệu thử

- **Seed demo** (`db/seed/`): 5 tài khoản/vai trò, ~12 loại đồng hồ/20 chiếc nhiều trạng thái, 30 linh kiện, 10 khách, 3 NCC, 2 quỹ, vài phiếu bán/nhập/sửa — đủ để thử tay và chụp màn hình; **khớp** các tiền đề của kịch bản vàng khi có thể.
- **Không bao giờ** seed demo lên production; kiểm trong `seed.mjs` (từ chối nếu `--env production`).
- Go-live: dữ liệu thật nhập bằng quy trình thật (phiếu nhập `opening`, số dư đầu kỳ quỹ), có biên bản đối chiếu với kiểm kê vật lý.

## 9. Báo cáo kết quả

Mỗi bản phát hành lưu `reports/test-<version>.md` (tự sinh): số ca đạt/tổng theo SC/CT/PT, danh sách lỗi đã biết, thời gian. Là tài liệu đầu vào cho UAT và kiểm định độc lập (`06-quality/uat-acceptance`).
