# Trải nghiệm & điều hướng

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (viết lại theo `customer-feedback-02`: sáu việc, điều hướng gọn; phong cách **Glass**, CF-09) · Thiết bị: điện thoại + máy tính, chỉ trình duyệt (PWA)
> Phong cách, token, thành phần, dock/sidebar: **`03-architecture/ui-design-system.md`** (đặc tả để dựng). File này nói về **người dùng làm gì ở màn nào**.

## 1. Nguyên tắc "dễ dùng"

1. **Mobile-first, một tay.** Thiết kế ở 390px trước; thao tác chính nằm trong tầm ngón cái (dock nổi ở đáy, nút "+" ở giữa, sheet trượt từ dưới).
2. **Ba chạm.** Ghi đơn bán, tra cứu chiếc, nhận máy sửa, giao hàng cho CTV, xác nhận báo bán: tối đa 3 chạm từ trang chủ.
3. **Một ô tìm kiếm cho tất cả** (mã nội bộ, serial, tên, SĐT khách, mã đơn) + nút **quét QR**. Không dấu, gõ sai nhẹ vẫn ra.
4. **Ít gõ.** Giá trị mặc định thông minh (giá niêm yết, ngày hôm nay, hạn bảo hành theo tình trạng), chọn thay vì nhập, tạo khách ngay trên đơn.
5. **Chỉ hiện cái cần.** Không có màn/nút của tính năng đã bỏ (thanh toán, nợ, giữ hàng, giá vốn, linh kiện, kiểm kê…). Mỗi màn có **một việc chính** và một nút chính.
6. **Nói tiếng người.** Nhãn tiếng Việt thường dùng ở cửa hàng ("Sẵn sàng bán", "Đang giao CTV"), không lộ mã kỹ thuật; lỗi nêu *chuyện gì* + *làm gì tiếp* (mã `WF-…` nhỏ ở cuối để hỗ trợ).
7. **Không mất việc.** Nháp tự lưu cục bộ, mất mạng có biểu ngữ và nút lưu bị khóa, gửi lại an toàn (cùng `Idempotency-Key`).
8. **Rõ ràng về tiền.** Tiền luôn định dạng `8.200.000 ₫`; màu *chỉ* hỗ trợ, luôn kèm chữ.
9. **Hành động nguy hiểm tách riêng.** Hủy đơn/hủy phiếu/từ chối báo bán: hộp xác nhận nêu hậu quả ("Sẽ đưa máy về kho và hủy bảo hành") + bắt lý do.
10. **Chỉ chạm ≥ 44px**, chữ nhập ≥ 16px, tương phản AA; bản sáng mặc định + **bản tối** chọn được (Sáng / Tối / Theo hệ thống — CQ-016).
11. **Trống thì hướng dẫn.** Màn hình trống có câu "Bạn chưa có … — Bắt đầu bằng …" + nút hành động.
12. **Ai không có quyền thì không thấy.** CTV không thấy doanh thu/đơn/khách; nhân viên không thấy mục của chủ.

## 2. Vai trò & nơi đến đầu tiên

| Vai trò | Trang chủ (sau đăng nhập) | Dock (xem `ui-design-system` §4.3) | Nút "+" |
|---|---|---|---|
| Chủ cửa hàng | Tổng quan đầy đủ | Tổng quan · Đồng hồ · **+** · Bán hàng · Menu | Ghi đơn bán · Nhận máy sửa · Giao đồng hồ cho CTV · CTV báo bán chờ xác nhận · Thêm đồng hồ |
| Nhân viên bán hàng | Tổng quan (doanh thu, báo bán chờ) | Bán hàng · Đồng hồ · **+** · Khách · Menu | Ghi đơn bán · CTV báo bán chờ xác nhận · Thêm khách |
| Quản lý kho | Tổng quan kho | Tổng quan · Đồng hồ · **+** · Vị trí kho · Menu | Thêm đồng hồ · In tem QR |
| Cộng tác viên | Hàng của tôi | Hàng · Báo bán · **+** · Thống kê · Tôi | Tìm chiếc được giao |

Dock/menu hiển thị theo **quyền** (không theo tên vai trò). Không còn vai trò Thợ (CF-05).

## 3. Sơ đồ trang (đường dẫn tiếng Việt, mã nguồn tiếng Anh)

| Đường dẫn | Màn hình | Quyền vào |
|---|---|---|
| `/dang-nhap`, `/doi-mat-khau`, `/xac-thuc-2-buoc` | Đăng nhập, đổi mật khẩu, TOTP | công khai |
| `/` | Tổng quan (theo quyền) | đã đăng nhập |
| `/dong-ho` · `/dong-ho/[id]` · `/dong-ho/moi` (= **Thêm đồng hồ**) · `/dong-ho/loai` | Danh sách/chi tiết chiếc (ảnh, giá niêm yết, lịch sử, tem QR); thêm một chiếc; loại & hãng | `catalog.view` · `purchase.create` · `catalog.manage` |
| `/vi-tri-kho` | Vị trí lưu kho | `location.manage` |
| `/ban-hang` · `/ban-hang/moi` · `/ban-hang/[id]` | Danh sách đơn (tìm tên/SĐT/mã/serial, lọc kênh) · **Ghi đơn bán** · chi tiết đơn (in, hủy) | `sale.view` · `sale.confirm` |
| `/khach-hang` · `/khach-hang/[id]` | Khách hàng, lịch sử mua/sửa | `customer.view` |
| `/cong-tac-vien` (tab: CTV · Hàng đang giao · Báo bán) · `/cong-tac-vien/[id]` · `/cong-tac-vien/giao-hang` · `/cong-tac-vien/hang` · `/cong-tac-vien/bao-ban` | Danh sách CTV + thống kê; **Giao hàng** (nhiều chiếc × nhiều CTV); hàng đang giao (thu hồi); **báo bán chờ xác nhận** (xác nhận/từ chối) | `collab.view`, `collab.manage`, `sale.confirm` |
| `/ctv` · `/ctv/don` · `/ctv/thong-ke` · `/ctv/toi` | Màn của **CTV**: Hàng của tôi (+ nút Đã bán) · Báo bán của tôi · Thống kê của tôi (số chiếc) · Tài khoản | `collab.view_own` |
| `/sua-chua` · `/sua-chua/moi` · `/sua-chua/[id]` | Phiếu sửa chữa (chỉ chủ mặc định) | `repair.view` |
| `/bao-cao` · `/bao-cao/[ma]` (`revenue`, `units`, `collab`) | 3 báo cáo | theo từng báo cáo |
| `/nhap-excel` | Nhập từ Excel (khách, đồng hồ) — **chỉ ở Menu** | `customer.create`, `purchase.create` |
| `/quan-tri` (tab: người dùng, vai trò & quyền, cài đặt, **nhật ký** (hai mục: Thay đổi dữ liệu · Truy cập & đăng nhập), hệ thống & sao lưu) | Quản trị | `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health` |
| `/thong-bao` · `/cai-dat` · `/huong-dan` | Thông báo; hồ sơ/đổi mật khẩu/TOTP; Hướng dẫn sử dụng (có mục "Có gì mới" ở cuối) | đã đăng nhập |

`/quan-tri/hoat-dong` và `/quan-tri/phien-ban` chỉ còn là đường dẫn chuyển hướng (về Nhật ký / Hướng dẫn).

**Đã bỏ khỏi sơ đồ:** `/thu-chi`, `/cong-no`, `/doi-tra`, `/nha-cung-cap`, "Việc của tôi" (thợ), `/nhap-hang*`, `/giu-hang`, `/bao-hanh*`, `/linh-kien*`, `/kiem-ke*`, `/cong-tac-vien/{quyet-toan,giao-hang/moi,thong-ke}`, `/ctv/tao-don`.

## 4. Màn hình trọng tâm

### 4.1 Ghi đơn bán (`/ban-hang/moi`) — FR-SALE-20
- **Trên**: ô tìm kiếm + nút **quét QR**. Kết quả là thẻ ảnh nhỏ (tên, mã, **giá niêm yết**, tình trạng); chạm = thêm vào đơn. Chiếc có báo bán CTV chờ hiện "CTV đã báo bán" (không chọn được).
- **Giữa**: danh sách chiếc trong đơn (ảnh nhỏ, tên, **giá bán** sửa được — hiện chênh lệch so với niêm yết, **hạn bảo hành** chọn: Mặc định (hàng mới 12 tháng, hàng cũ 3 tháng) / Không bảo hành / 1 / 3 / 6 / 12 / 24 tháng), xóa dòng.
- **Khách**: ô tìm khách theo tên/SĐT, hoặc **nhập mới** ngay (tên + SĐT); ngày bán (mặc định hôm nay), ghi chú.
- **Dưới (thanh dính)**: **Tổng** (chữ lớn) · nút **Lưu đơn**. Sau lưu: thông báo "Đã ghi đơn HD-…" và mở thẳng **chi tiết đơn** (nút In phiếu, Hủy đơn).
- Máy tính: hai cột (tìm bên trái, đơn dính bên phải). Lỗi nằm ngay dòng liên quan ("Chiếc này vừa được bán — [Bỏ khỏi đơn]").

### 4.2 Chi tiết chiếc (`/dong-ho/[id]`)
Đầu: ảnh, tên, mã nội bộ, trạng thái (chip), vị trí, **giá niêm yết**, "Đang giao N CTV" nếu có. Hàng hành động: **Ghi đơn bán · In tem · Đổi vị trí** (+ **Giao CTV** cho chủ). Tab: **Thông tin** · **Ảnh & tình trạng** · **Giá & lịch sử giá** · **Lịch sử trạng thái**. Không có tab giá vốn/giá thu.

### 4.3 Nhận máy sửa (`/sua-chua/moi`) — một trang
Khách (tìm SĐT hoặc nhập mới tên + SĐT) → Máy (hãng/loại/serial hoặc chọn máy đã lưu của khách) → Tình trạng ban đầu & lỗi → Hẹn trả → **Bảo hành miễn phí?** (chọn từ bảo hành còn hạn của khách, tùy chọn) → **Nhận máy & in phiếu**. Ảnh tùy chọn. Danh sách sửa chữa: thẻ theo trạng thái; mở thẻ: ghi nhận xét, thêm khoản tiền (dịch vụ/khoản khác), nút trạng thái kế tiếp, **Sửa xong**, **Giao máy**. Không phân công thợ, không cọc, không thu tiền.

### 4.4 Cộng tác viên — chủ (`/cong-tac-vien`) — CF-10…12
- **Danh sách CTV**: thẻ mỗi CTV (số chiếc đang giao, báo bán chờ, tháng này bán được + doanh thu); bấm vào xem hồ sơ + thống kê theo ngày/tháng/quý/năm.
- **Giao hàng** (`/giao-hang`): chọn **nhiều chiếc** (tìm/quét) × chọn **nhiều CTV** → Giao. Giao lại cho CTV đã có = bỏ qua. Không có giá thu.
- **Hàng đang giao** (`/hang`): mỗi chiếc kèm danh sách CTV đang được giao; nút **Thu hồi** từng CTV hoặc tất cả (chặn khi có báo bán chờ).
- **Báo bán** (`/bao-ban`): thẻ mỗi báo bán chờ (ảnh, CTV, tên + SĐT khách, ghi chú, giờ báo): nút **Xác nhận** (giá điền sẵn = niêm yết, sửa được; ngày; bảo hành) và **Từ chối** (lý do ≥ 10 ký tự). Tab hiện số chờ. Bộ lọc "Đã xử lý" để xem lại.

### 4.5 Màn hình của CTV (`/ctv`) — mức giới hạn
- **Hàng của tôi**: lưới ảnh + **giá niêm yết**; chiếc CTV khác đã báo hiện mờ "CTV khác đã báo bán". Chạm → nút **Đã bán**: nhập tên + SĐT khách (+ ghi chú) → Gửi chờ xác nhận. **Không có ô giá.**
- **Báo bán của tôi**: trạng thái (chờ / đã xác nhận / bị từ chối + lý do / đã rút); rút báo bán còn chờ.
- **Thống kê của tôi**: số chiếc bán được theo ngày/tháng/quý/năm. **Không có tiền.**
- Không có Tổng quan, Khách, Đơn bán, Báo cáo, Sửa chữa.

### 4.6 Báo cáo (`/bao-cao`) và Tổng quan (`/`)
- **Báo cáo**: 3 thẻ (Doanh thu · Số lượng đồng hồ · Cộng tác viên) → bộ chọn khoảng ngày + nhóm kỳ (ngày/tháng/quý/năm) → thẻ tổng + biểu đồ + bảng → **Xuất Excel**, **In**. Mục nào không có quyền thì ẩn.
- **Tổng quan**: hero doanh thu (kèm ▲/▼ so với kỳ trước), thẻ số theo quyền, biểu đồ doanh thu, "Báo bán chờ xác nhận" (xác nhận ngay), đơn gần đây, đang sửa chữa, tồn theo hãng. Điện thoại một cột, "Việc cần xử lý" lên ngay sau thẻ số. Chi tiết: `reports-and-dashboard` §4.

### 4.7 Tìm nhanh (Ctrl+K), huy hiệu số việc, dải cảnh báo vận hành — FR-NAV-01…03

- **Bảng lệnh / tìm toàn cục.** Mở bằng **Ctrl/⌘+K**, phím **/** (khi không gõ trong ô nhập), nút tìm ở thanh trên (desktop) hoặc nút kính lúp đầu mọi trang trên điện thoại. Desktop = hộp giữa 640px; điện thoại = toàn màn hình. Ô trống: *Gần đây* (≤ 5, lưu trình duyệt — chỉ nhãn + đường dẫn, **không** lưu khách/SĐT), *Hành động nhanh* (Ghi đơn bán, Nhận máy sửa, Thêm đồng hồ, Thêm khách, Giao đồng hồ cho CTV… theo quyền) và *Trang* (theo quyền). Gõ ≥ 2 ký tự: lọc hành động/trang không dấu + tìm máy chủ (`GET /api/v1/search`, debounce 250ms): Đồng hồ, Khách hàng, Đơn bán, Phiếu sửa — mỗi nhóm chỉ hiện khi có quyền. Gõ **đúng mã nội bộ/serial** ⇒ dòng "Khớp chính xác" lên đầu, **Enter mở thẳng** chiếc. ↑↓ chọn, Enter mở, Esc đóng; có trạng thái đang tải, lỗi (nút Thử lại), trống. **CTV không có tìm toàn cục.**
- **Huy hiệu số việc** (`GET /api/v1/me/badges`, làm mới 60 giây + khi quay lại tab): viên số ở mục điều hướng tương ứng — **Cộng tác viên** (báo bán chờ), **Sửa chữa** (máy mới nhận/quá hẹn/xong chưa lấy). **Đỏ** khi có việc quá hạn, **vàng** khi chỉ đang chờ. Tổng số cũng lên biểu tượng ứng dụng đã cài.
- **Dải cảnh báo vận hành** (chỉ người có `system.health`, `GET /api/v1/system/status?summary=1`, 5 phút/lần): đỏ = cron quá hạn/lỗi, sao lưu lỗi/quá hạn, kho ảnh sắp đầy; vàng = lỗi hệ thống mới 24 giờ. Bấm ⇒ Quản trị → Hệ thống; nút × ẩn đến hết hôm nay.
- **Thông báo** (chuông + thông báo đẩy tùy chọn): chủ/nhân viên nhận "CTV báo đã bán", "Máy chưa lấy", nhắc báo bán chờ quá 1 ngày; CTV nhận "Có đồng hồ mới để bán", "Đã xác nhận bán", "Báo bán bị từ chối" (kèm lý do), "Chiếc … đã được bán" (CTV khác bán trước).

## 5. Thành phần giao diện dùng chung
Danh sách thành phần, lớp và token: `ui-design-system` §3–§5 (Glass). Quy ước: không dùng `<input>`/`<select>` thô trong màn nghiệp vụ — bọc qua `Field`/`MoneyInput`/`Select`…; phần tử tương tác phức tạp ưu tiên lấy từ thư viện Lucian (`ui-design-system` §8).

## 6. Mất kết nối & nháp (FR-BAK-06)

- Biểu ngữ "Mất kết nối — bạn vẫn nhập được, chưa thể lưu" khi `navigator.onLine=false` hoặc API lỗi mạng.
- Form ghi đơn bán / nhận máy sửa lưu nháp cục bộ khi đổi trường; mở lại khôi phục.
- Nút lưu luôn gửi với `Idempotency-Key` sinh ở client (UUID) và **giữ nguyên khóa khi thử lại**; nhận lại kết quả cũ nếu lần trước đã thành công.
- Không có hàng đợi ghi offline tự chạy (ADR-013): người dùng tự bấm gửi lại khi có mạng.

## 7. In ấn

| Phiếu | Khổ | Nút ở |
|---|---|---|
| Phiếu bán (kèm hạn bảo hành từng chiếc; in lại có "BẢN IN LẠI") | 80mm (nhiệt) hoặc A5 | Sau khi ghi đơn / chi tiết đơn |
| Phiếu nhận sửa / giao trả | 80mm / A5 | Sau nhận / giao |
| Tem QR chiếc | 50×30mm (PDF tem) hoặc in A4 lưới | Chi tiết chiếc, sau khi thêm đồng hồ |
| Báo cáo | A4 | Trang báo cáo |

PDF sinh phía máy chủ (`pdfmake`) để cùng quyền và cùng số liệu; trình duyệt mở hộp thoại in. Chi tiết: `integrations`.

## 8. Hướng dẫn trong ứng dụng

Các trang danh sách chính (Đồng hồ, Sửa chữa, Bán hàng, Khách hàng) có **dải số liệu** đầu trang (thẻ bấm được để lọc); đồng hồ chưa có ảnh thật hiện ảnh vẽ SVG theo hãng/loại; khách/CTV/người dùng có avatar màu. Chi tiết: `03-architecture/ui-design-system.md` §5.

Mục **Hướng dẫn sử dụng** (`/huong-dan`) lọc theo **quyền** của người xem (nội dung dạng khối có kiểu ở `src/content/guide.ts` — bước có đánh số, ghi chú theo mức độ, đường dẫn menu, bảng, sơ đồ luồng, minh họa giao diện; là nguồn của `docs/07-user-guide`). Trang có: thẻ "Bắt đầu nhanh", ô tìm không dấu, công tắc **Dành cho tôi / Tất cả mục**, mục lục dính có đánh dấu mục đang đọc, liên kết sâu `/huong-dan#ban-hang`, nút **In / Lưu PDF**, mục **Có gì mới** (nhật ký phiên bản) ở cuối; gợi ý ngữ cảnh (dấu "?") ở các màn quan trọng; lần đăng nhập đầu có tour ngắn cho mỗi vai trò.
