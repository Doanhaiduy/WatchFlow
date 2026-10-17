# Trải nghiệm & điều hướng

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt phần khung (chốt phong cách **Glass**, CF-09); chi tiết từng màn chốt khi dựng giao diện ở mỗi mốc · Thiết bị: điện thoại + máy tính, chỉ trình duyệt (PWA)
> Phong cách, token, thành phần, dock/sidebar: **`03-architecture/ui-design-system.md`** (đặc tả để dựng). File này nói về **người dùng làm gì ở màn nào**.

## 1. Nguyên tắc "dễ dùng"

1. **Mobile-first, một tay.** Thiết kế ở 390px trước; thao tác chính nằm trong tầm ngón cái (dock nổi ở đáy, nút "+" ở giữa, sheet trượt từ dưới).
2. **Ba chạm.** Bán nhanh, tra cứu chiếc, nhận máy sửa, giao hàng cho CTV, thu thêm tiền: tối đa 3 chạm từ trang chủ.
3. **Một ô tìm kiếm cho tất cả** (mã nội bộ, serial, tên, thương hiệu, SĐT khách, mã phiếu) + nút **quét QR**. Không dấu, gõ sai nhẹ vẫn ra.
4. **Ít gõ.** Giá trị mặc định thông minh (giá hiệu lực, ngày hôm nay, cách thanh toán gần nhất), nhớ lựa chọn gần đây, chọn thay vì nhập, tạo nhanh khách tại chỗ.
5. **Nói tiếng người.** Nhãn tiếng Việt thường dùng ở cửa hàng ("Sẵn sàng bán", "Đang ở CTV"), không lộ mã kỹ thuật; lỗi nêu *chuyện gì* + *làm gì tiếp* (mã `WF-…` nhỏ ở cuối để hỗ trợ).
6. **Không mất việc.** Nháp tự lưu liên tục (cục bộ + máy chủ), mất mạng có biểu ngữ và nút xác nhận bị khóa, gửi lại an toàn.
7. **Rõ ràng về tiền.** Tiền luôn định dạng `8.200.000 ₫`, cỡ chữ lớn ở tổng phải trả; màu *chỉ* hỗ trợ, luôn kèm chữ.
8. **Hành động nguy hiểm tách riêng.** Hủy/tịch thu/ghi mất: hộp xác nhận nêu hậu quả bằng số ("Sẽ trả máy về kho và hủy thanh toán 8.200.000 ₫") + bắt lý do.
9. **Chỉ chạm ≥ 44px**, chữ nhập ≥ 16px, tương phản AA; bản sáng mặc định + **bản tối** chọn được (Sáng / Tối / Theo hệ thống — CQ-016).
10. **Trống thì hướng dẫn.** Màn hình trống có câu "Bạn chưa có … — Bắt đầu bằng …" + nút hành động.
11. **Ai không có quyền thì không thấy.** Khối giá vốn/lãi/thống kê không render nếu thiếu quyền, kèm ghi chú khóa ở nơi người có quyền xem.

## 2. Vai trò & nơi đến đầu tiên

| Vai trò | Trang chủ (sau đăng nhập) | Dock (xem bảng đầy đủ ở `ui-design-system` §4.3) |
|---|---|---|
| Chủ cửa hàng | Tổng quan đầy đủ | Tổng quan · Đồng hồ · **+** · Bán hàng · Menu |
| Nhân viên bán hàng | Tìm kiếm + Bán nhanh | Bán hàng · Đồng hồ · **+** · Khách · Menu |
| Quản lý kho | Việc kho | Tổng quan · Đồng hồ · **+** · Linh kiện · Menu |
| Cộng tác viên | Hàng đang giữ | Hàng · Đơn của tôi · **+ Tạo đơn** · Thống kê · Tôi |

Dock/menu hiển thị theo **quyền** (không theo tên vai trò). Không còn vai trò Thợ (CF-05).

## 3. Sơ đồ trang (đường dẫn tiếng Việt, mã nguồn tiếng Anh)

| Đường dẫn | Màn hình | Quyền vào | Module |
|---|---|---|---|
| `/dang-nhap`, `/doi-mat-khau`, `/xac-thuc-2-buoc` | Đăng nhập, đổi mật khẩu, TOTP | công khai | iam |
| `/` | Tổng quan (theo vai trò) | đã đăng nhập | reports |
| `/dong-ho` · `/dong-ho/[id]` · `/dong-ho/moi` (= Nhập nhanh một chiếc) | Danh sách/chi tiết chiếc (ảnh, giá, **giá thu**, lịch sử, tem QR) | `catalog.view` | catalog |
| `/dong-ho/loai` | Loại đồng hồ & thương hiệu | `catalog.view` | catalog |
| `/vi-tri-kho` | Vị trí lưu kho | `location.manage` | catalog |
| `/linh-kien` · `/linh-kien/[id]` | Linh kiện, tồn, nhập/xuất | `part.view` | parts |
| `/nhap-hang` · `/nhap-hang/moi` · `/nhap-hang/[id]` | Phiếu nhập (nguồn hàng chữ, không NCC) | `purchase.view` | purchasing |
| `/ban-hang` · `/ban-hang/moi` · `/ban-hang/[id]` | Danh sách (lọc "còn nợ")/POS/chi tiết phiếu bán (+ Thu thêm, Hủy 24 giờ) | `sale.view`, `sale.create_draft` | sales |
| `/giu-hang` | Giữ hàng / đặt cọc | `reservation.manage` | sales |
| `/bao-hanh` · `/bao-hanh/[id]` | Tra cứu bảo hành; nhận máy bảo hành | `warranty.view` | sales |
| `/sua-chua` · `/sua-chua/moi` · `/sua-chua/[id]` | Phiếu sửa chữa (chỉ chủ mặc định) | `repair.view` | repairs |
| `/khach-hang` · `/khach-hang/[id]` | Khách hàng, lịch sử, phiếu còn nợ, cọc | `customer.view` | partners |
| `/kiem-ke` | Kiểm kê | `stocktake.manage` | inventory |
| `/bao-cao` · `/bao-cao/[ma]` | Báo cáo (R1…R12) | theo từng báo cáo | reports |
| `/cong-tac-vien` · `/cong-tac-vien/[id]` | Danh sách CTV; chi tiết CTV (tab: Hàng đang giữ · Đơn · Quyết toán · Thống kê) | `collab.view` | sales |
| `/cong-tac-vien/giao-hang/moi?ctv=` | Phiếu giao hàng cho CTV (chọn chiếc + nhập giá thu) | `collab.manage` | sales |
| `/cong-tac-vien/quyet-toan/moi?ctv=` | Quyết toán CTV (chọn dòng đã bán chưa nộp) | `collab.manage` | sales |
| `/cong-tac-vien/thong-ke` | Thống kê CTV theo tháng/quý/năm (R9) | `collab.view` | reports |
| `/ctv` · `/ctv/tao-don` · `/ctv/don` · `/ctv/thong-ke` · `/ctv/toi` | Màn hình của **CTV**: hàng đang giữ (kèm giá thu), tạo đơn, đơn của tôi, thống kê của tôi, tài khoản | `collab.view_own` | sales |
| `/quan-tri` (tab: người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống & sao lưu, phiên bản) | Quản trị | `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health` | iam/platform |
| `/cai-dat` | Hồ sơ, đổi mật khẩu, TOTP | đã đăng nhập | iam |
| `/huong-dan` | Hướng dẫn sử dụng (lọc theo vai trò) | đã đăng nhập | platform |

**Đã bỏ khỏi sơ đồ:** `/thu-chi`, `/cong-no`, `/doi-tra`, `/nha-cung-cap`, "Việc của tôi" (thợ).

## 4. Màn hình trọng tâm

### 4.1 POS bán hàng (`/ban-hang/moi`) — CF-01: thông tin + giá thu + giá bán
- **Trên**: ô tìm kiếm + nút quét. Kết quả là thẻ ảnh nhỏ: tên, mã, **giá hiệu lực**, tình trạng; chạm = thêm vào phiếu.
- **Giữa**: danh sách dòng (ảnh nhỏ, tên, **giá bán** sửa được, nút giảm giá/xóa; với người có quyền thêm dòng **giá thu** và **lãi** cạnh giá bán); giảm giá tổng; mục *Thu cũ đổi mới*.
- **Dưới (thanh dính)**: Tổng phải trả (chữ lớn) · nút **Thanh toán** mở tờ trượt: chọn khách → các dòng thanh toán (chip Tiền mặt / Chuyển khoản) → ô "Khách đưa" → **Tiền thừa** → **Còn nợ** (nếu có, chọn hạn) → **Xác nhận**.
- Máy tính: bố cục hai cột (tìm bên trái, giỏ phiếu dính bên phải).
- Trạng thái lỗi nằm ngay dòng liên quan (vd. "Chiếc này vừa được bán — [Bỏ khỏi phiếu]").

### 4.2 Chi tiết chiếc (`/dong-ho/[id]`)
Đầu: ảnh, tên, mã nội bộ, trạng thái (chip), vị trí (hoặc "Đang ở CTV: <tên>"), giá. Hàng hành động: **Bán · Giữ hàng · In tem · Vị trí** (+ **Giao CTV** cho chủ). Tab: **Thông tin** · **Ảnh & tình trạng** · **Giá & lịch sử giá** · **Giá thu** (người có `cost.view`; kèm ghi chú khóa) · **Lịch sử trạng thái** · **Bảo hành & sửa chữa**.

### 4.3 Nhận máy sửa (`/sua-chua/moi`) — CF-04: gọn
Bước 1 Khách (tìm SĐT/tạo nhanh) → Bước 2 Máy (thương hiệu/model/serial; **chụp ảnh tùy chọn**) → Bước 3 Tình trạng & lỗi → Bước 4 Cọc (tùy chọn) → **Nhận & in phiếu**. Nháp tự lưu. Danh sách sửa chữa: thẻ theo trạng thái với vòng % tiến độ; mở thẻ: ghi nhận xét, thêm dòng dịch vụ/linh kiện (xác nhận dùng), nút trạng thái kế tiếp, Giao & thu tiền. Không có phân công thợ.

### 4.4 Bảo hành (`/bao-hanh`) — CF-02
Ô tìm theo mã phiếu/SĐT khách/mã chiếc/serial → kết quả: chiếc, ngày mua, **hạn bảo hành** (chip còn hạn/sắp hết/hết hạn), nút **Nhận máy bảo hành** (mở phiếu sửa miễn phí, điền sẵn thông tin). Hết hạn: nhận máy tính phí, có cảnh báo.

### 4.5 Cộng tác viên — chủ (`/cong-tac-vien`) — CF-03/08
- **Danh sách CTV**: thẻ mỗi CTV (số chiếc đang giữ, chưa nộp, tháng này bán được).
- **Giao hàng** (`/giao-hang/moi`): chọn CTV → chọn các chiếc sẵn sàng bán (tìm/quét) → mỗi chiếc nhập **giá thu giao CTV** (hiển thị giá vốn tham chiếu, cảnh báo nếu thấp hơn) → Xác nhận & in/chia sẻ phiếu giao.
- **Chi tiết CTV**: tab *Hàng đang giữ* (nút Thu hồi/Ghi mất) · *Đơn* (đơn nháp chờ xác nhận, đã xác nhận) · *Quyết toán* (chọn dòng đã bán chưa nộp → nhập cách nộp → xác nhận) · *Thống kê*.
- **Thống kê** (`/thong-ke`): chọn tháng/quý/năm; bảng mỗi CTV: số chiếc, doanh thu bán ra, phải nộp, phần CTV hưởng, đã/chưa quyết toán; biểu đồ cột theo kỳ.

### 4.6 Màn hình của CTV (`/ctv`)
- **Hàng đang giữ**: lưới ảnh + **giá thu**; chạm → chi tiết (không giá vốn) + nút **Tạo đơn**.
- **Tạo đơn**: chọn chiếc → nhập **giá bán thực** (cảnh báo nếu < giá thu) → thông tin khách (tên + SĐT) → Gửi chờ xác nhận.
- **Đơn của tôi**: trạng thái (chờ xác nhận / đã xác nhận / đã nộp giá thu).
- **Thống kê của tôi**: số chiếc, tổng bán ra, phải nộp, **phần tôi hưởng**, đã/chưa nộp.

### 4.7 Tiền thu (báo cáo R8) — thay "Thu chi"
Một trang xem **thực thu** theo ngày/khoảng ngày: tiền mặt / chuyển khoản; cọc nhận/hoàn; CTV nộp; thu nhập khác. Không số dư, không phiếu chi.

### 4.8 Tìm nhanh (Ctrl+K), huy hiệu số việc, dải cảnh báo vận hành — FR-NAV-01…03

- **Bảng lệnh / tìm toàn cục.** Mở bằng **Ctrl/⌘+K**, phím **/** (khi không gõ trong ô nhập), nút tìm ở thanh trên (desktop, hiện kèm phím tắt) hoặc nút kính lúp đầu mọi trang trên điện thoại. Desktop = hộp giữa 640px; điện thoại = toàn màn hình. Ô trống: *Gần đây* (≤ 5, lưu trình duyệt — chỉ nhãn + đường dẫn, **không** lưu khách/SĐT), *Hành động nhanh* (Bán nhanh, Nhận máy sửa, Nhập một chiếc, Thêm khách, Giữ hàng… theo quyền) và *Trang* (theo quyền, kể cả các tab Quản trị). Gõ ≥ 2 ký tự: lọc hành động/trang không dấu + tìm máy chủ (`GET /api/v1/search`, debounce 250ms): Đồng hồ, Khách hàng, Phiếu bán/sửa/nhập, Giữ hàng, Linh kiện — mỗi nhóm chỉ hiện khi có quyền. Gõ **đúng mã nội bộ/serial** ⇒ dòng "Khớp chính xác" lên đầu, **Enter mở thẳng** chiếc (kể cả bấm Enter trước khi hết debounce). ↑↓ chọn, Enter mở, Esc đóng; có trạng thái đang tải, lỗi (nút Thử lại), trống; combobox/listbox có `aria-activedescendant`. CTV chỉ thấy chiếc đang giữ và khách của mình.
- **Huy hiệu số việc** (`GET /api/v1/me/badges`, làm mới 60 giây + khi quay lại tab): viên số ở mục điều hướng tương ứng — dock (góc biểu tượng; việc của mục chỉ có trong Menu gom vào nút **Menu**), sidebar, danh sách Menu. **Đỏ** khi có việc quá hạn, **vàng** khi chỉ đang chờ; rê chuột/đọc màn hình thấy từng loại việc. Tổng số cũng lên biểu tượng ứng dụng đã cài (`navigator.setAppBadge`, bọc `try`).
- **Dải cảnh báo vận hành** (chỉ người có `system.health`, `GET /api/v1/system/status?summary=1`, 5 phút/lần): dưới thanh trên. Đỏ = cron quá hạn/lỗi, sao lưu lỗi/quá hạn, kho ảnh sắp đầy; vàng = lỗi hệ thống mới 24 giờ, kho ảnh đã dùng nhiều. Bấm ⇒ Quản trị → Hệ thống; nút × ẩn đến hết hôm nay (`localStorage`), tự hiện lại khi sang ngày mới hoặc có vấn đề **loại khác**.

## 5. Thành phần giao diện dùng chung
Danh sách thành phần, lớp và token: `ui-design-system` §3–§5 (Glass). Quy ước: không dùng `<input>`/`<select>` thô trong màn nghiệp vụ — bọc qua `Field`/`MoneyInput`/`Select`…; phần tử tương tác phức tạp ưu tiên lấy từ thư viện Lucian (`ui-design-system` §8).

## 6. Mất kết nối & nháp (FR-BAK-06)

- Biểu ngữ "Mất kết nối — bạn vẫn nhập được, chưa thể xác nhận" khi `navigator.onLine=false` hoặc API lỗi mạng.
- Mỗi form nghiệp vụ lớn (phiếu nhập/bán/sửa/giao CTV) lưu nháp vào `IndexedDB` theo `draft:<loại>:<id>` mỗi 2 giây + khi đổi trường; mở lại khôi phục.
- Nút "Xác nhận" luôn gửi với `Idempotency-Key` sinh ở client (UUID) và **giữ nguyên khóa khi thử lại**; nhận lại kết quả cũ nếu lần trước đã thành công.
- Không có hàng đợi ghi offline tự chạy (ADR-013): người dùng tự bấm gửi lại khi có mạng.

## 7. In ấn

| Phiếu | Khổ | Nút ở |
|---|---|---|
| Phiếu bán hàng | 80mm (nhiệt) hoặc A5 | Sau xác nhận / chi tiết phiếu |
| Phiếu giữ hàng (biên nhận cọc) | 80mm / A5 | Sau tạo |
| Phiếu nhập; biên bản thu mua | A4 | Chi tiết phiếu nhập |
| Phiếu nhận sửa/giao trả | 80mm / A5 | Sau nhận / giao |
| Phiếu giao CTV | A5 / chia sẻ ảnh | Sau xác nhận giao |
| Tem QR chiếc | 50×30mm (PDF tem) hoặc in A4 lưới | Chi tiết chiếc, sau xác nhận phiếu nhập |
| Báo cáo | A4 | Trang báo cáo |

PDF sinh phía máy chủ (`pdfmake`) để cùng quyền và cùng số liệu; trình duyệt mở hộp thoại in. Chi tiết: `integrations`.

## 8. Hướng dẫn trong ứng dụng

Mục **Hướng dẫn sử dụng** lọc theo vai trò (nội dung ở `src/content/guide.ts`, nguồn của `docs/07-user-guide`); gợi ý ngữ cảnh (dấu "?") ở các màn hình nghiệp vụ quan trọng; lần đăng nhập đầu có tour 4 bước cho mỗi vai trò.
