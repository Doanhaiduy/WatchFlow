# Hướng dẫn sử dụng WatchFlow

> Cập nhật lần cuối: 2026-10-18 · Phiên bản 0.15.0 · Sinh tự động từ `src/content/guide.ts` bằng `pnpm docs:guide` — đừng sửa tay. Trong ứng dụng: menu **Hướng dẫn** (chỉ hiện mục hợp với quyền của bạn; có nút **In / Lưu PDF**).

Cách làm việc hằng ngày trên WatchFlow: bán hàng, nhập hàng, giữ hàng, sửa chữa, cộng tác viên… Bạn chỉ thấy những mục **hợp với quyền của mình**; thiếu mục nào cần dùng, nhờ chủ cửa hàng cấp quyền ở Quản trị.

## Các loại tài khoản trong cửa hàng

- **Chủ cửa hàng** — Thấy tất cả: giá thu (giá vốn), lãi, sửa chữa, cộng tác viên, quản trị người dùng, cài đặt và sao lưu.
- **Nhân viên bán hàng** — Lập phiếu bán, giữ hàng/đặt cọc, thu cũ đổi mới, tạo khách, tra cứu bảo hành. Không thấy giá thu và lãi; giảm giá trong hạn mức được cấp.
- **Quản lý kho** — Nhập hàng, tem QR, vị trí kho, linh kiện, kiểm kê, nhập Excel; thấy giá thu của hàng trong kho. Không bán hàng.
- **Cộng tác viên** — Nhận hàng của cửa hàng để bán, tạo đơn chờ xác nhận, xem hàng đang giữ/đơn của mình/thống kê. Không thấy giá vốn.

## Mục lục

1. [Bắt đầu nhanh](#bat-dau) — Làm quen màn hình, thanh điều hướng, nút “+”, tìm nhanh và số việc cần xử lý.
2. [Đăng nhập & xác thực 2 bước](#dang-nhap) — Mật khẩu, mã 6 số, mã khôi phục, thiết bị tin cậy, giao diện sáng/tối.
3. [Cài ứng dụng & thông báo](#cai-ung-dung) — Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.
4. [Bán hàng (POS)](#ban-hang) — Tìm chiếc, giỏ phiếu, thanh toán tiền mặt/chuyển khoản/kết hợp, bán nợ, thu thêm, hủy trong 24 giờ.
5. [Giữ hàng & đặt cọc](#giu-hang) — Giữ chiếc cho khách, chuyển thành bán, hoàn hoặc tịch thu cọc.
6. [Thu cũ đổi mới](#thu-cu) — Nhận máy cũ của khách trừ vào phiếu bán.
7. [Bảo hành](#bao-hanh) — Tra cứu bảo hành, nhận máy bảo hành, phiếu bảo hành PDF.
8. [Nhập hàng & nhập nhanh](#nhap-hang) — Phiếu nhập nhiều dòng, chi phí phân bổ, nhập nhanh một chiếc, in tem QR.
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

*Làm quen màn hình, thanh điều hướng, nút “+”, tìm nhanh và số việc cần xử lý.* · Dành cho: Mọi người

Bạn chỉ thấy những mục mình có quyền dùng. Nếu thiếu một mục cần thiết, nhờ chủ cửa hàng cấp quyền ở **Quản trị**.

### Làm quen giao diện

#### Điện thoại

*(Hình minh họa: Giao diện trên điện thoại)*

- **Thanh dưới cùng** có các mục chính theo công việc của bạn.
- Nút **+** ở giữa mở các **hành động hay dùng** (bán hàng, nhập hàng, nhận máy sửa…).
- Mục **Menu** chứa các màn còn lại.
- Nút **Quay lại** ở đầu trang (hoặc nút Back của điện thoại) đưa bạn về màn trước.

#### Máy tính

*(Hình minh họa: Giao diện trên máy tính)*

- **① Thanh bên trái** liệt kê các mục theo nhóm; viên số cạnh mục là số việc cần xử lý. Ở cuối có công tắc **Sáng/Tối** và thẻ tài khoản.
- **② Ô tìm nhanh** (phím tắt `Ctrl + K`): tìm mã, serial, khách, phiếu hoặc mở trang.
- **③ Quét QR và chuông**: quét tem đồng hồ; chuông là thông báo dành cho bạn.
- **④ Nút hành động chính** (màu gradient) — thường là Bán hàng.

### Tìm nhanh

1. **Mở ô tìm nhanh** — Nhấn **Ctrl+K** (Mac: **⌘K**) hoặc phím **/**, hay bấm nút kính lúp (thanh trên máy tính, đầu trang trên điện thoại).
2. **Gõ mã hoặc tên** — Gõ **mã nội bộ, serial, tên đồng hồ, tên/số điện thoại khách, mã phiếu** — không cần gõ dấu. Kết quả gom theo nhóm và chỉ gồm phần bạn có quyền xem.
3. **Mở kết quả** — Gõ đúng mã hoặc serial rồi nhấn **Enter** là mở thẳng chiếc đó. Ô trống cho bạn các **hành động nhanh** (Bán nhanh, Nhận máy sửa, Nhập một chiếc, Thêm khách, Giữ hàng…) và danh sách **trang**; **↑↓** để chọn, **Esc** để đóng.

### Số việc cần xử lý

Viên số cạnh mục trên thanh dưới, thanh bên và Menu cho biết còn bao nhiêu việc: **vàng** là đang chờ, **đỏ** là có việc quá hạn (đơn CTV chờ xác nhận, giữ hàng sắp hết hạn, máy sửa chờ hoặc chưa lấy, khách đến hạn trả nợ, linh kiện sắp hết…). Rê chuột để xem từng loại. Số tự cập nhật mỗi phút.

- **Quét QR** — Nút quét QR mở camera (hoặc ô nhập mã nếu máy không có camera).
- **Chuông thông báo** — Cho biết việc mới: đơn CTV chờ xác nhận, sắp hết hạn giữ hàng…
- **Dải cảnh báo** — Chủ cửa hàng/người phụ trách hệ thống thấy dải cảnh báo phía trên khi việc chạy nền quá hạn, sao lưu lỗi, có lỗi hệ thống mới hoặc kho ảnh sắp đầy; bấm để mở **Quản trị → Hệ thống**, nút × ẩn đến hết hôm nay.

> **Số tiền.** Số tiền luôn hiển thị dạng **8.200.000 ₫**; mọi con số do máy chủ tính, màn hình chỉ hiển thị.

> **Mất mạng.** Biểu ngữ vàng hiện lên; bạn vẫn nhập được nhưng **chưa thể xác nhận** cho tới khi có mạng lại.

<a id="dang-nhap"></a>

## Đăng nhập & xác thực 2 bước

*Mật khẩu, mã 6 số, mã khôi phục, thiết bị tin cậy, giao diện sáng/tối.* · Dành cho: Mọi người

### Đăng nhập lần đầu

1. **Đăng nhập** — Nhập email và mật khẩu được cấp. Sai nhiều lần tài khoản bị khóa tạm — màn hình báo còn mấy lần thử.
2. **Đổi mật khẩu tạm** — Lần đầu dùng mật khẩu tạm bạn phải **đổi mật khẩu** ngay.
3. **Bật xác thực 2 bước** — Vai trò bắt buộc **xác thực 2 bước**: quét mã QR bằng ứng dụng Authenticator, nhập mã 6 số, rồi **lưu mã khôi phục** (chỉ hiện một lần).

> **Mất điện thoại?** Ở màn nhập mã chọn **Dùng mã khôi phục** và nhập một mã còn dùng được (mỗi mã dùng một lần).

#### Tin cậy thiết bị này

Ở bước nhập mã 6 số có ô **“Tin cậy thiết bị này … ngày”**. Chỉ tick trên **máy của riêng bạn**: những lần đăng nhập sau trên máy đó (cùng trình duyệt) chỉ cần **mật khẩu**, không hỏi mã 6 số. Mật khẩu vẫn luôn phải đúng, và với thao tác nhạy cảm (xem CCCD đầy đủ, đặt lại mật khẩu, tắt xác thực 2 bước…) hệ thống vẫn hỏi lại mật khẩu **và mã 2 bước**.

Thiết bị tự hết tin cậy khi hết hạn, khi bạn **đổi mật khẩu**, khi chủ cửa hàng **đặt lại mật khẩu hoặc khóa** tài khoản, hoặc khi bạn tắt xác thực 2 bước.

*Muốn bỏ ngay: Tài khoản → Thiết bị tin cậy → Bỏ*

Bấm **Bỏ** từng máy hoặc **Quên các thiết bị đã tin cậy**. Mất máy? Đổi mật khẩu là đủ để thu hồi tất cả. Chủ cửa hàng có thể tắt tính năng (Quản trị → Cài đặt → “Tin cậy thiết bị”, đặt 0 ngày).

#### Thiết bị đang đăng nhập

Vào **Tài khoản** để xem các thiết bị và **thu hồi** thiết bị lạ. Với thao tác nhạy cảm (đổi vai trò, hủy phiếu…) hệ thống hỏi **nhập lại mật khẩu**.

#### Giao diện sáng / tối

*Vào: Tài khoản → Giao diện*

Chọn **Sáng**, **Tối** hoặc **Theo hệ thống** (cũng có ở cuối **Menu** trên điện thoại, cuối thanh bên trên máy tính). Lựa chọn được nhớ trên thiết bị này; bản in luôn nền trắng chữ đen.

<a id="cai-ung-dung"></a>

## Cài ứng dụng & thông báo

*Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.* · Dành cho: Mọi người

*Vào: Tài khoản → Ứng dụng trên màn hình chính*

Trang chủ cũng có thẻ gợi ý nhỏ; đóng đi thì 21 ngày sau mới nhắc lại.

#### Android / Chrome / Edge

1. **Bấm cài đặt** — Bấm **Cài WatchFlow lên màn hình chính** và xác nhận.

#### iPhone / iPad

1. **Mở bằng Safari** — Phải dùng **Safari**, không dùng trình duyệt trong ứng dụng khác.
2. **Thêm vào màn hình chính** — Bấm nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**.

> **Lưu ý.** Trên iPhone phải cài ra màn hình chính thì mới nhận được thông báo.

> **Mở link qua Zalo / Facebook?** Trình duyệt trong Zalo, Facebook, Messenger… **hay làm mất đăng nhập**, không cài được ứng dụng và không nhận được thông báo. Khi gặp, đầu trang hiện **dải vàng**: bấm **Mở bằng Chrome** (Android) hoặc **Sao chép liên kết** rồi dán vào Chrome/Safari.

### Thông báo trên điện thoại

1. **Mở cài đặt thông báo** (*Vào: Tài khoản → Thông báo trên thiết bị*)
2. **Bật và cho phép** — Bật **Nhận thông báo trên thiết bị này** (trình duyệt sẽ hỏi quyền — chọn **Cho phép**). Mỗi thiết bị bật riêng.
3. **Thử** — Bấm **Gửi thử** để kiểm tra thiết bị đã nhận chưa.

| Tùy chọn | Ý nghĩa |
|---|---|
| Giờ yên tĩnh | Trong khoảng giờ bạn chọn (giờ Việt Nam), thông báo được giữ lại và gửi sau khi hết giờ. |
| Bấm vào thông báo | Mở đúng trang và đánh dấu đã đọc. |
| Chuông trong ứng dụng | Luôn có, dù bạn có bật thông báo trên thiết bị hay không. |
| Dùng chung máy | Tắt công tắc trước khi đăng xuất để người sau không nhận tin của bạn. |

> **Mất mạng khi mở ứng dụng.** Hiện trang **Bạn đang mất kết nối** — bật mạng rồi bấm **Thử lại**. Dữ liệu cửa hàng không lưu trên máy nên cần có mạng để làm việc.

<a id="ban-hang"></a>

## Bán hàng (POS)

*Tìm chiếc, giỏ phiếu, thanh toán tiền mặt/chuyển khoản/kết hợp, bán nợ, thu thêm, hủy trong 24 giờ.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `sale.create_draft`, `sale.view`, `sale.view_own`

**Vòng đời một phiếu bán:** **Nháp** (tự lưu, không giữ hàng) → **Đã xác nhận** (khóa chiếc, ghi giá vốn, thu tiền, cấp bảo hành) → **Đã hủy** (trong hạn (mặc định 24 giờ), cần lý do)

### Lập phiếu bán

1. **Mở màn bán hàng** (*Vào: Nút + → Bán hàng*) — Tìm chiếc theo mã, serial, tên hoặc quét QR; chạm để thêm vào phiếu. Chỉ chiếc **Sẵn sàng bán** mới thêm được.
2. **Chọn khách** — Tìm theo SĐT/tên hoặc tạo nhanh. Khách lẻ không cần chọn, nhưng **bán nợ và thu cũ đổi mới bắt buộc có khách**.
3. **Chỉnh giá** — Sửa **giá bán** từng dòng nếu cần; có thể **giảm giá tổng phiếu**. Giảm quá hạn mức vai trò của bạn sẽ bị chặn khi xác nhận — nhờ người có hạn mức cao hơn.
4. **Để phiếu tự lưu** — Phiếu **tự lưu nháp** vài giây sau mỗi thay đổi; nháp không giữ hàng. Trên điện thoại, thanh “Xem phiếu” mở giỏ kéo lên/xuống được.

> **Nút Thanh toán chờ một chút?** Sau khi sửa giá hoặc thêm chiếc, nút **Thanh toán** mở lại ngay khi phiếu lưu xong (khoảng một giây) để số **Còn phải thu** luôn khớp với phiếu.

### Thanh toán

| Hình thức | Cách làm | Cần nhớ |
|---|---|---|
| Tiền mặt | Nhập **Khách đưa** để thấy **tiền thừa**. | Tiền thừa chỉ để trả khách, không ghi vào doanh thu. |
| Chuyển khoản | Hiện **mã QR VietQR** có sẵn số tiền và nội dung (mã phiếu), kèm nút **sao chép** số tài khoản, số tiền, nội dung. Khách quét bằng ứng dụng ngân hàng. | **QR chỉ để quét — hệ thống không tự ghi nhận tiền.** Chỉ bấm **Xác nhận** sau khi đã thấy tiền vào tài khoản. |
| Kết hợp | Chia một phần tiền mặt, một phần chuyển khoản. | Phần chuyển khoản cũng hiện QR. |
| Thu thiếu (nợ) | Nếu khách có số điện thoại, phần còn lại ghi **nợ**; có thể đặt **hẹn trả**. | Bán nợ bắt buộc có khách. |

> **QR còn xuất hiện ở đâu? Chưa thấy QR?** Phiếu chưa có mã (đang lập) dùng nội dung tạm như “BAN HANG 1A2B3C”. QR cũng hiện ở **Thu thêm**, đặt **cọc giữ hàng**, **cọc/giao máy sửa**, **CTV nộp quyết toán**. Chưa thấy QR? Chủ cửa hàng vào **Quản trị → Cài đặt → Thanh toán** chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản (và mẫu nội dung nếu muốn).

1. **Bấm Xác nhận** — Máy chủ **khóa chiếc, ghi giá vốn, thu tiền và cấp bảo hành** trong một lần — hoặc cùng thành công, hoặc không thay đổi gì.
2. **In hoặc gửi phiếu** — **In phiếu** (80mm) hoặc **Tải PDF** (A5, chữ tiếng Việt đầy đủ) / **Chia sẻ** (trên điện thoại, gửi qua Zalo/Messenger/Mail). Tải lại phiếu đã in vẫn được đánh dấu **BẢN IN LẠI**; PDF không bao giờ có giá vốn hay lãi.

#### Thu thêm (khách còn nợ)

Mở phiếu còn nợ → **Thu thêm** → nhập số tiền khách trả.

#### Hủy phiếu

Chỉ trong thời hạn cho phép (mặc định 24 giờ), cần lý do và nhập lại mật khẩu; máy trả về kho và các khoản thu bị hủy.

#### Tìm phiếu còn nợ

Danh sách phiếu có bộ lọc **Còn nợ** kèm tổng nợ.

<a id="giu-hang"></a>

## Giữ hàng & đặt cọc

*Giữ chiếc cho khách, chuyển thành bán, hoàn hoặc tịch thu cọc.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `reservation.manage`

**Trạng thái một lần giữ hàng:** **Đang giữ** (chiếc chuyển sang Đã giữ) → **Đã chuyển bán** (cọc tự trừ vào tiền phải thu) → **Hủy giữ** (hoàn cọc, hoặc tịch thu cọc)

1. **Tạo lần giữ** (*Vào: Giữ hàng → Giữ hàng*) — Ở chi tiết chiếc (hoặc màn Giữ hàng) chọn khách, hạn giữ, hình thức và **số tiền cọc**. Cọc phải đạt mức tối thiểu theo cài đặt.
2. **Chiếc được giữ** — Chiếc chuyển sang **Đã giữ**, không bán cho người khác được.
3. **Khách đến mua** — Bấm **Chuyển thành bán** — phiếu bán nháp được tạo sẵn, cọc tự trừ vào tiền phải thu.
4. **Khách không mua** — **Hủy giữ** và **hoàn cọc**. **Tịch thu cọc** chỉ người có quyền riêng làm được, cần lý do, nhập lại mật khẩu và **giữ nút 1,2 giây** để xác nhận.

> **Chú ý.** Giữ quá hạn được tô đỏ trong danh sách và báo ở Tổng quan.

<a id="thu-cu"></a>

## Thu cũ đổi mới

*Nhận máy cũ của khách trừ vào phiếu bán.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `sale.create_draft`

1. **Thêm máy cũ vào phiếu** — Trong phiếu bán bấm **Thêm máy cũ**: nhập loại, serial, tình trạng/hạng, vị trí kho và **giá thu**.
2. **Chụp ảnh** — Chụp ảnh giấy tờ người bán và ảnh máy.
3. **Chọn khách** — Bắt buộc có khách (người bán máy cũ).

- **Trừ vào phiếu** — Giá thu máy cũ được **trừ** vào tổng phiếu và **không được lớn hơn** tổng tiền phiếu bán.
- **Vào kho chờ kiểm tra** — Máy cũ vào kho ở trạng thái **Chờ kiểm tra**; sau khi kiểm tra đạt mới bán lại được.

<a id="bao-hanh"></a>

## Bảo hành

*Tra cứu bảo hành, nhận máy bảo hành, phiếu bảo hành PDF.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `warranty.view`, `repair.view`

Bảo hành **tự được cấp** khi xác nhận phiếu bán (thời hạn theo cài đặt: hàng mới/cũ/đã sửa) và sau mỗi lần sửa chữa.

1. **Tra cứu** (*Vào: Bảo hành*) — Tìm theo mã BH, mã phiếu, mã chiếc, serial hoặc số điện thoại khách. Chip cho biết **Còn hạn / Sắp hết / Hết hạn**.
2. **Nhận máy bảo hành** — Chọn kết quả → nhập lỗi → hệ thống mở phiếu sửa miễn phí. Hết hạn thì báo rõ và gợi ý **nhận máy tính phí**.
3. **Đưa phiếu cho khách** — Chọn kết quả → **PDF phiếu bảo hành** (hoặc **Chia sẻ** trên điện thoại) để gửi/in cho khách; có điều khoản bảo hành của cửa hàng. Phiếu **nhận/giao máy sửa** cũng có **Tải PDF** cạnh nút In.

> **Không có “đổi trả”.** Khách có vấn đề thì xử lý qua bảo hành/sửa chữa.

<a id="nhap-hang"></a>

## Nhập hàng & nhập nhanh

*Phiếu nhập nhiều dòng, chi phí phân bổ, nhập nhanh một chiếc, in tem QR.* · Dành cho: Kho, Chủ · Hiện cho người có quyền: `purchase.view`, `purchase.create`

### Lập phiếu nhập

1. **Chọn loại phiếu** (*Vào: Nhập hàng → Lập phiếu*) — **Mua vào** (ghi nguồn hàng bằng chữ — gõ vài chữ để chọn nguồn đã dùng, không cần gõ dấu), **Thu mua từ khách** (chọn khách, tải ảnh giấy tờ và ảnh máy) hoặc **Tồn đầu kỳ**.
2. **Thêm dòng** — Dòng **đồng hồ** (loại, serial hoặc “không serial”, tình trạng, hạng, vị trí, giá nhập) và dòng **linh kiện**. Có nút **nhân bản dòng** để nhập nhiều chiếc giống nhau.
3. **Thêm chi phí** — Vận chuyển, kiểm định… và chọn phân bổ theo giá trị hoặc chia đều — giá vốn từng chiếc đã gồm phần phân bổ.
4. **Lưu nháp rồi Xác nhận** — Phiếu tự lưu nháp. Khi **Xác nhận**, hệ thống tạo từng chiếc với mã DH-…; bạn **in tem QR** để dán.

> **Hàng cũ / đã sửa.** Cần **ảnh tình trạng** trước khi bán — hoặc để trạng thái **Chờ kiểm tra**.

> **Đang nhập dở mà bấm ra ngoài?** Bấm ra ngoài hộp thoại, sang trang khác hay đóng tab, ứng dụng sẽ hỏi **Bỏ thay đổi chưa lưu?** — chọn **Ở lại** để giữ nguyên dữ liệu. Khi bấm Lưu/Xác nhận, hộp thoại hiện **Đang xử lý…** và không đóng được cho tới khi xong (không lo bấm hai lần).

#### Hủy phiếu nhập

Chỉ hủy được khi chưa có giao dịch nào dùng đến hàng đó; cần lý do và nhập lại mật khẩu.

#### Nhập nhanh một chiếc

*Vào: Đồng hồ → Thêm đồng hồ*

Điền một chiếc và giá nhập; hệ thống tạo phiếu và xác nhận ngay.

<a id="dong-ho"></a>

## Đồng hồ & tem QR

*Tìm kiếm, lọc, chi tiết chiếc, đổi giá/vị trí, in tem.* · Dành cho: Kho, Bán hàng, Chủ · Hiện cho người có quyền: `catalog.view`

### Trạng thái của một chiếc

Trạng thái chỉ đổi qua các thao tác nghiệp vụ (bán, giữ hàng, giao CTV, sửa chữa, kiểm tra…), không sửa tay được.

- **Danh sách** — Lọc theo trạng thái (Sẵn sàng bán, Đã giữ, Đang ở CTV, Đang sửa, Chờ kiểm tra, Đã bán, Thanh lý/mất), thương hiệu, loại, vị trí, tình trạng, **tồn lâu**.
- **Chi tiết chiếc** — Ảnh, giá, vị trí; các tab Thông tin, Ảnh, Giá, **Giá thu** (chỉ người có quyền), Lịch sử, Bảo hành & sửa chữa.
- **Sửa giá, vị trí, kiểm tra** — **Sửa giá** và khuyến mãi theo khoảng ngày (cần quyền sửa giá); **Đổi vị trí**; **Kiểm tra đạt** cho chiếc Chờ kiểm tra. **Ghi mất/Khôi phục** cần lý do và nhập lại mật khẩu.
- **Tem QR 50×30mm** — **In tem QR**; quét tem bằng ô quét ở thanh tìm kiếm để mở chiếc ngay.

#### Ảnh đồng hồ

Tải ảnh từ điện thoại/máy tính — ảnh được thu nhỏ ngay trên máy trước khi gửi (nhanh hơn, tiết kiệm mạng), có thanh tiến độ, nút **Hủy** và **Thử lại** khi mất mạng. Bấm vào ảnh để xem toàn màn hình: chụm/lăn chuột để phóng to, vuốt ngang để qua ảnh khác, **Esc** để đóng. Chủ cửa hàng xem dung lượng kho ảnh ở **Quản trị → Hệ thống**; ảnh giấy tờ của khách đã ẩn danh được xóa thật khỏi kho.

#### Loại & hãng, vị trí kho

Danh mục **Loại & hãng** và **Vị trí kho** do người quản lý danh mục chỉnh.

<a id="linh-kien"></a>

## Linh kiện

*Tồn kho linh kiện, điều chỉnh, sắp hết.* · Dành cho: Kho, Chủ · Hiện cho người có quyền: `part.view`

- **Danh sách** — Bộ lọc theo loại và **Sắp hết** (tồn ≤ mức đặt hàng lại).
- **Điều chỉnh tồn** — Chọn số lượng tăng/giảm và **ghi lý do** (≥ 10 ký tự); mọi điều chỉnh để lại lịch sử.
- **Nhập kho** — Linh kiện nhập qua **phiếu nhập**, trừ kho khi **xác nhận dùng** trong phiếu sửa hoặc khi bán lẻ.
- **Giá vốn** — Giá vốn bình quân chỉ hiện cho người có quyền xem giá vốn.

<a id="khach-hang"></a>

## Khách hàng & CCCD

*Tạo khách, trùng SĐT, xem CCCD đầy đủ, ẩn danh.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `customer.view`, `customer.view_own`, `customer.create`

**Tạo nhanh** chỉ cần tên (và SĐT). Trùng số điện thoại thì hệ thống hiện khách đã có để bạn **mở khách đó** hoặc **vẫn tạo mới**.

### Xem số CCCD/giấy tờ đầy đủ

1. **Mặc định chỉ thấy vài số cuối** — Số **CCCD/giấy tờ** được mã hóa; màn hình chỉ hiện vài số cuối.
2. **Bấm Xem đầy đủ** — Người có quyền bấm **Xem đầy đủ**, nêu lý do, nhập lại mật khẩu.
3. **Tự ẩn sau 30 giây** — Số hiện **30 giây** rồi tự ẩn và việc xem được ghi nhật ký.

Trang khách có **đồng hồ của khách**, phiếu còn nợ, giữ hàng/cọc và lịch sử mua.

> **Ẩn danh.** **Ẩn danh** (xóa dữ liệu cá nhân) chỉ người có quyền làm, cần lý do và **không hoàn tác**.

<a id="nhap-excel"></a>

## Nhập từ Excel (hàng loạt)

*Nhập khách hàng, đồng hồ tồn đầu kỳ, linh kiện từ tệp Excel/CSV — xem trước rồi mới ghi.* · Dành cho: Kho, Chủ · Hiện cho người có quyền: `customer.create`, `purchase.create`

Dùng khi chuyển từ sổ sách/Excel cũ sang WatchFlow.

*Vào: Menu → Nhập từ Excel*

Hoặc nút **Nhập Excel** ở màn **Khách hàng**, **Đồng hồ**, **Linh kiện** (chỉ hiện nếu bạn có quyền).

1. **Tải tệp mẫu** — Chọn loại dữ liệu và bấm **Tải tệp mẫu (.xlsx)**. Tệp có 3 sheet: **Dữ liệu** (cột + 2 dòng ví dụ, có chữ [VÍ DỤ] — hệ thống tự bỏ qua), **Hướng dẫn**, **Danh mục** (hãng/loại/vị trí/nhóm đang có trong cửa hàng để điền cho khớp).
2. **Điền và chọn tệp** — Điền dữ liệu (**tối đa 300 dòng mỗi lần**), lưu lại rồi chọn tệp (.xlsx hoặc .csv, tối đa 5 MB) hoặc kéo thả vào khung. Tên cột có dấu hay không dấu đều được; cột lạ bị bỏ qua.
3. **Xem trước** — Mỗi dòng là *Hợp lệ*, *Cảnh báo*, *Lỗi* (kèm lý do) hoặc *Trùng*. Chưa có gì được ghi. Sửa lỗi trong tệp rồi bấm **Chọn tệp khác**; tích chọn các dòng muốn nhập (dòng trùng mặc định **không** tích; dòng lỗi không thể nhập).
4. **Nhập** — Bấm **Nhập N dòng** (một lần — bấm đúp không nhập hai lần). Màn kết quả liệt kê từng dòng đã nhập kèm liên kết.

#### Khách hàng

Cột: Họ và tên (bắt buộc), SĐT, Email, Địa chỉ, Nhóm khách, Ghi chú, CCCD (tùy chọn, được mã hóa như khi tạo khách). SĐT được chuẩn hóa (+84, thiếu số 0 đầu đều được). **Trùng SĐT** với khách có sẵn hoặc với dòng khác trong tệp sẽ được báo — bạn chọn bỏ qua hay vẫn nhập.

#### Đồng hồ tồn đầu kỳ

Cột: Hãng, Loại/Model (bắt buộc — khớp theo mã hoặc tên), Serial, Tình trạng (bắt buộc: Mới / Cũ / Đã sửa), Hạng, **Giá vốn (giá thu)** (bắt buộc), Giá niêm yết, Vị trí kho, Ghi chú. Tất cả dòng nhập được ghi bằng **một phiếu “Tồn đầu kỳ”** xác nhận ngay: giá vốn đúng như trong tệp, kho tăng đúng số chiếc. Giá là số nguyên đồng (6000000 hoặc 6.000.000), không âm.

- Hàng **Cũ / Đã sửa** vào kho ở trạng thái **Chờ kiểm tra** (cần hạng tình trạng và ảnh mới chuyển được sang Sẵn sàng bán); hàng Mới vào thẳng Sẵn sàng bán.
- Chưa có loại trong danh mục: tạo ở **Đồng hồ → Loại & hãng**, hoặc (nếu bạn có quyền quản lý danh mục) bật **Tự tạo hãng/loại chưa có** trước khi chọn tệp.
- Serial đã có trong kho (cùng hãng) hoặc trùng trong tệp bị chặn. Ô Vị trí kho trống dùng **vị trí mặc định** bạn chọn.

#### Linh kiện

Cột: Mã, Tên, Danh mục (phải có sẵn), Đơn vị, Tồn đầu, Giá vốn, Ngưỡng cảnh báo, Giá bán. Tồn đầu > 0 được ghi bằng một phiếu “Tồn đầu kỳ”. Mã đã có sẽ báo **trùng**; nếu bạn vẫn chọn nhập, số lượng được **cộng thêm** vào tồn hiện có.

<a id="ctv"></a>

## Cộng tác viên (dành cho chủ)

*Giao hàng, đơn chờ xác nhận, quyết toán, thống kê.* · Dành cho: Chủ · Hiện cho người có quyền: `collab.view`, `collab.manage`

**Đường đi của một chiếc qua cộng tác viên:** **Giao hàng** (nhập giá thu từng chiếc) → **CTV tạo đơn** (chờ xác nhận) → **Chủ xác nhận** (chiếc thành Đã bán) → **Quyết toán** (CTV nộp tiền theo giá thu)

*(Hình minh họa: Ví dụ: giá thu 8.000.000 ₫, CTV bán 9.000.000 ₫)*

1. **Giao hàng** (*Vào: Nút + → Giao hàng cho CTV*) — Chọn CTV, chọn chiếc sẵn sàng bán và nhập **giá thu** từng chiếc (CTV bán cao hơn giá thu thì phần chênh là của CTV). Giá thu thấp hơn giá vốn sẽ có cảnh báo.
2. **Xác nhận đơn** — CTV tạo **đơn chờ xác nhận**; bạn mở đơn và bấm **Xác nhận** (chuông thông báo cho bạn biết).
3. **Quyết toán** — Chọn các dòng đã bán chưa nộp → tổng phải nộp → tiền mặt/chuyển khoản → xác nhận. Hủy quyết toán cần lý do và nhập lại mật khẩu.
4. **Thu hồi** — Thu hồi chiếc CTV chưa bán: chọn vị trí kho và lý do.
5. **Thống kê** — **Thống kê CTV** theo tháng/quý/năm: số chiếc, bán ra, phải nộp, phần CTV hưởng, đã/chưa nộp.

> **Doanh thu của cửa hàng.** Với đơn của CTV, doanh thu cửa hàng là **giá thu giao CTV**; phần CTV hưởng (giá bán − giá thu) không tính là doanh thu hay lãi của cửa hàng.

<a id="man-ctv"></a>

## Màn hình của cộng tác viên

*Hàng đang giữ, tạo đơn, đơn của tôi, thống kê.* · Dành cho: Cộng tác viên · Hiện cho người có quyền: `collab.view_own`

- **Hàng** — Các chiếc cửa hàng giao cho bạn kèm **giá thu** và số ngày giữ. Bạn không thấy giá vốn.
- **Đơn của tôi** — Trạng thái từng đơn, phần bạn hưởng và đã nộp tiền chưa.
- **Thống kê** — Số chiếc, tổng bán ra, phải nộp, phần tôi hưởng theo tháng/quý/năm.

### Tạo đơn bán

1. **Chọn chiếc** — Chọn chiếc đang giữ trong **Hàng**.
2. **Nhập giá bán thực** — Cảnh báo nếu thấp hơn giá thu.
3. **Chọn hoặc tạo khách** — Tên + SĐT.
4. **Gửi chờ xác nhận** — Cửa hàng xác nhận thì đơn mới tính.

<a id="sua-chua"></a>

## Sửa chữa

*Nhận máy, tiến độ, dịch vụ và linh kiện, giao máy, sửa nội bộ.* · Dành cho: Chủ · Hiện cho người có quyền: `repair.view`, `repair.create`

**Tiến độ một phiếu sửa:** **Đã nhận** → **Đang kiểm tra** → **Đang sửa** (có thể quay lại Chờ linh kiện) → **Hoàn thành** (khóa các dòng) → **Đã giao** (thu tiền, ghi doanh thu, cấp bảo hành)

### Nhận máy (5 bước)

1. **Khách** (*Vào: Sửa chữa → Nhận máy*)
2. **Máy**
3. **Tình trạng & lỗi**
4. **Cọc (tùy chọn)**
5. **Nhận máy** — Chụp ảnh máy (tùy chọn) và **in phiếu nhận**.

- **Dòng trong phiếu** — Thêm dòng **dịch vụ** (giá mặc định theo loại việc), **linh kiện** (bấm **Xác nhận dùng** để trừ kho) và **chi phí khác**. Sửa giá cần quyền riêng.
- **Hoàn thành & giao máy** — **Hoàn thành** khóa các dòng. **Giao máy**: thu tiền (hoặc ghi nợ), doanh thu ghi nhận lúc giao và cấp bảo hành sau sửa. **In phiếu giao**.
- **Hủy** — **Hủy** trước khi hoàn thành: hoàn linh kiện và hoàn cọc.
- **Sửa nội bộ** — Chọn **Máy của cửa hàng**: chi phí sửa được cộng vào **giá vốn** chiếc khi hoàn thành; chọn chiếc về kho hay chờ kiểm tra.

<a id="kiem-ke"></a>

## Kiểm kê

*Đếm chiếc và linh kiện, đối chiếu, chốt.* · Dành cho: Kho, Chủ · Hiện cho người có quyền: `stocktake.manage`

1. **Mở đợt** (*Vào: Kiểm kê → Mở đợt*) — Chọn phạm vi: tất cả chiếc, theo vị trí, linh kiện, hoặc tất cả.
2. **Đếm** — **Quét hoặc gõ mã** từng chiếc để đếm; với linh kiện nhập **số đếm**. Chiếc không thấy: bấm **Không thấy** và chọn lý do (mất, hư hỏng, nhập sai, đếm sai, tìm thấy, khác).
3. **Chốt** — Xem các dòng **Lệch**, rồi **Chốt**: linh kiện lệch tạo biến động tồn; chiếc mất được **ghi mất** (cần quyền ghi mất — nếu không, nhờ chủ chốt).

> **Lưu ý.** **Hủy đợt** bỏ toàn bộ số đếm, không điều chỉnh gì. Số hệ thống được lấy lại lúc chốt nên hàng bán trong lúc kiểm vẫn đúng.

<a id="bao-cao"></a>

## Báo cáo & Tổng quan

*Doanh thu, lãi gộp, tồn kho, công nợ, xuất Excel, in.* · Dành cho: Chủ · Hiện cho người có quyền: `report.sales`, `report.inventory`, `profit.view`, `debt.view`

- **Tổng quan** — Doanh thu, lãi gộp, thực thu, tồn kho, giá trị tồn theo **kỳ** bạn chọn, kèm **việc cần xử lý** (giữ hàng quá hạn, nợ đến hạn, máy sửa xong chưa giao, linh kiện sắp hết…). Mỗi người chỉ thấy phần mình có quyền.
- **Báo cáo** — Liệt kê các báo cáo bạn được xem. Chọn khoảng ngày và nhóm theo ngày/tháng/quý/năm, xem bảng kèm dòng tổng.
- **Xuất Excel & in** — **Xuất Excel** (cần quyền xuất) và **In / Lưu PDF** dùng cùng số liệu trên màn hình. Dòng “Dữ liệu đến lúc …” cho biết thời điểm tính.
- **Giá vốn và lãi** — Chỉ hiện cho người có quyền tương ứng.

> **Vì sao doanh thu, thực thu và lãi là ba con số khác nhau?** **Doanh thu** tính từ phiếu đã xác nhận; **thực thu** là tiền khách đã trả; **lãi gộp** là doanh thu trừ giá thu (giá vốn). Khách còn nợ thì doanh thu đã có nhưng thực thu chưa đủ.

<a id="quan-tri"></a>

## Quản trị & sao lưu

*Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.* · Dành cho: Chủ · Hiện cho người có quyền: `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health`

- **Người dùng** — Tạo tài khoản (mật khẩu tạm chỉ hiện **một lần** — sao chép gửi cho người dùng), khóa/mở khóa kèm lý do, đặt lại mật khẩu, đổi vai trò.
- **Vai trò & quyền** — Bật/tắt từng quyền theo nhóm; quyền nhạy cảm có nhãn. Vai trò Chủ luôn giữ quyền quản lý người dùng và vai trò.
- **Cài đặt** — Hạn giữ hàng, thời hạn bảo hành, ngưỡng cảnh báo, bảo mật… có hiệu lực ngay.
- **Hệ thống & sao lưu** — Tình trạng máy chủ, **lần sao lưu gần nhất**, tác vụ nền và lỗi gần đây. Nếu sao lưu quá cũ, hãy báo người phụ trách vận hành.

> **Giới hạn.** Chỉ **chủ cửa hàng** mới sửa được tài khoản chủ, vai trò Chủ và cài đặt bảo mật. Không ai tự đổi vai trò, tự khóa hay tự đặt lại mật khẩu của chính mình (dùng **Đổi mật khẩu**).

#### Thanh toán: hiện mã VietQR

Nhóm **Thanh toán** trong Cài đặt: ngân hàng (chọn từ danh sách, có ô tìm), số tài khoản, tên chủ tài khoản và mẫu nội dung chuyển khoản (“{code}” = mã phiếu) để hiện mã VietQR khi thu chuyển khoản; chưa nhập thì không hiện QR.

#### Nhật ký

Mọi thay đổi quan trọng (ai, khi nào, trước/sau) — không sửa được.

#### Hoạt động

Ai đã làm thao tác gì, lúc nào, kết quả (thành công/lỗi/bị từ chối) và từ máy nào — kể cả khi **xuất Excel, in phiếu, xem giá vốn, xem báo cáo, xem CCCD đầy đủ** (tick “Chỉ sự kiện nhạy cảm” để xem riêng). Lọc theo người, khu vực, khoảng ngày; tab **Đăng nhập** cho biết ai đăng nhập, sai mật khẩu, bị khóa tạm hay dùng thiết bị tin cậy.

Nhật ký **không ghi nội dung** bạn nhập hay số điện thoại/CCCD, chỉ ghi “làm gì” — không sửa/xóa được và tự dọn sau số ngày đặt ở Cài đặt (mặc định 180). Cần quyền xem nhật ký.

<a id="khi-co-loi"></a>

## Khi có lỗi

*Thông báo hay gặp và cách xử lý.* · Dành cho: Mọi người

> **Cần hỗ trợ?** Mỗi thông báo lỗi có câu giải thích và một mã dạng **WF-…**. Hãy **chụp màn hình kèm mã này** gửi người phụ trách.

| Thông báo / mã | Nghĩa là | Làm gì |
|---|---|---|
| Phiên đăng nhập đã hết hạn · `WF-AUTH-UNAUTHENTICATED` | Phiên dài nhất 30 ngày kể từ lần đăng nhập. | Đăng nhập lại. |
| Tài khoản bị khóa tạm · `WF-AUTH-LOCKED` | Nhập sai mật khẩu nhiều lần. | Chờ hết thời gian khóa hoặc nhờ chủ cửa hàng đặt lại mật khẩu. |
| Bạn không có quyền · `WF-AUTH-FORBIDDEN` | Việc này cần quyền khác. | Nhờ chủ cửa hàng cấp quyền. |
| Vui lòng nhập lại mật khẩu · `WF-SEC-REAUTH` | Thao tác nhạy cảm cần xác nhận lại. | Nhập mật khẩu (và mã 2 bước nếu có) rồi bấm lại. |
| Dữ liệu vừa được người khác sửa · `WF-CONFLICT-VERSION` | Có người khác vừa đổi cùng dữ liệu. | Tải lại trang rồi làm lại. Với phiếu bán nháp, bấm **Tải lại phiếu** trong thông báo. |
| Chiếc này không còn bán được / đã được giữ | Người khác vừa bán hoặc giữ. | Tải lại để xem trạng thái mới. |
| Thao tác quá nhiều lần · `WF-RATE-LIMIT` | Hệ thống tạm giới hạn. | Chờ vài phút. |
| Yêu cầu này đã được xử lý trước đó · `WF-BUSY` | Bạn vừa bấm hai lần. | Tải lại trang để xem kết quả, đừng tạo lại. |
| Lý do quá ngắn · `WF-REASON-REQUIRED` | Hủy/điều chỉnh cần lý do từ 10 ký tự. | Nhập lý do rõ hơn. |

> **Mất mạng.** Thao tác chưa gửi được sẽ báo lỗi; khi có mạng bấm lại — hệ thống chống tạo trùng chứng từ.
