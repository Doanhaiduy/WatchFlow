// Nhật ký thay đổi — mục mới nhất ở ĐẦU. `pnpm version:bump` thêm mục; `pnpm build` hỏng nếu phiên bản lệch package.json
// hoặc còn chữ TODO. Hiện ở cuối trang Hướng dẫn (“Có gì mới”).
export type ChangelogEntry = { version: string; date: string; title: string; items: string[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.16.0",
    date: "2026-10-19",
    title: "Rút gọn về đúng việc của cửa hàng: ghi đơn bán, giao đồng hồ cho nhiều CTV, sửa chữa, báo cáo gọn",
    items: [
      "Làm gọn theo đúng việc của chủ cửa hàng: quản lý đồng hồ đang có, ghi đơn khi khách mua, giao đồng hồ cho cộng tác viên (CTV) bán, nhận–sửa–giao máy sửa chữa, và xem báo cáo. Các phần ít dùng đã được bỏ khỏi giao diện: thanh toán/công nợ/QR chuyển khoản, giữ hàng & đặt cọc, thu cũ đổi mới, nhập hàng nhiều dòng, linh kiện, kiểm kê, giá vốn & lãi gộp, quyết toán CTV, trang tra cứu bảo hành. Dữ liệu cũ vẫn được giữ nguyên trong hệ thống.",
      "Ghi đơn bán chỉ cần: chọn chiếc, nhập khách (chọn sẵn hoặc gõ tên + số điện thoại), giá và ngày — kèm hạn bảo hành từng chiếc. Lưu là có đơn ngay, tra cứu lại theo tên, số điện thoại, mã đơn hoặc serial; in phiếu có hạn bảo hành; hủy đơn nhập nhầm trong 24 giờ.",
      "Giao đồng hồ cho cộng tác viên: một chiếc giao được cho nhiều CTV cùng lúc, chiếc vẫn bán được tại cửa hàng. CTV nào bấm “Đã bán” trước (kèm tên và số điện thoại khách) thì được giữ; chủ xác nhận (giá mặc định là giá niêm yết, sửa được) hoặc từ chối. CTV khác tự mất chiếc đó và được báo.",
      "Cộng tác viên chỉ thấy hàng được giao (kèm giá niêm yết), báo bán của mình và số chiếc bán được — không thấy doanh thu, giá vốn, đơn hay khách. Chủ xem số chiếc và doanh thu từng CTV mang về theo ngày, tháng, quý, năm.",
      "Sửa chữa gọn hơn (chỉ chủ): nhận máy trong một trang (khách có số điện thoại, máy, lỗi, hẹn trả, chọn bảo hành miễn phí nếu còn hạn), ghi khoản tiền sửa, sửa xong, giao máy ghi doanh thu, in phiếu.",
      "Báo cáo còn 3 loại dễ hiểu — Doanh thu, Số lượng đồng hồ, Cộng tác viên — xem theo ngày/tháng/quý/năm, xuất Excel và in. Tổng quan gọn theo quyền từng người.",
      "Gọn menu: Nhật ký và Hoạt động gộp một trang, bỏ tab Phiên bản (xem “Có gì mới” cuối trang Hướng dẫn), Nhập Excel chỉ còn khách và đồng hồ, Cài đặt/Vai trò ẩn mục của tính năng đã bỏ. Hướng dẫn sử dụng viết lại theo từng việc.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-17",
    title: "Giao diện sinh động hơn: Tổng quan có biểu đồ, thẻ số liệu có biểu tượng, ảnh đồng hồ vẽ, dải số liệu ở các trang danh sách",
    items: [
      "Tổng quan làm lại theo mẫu đã duyệt: thẻ doanh thu có so sánh với kỳ trước (▲/▼), thẻ số liệu có biểu tượng màu và đường xu hướng, biểu đồ doanh thu & lãi gộp (kể cả hôm nay — các ngày không bán được điền 0 nên biểu đồ không còn bị ẩn), biểu đồ bán hàng so với sửa chữa, tồn kho theo trạng thái và theo hãng, thực thu theo hình thức, “Làm nhanh”. Trên điện thoại, “Việc cần xử lý” nằm ngay sau thẻ số liệu.",
      "Đồng hồ chưa có ảnh thật hiện ảnh vẽ theo hãng/loại (đồng hồ thép, vàng, G-Shock…) ở danh sách, tìm kiếm khi bán hàng, giỏ phiếu bán, chi tiết chiếc và hồ sơ khách — cùng một loại luôn cùng một kiểu.",
      "Các trang Đồng hồ, Sửa chữa, Bán hàng, Khách hàng, Giữ hàng, Linh kiện có dải số liệu đầu trang (bấm vào thẻ để lọc); giữ hàng và bảo hành có vòng thời hạn còn lại; phiếu bán có vòng % đã thu và biểu tượng cho từng khoản thanh toán.",
      "Khách hàng, cộng tác viên, người dùng có avatar màu; hồ sơ khách và trang Tài khoản có thẻ đầu trang; trang Quản trị dạng ô biểu tượng; trang Báo cáo có biểu đồ doanh thu & lãi gộp, cột theo tháng, tồn theo hãng và biểu tượng màu cho từng báo cáo.",
    ],
  },
  {
    version: "0.14.2",
    date: "2026-10-17",
    title: "Sửa huy hiệu số việc, tự lưu nháp POS bền hơn, làm lại trang Hướng dẫn",
    items: [
      "Sửa viên số việc cần xử lý ở thanh bên/Menu: số không còn bị lệch lên góc trên viên tròn.",
      "Bán hàng: tự lưu nháp ổn định hơn — mở lại phiếu nháp không còn tự ghi lại; nếu lệch phiên bản do mất mạng giữa chừng thì tự lưu lại êm, còn khi người khác sửa thật thì báo rõ và có nút “Tải lại phiếu” thay vì kẹt lỗi. Nút Thanh toán chỉ mở khi phiếu đã lưu khớp với màn hình.",
      "Bán hàng: nút “Linh kiện lẻ / Thêm máy cũ” không còn dính sát danh sách chiếc; tên đồng hồ trong danh sách tìm được xuống dòng thay vì bị cắt; thanh cuộn của phiếu bán gọn hơn; ô tìm nhanh trên thanh trên co lại vừa phải ở màn hẹp.",
      "Trang Hướng dẫn sử dụng làm lại cho trực quan: thẻ “Bắt đầu nhanh”, tìm không dấu, công tắc “Dành cho tôi / Tất cả mục”, mục lục dính, các bước có đánh số, ghi chú theo mức độ, đường dẫn menu, bảng, sơ đồ luồng, hình minh họa giao diện, liên kết sâu tới từng mục và nút In / Lưu PDF.",
    ],
  },
  {
    version: "0.14.1",
    date: "2026-10-17",
    title: "Sửa đua dữ liệu hủy đơn CTV và quyết toán; công cụ triển khai staging/production",
    items: [
      "Sửa lỗi hiếm ở cộng tác viên: nếu chủ hủy một đơn đúng lúc đang quyết toán chính đơn đó, hệ thống có thể vừa hủy đơn vừa ghi nhận tiền nộp. Giờ quyết toán bị chặn và báo đơn vừa bị hủy.",
      "Chuẩn bị đưa lên máy chủ thật (staging/production): công cụ dựng cơ sở dữ liệu và cấu hình tự động — không đổi cách dùng.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-10-17",
    title: "Tiện ích từ Lưu Xá: VietQR, Ctrl+K, nhập Excel, PWA",
    items: [
      "Chuyển khoản bằng mã VietQR có sẵn số tiền và nội dung (POS, thu thêm, cọc giữ hàng, nhận/giao máy sửa, CTV nộp tiền) — cài số tài khoản ở Quản trị → Cài đặt → Thanh toán.",
      "Tải PDF tiếng Việt cho phiếu bán, phiếu sửa và phiếu bảo hành để gửi khách qua Zalo; bản tải lại có dòng “BẢN IN LẠI”.",
      "Tìm nhanh toàn cục: Ctrl+K (hoặc nút kính lúp trên điện thoại) — tìm chiếc, khách, linh kiện, mã phiếu và đi tới hành động nhanh.",
      "Số việc cần xử lý hiện ngay trên thanh điều hướng; chủ cửa hàng thấy dải cảnh báo khi sao lưu, tác vụ nền hoặc dung lượng có vấn đề.",
      "Nhập Excel hàng loạt khách hàng, đồng hồ tồn đầu kỳ và linh kiện: tệp mẫu, xem trước từng dòng, báo trùng trước khi ghi.",
      "Hỏi trước khi đóng biểu mẫu chưa lưu; chặn bấm đúp khi đang lưu; ô “Nguồn hàng” gợi ý các nguồn đã dùng.",
      "Cài WatchFlow lên màn hình chính; cảnh báo khi mở trong Zalo/Facebook kèm nút mở bằng Chrome; trang báo mất mạng thân thiện; nhận thông báo trên điện thoại (cần cấu hình khi triển khai).",
      "Quản trị → Hoạt động: ai đã làm gì, xem/in/xuất dữ liệu nhạy cảm, lịch sử đăng nhập. Tùy chọn “Tin cậy thiết bị này 30 ngày” ở bước xác thực 2 bước.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-17",
    title: "Đối ứng Lưu Xá: log lỗi, ảnh & lưu trữ",
    items: [
      "Ảnh được thu nhỏ ngay trên điện thoại trước khi tải lên (nhanh hơn trên 4G), có thanh tiến độ %, nút hủy và thử lại.",
      "Xem ảnh phóng to: chụm/lăn để zoom, vuốt qua lại giữa các ảnh, xoay, tải về — ở chi tiết đồng hồ, phiếu sửa, phiếu nhập.",
      "Bảo vệ dữ liệu cá nhân: ảnh giấy tờ đã xóa (kể cả khi ẩn danh khách) được xóa thật khỏi kho lưu trữ; ảnh thường xóa sau 7 ngày.",
      "Quản trị → Hệ thống: theo dõi dung lượng lưu trữ theo loại ảnh, dự kiến ngày đầy, cảnh báo khi gần hết hạn mức.",
      "Ghi nhận lỗi giao diện trên máy người dùng (không kèm dữ liệu cá nhân) để đội kỹ thuật sửa nhanh; thông báo lỗi mạng dễ hiểu hơn.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-17",
    title: "Giao diện sáng/tối & tối ưu trải nghiệm",
    items: [
      "Giao diện tối: chọn Sáng / Tối / Theo hệ thống ở menu tài khoản (lưu trên từng thiết bị); trang in luôn nền trắng.",
      "Ô chọn và chọn ngày mới đồng bộ giao diện: trên điện thoại mở dạng tờ trượt, có ô tìm không dấu, lịch tiếng Việt, gõ ngày dd/mm/yyyy; báo cáo chọn khoảng ngày.",
      "Điện thoại: nút quay lại ở trang chi tiết, nút tìm/quét ở đầu trang, thanh nút dính đáy cho các biểu mẫu dài, báo cáo hiển thị dạng thẻ thay bảng.",
      "Nút bị khóa luôn nói rõ còn thiếu gì; hỏi xác nhận trước thao tác không hoàn tác (hủy phiếu nháp, xác nhận phiếu nhập, giao máy 0 đ, quyết toán CTV).",
      "Bán hàng: cảnh báo ngay khi giảm vượt hạn mức; thu cũ đổi mới cần chọn khách. Nhập hàng: báo trước nguồn hàng bắt buộc, hạng và ảnh cho hàng cũ. Kiểm kê: quét liên tục.",
      "Sửa lỗi: “Đơn của tôi” của CTV không hiện chiếc đã bán; tổng tiền phiếu sửa hiện 0 đ khi đang sửa; số tiền trong thông báo hiển thị đúng kiểu 550.000 đ; phiên hết hạn chuyển về trang đăng nhập.",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-17",
    title: "Hoàn thiện, bảo mật & hướng dẫn (M9)",
    items: [
      "Hướng dẫn sử dụng trong ứng dụng (menu Hướng dẫn), chỉ hiện mục hợp với quyền của bạn; thêm mục xử lý lỗi thường gặp.",
      "In lại phiếu bán có dòng “BẢN IN LẠI (lần N)”.",
      "Bảo mật: chỉ chủ cửa hàng sửa tài khoản chủ, vai trò Chủ và cài đặt bảo mật; không tự đổi vai trò/khóa chính mình; phiên đăng nhập tối đa 30 ngày; mở nhiều tab không còn bị đăng xuất khi làm mới phiên.",
      "Chặn chạy mã lạ trên trang (chính sách nội dung theo nonce); nhật ký che tên và số điện thoại người bán.",
      "Giao diện: tăng độ tương phản chữ phụ; nút Thanh toán luôn hiện trên giỏ hàng điện thoại.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-17",
    title: "Báo cáo & tổng quan (M8)",
    items: [
      "Trang Tổng quan theo vai trò: chỉ hiện số liệu người dùng được phép xem (doanh thu, lãi gộp, thực thu, tồn kho, giá trị tồn, việc cần xử lý).",
      "Báo cáo doanh thu, lợi nhuận gộp, nhập & xuất, tồn kho theo giá vốn, tồn lâu, phiếu còn nợ, sửa chữa, tiền thu, hao hụt kiểm kê, bảo hành sắp hết hạn; xuất Excel theo đúng quyền.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-10-17",
    title: "Kiểm kê, cảnh báo & thông báo (M7)",
    items: [
      "Kiểm kê theo vị trí/linh kiện: quét mã để đếm, ghi lý do chênh lệch, chốt hao hụt.",
      "Cảnh báo hằng ngày: giữ hàng quá hạn, khách đến hạn trả, máy sửa chưa lấy, linh kiện sắp hết, hàng tồn lâu, chiếc ở CTV quá hạn, bảo hành sắp hết hạn.",
      "Kiểm tra toàn vẹn dữ liệu mỗi tối; thông báo trong ứng dụng (chuông).",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-10-17",
    title: "Sửa chữa gọn (M6)",
    items: [
      "Nhận máy (ảnh tùy chọn, cọc), dòng dịch vụ/linh kiện/chi phí khác, xác nhận dùng linh kiện, hoàn thành, giao máy thu tiền hoặc ghi nợ, hủy phiếu hoàn linh kiện & cọc.",
      "Sửa nội bộ: chi phí vốn hóa vào giá vốn chiếc. Nhận máy bảo hành miễn phí. Bảo hành sau sửa 90 ngày.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-10-17",
    title: "Cộng tác viên (M5b)",
    items: [
      "Giao hàng cho CTV với giá thu, CTV tạo đơn từ hàng đang giữ, chủ/nhân viên xác nhận đơn, quyết toán và hủy quyết toán, thu hồi chiếc.",
      "Màn hình riêng của CTV (hàng đang giữ, tạo đơn, đơn của tôi, thống kê của tôi) — không bao giờ thấy giá vốn.",
      "Thống kê CTV theo tháng/quý/năm.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-10-17",
    title: "Bán hàng, giữ hàng, thu cũ đổi mới, bảo hành (M5a)",
    items: [
      "POS trên điện thoại: giảm giá theo hạn mức, thanh toán tiền mặt/chuyển khoản/kết hợp, tiền thừa, bán nợ có hẹn trả, thu thêm trên phiếu, hủy phiếu trong 24 giờ.",
      "Giữ hàng có cọc, chuyển thành bán, hoàn hoặc tịch thu cọc. Thu cũ đổi mới trong cùng phiếu bán. Bảo hành tự tạo và tra cứu.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-10-17",
    title: "Nhập hàng & giá vốn (M4)",
    items: [
      "Phiếu nhập mua vào / thu mua từ khách / tồn đầu kỳ, phân bổ chi phí vận chuyển vào giá vốn, giá bình quân linh kiện, nhập nhanh một chiếc, hủy phiếu và điều chỉnh giá vốn có lý do, xuất Excel.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-10-17",
    title: "Tiền & thanh toán tối giản (M3)",
    items: ["Thanh toán gắn chứng từ, không quỹ; hủy thanh toán có lý do; làm tròn và phân bổ tiền khớp tuyệt đối."],
  },
  {
    version: "0.3.0",
    date: "2026-10-17",
    title: "Khách hàng (M2)",
    items: ["Khách hàng, nhóm khách, tìm theo tên/SĐT không dấu, CCCD mã hóa (xem đầy đủ phải nêu lý do), ẩn danh khách, đồng hồ của khách."],
  },
  {
    version: "0.2.0",
    date: "2026-10-17",
    title: "Danh mục & kho (M1)",
    items: [
      "Thương hiệu, loại đồng hồ, vị trí kho, từng chiếc theo mã nội bộ/serial, ảnh (xóa EXIF GPS), giá & khuyến mãi, lịch sử trạng thái/giá/vị trí, tem QR, quét mã.",
      "Linh kiện: danh mục, tương thích, điều chỉnh tồn có lý do, lịch sử xuất nhập.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-16",
    title: "Nền tảng & hệ giao diện Glass (M0)",
    items: [
      "Đăng nhập, đăng xuất, đổi mật khẩu, xác thực 2 bước (TOTP) cho chủ cửa hàng, xác thực lại cho thao tác nhạy cảm.",
      "Quản trị người dùng, vai trò & quyền, cài đặt, nhật ký hoạt động, tình trạng hệ thống.",
      "Phân quyền tầng cơ sở dữ liệu (RLS), nhật ký bất biến, chống bấm đúp (Idempotency-Key).",
      "Hệ giao diện Glass: thẻ kính, dock điện thoại, sidebar máy tính, thông báo, trang /dev/design.",
    ],
  },
];
