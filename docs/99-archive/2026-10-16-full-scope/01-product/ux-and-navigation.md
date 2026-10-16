# Trải nghiệm & điều hướng

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Nháp (chốt khi dựng giao diện ở mỗi mốc) · Thiết bị: điện thoại + máy tính, chỉ trình duyệt (PWA)

## 1. Nguyên tắc "dễ dùng"

1. **Mobile-first, một tay.** Thiết kế ở 390px trước; thao tác chính nằm trong tầm ngón cái (thanh điều hướng dưới, nút hành động nổi/thanh dưới).
2. **Ba chạm.** Bán nhanh, tra cứu chiếc, nhận máy sửa, thu nợ: tối đa 3 chạm từ trang chủ.
3. **Một ô tìm kiếm cho tất cả** (mã nội bộ, serial, tên, thương hiệu, SĐT khách, mã phiếu) + nút **quét QR**. Không dấu, gõ sai nhẹ vẫn ra.
4. **Ít gõ.** Giá trị mặc định thông minh (giá hiệu lực, ngày hôm nay, quỹ gần nhất), nhớ lựa chọn gần đây, chọn thay vì nhập, tạo nhanh khách/NCC tại chỗ.
5. **Nói tiếng người.** Nhãn tiếng Việt thường dùng ở cửa hàng ("Sẵn sàng bán", "Chờ kiểm tra"), không lộ mã kỹ thuật; lỗi nêu *chuyện gì* + *làm gì tiếp* (và mã `WF-…` nhỏ ở cuối để hỗ trợ).
6. **Không mất việc.** Nháp tự lưu liên tục (cục bộ + máy chủ), mất mạng có biểu ngữ và nút xác nhận bị khóa, gửi lại an toàn.
7. **Rõ ràng về tiền.** Tiền luôn định dạng `8.200.000 ₫`, cỡ chữ lớn ở tổng phải trả; màu *chỉ* hỗ trợ (đỏ = nợ/cảnh báo, xanh = đã thu); luôn có chữ đi kèm (không chỉ màu).
8. **Hành động nguy hiểm tách riêng.** Hủy/đảo/tịch thu: hộp xác nhận nêu hậu quả bằng số ("Sẽ hoàn 8.200.000 ₫ và trả máy về kho") + bắt lý do.
9. **Sáng/tối**, chữ ≥ 16px trên input (tránh iOS tự phóng), vùng chạm ≥ 44px, tương phản đạt WCAG AA.
10. **Trống thì hướng dẫn.** Màn hình trống có câu "Bạn chưa có … — Bắt đầu bằng …" + nút hành động.

## 2. Vai trò & nơi đến đầu tiên

| Vai trò | Trang chủ (sau đăng nhập) | Thanh điều hướng dưới (điện thoại) |
|---|---|---|
| Chủ cửa hàng | Tổng quan đầy đủ | Tổng quan · Bán hàng · Đồng hồ · Thu chi · Thêm |
| Nhân viên bán hàng | Tìm kiếm + Bán nhanh | Bán hàng · Đồng hồ · Khách · Sửa chữa · Thêm |
| Quản lý kho | Việc kho | Nhập hàng · Đồng hồ · Linh kiện · Kiểm kê · Thêm |
| Thợ sửa chữa | Việc của tôi | Việc của tôi · Linh kiện · Thêm |
| Cộng tác viên | Hàng đang bán | Hàng · Đơn của tôi · Hoa hồng |

Thanh dưới hiển thị theo **quyền** (không theo tên vai trò); mục "Thêm" mở danh sách đầy đủ theo quyền.

## 3. Sơ đồ trang (đường dẫn tiếng Việt, mã nguồn tiếng Anh)

| Đường dẫn | Màn hình | Quyền vào | Module |
|---|---|---|---|
| `/dang-nhap`, `/doi-mat-khau`, `/xac-thuc-2-buoc` | Đăng nhập, đổi mật khẩu, TOTP | công khai | iam |
| `/` | Tổng quan (theo vai trò) | đã đăng nhập | reports |
| `/dong-ho` · `/dong-ho/[id]` · `/dong-ho/moi` | Danh sách/chi tiết/thêm chiếc (ảnh, giá, lịch sử, tem QR) | `catalog.view` | catalog |
| `/dong-ho/loai` | Loại đồng hồ & thương hiệu | `catalog.view` | catalog |
| `/vi-tri-kho` | Vị trí lưu kho | `location.manage` | catalog |
| `/linh-kien` · `/linh-kien/[id]` | Linh kiện, tồn, nhập/xuất | `part.view` | parts |
| `/nhap-hang` · `/nhap-hang/moi` · `/nhap-hang/[id]` | Phiếu nhập | `purchase.view` | purchasing |
| `/ban-hang` · `/ban-hang/moi` · `/ban-hang/[id]` | Danh sách/POS/chi tiết phiếu bán | `sale.view`, `sale.create_draft` | sales |
| `/giu-hang` | Giữ hàng / đặt cọc | `reservation.manage` | sales |
| `/doi-tra` · `/doi-tra/moi` | Đổi trả | `return.create` | sales |
| `/sua-chua` · `/sua-chua/moi` · `/sua-chua/[id]` | Phiếu sửa chữa; "Việc của tôi" cho thợ | `repair.view`/`repair.view_assigned` | repairs |
| `/khach-hang` · `/khach-hang/[id]` | Khách hàng, lịch sử, công nợ | `customer.view` | partners |
| `/nha-cung-cap` · `/nha-cung-cap/[id]` | NCC, lịch sử, công nợ | `supplier.view` | partners |
| `/thu-chi` | Quỹ, phiếu thu/chi, chuyển quỹ, chốt ngày, khóa kỳ | `finance.view` | finance |
| `/cong-no` | Công nợ khách & NCC, thu/trả nợ | `debt.view` | finance |
| `/kiem-ke` | Kiểm kê | `stocktake.manage` | inventory |
| `/bao-cao` · `/bao-cao/[ma]` | Báo cáo | theo từng báo cáo | reports |
| `/cong-tac-vien` | Hoa hồng, hồ sơ CTV (chủ); "Đơn của tôi" (CTV) | `commission.view`/`commission.view_own` | sales |
| `/quan-tri` (tab: người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống & sao lưu, phiên bản) | Quản trị | `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health` | iam/platform |
| `/cai-dat` | Hồ sơ, đổi mật khẩu, TOTP | đã đăng nhập | iam |
| `/huong-dan` | Hướng dẫn sử dụng (lọc theo vai trò) | đã đăng nhập | platform |

## 4. Màn hình trọng tâm

### 4.1 POS bán hàng (`/ban-hang/moi`)
- **Trên**: ô tìm kiếm + nút quét. Kết quả là thẻ ảnh nhỏ: tên, mã, **giá hiệu lực**, tình trạng; chạm = thêm vào phiếu.
- **Giữa**: danh sách dòng (ảnh nhỏ, tên, giá, nút giảm giá/xóa); giảm giá tổng; mục *Thu cũ đổi mới*.
- **Dưới (thanh dính)**: Tổng phải trả (chữ lớn) · nút **Thanh toán** mở tờ trượt: chọn khách → các dòng thanh toán (chip Tiền mặt / Chuyển khoản, chọn quỹ) → ô "Khách đưa" → **Tiền thừa** → **Còn nợ** (nếu có, chọn hạn) → **Xác nhận**.
- Máy tính: bố cục hai cột (tìm bên trái, phiếu bên phải).
- Trạng thái lỗi nằm ngay dòng liên quan (vd. "Chiếc này vừa được bán — [Bỏ khỏi phiếu]").

### 4.2 Chi tiết chiếc (`/dong-ho/[id]`)
Đầu: ảnh (vuốt), tên, mã nội bộ, trạng thái (chip), vị trí, giá. Tab: **Thông tin** · **Ảnh & tình trạng** · **Giá & lịch sử giá** · **Giá vốn** (chỉ `cost.view`) · **Lịch sử trạng thái** · **Sửa chữa & bảo hành**. Hành động theo trạng thái (Bán, Giữ hàng, Chuyển vị trí, In tem, Sửa nội bộ…).

### 4.3 Nhận máy sửa (`/sua-chua/moi`)
Bước 1 Khách (tìm SĐT/tạo nhanh) → Bước 2 Máy (thương hiệu/model/serial, chụp ảnh) → Bước 3 Tình trạng & lỗi → Bước 4 Cọc (tùy chọn) → **Nhận & in phiếu**. Mỗi bước một màn hình nhỏ (stepper), nháp tự lưu.

### 4.4 Việc của thợ (`/sua-chua`, lọc "Của tôi")
Thẻ theo trạng thái; mở thẻ: thông tin máy + ảnh nhận, ghi kiểm tra, thêm nhân công/linh kiện (xác nhận dùng), nút trạng thái kế tiếp (Bắt đầu sửa / Chờ linh kiện / Hoàn thành). Thợ không thấy giá vốn/doanh thu, chỉ thấy tiền công **của mình**.

### 4.5 Thu chi (`/thu-chi`)
Tab **Tổng quan** (số dư các quỹ, thu/chi hôm nay) · **Phiếu thu/chi** · **Chuyển quỹ** · **Chốt ngày** · **Kỳ & đối chiếu**. Nút **+ Thu / + Chi** nổi; chọn mục đích → form rút gọn theo mục đích.

## 5. Thành phần giao diện dùng chung

`src/components/ui/`: `Button`, `FormField` (nhãn + lỗi), `MoneyInput` (nhập số có dấu chấm, trả `number`), `DatePicker` (ngày VN), `Select`/`Combobox` (lọc không dấu), `PhoneInput`, `ImageUploader` (chụp/chọn, nén, EXIF, tiến trình), `ScanButton` (camera QR/mã vạch: `BarcodeDetector` nếu có, dự phòng `@zxing/browser` cho iOS Safari), `StatusChip`, `DataTable` (thẻ trên điện thoại, bảng trên máy tính), `BottomSheet`/`Modal`, `ConfirmDialog` (nêu hậu quả + lý do), `EmptyState`, `OfflineBanner`, `Toast`, `PrintButton`.

Quy ước: không dùng `<input>`/`<select>` thô trong màn hình nghiệp vụ; trên điện thoại các bộ chọn ngày/giờ gốc của trình duyệt **được phép** bọc trong thành phần chung nếu trải nghiệm tốt hơn.

## 6. Mất kết nối & nháp (FR-BAK-06)

- Biểu ngữ "Mất kết nối — bạn vẫn nhập được, chưa thể xác nhận" khi `navigator.onLine=false` hoặc API lỗi mạng.
- Mỗi form nghiệp vụ lớn (phiếu nhập/bán/sửa) lưu nháp vào `IndexedDB` theo `draft:<loại>:<id>` mỗi 2 giây + khi đổi trường; mở lại khôi phục.
- Nút "Xác nhận" luôn gửi với `Idempotency-Key` sinh ở client (UUID) và **giữ nguyên khóa khi thử lại**; nhận lại kết quả cũ nếu lần trước đã thành công.
- Không có hàng đợi ghi offline tự chạy (ADR-013): người dùng tự bấm gửi lại khi có mạng.

## 7. In ấn

| Phiếu | Khổ | Nút ở |
|---|---|---|
| Phiếu bán hàng | 80mm (nhiệt) hoặc A5 | Sau xác nhận / chi tiết phiếu |
| Phiếu giữ hàng (biên nhận cọc) | 80mm / A5 | Sau tạo |
| Phiếu nhập; biên bản thu mua | A4 | Chi tiết phiếu nhập |
| Phiếu nhận sửa; phiếu giao trả | 80mm / A5 | Sau nhận / giao |
| Tem QR chiếc | 50×30mm (PDF tem) hoặc in A4 lưới | Chi tiết chiếc, sau xác nhận phiếu nhập |
| Báo cáo | A4 | Trang báo cáo |

PDF sinh phía máy chủ (`pdfmake`) để cùng quyền và cùng số liệu; trình duyệt mở hộp thoại in. Chi tiết: `integrations`.

## 8. Hướng dẫn trong ứng dụng

Mục **Hướng dẫn sử dụng** lọc theo vai trò (nội dung ở `src/content/guide.ts`, nguồn của `docs/07-user-guide`); gợi ý ngữ cảnh (dấu "?") ở các màn hình nghiệp vụ quan trọng; lần đăng nhập đầu có tour 4 bước cho mỗi vai trò.
