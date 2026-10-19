# Hướng dẫn sử dụng WatchFlow

> Cập nhật lần cuối: 2026-10-19 · Phiên bản 0.16.0 · Sinh tự động từ `src/content/guide.ts` bằng `pnpm docs:guide` — đừng sửa tay. Trong ứng dụng: menu **Hướng dẫn** (chỉ hiện mục hợp với quyền của bạn; có nút **In / Lưu PDF**).

WatchFlow giúp chủ cửa hàng làm đúng **sáu việc**: quản lý đồng hồ đang có, ghi lại đơn khi khách mua, giao đồng hồ cho cộng tác viên (CTV) đi bán, quản lý máy khách đưa sửa, xem báo cáo doanh thu/số lượng, và cho CTV dùng ở mức giới hạn. Bạn chỉ thấy những mục **hợp với quyền của mình**; thiếu mục nào cần dùng, nhờ chủ cửa hàng cấp quyền ở Quản trị.

## Các loại tài khoản trong cửa hàng

- **Chủ cửa hàng** — Thấy tất cả: đồng hồ, đơn bán, giao hàng cho CTV và xác nhận CTV báo bán, sửa chữa (chỉ chủ), báo cáo doanh thu, quản trị người dùng, cài đặt và sao lưu.
- **Nhân viên bán hàng** — Ghi đơn bán, xác nhận CTV báo bán, tạo khách, xem đồng hồ và báo cáo bán hàng. Không giao hàng cho CTV, không xem hay sửa máy khách đưa sửa.
- **Quản lý kho** — Thêm đồng hồ, tem QR, vị trí kho, nhập Excel. Không ghi đơn bán.
- **Cộng tác viên** — Chỉ thấy đồng hồ được giao cho mình (kèm giá niêm yết), báo “Đã bán”, xem kết quả và số chiếc đã bán. Không thấy doanh thu, giá vốn, khách của người khác hay đơn của cửa hàng.

## Mục lục

1. [Bắt đầu nhanh](#bat-dau) — Làm quen màn hình, thanh điều hướng, nút “+”, tìm nhanh và số việc cần xử lý.
2. [Đăng nhập & xác thực 2 bước](#dang-nhap) — Mật khẩu, mã 6 số, mã khôi phục, thiết bị tin cậy, giao diện sáng/tối.
3. [Cài ứng dụng & thông báo](#cai-ung-dung) — Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.
4. [Ghi đơn bán](#ban-hang) — Khách mua chiếc nào, giá bao nhiêu, ngày nào — nhập một lần để tra cứu lại sau này.
5. [Đồng hồ & kho](#dong-ho) — Thêm đồng hồ, nhập Excel, giá, vị trí, tem QR.
6. [Khách hàng](#khach-hang) — Lưu họ tên, SĐT, địa chỉ để tra cứu lịch sử mua và sửa.
7. [Giao hàng cho cộng tác viên](#cong-tac-vien) — Một chiếc giao nhiều CTV; ai báo “Đã bán” trước được giữ; bạn xác nhận.
8. [Dành cho cộng tác viên](#man-ctv) — Xem hàng được giao, báo “Đã bán”, theo dõi kết quả và số chiếc đã bán.
9. [Sửa chữa (chỉ chủ)](#sua-chua) — Nhận máy khách đưa sửa, theo dõi tiến độ, tiền sửa, giao máy.
10. [Báo cáo](#bao-cao) — Doanh thu, số lượng đồng hồ, cộng tác viên — theo ngày, tháng, quý, năm.
11. [Quản trị & sao lưu](#quan-tri) — Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.
12. [Khi có lỗi](#khi-co-loi) — Thông báo hay gặp và cách xử lý.

<a id="bat-dau"></a>

## Bắt đầu nhanh

*Làm quen màn hình, thanh điều hướng, nút “+”, tìm nhanh và số việc cần xử lý.* · Dành cho: Mọi người

Bạn chỉ thấy những mục mình có quyền dùng. Nếu thiếu một mục cần thiết, nhờ chủ cửa hàng cấp quyền ở **Quản trị**.

### Làm quen giao diện

#### Điện thoại

*(Hình minh họa: Giao diện trên điện thoại)*

- **Thanh dưới cùng** có các mục chính theo công việc của bạn.
- Nút **+** ở giữa mở các **hành động hay dùng** (ghi đơn bán, thêm đồng hồ, giao hàng cho CTV, nhận máy sửa…).
- Mục **Menu** chứa các màn còn lại.
- Nút **Quay lại** ở đầu trang (hoặc nút Back của điện thoại) đưa bạn về màn trước.

#### Máy tính

*(Hình minh họa: Giao diện trên máy tính)*

- **① Thanh bên trái** liệt kê các mục theo nhóm; viên số cạnh mục là số việc cần xử lý. Ở cuối có công tắc **Sáng/Tối** và thẻ tài khoản.
- **② Ô tìm nhanh** (phím tắt `Ctrl + K`): tìm mã, serial, khách, đơn hoặc mở trang.
- **③ Quét QR và chuông**: quét tem đồng hồ; chuông là thông báo dành cho bạn.
- **④ Nút hành động chính** (màu gradient) — thường là Ghi đơn bán.

### Tìm nhanh

1. **Mở ô tìm nhanh** — Nhấn **Ctrl+K** (Mac: **⌘K**) hoặc phím **/**, hay bấm nút kính lúp (thanh trên máy tính, đầu trang trên điện thoại).
2. **Gõ mã hoặc tên** — Gõ **mã nội bộ, serial, tên đồng hồ, tên/số điện thoại khách, mã đơn** — không cần gõ dấu. Kết quả gom theo nhóm và chỉ gồm phần bạn có quyền xem.
3. **Mở kết quả** — Gõ đúng mã hoặc serial rồi nhấn **Enter** là mở thẳng chiếc đó. Ô trống cho bạn các **hành động nhanh** và danh sách **trang**; **↑↓** để chọn, **Esc** để đóng.

### Số việc cần xử lý

Viên số cạnh mục trên thanh dưới, thanh bên và Menu cho biết còn bao nhiêu việc: **vàng** là đang chờ, **đỏ** là có việc quá hạn (CTV báo bán chờ hơn một ngày, máy sửa quá hẹn hoặc xong chưa lấy). Số tự cập nhật mỗi phút.

- **Quét QR** — Nút quét QR mở camera (hoặc ô nhập mã nếu máy không có camera).
- **Chuông thông báo** — Cho biết việc mới: CTV báo đã bán cần xác nhận, kết quả báo bán của CTV, đồng hồ mới được giao…
- **Dải cảnh báo** — Chủ cửa hàng thấy dải cảnh báo phía trên khi việc chạy nền quá hạn, sao lưu lỗi hoặc kho ảnh sắp đầy; bấm để mở **Quản trị → Hệ thống**.

> **Số tiền.** Số tiền luôn hiển thị dạng **8.200.000 ₫**; mọi con số do máy chủ tính, màn hình chỉ hiển thị.

> **Mất mạng.** Biểu ngữ vàng hiện lên; bạn vẫn nhập được nhưng **chưa thể lưu** cho tới khi có mạng lại.

<a id="dang-nhap"></a>

## Đăng nhập & xác thực 2 bước

*Mật khẩu, mã 6 số, mã khôi phục, thiết bị tin cậy, giao diện sáng/tối.* · Dành cho: Mọi người

### Đăng nhập lần đầu

1. **Đăng nhập** — Nhập email và mật khẩu được cấp. Sai nhiều lần tài khoản bị khóa tạm — màn hình báo còn mấy lần thử.
2. **Đổi mật khẩu tạm** — Lần đầu dùng mật khẩu tạm bạn phải **đổi mật khẩu** ngay.
3. **Bật xác thực 2 bước** — Vai trò bắt buộc **xác thực 2 bước**: quét mã QR bằng ứng dụng Authenticator, nhập mã 6 số, rồi **lưu mã khôi phục** (chỉ hiện một lần).

> **Mất điện thoại?** Ở màn nhập mã chọn **Dùng mã khôi phục** và nhập một mã còn dùng được (mỗi mã dùng một lần).

#### Tin cậy thiết bị này

Ở bước nhập mã 6 số có ô **“Tin cậy thiết bị này … ngày”**. Chỉ tick trên **máy của riêng bạn**: những lần đăng nhập sau trên máy đó (cùng trình duyệt) chỉ cần **mật khẩu**, không hỏi mã 6 số. Mật khẩu vẫn luôn phải đúng, và với thao tác nhạy cảm (đặt lại mật khẩu, tắt xác thực 2 bước, hủy đơn…) hệ thống vẫn hỏi lại mật khẩu **và mã 2 bước**.

Thiết bị tự hết tin cậy khi hết hạn, khi bạn **đổi mật khẩu**, khi chủ cửa hàng **đặt lại mật khẩu hoặc khóa** tài khoản, hoặc khi bạn tắt xác thực 2 bước.

*Muốn bỏ ngay: Tài khoản → Thiết bị tin cậy → Bỏ*

Bấm **Bỏ** từng máy hoặc **Quên các thiết bị đã tin cậy**. Mất máy? Đổi mật khẩu là đủ để thu hồi tất cả.

#### Thiết bị đang đăng nhập

Vào **Tài khoản** để xem các thiết bị và **thu hồi** thiết bị lạ. Với thao tác nhạy cảm (đổi vai trò, hủy đơn…) hệ thống hỏi **nhập lại mật khẩu**.

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

## Ghi đơn bán

*Khách mua chiếc nào, giá bao nhiêu, ngày nào — nhập một lần để tra cứu lại sau này.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `sale.confirm`, `sale.view`

Đơn bán chỉ lưu **chiếc đã bán + khách + giá + ngày** (và hạn bảo hành). Hệ thống **không** theo dõi thanh toán, công nợ, giảm giá hay thu cũ — khách trả bao nhiêu, bằng cách nào là việc của cửa hàng.

*Vào: Bán hàng → Ghi đơn bán*

### Ghi một đơn

1. **Chọn chiếc khách mua** — Tìm theo **mã nội bộ, serial hoặc tên** (hoặc quét tem QR). Chọn nhiều chiếc nếu khách mua nhiều. Chỉ chiếc **Sẵn sàng bán** mới chọn được.
2. **Nhập giá bán** — Ô giá tự điền **giá niêm yết**; sửa nếu bán giá khác. Có thể đổi **hạn bảo hành** từng chiếc (mặc định hàng mới 12 tháng, hàng cũ 3 tháng, hoặc không bảo hành).
3. **Nhập khách** — Gõ tên/SĐT để chọn **khách đã có**, hoặc nhập **họ tên (+ SĐT)** khách mới — cùng SĐT hệ thống dùng lại khách cũ.
4. **Chọn ngày bán, ghi chú, Lưu đơn** — Ngày mặc định là hôm nay (ghi lùi tối đa vài ngày theo cài đặt). Bấm **Lưu đơn** — đơn có mã `HD-…` và chiếc chuyển sang **Đã bán**.

> **Nhập sai?** Mở đơn → **Hủy đơn** (kèm lý do, trong vòng 24 giờ, cần nhập lại mật khẩu). Chiếc quay về kho, bạn ghi lại đơn đúng.

- **Tra cứu đơn cũ** — Ở **Bán hàng** gõ tên/SĐT khách, mã đơn hoặc serial; lọc **Bán tại cửa hàng / CTV bán / Đã hủy**.
- **Lịch sử của khách** — Mở **Khách hàng** → chọn khách để xem các đơn đã mua và các lần gửi sửa.
- **In phiếu** — Mở đơn → **In phiếu** (khổ 80mm hoặc PDF). Phiếu in kèm hạn bảo hành từng chiếc; lần in thứ hai ghi “BẢN IN LẠI”.
- **Đơn do CTV bán** — Khi bạn xác nhận CTV báo bán, hệ thống tự tạo đơn (có ghi tên CTV). Doanh thu = giá bạn xác nhận.

<a id="dong-ho"></a>

## Đồng hồ & kho

*Thêm đồng hồ, nhập Excel, giá, vị trí, tem QR.* · Dành cho: Kho, Chủ · Hiện cho người có quyền: `catalog.view`

### Trạng thái của một chiếc

Trạng thái chỉ đổi qua các thao tác nghiệp vụ (bán, kiểm tra, sửa…), không sửa tay được. **Chiếc đang giao cho CTV vẫn là “Sẵn sàng bán”** — cửa hàng vẫn bán trực tiếp được.

### Thêm một chiếc vào kho

1. **Mở form** (*Vào: Đồng hồ → Thêm đồng hồ*)
2. **Điền thông tin** — Chọn **loại đồng hồ**, **serial**, **tình trạng** (mới/cũ), **vị trí lưu kho** và **giá niêm yết**. Loại chưa có: tạo ở **Đồng hồ → Loại & hãng**.
3. **Lưu** — Hàng **mới** vào thẳng “Sẵn sàng bán”. Hàng **cũ** vào “Chờ kiểm tra”: chụp ảnh, ghi hạng rồi bấm **Kiểm tra đạt** ở trang chiếc.

> **Nhập nhiều chiếc cùng lúc.** **Menu → Nhập từ Excel** (hoặc nút ở trang Đồng hồ): tải tệp mẫu, điền, rồi xem trước từng dòng trước khi ghi. Cùng chỗ đó nhập được **khách hàng** hàng loạt.

- **Danh sách** — Lọc theo trạng thái (Sẵn sàng bán, Chờ kiểm tra, Đang sửa, Đã bán, Thanh lý/mất), thương hiệu, loại, vị trí, tình trạng.
- **Chi tiết chiếc** — Ảnh, giá, vị trí; các tab Thông tin, Ảnh, Giá, Lịch sử. Từ đây bấm **Bán** hoặc **Giao CTV** cho chiếc này.
- **Sửa giá, vị trí, kiểm tra** — **Sửa giá** và khuyến mãi theo khoảng ngày; **Đổi vị trí**; **Kiểm tra đạt** cho chiếc Chờ kiểm tra. **Ghi mất/Khôi phục** cần lý do và nhập lại mật khẩu.
- **Tem QR 50×30mm** — **In tem QR**; quét tem bằng ô quét ở thanh tìm kiếm để mở chiếc ngay.

<a id="khach-hang"></a>

## Khách hàng

*Lưu họ tên, SĐT, địa chỉ để tra cứu lịch sử mua và sửa.* · Dành cho: Bán hàng, Chủ · Hiện cho người có quyền: `customer.view`, `customer.view_own`

Khách được lưu **tự động** khi bạn ghi đơn bán hoặc nhận máy sửa; bạn cũng có thể thêm trước ở **Khách hàng → Thêm**. Mỗi khách có: họ tên, SĐT, địa chỉ, ghi chú, danh sách đồng hồ của khách, lịch sử mua và sửa.

> **Trùng số điện thoại.** Thêm khách có SĐT đã tồn tại, hệ thống cho bạn mở khách đó hoặc chọn “Vẫn tạo khách mới”. Khi ghi đơn/nhận máy, cùng SĐT sẽ dùng lại khách cũ.

<a id="cong-tac-vien"></a>

## Giao hàng cho cộng tác viên

*Một chiếc giao nhiều CTV; ai báo “Đã bán” trước được giữ; bạn xác nhận.* · Dành cho: Chủ, Bán hàng · Hiện cho người có quyền: `collab.manage`, `collab.view`, `sale.confirm`

CTV (cộng tác viên) đi bán giúp. Bạn **không cần ghi giá thu hay quyết toán**: CTV bán giá nào là việc của họ, cửa hàng chỉ cần biết chiếc đã bán được.

*(Hình minh họa: Một chiếc giao cho 3 CTV: CTV nào báo “Đã bán” trước được giữ chiếc)*

**Luồng một chiếc:** **Giao cho 1 hay nhiều CTV** (Chiếc vẫn ở kho) → **CTV báo “Đã bán”** (Tên + SĐT khách; ai trước được) → **Bạn xác nhận** (Giá mặc định = giá niêm yết) → **Đơn bán + Đã bán** (CTV khác tự mất chiếc)

### Giao đồng hồ

1. **Mở trang giao hàng** (*Vào: Cộng tác viên → Giao đồng hồ*)
2. **Chọn chiếc** — Tìm theo mã/serial/tên. Chọn được nhiều chiếc một lần. Chỉ chiếc “Sẵn sàng bán” giao được.
3. **Chọn cộng tác viên** — Tick **một hoặc nhiều CTV** (hoặc “Chọn tất cả CTV”). Mỗi CTV nhận thông báo và thấy chiếc trong **Hàng của tôi**.
4. **Bấm Giao** — Muốn thu hồi: **Cộng tác viên → Hàng đang giao** → mở chiếc → **Thu hồi** (một CTV hoặc tất cả).

### Khi CTV báo đã bán

1. **Nhận thông báo** — Chuông + viên số vàng ở mục **Cộng tác viên**; hoặc vào **Cộng tác viên → Báo bán**.
2. **Xác nhận** — Kiểm tra khách (gọi nếu cần), sửa **giá bán** nếu khác giá niêm yết, chọn ngày và bảo hành, bấm **Xác nhận đã bán**.
3. **Hoặc từ chối** — Bấm **Từ chối** kèm lý do (từ 10 ký tự): chiếc vẫn còn cho các CTV khác báo, CTV bị từ chối nhận thông báo.

| Tình huống | Hệ thống xử lý |
|---|---|
| Hai CTV báo cùng lúc | Chỉ người báo trước được ghi nhận; người sau nhận thông báo “đã có CTV khác báo bán trước”. |
| Đang chờ xác nhận mà cửa hàng bán chiếc đó | Bị chặn — hãy xác nhận hoặc từ chối báo bán trước. |
| Chiếc bị ghi mất / chuyển “Chờ kiểm tra” | Mọi chào hàng tự đóng; báo bán đang chờ tự huỷ. |
| Hủy đơn do CTV bán (trong 24 giờ) | Chiếc về “Sẵn sàng bán”; chào hàng không tự mở lại — giao lại nếu cần. |

> **Doanh thu của chiếc CTV bán.** Bằng **giá bạn xác nhận** (mặc định giá niêm yết), tính vào doanh thu cửa hàng ở ngày bán. Số chiếc và doanh thu từng CTV xem ở **Báo cáo → Cộng tác viên** (theo ngày/tháng/quý/năm). CTV không thấy các số này.

<a id="man-ctv"></a>

## Dành cho cộng tác viên

*Xem hàng được giao, báo “Đã bán”, theo dõi kết quả và số chiếc đã bán.* · Dành cho: Cộng tác viên · Hiện cho người có quyền: `collab.view_own`

- **Hàng của tôi** — Các chiếc cửa hàng giao cho bạn, kèm **giá niêm yết** tham khảo. Chiếc có thể cũng được giao cho CTV khác.
- **Báo bán của tôi** — Các lần bạn báo “Đã bán” và kết quả: chờ xác nhận, đã xác nhận, bị từ chối (kèm lý do).
- **Thống kê** — Số chiếc bạn bán được theo ngày/tháng/quý/năm. Không hiển thị tiền.
- **Tài khoản của tôi** — Đổi mật khẩu, giao diện sáng/tối, thông báo trên điện thoại.

### Khi bán được một chiếc

1. **Mở Hàng của tôi** — Tìm chiếc đã bán, bấm **Đã bán**.
2. **Nhập khách** — Họ tên và **số điện thoại** khách (bắt buộc), ghi chú nếu có. **Không cần nhập giá** — cửa hàng tự xác nhận.
3. **Chờ xác nhận** — Bạn nhận thông báo khi cửa hàng xác nhận hoặc từ chối. Báo nhầm? Vào **Báo bán của tôi** → **Rút lại báo bán** (khi còn chờ).

> **Ai báo trước được giữ.** Nếu chiếc được giao cho nhiều CTV, người báo “Đã bán” **trước** sẽ giữ chiếc; chiếc hiện “CTV khác đã báo bán” ở máy của người sau. Khi cửa hàng xác nhận, chiếc biến khỏi danh sách của các CTV còn lại.

> **Bạn không thấy gì?** CTV chỉ thấy chiếc được giao cho mình. Doanh thu, giá vốn, đơn và khách của cửa hàng không hiển thị với CTV.

<a id="sua-chua"></a>

## Sửa chữa (chỉ chủ)

*Nhận máy khách đưa sửa, theo dõi tiến độ, tiền sửa, giao máy.* · Dành cho: Chủ · Hiện cho người có quyền: `repair.view`

Chỉ người có quyền sửa chữa (mặc định **chủ cửa hàng**) thấy mục này. Phiếu sửa lưu **khách + máy + lỗi + tiến độ + tiền sửa**; không có linh kiện, cọc hay công nợ.

**Tiến độ một phiếu sửa:** **Đã nhận** → **Đang kiểm tra** → **Đang sửa** (hoặc Chờ linh kiện) → **Sửa xong** → **Đã giao** (ghi doanh thu)

### Nhận một máy

1. **Mở form** (*Vào: Sửa chữa → Nhận máy*)
2. **Khách** — Tìm khách cũ hoặc nhập họ tên + **SĐT** (bắt buộc).
3. **Máy & lỗi** — Chọn đồng hồ đã có trong hồ sơ khách hoặc nhập thương hiệu/loại/serial; ghi **lỗi khách mô tả**, tình trạng lúc nhận, ngày hẹn trả. Máy còn bảo hành của cửa hàng: chọn để **sửa miễn phí**.
4. **In phiếu nhận** — Bấm **Nhận máy & lập phiếu**, in phiếu cho khách và chụp ảnh máy (tùy chọn).

### Trong lúc sửa

1. **Đổi tiến độ** — Bấm **Bắt đầu kiểm tra → Bắt đầu sửa**, hoặc **Chờ linh kiện** khi đang đợi hàng.
2. **Ghi tiền sửa** — **Thêm khoản**: chọn loại việc (giá mặc định) hoặc khoản khác tự nhập (dây da, gia công ngoài…). Sửa giá cần quyền sửa giá.
3. **Sửa xong → Giao máy** — Bấm **Sửa xong** (khóa các khoản), rồi **Giao máy** khi khách đến lấy: doanh thu sửa chữa được ghi nhận **lúc giao** và bắt đầu bảo hành sau sửa.

> **Hủy phiếu.** Phiếu chưa sửa xong có thể **Hủy** (lý do từ 10 ký tự). Đã giao thì bị khóa, không hủy được.

<a id="bao-cao"></a>

## Báo cáo

*Doanh thu, số lượng đồng hồ, cộng tác viên — theo ngày, tháng, quý, năm.* · Dành cho: Chủ, Bán hàng · Hiện cho người có quyền: `report.sales`, `report.inventory`, `collab.view`

*Vào: Báo cáo*

| Báo cáo | Cho biết | Ai xem |
|---|---|---|
| Doanh thu | Bán tại cửa hàng + CTV bán + sửa chữa, kèm số đơn và số chiếc, theo ngày/tháng/quý/năm | Người có quyền báo cáo bán hàng |
| Số lượng đồng hồ | Đã bán trong kỳ (theo hãng, theo kênh) và đang có trong kho theo hãng | Báo cáo bán hàng hoặc kho |
| Cộng tác viên | Số chiếc và doanh thu từng CTV mang về, theo kỳ | Chỉ người được xem CTV (chủ) |

1. **Chọn báo cáo** — Mở một báo cáo ở trang Báo cáo; biểu đồ phía trên cho cái nhìn nhanh.
2. **Chọn khoảng thời gian** — 7 ngày / 30 ngày / Tháng này / Quý / Năm / Tùy chọn, và **nhóm theo** ngày, tháng, quý hoặc năm.
3. **Xuất hoặc in** — **Xuất Excel** (giới hạn vài lần mỗi giờ, có ghi nhật ký) hoặc **In / Lưu PDF**.

> **Doanh thu tính từ đâu?** Từ **đơn bán đã ghi** (theo ngày bán) và **phiếu sửa đã giao** (theo ngày giao) — không tính từ tiền thu. Đơn đã hủy không được tính.

<a id="quan-tri"></a>

## Quản trị & sao lưu

*Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.* · Dành cho: Chủ · Hiện cho người có quyền: `user.manage`, `role.manage`, `settings.view`, `audit.view`, `system.health`

- **Người dùng** — Tạo tài khoản (mật khẩu tạm chỉ hiện **một lần** — sao chép gửi cho người dùng), khóa/mở khóa kèm lý do, đặt lại mật khẩu, đổi vai trò. Muốn có CTV: tạo người dùng vai trò **Cộng tác viên**.
- **Vai trò & quyền** — Bật/tắt từng quyền theo nhóm; quyền nhạy cảm có nhãn. Vai trò Chủ luôn giữ quyền quản lý người dùng và vai trò.
- **Cài đặt** — Thông tin cửa hàng in trên phiếu, hạn bảo hành, cửa sổ hủy đơn, bảo mật… có hiệu lực ngay.
- **Hệ thống & sao lưu** — Tình trạng máy chủ, **lần sao lưu gần nhất**, tác vụ nền và lỗi gần đây. Nếu sao lưu quá cũ, hãy báo người phụ trách vận hành.

> **Giới hạn.** Chỉ **chủ cửa hàng** mới sửa được tài khoản chủ, vai trò Chủ và cài đặt bảo mật. Không ai tự đổi vai trò, tự khóa hay tự đặt lại mật khẩu của chính mình (dùng **Đổi mật khẩu**).

#### Nhật ký

Một trang, hai mục: **Thay đổi dữ liệu** (ai sửa gì, khi nào, trước/sau — không sửa được) và **Truy cập & đăng nhập** (ai làm thao tác gì, từ máy nào, ai đăng nhập hay sai mật khẩu; lọc theo người, khu vực, khoảng ngày).

Nhật ký **không ghi nội dung** bạn nhập hay số điện thoại khách, chỉ ghi “làm gì” — không sửa/xóa được và tự dọn sau số ngày đặt ở Cài đặt (mặc định 180).

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
| Chiếc không còn sẵn sàng bán · `WF-SALE-UNIT-UNAVAILABLE` | Chiếc vừa được bán hoặc chuyển trạng thái. | Tải lại và bỏ chiếc đó khỏi đơn. |
| Chiếc đang có CTV báo bán · `WF-SALE-UNIT-CLAIMED` | Có báo bán chờ xác nhận cho chiếc này. | Vào Cộng tác viên → Báo bán, xác nhận hoặc từ chối trước. |
| Đã có CTV khác báo bán trước · `WF-COL-CLAIMED` | Người báo trước đang giữ chiếc, chờ cửa hàng xác nhận. | Chờ kết quả; nếu bị từ chối, chiếc mở lại cho bạn. |
| Quá thời hạn hủy đơn · `WF-SALE-VOID-EXPIRED` | Chỉ hủy đơn trong thời hạn đặt ở Cài đặt (mặc định 24 giờ). | Liên hệ chủ cửa hàng để xử lý riêng. |
| Dữ liệu vừa được người khác sửa · `WF-CONFLICT-VERSION` | Có người khác vừa đổi cùng dữ liệu. | Tải lại trang rồi làm lại. |
| Thao tác quá nhiều lần · `WF-RATE-LIMIT` | Hệ thống tạm giới hạn. | Chờ vài phút. |
| Yêu cầu này đã được xử lý trước đó · `WF-BUSY` | Bạn vừa bấm hai lần. | Tải lại trang để xem kết quả, đừng tạo lại. |
| Lý do quá ngắn · `WF-REASON-REQUIRED` | Hủy/từ chối cần lý do từ 10 ký tự. | Nhập lý do rõ hơn. |

> **Mất mạng.** Thao tác chưa gửi được sẽ báo lỗi; khi có mạng bấm lại — hệ thống chống tạo trùng đơn khi bạn bấm hai lần.
