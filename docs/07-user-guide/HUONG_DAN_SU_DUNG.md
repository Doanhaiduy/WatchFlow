# Hướng dẫn sử dụng WatchFlow

> Cập nhật lần cuối: 2026-10-17 · Phiên bản 0.14.0 · Sinh tự động từ `src/content/guide.ts` bằng `pnpm docs:guide` — đừng sửa tay. Trong ứng dụng: menu **Hướng dẫn** (chỉ hiện mục hợp với quyền của bạn).

## Mục lục

1. [Bắt đầu nhanh](#bat-dau) — Làm quen màn hình, thanh điều hướng và nút “+”.
2. [Đăng nhập & xác thực 2 bước](#dang-nhap) — Mật khẩu, mã 6 số, mã khôi phục, thiết bị đang đăng nhập.
3. [Cài ứng dụng & thông báo](#cai-ung-dung) — Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.
4. [Bán hàng (POS)](#ban-hang) — Tìm chiếc, giỏ phiếu, thanh toán tiền mặt/chuyển khoản/kết hợp, bán nợ, thu thêm, hủy trong 24 giờ.
5. [Giữ hàng & đặt cọc](#giu-hang) — Giữ chiếc cho khách, chuyển thành bán, hoàn hoặc tịch thu cọc.
6. [Thu cũ đổi mới](#thu-cu) — Nhận máy cũ của khách trừ vào phiếu bán.
7. [Bảo hành](#bao-hanh) — Tra cứu bảo hành, nhận máy bảo hành.
8. [Nhập hàng & nhập nhanh](#nhap-hang) — Phiếu nhập nhiều dòng, chi phí phân bổ, nhập nhanh một chiếc.
9. [Đồng hồ & tem QR](#dong-ho) — Tìm kiếm, lọc, chi tiết chiếc, đổi giá/vị trí, in tem.
10. [Linh kiện](#linh-kien) — Tồn kho linh kiện, điều chỉnh, sắp hết.
11. [Khách hàng & CCCD](#khach-hang) — Tạo khách, trùng SĐT, xem CCCD đầy đủ, ẩn danh.
12. [Nhập từ Excel (hàng loạt)](#nhap-excel) — Nhập khách hàng, đồng hồ tồn đầu kỳ, linh kiện từ tệp Excel/CSV — xem trước rồi mới ghi.
13. [Cộng tác viên (dành cho chủ)](#ctv) — Giao hàng, đơn chờ xác nhận, quyết toán, thống kê.
14. [Màn hình của cộng tác viên](#man-ctv) — Hàng đang giữ, tạo đơn, đơn của tôi, thống kê.
15. [Sửa chữa](#sua-chua) — Nhận máy, tiến độ, dịch vụ và linh kiện, giao máy, sửa nội bộ.
16. [Kiểm kê](#kiem-ke) — Đếm chiếc và linh kiện, đối chiếu, chốt.
17. [Báo cáo & Tổng quan](#bao-cao) — Doanh thu, lãi gộp, tồn kho, công nợ, xuất Excel, in.
18. [Quản trị & sao lưu](#quan-tri) — Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.
19. [Khi có lỗi](#khi-co-loi) — Thông báo hay gặp và cách xử lý.

<a id="bat-dau"></a>

## Bắt đầu nhanh

*Làm quen màn hình, thanh điều hướng và nút “+”.*

Trên **điện thoại**, thanh dưới cùng có các mục chính, nút **+** ở giữa mở các hành động hay dùng (bán hàng, nhập hàng, nhận máy sửa…) và mục **Menu** chứa các màn còn lại. Trên **máy tính**, thanh bên trái liệt kê các mục theo nhóm.

Bạn chỉ thấy những mục mình có quyền dùng. Nếu thiếu một mục cần thiết, nhờ chủ cửa hàng cấp quyền ở Quản trị.

- **Tìm nhanh**: nhấn **Ctrl+K** (Mac: **⌘K**) hoặc phím **/**, hay bấm nút kính lúp (thanh trên máy tính, đầu trang trên điện thoại). Gõ **mã nội bộ, serial, tên đồng hồ, tên/số điện thoại khách, mã phiếu** (không cần dấu) — kết quả gom theo nhóm và chỉ gồm phần bạn có quyền xem. Gõ đúng mã hoặc serial rồi nhấn **Enter** là mở thẳng chiếc đó. Ô trống cho bạn các **hành động nhanh** (Bán nhanh, Nhận máy sửa, Nhập một chiếc, Thêm khách, Giữ hàng…) và danh sách **trang**; ↑↓ để chọn, Enter để mở, Esc để đóng.
- **Số việc cần xử lý**: viên số cạnh mục trên thanh dưới/thanh bên/Menu — **vàng** là đang chờ, **đỏ** là có việc quá hạn (đơn CTV chờ xác nhận, giữ hàng sắp hết hạn, máy sửa chờ hoặc chưa lấy, khách đến hạn trả nợ, linh kiện sắp hết…). Rê chuột để xem từng loại. Số tự cập nhật mỗi phút.
- **Chủ cửa hàng/người phụ trách hệ thống** còn thấy **dải cảnh báo** phía trên màn hình khi việc chạy nền quá hạn, sao lưu lỗi, có lỗi hệ thống mới hoặc kho ảnh sắp đầy; bấm để mở **Quản trị → Hệ thống**, nút × ẩn đến hết hôm nay.
- Nút quét QR mở camera (hoặc ô nhập mã nếu máy không có camera).
- Chuông thông báo cho biết việc mới (đơn CTV chờ xác nhận, sắp hết hạn giữ hàng…).
- Số tiền luôn hiển thị dạng **8.200.000 ₫**; số do máy chủ tính, màn hình chỉ hiển thị.
- Mất mạng: biểu ngữ vàng hiện lên, bạn vẫn nhập được nhưng **chưa thể xác nhận** cho tới khi có mạng lại.

<a id="dang-nhap"></a>

## Đăng nhập & xác thực 2 bước

*Mật khẩu, mã 6 số, mã khôi phục, thiết bị đang đăng nhập.*

1. Nhập email và mật khẩu được cấp. Sai nhiều lần tài khoản bị khóa tạm — màn hình báo còn mấy lần thử.
2. Lần đầu dùng mật khẩu tạm bạn phải **đổi mật khẩu** ngay.
3. Vai trò bắt buộc **xác thực 2 bước**: quét mã QR bằng ứng dụng Authenticator, nhập mã 6 số, rồi **lưu mã khôi phục** (chỉ hiện một lần).

### Mất điện thoại?
Ở màn nhập mã chọn **Dùng mã khôi phục** và nhập một mã còn dùng được (mỗi mã dùng một lần).

### Tin cậy thiết bị này
Ở bước nhập mã 6 số có ô **“Tin cậy thiết bị này … ngày”**. Chỉ tick trên **máy của riêng bạn**: những lần đăng nhập sau trên máy đó (cùng trình duyệt) chỉ cần **mật khẩu**, không hỏi mã 6 số. Mật khẩu vẫn luôn phải đúng, và với thao tác nhạy cảm (xem CCCD đầy đủ, đặt lại mật khẩu, tắt xác thực 2 bước…) hệ thống vẫn hỏi lại mật khẩu **và mã 2 bước**. Thiết bị tự hết tin cậy khi hết hạn, khi bạn **đổi mật khẩu**, khi chủ cửa hàng **đặt lại mật khẩu hoặc khóa** tài khoản, hoặc khi bạn tắt xác thực 2 bước. Muốn bỏ ngay: vào **Tài khoản → Thiết bị tin cậy** bấm **Bỏ** từng máy hoặc **Quên các thiết bị đã tin cậy**. Mất máy? Đổi mật khẩu là đủ để thu hồi tất cả. Chủ cửa hàng có thể tắt tính năng (Quản trị → Cài đặt → “Tin cậy thiết bị”, đặt 0 ngày).

### Thiết bị đang đăng nhập
Vào **Tài khoản** để xem các thiết bị và **thu hồi** thiết bị lạ. Với thao tác nhạy cảm (đổi vai trò, hủy phiếu…) hệ thống hỏi **nhập lại mật khẩu**.

### Giao diện sáng / tối
Vào **Tài khoản → Giao diện** (hoặc ở cuối **Menu** trên điện thoại, cuối thanh bên trên máy tính) để chọn **Sáng**, **Tối** hoặc **Theo hệ thống**. Lựa chọn được nhớ trên thiết bị này; bản in luôn nền trắng chữ đen.

<a id="cai-ung-dung"></a>

## Cài ứng dụng & thông báo

*Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.*

### Cài lên màn hình chính
Vào **Tài khoản → Ứng dụng trên màn hình chính** (trang chủ cũng có thẻ gợi ý nhỏ, đóng đi thì 21 ngày sau mới nhắc lại).
- **Android / Chrome / Edge**: bấm **Cài WatchFlow lên màn hình chính**.
- **iPhone / iPad**: mở bằng **Safari**, bấm nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**. Trên iPhone phải cài thì mới nhận được thông báo.

### Mở link qua Zalo / Facebook?
Trình duyệt trong Zalo, Facebook, Messenger… **hay làm mất đăng nhập**, không cài được ứng dụng và không nhận được thông báo. Khi gặp, đầu trang hiện **dải vàng**: bấm **Mở bằng Chrome** (Android) hoặc **Sao chép liên kết** rồi dán vào Chrome/Safari.

### Thông báo trên điện thoại
Vào **Tài khoản → Thông báo trên thiết bị** và bật **Nhận thông báo trên thiết bị này** (trình duyệt sẽ hỏi quyền — chọn **Cho phép**). Mỗi thiết bị bật riêng.
- **Giờ yên tĩnh**: trong khoảng giờ bạn chọn (giờ Việt Nam), thông báo được giữ lại và gửi sau khi hết giờ.
- **Gửi thử**: gửi một thông báo thử để kiểm tra thiết bị đã nhận chưa.
- Bấm vào thông báo sẽ mở đúng trang và đánh dấu đã đọc. Thông báo trong ứng dụng (biểu tượng chuông) luôn có, dù bạn có bật thông báo trên thiết bị hay không.
- Dùng chung máy với người khác? Tắt công tắc trước khi đăng xuất để người sau không nhận tin của bạn.
- Mất mạng khi mở ứng dụng: hiện trang **Bạn đang mất kết nối** — bật mạng rồi bấm **Thử lại**. Dữ liệu cửa hàng không lưu trên máy nên cần có mạng để làm việc.

<a id="ban-hang"></a>

## Bán hàng (POS)

*Tìm chiếc, giỏ phiếu, thanh toán tiền mặt/chuyển khoản/kết hợp, bán nợ, thu thêm, hủy trong 24 giờ.* · Hiện cho người có quyền: `sale.create_draft`, `sale.view`, `sale.view_own`

### Lập phiếu bán
1. Vào **Bán hàng → Bán hàng** (hoặc nút **+**). Tìm chiếc theo mã, serial, tên hoặc quét QR; chạm để thêm vào phiếu. Chỉ chiếc **Sẵn sàng bán** mới thêm được.
2. Chọn **khách** (tìm theo SĐT/tên hoặc tạo nhanh). Khách lẻ không cần chọn, nhưng **bán nợ và thu cũ đổi mới bắt buộc có khách**.
3. Sửa **giá bán** từng dòng nếu cần; có thể **giảm giá tổng phiếu**. Giảm quá hạn mức vai trò của bạn sẽ bị chặn khi xác nhận — nhờ người có hạn mức cao hơn.
4. Phiếu **tự lưu nháp**; nháp không giữ hàng. Trên điện thoại, thanh “Xem phiếu” mở giỏ kéo lên/xuống được.

### Thanh toán
- Chọn **Tiền mặt**, **Chuyển khoản** hoặc **Kết hợp**. Với tiền mặt nhập **Khách đưa** để thấy **tiền thừa** (tiền thừa chỉ để trả khách, không ghi vào doanh thu).
- Chọn **Chuyển khoản** (hoặc phần chuyển khoản trong **Kết hợp**) ⇒ hiện **mã QR VietQR** có sẵn số tiền và nội dung chuyển khoản (mã phiếu), kèm nút **sao chép** số tài khoản, số tiền, nội dung. Khách quét bằng ứng dụng ngân hàng. **QR chỉ để quét — hệ thống không tự ghi nhận tiền**: chỉ bấm **Xác nhận** sau khi đã thấy tiền vào tài khoản. Phiếu chưa có mã (đang lập) dùng nội dung tạm như “BAN HANG 1A2B3C”. Cũng hiện ở **Thu thêm**, đặt **cọc giữ hàng**, **cọc/giao máy sửa**, **CTV nộp quyết toán**. Chưa thấy QR? Chủ cửa hàng vào **Quản trị → Cài đặt → Thanh toán** chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản (và mẫu nội dung nếu muốn).
- Thu thiếu: nếu khách có số điện thoại, phần còn lại ghi **nợ**; có thể đặt **hẹn trả**.
- Bấm **Xác nhận**: máy chủ khóa chiếc, ghi giá vốn, thu tiền và cấp **bảo hành**. Sau đó **In phiếu** (80mm) hoặc **Tải PDF** (A5, chữ tiếng Việt đầy đủ) / **Chia sẻ** (trên điện thoại, gửi qua Zalo/Messenger/Mail). Tải lại phiếu đã in vẫn được đánh dấu **BẢN IN LẠI**; PDF không bao giờ có giá vốn hay lãi.

### Sau khi bán
- **Thu thêm**: mở phiếu còn nợ → Thu thêm → nhập số tiền khách trả.
- **Hủy phiếu**: chỉ trong thời hạn cho phép (mặc định 24 giờ), cần lý do và nhập lại mật khẩu; máy trả về kho và các khoản thu bị hủy.
- Danh sách phiếu có bộ lọc **Còn nợ** kèm tổng nợ.

<a id="giu-hang"></a>

## Giữ hàng & đặt cọc

*Giữ chiếc cho khách, chuyển thành bán, hoàn hoặc tịch thu cọc.* · Hiện cho người có quyền: `reservation.manage`

1. Ở chi tiết chiếc (hoặc **Giữ hàng → Giữ hàng**) chọn khách, hạn giữ, hình thức và **số tiền cọc**. Cọc phải đạt mức tối thiểu theo cài đặt.
2. Chiếc chuyển sang **Đã giữ**, không bán cho người khác được.
3. Khi khách đến mua: **Chuyển thành bán** — phiếu bán nháp được tạo sẵn, cọc tự trừ vào tiền phải thu.
4. Khách không mua: **Hủy giữ** và **hoàn cọc**. **Tịch thu cọc** chỉ người có quyền riêng làm được, cần lý do, nhập lại mật khẩu và **giữ nút 1,2 giây** để xác nhận.

Giữ quá hạn được tô đỏ trong danh sách và báo ở Tổng quan.

<a id="thu-cu"></a>

## Thu cũ đổi mới

*Nhận máy cũ của khách trừ vào phiếu bán.* · Hiện cho người có quyền: `sale.create_draft`

Trong phiếu bán chọn **Thêm máy cũ**: nhập loại, serial, tình trạng/hạng, vị trí kho và **giá thu**. Chụp ảnh giấy tờ người bán và ảnh máy.

- Giá thu máy cũ được **trừ** vào tổng phiếu và **không được lớn hơn** tổng tiền phiếu bán.
- Máy cũ vào kho ở trạng thái **Chờ kiểm tra**; sau khi kiểm tra đạt mới bán lại được.
- Bắt buộc có khách (người bán máy cũ).

<a id="bao-hanh"></a>

## Bảo hành

*Tra cứu bảo hành, nhận máy bảo hành.* · Hiện cho người có quyền: `warranty.view`, `repair.view`

Bảo hành **tự được cấp** khi xác nhận phiếu bán (thời hạn theo cài đặt: hàng mới/cũ/đã sửa) và sau mỗi lần sửa chữa.

- **Tra cứu** ở Bảo hành theo mã BH, mã phiếu, mã chiếc, serial hoặc số điện thoại khách. Chip cho biết **Còn hạn / Sắp hết / Hết hạn**.
- **Nhận máy bảo hành**: chọn kết quả → nhập lỗi → hệ thống mở phiếu sửa miễn phí. Hết hạn thì báo rõ và gợi ý **nhận máy tính phí**.
- **PDF phiếu bảo hành**: chọn kết quả → **PDF phiếu bảo hành** (hoặc **Chia sẻ** trên điện thoại) để gửi/in cho khách; có điều khoản bảo hành của cửa hàng. Phiếu **nhận/giao máy sửa** cũng có **Tải PDF** cạnh nút In.
- Không có “đổi trả”: khách có vấn đề thì xử lý qua bảo hành/sửa chữa.

<a id="nhap-hang"></a>

## Nhập hàng & nhập nhanh

*Phiếu nhập nhiều dòng, chi phí phân bổ, nhập nhanh một chiếc.* · Hiện cho người có quyền: `purchase.view`, `purchase.create`

### Phiếu nhập
1. **Nhập hàng → Lập phiếu**. Chọn loại: **Mua vào** (ghi nguồn hàng bằng chữ — gõ vài chữ để chọn nguồn đã dùng, không cần gõ dấu), **Thu mua từ khách** (chọn khách, tải ảnh giấy tờ và ảnh máy) hoặc **Tồn đầu kỳ**.
2. Thêm dòng **đồng hồ** (loại, serial hoặc “không serial”, tình trạng, hạng, vị trí, giá nhập) và dòng **linh kiện**. Có nút **nhân bản dòng** để nhập nhiều chiếc giống nhau.
3. Thêm **chi phí** (vận chuyển, kiểm định…) và chọn phân bổ theo giá trị hoặc chia đều — giá vốn từng chiếc đã gồm phần phân bổ.
4. **Lưu nháp** (tự lưu), rồi **Xác nhận**: hệ thống tạo từng chiếc với mã DH-…, bạn **in tem QR** để dán.

Hàng cũ/đã sửa cần **ảnh tình trạng** trước khi bán — hoặc để trạng thái **Chờ kiểm tra**.

Đang nhập dở mà bấm ra ngoài hộp thoại, bấm sang trang khác hay đóng tab, ứng dụng sẽ hỏi **Bỏ thay đổi chưa lưu?** — chọn **Ở lại** để giữ nguyên dữ liệu đã nhập. Khi bấm Lưu/Xác nhận, hộp thoại hiện **Đang xử lý…** và không đóng được cho tới khi xong (không lo bấm hai lần).

### Hủy phiếu nhập
Chỉ hủy được khi chưa có giao dịch nào dùng đến hàng đó; cần lý do và nhập lại mật khẩu.

### Nhập nhanh một chiếc
**Đồng hồ → Thêm đồng hồ**: điền một chiếc và giá nhập; hệ thống tạo phiếu và xác nhận ngay.

<a id="dong-ho"></a>

## Đồng hồ & tem QR

*Tìm kiếm, lọc, chi tiết chiếc, đổi giá/vị trí, in tem.* · Hiện cho người có quyền: `catalog.view`

- **Danh sách**: lọc theo trạng thái (Sẵn sàng bán, Đã giữ, Đang ở CTV, Đang sửa, Chờ kiểm tra, Đã bán, Thanh lý/mất), thương hiệu, loại, vị trí, tình trạng, **tồn lâu**.
- **Chi tiết chiếc**: ảnh, giá, vị trí, tab Thông tin, Ảnh, Giá, **Giá thu** (chỉ người có quyền), Lịch sử, Bảo hành & sửa chữa.
- **Ảnh**: tải ảnh từ điện thoại/máy tính — ảnh được thu nhỏ ngay trên máy trước khi gửi (nhanh hơn, tiết kiệm mạng), có thanh tiến độ, nút **Hủy** và **Thử lại** khi mất mạng. Bấm vào ảnh để xem toàn màn hình: chụm/lăn chuột để phóng to, vuốt ngang để qua ảnh khác, **Esc** để đóng. Chủ cửa hàng xem dung lượng kho ảnh ở **Quản trị → Hệ thống**; ảnh giấy tờ của khách đã ẩn danh được xóa thật khỏi kho.
- **Sửa giá**, khuyến mãi theo khoảng ngày (cần quyền sửa giá); **Đổi vị trí**; **Kiểm tra đạt** cho chiếc Chờ kiểm tra.
- **Ghi mất/Khôi phục**: cần lý do và nhập lại mật khẩu.
- **In tem QR** (50×30mm): quét tem bằng ô quét ở thanh tìm kiếm để mở chiếc ngay.
- Danh mục **Loại & hãng** và **Vị trí kho** do người quản lý danh mục chỉnh.

<a id="linh-kien"></a>

## Linh kiện

*Tồn kho linh kiện, điều chỉnh, sắp hết.* · Hiện cho người có quyền: `part.view`

- Danh sách có bộ lọc theo loại và **Sắp hết** (tồn ≤ mức đặt hàng lại).
- **Điều chỉnh tồn**: chọn số lượng tăng/giảm và **ghi lý do** (≥ 10 ký tự); mọi điều chỉnh để lại lịch sử.
- Linh kiện nhập qua **phiếu nhập**, trừ kho khi **xác nhận dùng** trong phiếu sửa hoặc khi bán lẻ.
- Giá vốn bình quân chỉ hiện cho người có quyền xem giá vốn.

<a id="khach-hang"></a>

## Khách hàng & CCCD

*Tạo khách, trùng SĐT, xem CCCD đầy đủ, ẩn danh.* · Hiện cho người có quyền: `customer.view`, `customer.view_own`, `customer.create`

- **Tạo nhanh** chỉ cần tên (và SĐT). Trùng số điện thoại thì hệ thống hiện khách đã có để bạn **mở khách đó** hoặc **vẫn tạo mới**.
- Số **CCCD/giấy tờ** được mã hóa; màn hình chỉ hiện vài số cuối. Người có quyền bấm **Xem đầy đủ**, nêu lý do, nhập lại mật khẩu — số hiện **30 giây** rồi tự ẩn và việc xem được ghi nhật ký.
- Trang khách có **đồng hồ của khách**, phiếu còn nợ, giữ hàng/cọc và lịch sử mua.
- **Ẩn danh** (xóa dữ liệu cá nhân) chỉ người có quyền làm, cần lý do và không hoàn tác.

<a id="nhap-excel"></a>

## Nhập từ Excel (hàng loạt)

*Nhập khách hàng, đồng hồ tồn đầu kỳ, linh kiện từ tệp Excel/CSV — xem trước rồi mới ghi.* · Hiện cho người có quyền: `customer.create`, `purchase.create`

Dùng khi chuyển từ sổ sách/Excel cũ sang WatchFlow. Vào **Menu → Nhập từ Excel**, hoặc nút **Nhập Excel** ở màn **Khách hàng**, **Đồng hồ**, **Linh kiện** (chỉ hiện nếu bạn có quyền).

1. Chọn loại dữ liệu và bấm **Tải tệp mẫu (.xlsx)**. Tệp có 3 sheet: **Dữ liệu** (cột + 2 dòng ví dụ, có chữ [VÍ DỤ] — hệ thống tự bỏ qua), **Hướng dẫn**, **Danh mục** (hãng/loại/vị trí/nhóm đang có trong cửa hàng để điền cho khớp).
2. Điền dữ liệu (**tối đa 300 dòng mỗi lần**), lưu lại rồi chọn tệp (.xlsx hoặc .csv, tối đa 5 MB) hoặc kéo thả vào khung. Tên cột có dấu hay không dấu đều được; cột lạ bị bỏ qua.
3. **Xem trước:** mỗi dòng là *Hợp lệ*, *Cảnh báo*, *Lỗi* (kèm lý do) hoặc *Trùng*. Chưa có gì được ghi. Sửa lỗi trong tệp rồi bấm **Chọn tệp khác**; tích chọn các dòng muốn nhập (dòng trùng mặc định **không** tích; dòng lỗi không thể nhập).
4. Bấm **Nhập N dòng** (một lần — bấm đúp không nhập hai lần). Màn kết quả liệt kê từng dòng đã nhập kèm liên kết.

### Khách hàng
Cột: Họ và tên (bắt buộc), SĐT, Email, Địa chỉ, Nhóm khách, Ghi chú, CCCD (tùy chọn, được mã hóa như khi tạo khách). SĐT được chuẩn hóa (+84, thiếu số 0 đầu đều được). **Trùng SĐT** với khách có sẵn hoặc với dòng khác trong tệp sẽ được báo — bạn chọn bỏ qua hay vẫn nhập.

### Đồng hồ tồn đầu kỳ
Cột: Hãng, Loại/Model (bắt buộc — khớp theo mã hoặc tên), Serial, Tình trạng (bắt buộc: Mới / Cũ / Đã sửa), Hạng, **Giá vốn (giá thu)** (bắt buộc), Giá niêm yết, Vị trí kho, Ghi chú. Tất cả dòng nhập được ghi bằng **một phiếu “Tồn đầu kỳ”** xác nhận ngay: giá vốn đúng như trong tệp, kho tăng đúng số chiếc. Giá là số nguyên đồng (6000000 hoặc 6.000.000), không âm.
- Hàng **Cũ / Đã sửa** vào kho ở trạng thái **Chờ kiểm tra** (cần hạng tình trạng và ảnh mới chuyển được sang Sẵn sàng bán); hàng Mới vào thẳng Sẵn sàng bán.
- Chưa có loại trong danh mục: tạo ở **Đồng hồ → Loại & hãng**, hoặc (nếu bạn có quyền quản lý danh mục) bật **Tự tạo hãng/loại chưa có** trước khi chọn tệp.
- Serial đã có trong kho (cùng hãng) hoặc trùng trong tệp bị chặn. Ô Vị trí kho trống dùng **vị trí mặc định** bạn chọn.

### Linh kiện
Cột: Mã, Tên, Danh mục (phải có sẵn), Đơn vị, Tồn đầu, Giá vốn, Ngưỡng cảnh báo, Giá bán. Tồn đầu > 0 được ghi bằng một phiếu “Tồn đầu kỳ”. Mã đã có sẽ báo **trùng**; nếu bạn vẫn chọn nhập, số lượng được **cộng thêm** vào tồn hiện có.

<a id="ctv"></a>

## Cộng tác viên (dành cho chủ)

*Giao hàng, đơn chờ xác nhận, quyết toán, thống kê.* · Hiện cho người có quyền: `collab.view`, `collab.manage`

1. **Giao hàng**: chọn CTV, chọn chiếc sẵn sàng bán và nhập **giá thu** từng chiếc (CTV bán cao hơn giá thu thì phần chênh là của CTV). Giá thu thấp hơn giá vốn sẽ có cảnh báo.
2. CTV tạo **đơn chờ xác nhận**; bạn mở đơn và bấm **Xác nhận** (chuông thông báo cho bạn biết).
3. **Quyết toán**: chọn các dòng đã bán chưa nộp → tổng phải nộp → tiền mặt/chuyển khoản → xác nhận. Hủy quyết toán cần lý do và nhập lại mật khẩu.
4. **Thu hồi** chiếc CTV chưa bán: chọn vị trí kho và lý do.
5. **Thống kê CTV** theo tháng/quý/năm: số chiếc, bán ra, phải nộp, phần CTV hưởng, đã/chưa nộp.

<a id="man-ctv"></a>

## Màn hình của cộng tác viên

*Hàng đang giữ, tạo đơn, đơn của tôi, thống kê.* · Hiện cho người có quyền: `collab.view_own`

- **Hàng**: các chiếc cửa hàng giao cho bạn kèm **giá thu** và số ngày giữ. Bạn không thấy giá vốn.
- **Tạo đơn**: chọn chiếc → nhập **giá bán thực** (cảnh báo nếu thấp hơn giá thu) → chọn hoặc tạo khách (tên + SĐT) → **Gửi chờ xác nhận**.
- **Đơn của tôi**: trạng thái từng đơn, phần bạn hưởng và đã nộp tiền chưa.
- **Thống kê**: số chiếc, tổng bán ra, phải nộp, phần tôi hưởng theo tháng/quý/năm.

<a id="sua-chua"></a>

## Sửa chữa

*Nhận máy, tiến độ, dịch vụ và linh kiện, giao máy, sửa nội bộ.* · Hiện cho người có quyền: `repair.view`, `repair.create`

### Nhận máy
**Sửa chữa → Nhận máy** theo 5 bước: Khách → Máy → Tình trạng & lỗi → Cọc (tùy chọn) → Nhận máy. Chụp ảnh máy (tùy chọn) và **in phiếu nhận**.

### Xử lý
- Chuyển trạng thái: Đã nhận → Đang kiểm tra → Đang sửa ⇄ Chờ linh kiện → **Hoàn thành**.
- Thêm dòng **dịch vụ** (giá mặc định theo loại việc), **linh kiện** (bấm **Xác nhận dùng** để trừ kho) và **chi phí khác**. Sửa giá cần quyền riêng.
- **Hoàn thành**: khóa các dòng. **Giao máy**: thu tiền (hoặc ghi nợ), doanh thu ghi nhận lúc giao và cấp bảo hành sau sửa. **In phiếu giao**.
- **Hủy** trước khi hoàn thành: hoàn linh kiện và hoàn cọc.

### Sửa nội bộ
Chọn **Máy của cửa hàng**: chi phí sửa được cộng vào **giá vốn** chiếc khi hoàn thành; chọn chiếc về kho hay chờ kiểm tra.

<a id="kiem-ke"></a>

## Kiểm kê

*Đếm chiếc và linh kiện, đối chiếu, chốt.* · Hiện cho người có quyền: `stocktake.manage`

1. **Kiểm kê → Mở đợt**: chọn phạm vi (tất cả chiếc, theo vị trí, linh kiện, hoặc tất cả).
2. **Quét hoặc gõ mã** từng chiếc để đếm; với linh kiện nhập **số đếm**. Chiếc không thấy: bấm **Không thấy** và chọn lý do (mất, hư hỏng, nhập sai, đếm sai, tìm thấy, khác).
3. Xem các dòng **Lệch**, rồi **Chốt**: linh kiện lệch tạo biến động tồn; chiếc mất được **ghi mất** (cần quyền ghi mất — nếu không, nhờ chủ chốt).
4. **Hủy đợt** bỏ toàn bộ số đếm, không điều chỉnh gì.

Số hệ thống được lấy lại lúc chốt nên hàng bán trong lúc kiểm vẫn đúng.

<a id="bao-cao"></a>

## Báo cáo & Tổng quan

*Doanh thu, lãi gộp, tồn kho, công nợ, xuất Excel, in.* · Hiện cho người có quyền: `report.sales`, `report.inventory`, `profit.view`, `debt.view`

- **Tổng quan** hiện doanh thu, lãi gộp, thực thu, tồn kho, giá trị tồn theo **kỳ** bạn chọn, kèm **việc cần xử lý** (giữ hàng quá hạn, nợ đến hạn, máy sửa xong chưa giao, linh kiện sắp hết…). Mỗi người chỉ thấy phần mình có quyền.
- **Báo cáo** liệt kê các báo cáo bạn được xem. Chọn khoảng ngày và nhóm theo ngày/tháng/quý/năm, xem bảng kèm dòng tổng.
- **Xuất Excel** (cần quyền xuất) và **In / Lưu PDF** dùng cùng số liệu trên màn hình. Dòng “Dữ liệu đến lúc …” cho biết thời điểm tính.
- Giá vốn và lãi chỉ hiện cho người có quyền tương ứng.

<a id="quan-tri"></a>

## Quản trị & sao lưu

*Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.* · Hiện cho người có quyền: `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health`

- **Người dùng**: tạo tài khoản (mật khẩu tạm chỉ hiện **một lần** — sao chép gửi cho người dùng), khóa/mở khóa kèm lý do, đặt lại mật khẩu, đổi vai trò.
- **Vai trò & quyền**: bật/tắt từng quyền theo nhóm; quyền nhạy cảm có nhãn. Vai trò Chủ luôn giữ quyền quản lý người dùng và vai trò.
- Chỉ **chủ cửa hàng** mới sửa được tài khoản chủ, vai trò Chủ và cài đặt bảo mật. Không ai tự đổi vai trò, tự khóa hay tự đặt lại mật khẩu của chính mình (dùng **Đổi mật khẩu**).
- **Cài đặt**: hạn giữ hàng, thời hạn bảo hành, ngưỡng cảnh báo, bảo mật… có hiệu lực ngay. Nhóm **Thanh toán**: ngân hàng (chọn từ danh sách, có ô tìm), số tài khoản, tên chủ tài khoản và mẫu nội dung chuyển khoản (“{code}” = mã phiếu) để hiện mã VietQR khi thu chuyển khoản; chưa nhập thì không hiện QR.
- **Nhật ký**: mọi thay đổi quan trọng (ai, khi nào, trước/sau) — không sửa được.
- **Hoạt động**: ai đã làm thao tác gì, lúc nào, kết quả (thành công/lỗi/bị từ chối) và từ máy nào — kể cả khi **xuất Excel, in phiếu, xem giá vốn, xem báo cáo, xem CCCD đầy đủ** (tick “Chỉ sự kiện nhạy cảm” để xem riêng). Lọc theo người, khu vực, khoảng ngày; tab **Đăng nhập** cho biết ai đăng nhập, sai mật khẩu, bị khóa tạm hay dùng thiết bị tin cậy. Nhật ký **không ghi nội dung** bạn nhập hay số điện thoại/CCCD, chỉ ghi “làm gì” — không sửa/xóa được và tự dọn sau số ngày đặt ở Cài đặt (mặc định 180). Cần quyền xem nhật ký.
- **Hệ thống & sao lưu**: tình trạng máy chủ, **lần sao lưu gần nhất**, tác vụ nền và lỗi gần đây. Nếu sao lưu quá cũ, hãy báo người phụ trách vận hành.

<a id="khi-co-loi"></a>

## Khi có lỗi

*Thông báo hay gặp và cách xử lý.*

Mỗi thông báo lỗi có câu giải thích và một mã dạng **WF-…** — khi cần hỗ trợ, hãy chụp màn hình kèm mã này.

- **Phiên đăng nhập đã hết hạn** (WF-AUTH-UNAUTHENTICATED): đăng nhập lại. Phiên dài nhất 30 ngày kể từ lần đăng nhập.
- **Tài khoản bị khóa tạm** (WF-AUTH-LOCKED): nhập sai mật khẩu nhiều lần — chờ hết thời gian khóa hoặc nhờ chủ cửa hàng đặt lại mật khẩu.
- **Bạn không có quyền** (WF-AUTH-FORBIDDEN): việc này cần quyền khác — nhờ chủ cửa hàng.
- **Vui lòng nhập lại mật khẩu** (WF-SEC-REAUTH): thao tác nhạy cảm cần xác nhận lại; nhập mật khẩu (và mã 2 bước nếu có) rồi bấm lại.
- **Dữ liệu vừa được người khác sửa** (WF-CONFLICT-VERSION): tải lại trang rồi làm lại.
- **Chiếc này không còn bán được** / đã được giữ: tải lại để xem trạng thái mới; có thể người khác vừa bán hoặc giữ.
- **Thao tác quá nhiều lần** (WF-RATE-LIMIT): chờ vài phút.
- **Yêu cầu này đã được xử lý trước đó** (WF-BUSY): bạn vừa bấm hai lần — tải lại trang để xem kết quả, đừng tạo lại.
- **Lý do quá ngắn** (WF-REASON-REQUIRED): hủy/điều chỉnh cần lý do từ 10 ký tự.
- Mất mạng: thao tác chưa gửi được sẽ báo lỗi; khi có mạng bấm lại — hệ thống chống tạo trùng chứng từ.
