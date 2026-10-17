// Nhật ký thay đổi — mục mới nhất ở ĐẦU. `pnpm version:bump` thêm mục; `pnpm build` hỏng nếu phiên bản lệch package.json
// hoặc còn chữ TODO. Hiện ở Quản trị → Phiên bản.
export type ChangelogEntry = { version: string; date: string; title: string; items: string[] };

export const CHANGELOG: ChangelogEntry[] = [
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
