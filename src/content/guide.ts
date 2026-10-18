// Hướng dẫn sử dụng (/huong-dan). Nội dung tĩnh do đội phát triển viết; hiển thị bằng bộ dựng an toàn (không HTML) ở src/components/guide/.
// Nguồn sự thật của docs/07-user-guide/HUONG_DAN_SU_DUNG.md (sinh bằng `pnpm docs:guide`, đọc trực tiếp file này — chỉ `import type`).
//
// Mỗi mục là danh sách KHỐI có kiểu (bước, ghi chú, đường dẫn, bảng, thẻ, sơ đồ, minh họa giao diện…) để trang hiển thị trực quan.
// Chữ trong khối hỗ trợ **đậm**, `mã`, [liên kết](/duong-dan-noi-bo). Đoạn `md` còn có "## " (tiêu đề nhỏ), "- " (gạch đầu dòng), "1. " (đánh số).
// `perms` (nếu có): chỉ hiện cho người có BẤT KỲ quyền nào trong danh sách (ẩn theo quyền, không theo tên vai trò).
import type { Permission } from "@/lib/permissions";

export type GuideIcon =
  | "start" | "app" | "shield" | "sale" | "reserve" | "tradein" | "warranty" | "purchase" | "watch" | "part" | "customer"
  | "excel" | "ctv" | "me" | "repair" | "stocktake" | "report" | "admin" | "help" | "bell" | "search" | "book";

/** Minh họa giao diện dựng bằng chính các lớp Glass của ứng dụng (xem src/components/guide/GuideDemos.tsx). */
export type GuideDemo = "layout-desktop" | "layout-mobile" | "badges" | "shortcuts" | "unit-states" | "pos-cart" | "money-split" | "payment-methods";

export type CalloutTone = "tip" | "info" | "warn" | "danger";
export type FlowTone = "ok" | "info" | "hold" | "bad" | "neutral" | "check" | "repair";

export type GuideBlock =
  | { t: "md"; text: string }
  | { t: "heading"; text: string }
  | { t: "callout"; tone: CalloutTone; title?: string; text: string }
  | { t: "steps"; title?: string; items: { title: string; text?: string; path?: string[]; demo?: GuideDemo }[] }
  | { t: "path"; label?: string; items: string[] }
  | { t: "cards"; cols?: 2 | 3; items: { icon: GuideIcon; title: string; text: string }[] }
  | { t: "flow"; caption?: string; items: { label: string; note?: string; tone?: FlowTone }[] }
  | { t: "demo"; name: GuideDemo; caption?: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "tabs"; tabs: { label: string; blocks: GuideBlock[] }[] }
  | { t: "accordion"; items: { title: string; blocks: GuideBlock[] }[] };

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  icon: GuideIcon;
  /** Nhãn "dành cho" (chỉ để người đọc biết, KHÔNG dùng để phân quyền — phân quyền theo `perms`) */
  tags?: string[];
  perms?: Permission[];
  blocks: GuideBlock[];
}

export const GUIDE_INTRO =
  "Cách làm việc hằng ngày trên WatchFlow: bán hàng, nhập hàng, giữ hàng, sửa chữa, cộng tác viên… Bạn chỉ thấy những mục **hợp với quyền của mình**; thiếu mục nào cần dùng, nhờ chủ cửa hàng cấp quyền ở Quản trị.";

/** Các loại tài khoản thường gặp (mô tả để hiểu nhau — quyền thật do chủ cửa hàng chỉnh ở Quản trị → Vai trò & quyền). */
export const GUIDE_ROLES: { title: string; text: string }[] = [
  { title: "Chủ cửa hàng", text: "Thấy tất cả: giá thu (giá vốn), lãi, sửa chữa, cộng tác viên, quản trị người dùng, cài đặt và sao lưu." },
  { title: "Nhân viên bán hàng", text: "Lập phiếu bán, giữ hàng/đặt cọc, thu cũ đổi mới, tạo khách, tra cứu bảo hành. Không thấy giá thu và lãi; giảm giá trong hạn mức được cấp." },
  { title: "Quản lý kho", text: "Nhập hàng, tem QR, vị trí kho, linh kiện, kiểm kê, nhập Excel; thấy giá thu của hàng trong kho. Không bán hàng." },
  { title: "Cộng tác viên", text: "Nhận hàng của cửa hàng để bán, tạo đơn chờ xác nhận, xem hàng đang giữ/đơn của mình/thống kê. Không thấy giá vốn." },
];

/** Lối tắt "Bắt đầu nhanh" ở đầu trang (chỉ hiện nếu mục đích có trong danh sách của người xem). */
export const GUIDE_QUICK: { icon: GuideIcon; title: string; text: string; target: string }[] = [
  { icon: "start", title: "Làm quen màn hình", text: "Thanh dưới, nút “+”, tìm nhanh Ctrl+K", target: "bat-dau" },
  { icon: "sale", title: "Bán một chiếc", text: "Tìm, chọn khách, thanh toán, in phiếu", target: "ban-hang" },
  { icon: "reserve", title: "Giữ hàng & cọc", text: "Giữ cho khách, chuyển thành bán", target: "giu-hang" },
  { icon: "purchase", title: "Nhập hàng", text: "Phiếu nhập, chi phí, in tem QR", target: "nhap-hang" },
  { icon: "repair", title: "Nhận máy sửa", text: "5 bước, linh kiện, giao máy", target: "sua-chua" },
  { icon: "app", title: "Cài app & thông báo", text: "Đưa ra màn hình chính, nhận thông báo", target: "cai-ung-dung" },
  { icon: "ctv", title: "Cộng tác viên", text: "Giao hàng, giá thu, quyết toán", target: "ctv" },
  { icon: "help", title: "Khi có lỗi", text: "Mã WF-… nghĩa là gì, làm gì tiếp", target: "khi-co-loi" },
];

export const GUIDE: GuideSection[] = [
  // ------------------------------------------------------------------ Bắt đầu
  {
    id: "bat-dau",
    title: "Bắt đầu nhanh",
    summary: "Làm quen màn hình, thanh điều hướng, nút “+”, tìm nhanh và số việc cần xử lý.",
    icon: "start",
    tags: ["Mọi người"],
    blocks: [
      { t: "md", text: "Bạn chỉ thấy những mục mình có quyền dùng. Nếu thiếu một mục cần thiết, nhờ chủ cửa hàng cấp quyền ở **Quản trị**." },
      { t: "heading", text: "Làm quen giao diện" },
      {
        t: "tabs",
        tabs: [
          {
            label: "Điện thoại",
            blocks: [
              { t: "demo", name: "layout-mobile", caption: "Giao diện trên điện thoại" },
              { t: "md", text: "- **Thanh dưới cùng** có các mục chính theo công việc của bạn.\n- Nút **+** ở giữa mở các **hành động hay dùng** (bán hàng, nhập hàng, nhận máy sửa…).\n- Mục **Menu** chứa các màn còn lại.\n- Nút **Quay lại** ở đầu trang (hoặc nút Back của điện thoại) đưa bạn về màn trước." },
            ],
          },
          {
            label: "Máy tính",
            blocks: [
              { t: "demo", name: "layout-desktop", caption: "Giao diện trên máy tính" },
              { t: "md", text: "- **① Thanh bên trái** liệt kê các mục theo nhóm; viên số cạnh mục là số việc cần xử lý. Ở cuối có công tắc **Sáng/Tối** và thẻ tài khoản.\n- **② Ô tìm nhanh** (phím tắt `Ctrl + K`): tìm mã, serial, khách, phiếu hoặc mở trang.\n- **③ Quét QR và chuông**: quét tem đồng hồ; chuông là thông báo dành cho bạn.\n- **④ Nút hành động chính** (màu gradient) — thường là Bán hàng." },
            ],
          },
        ],
      },
      { t: "heading", text: "Tìm nhanh" },
      { t: "demo", name: "shortcuts" },
      {
        t: "steps",
        items: [
          { title: "Mở ô tìm nhanh", text: "Nhấn **Ctrl+K** (Mac: **⌘K**) hoặc phím **/**, hay bấm nút kính lúp (thanh trên máy tính, đầu trang trên điện thoại)." },
          { title: "Gõ mã hoặc tên", text: "Gõ **mã nội bộ, serial, tên đồng hồ, tên/số điện thoại khách, mã phiếu** — không cần gõ dấu. Kết quả gom theo nhóm và chỉ gồm phần bạn có quyền xem." },
          { title: "Mở kết quả", text: "Gõ đúng mã hoặc serial rồi nhấn **Enter** là mở thẳng chiếc đó. Ô trống cho bạn các **hành động nhanh** (Bán nhanh, Nhận máy sửa, Nhập một chiếc, Thêm khách, Giữ hàng…) và danh sách **trang**; **↑↓** để chọn, **Esc** để đóng." },
        ],
      },
      { t: "heading", text: "Số việc cần xử lý" },
      { t: "demo", name: "badges" },
      { t: "md", text: "Viên số cạnh mục trên thanh dưới, thanh bên và Menu cho biết còn bao nhiêu việc: **vàng** là đang chờ, **đỏ** là có việc quá hạn (đơn CTV chờ xác nhận, giữ hàng sắp hết hạn, máy sửa chờ hoặc chưa lấy, khách đến hạn trả nợ, linh kiện sắp hết…). Rê chuột để xem từng loại. Số tự cập nhật mỗi phút." },
      {
        t: "cards",
        cols: 3,
        items: [
          { icon: "search", title: "Quét QR", text: "Nút quét QR mở camera (hoặc ô nhập mã nếu máy không có camera)." },
          { icon: "bell", title: "Chuông thông báo", text: "Cho biết việc mới: đơn CTV chờ xác nhận, sắp hết hạn giữ hàng…" },
          { icon: "admin", title: "Dải cảnh báo", text: "Chủ cửa hàng/người phụ trách hệ thống thấy dải cảnh báo phía trên khi việc chạy nền quá hạn, sao lưu lỗi, có lỗi hệ thống mới hoặc kho ảnh sắp đầy; bấm để mở **Quản trị → Hệ thống**, nút × ẩn đến hết hôm nay." },
        ],
      },
      { t: "callout", tone: "info", title: "Số tiền", text: "Số tiền luôn hiển thị dạng **8.200.000 ₫**; mọi con số do máy chủ tính, màn hình chỉ hiển thị." },
      { t: "callout", tone: "warn", title: "Mất mạng", text: "Biểu ngữ vàng hiện lên; bạn vẫn nhập được nhưng **chưa thể xác nhận** cho tới khi có mạng lại." },
    ],
  },

  // ------------------------------------------------------------------ Đăng nhập
  {
    id: "dang-nhap",
    title: "Đăng nhập & xác thực 2 bước",
    summary: "Mật khẩu, mã 6 số, mã khôi phục, thiết bị tin cậy, giao diện sáng/tối.",
    icon: "shield",
    tags: ["Mọi người"],
    blocks: [
      {
        t: "steps",
        title: "Đăng nhập lần đầu",
        items: [
          { title: "Đăng nhập", text: "Nhập email và mật khẩu được cấp. Sai nhiều lần tài khoản bị khóa tạm — màn hình báo còn mấy lần thử." },
          { title: "Đổi mật khẩu tạm", text: "Lần đầu dùng mật khẩu tạm bạn phải **đổi mật khẩu** ngay." },
          { title: "Bật xác thực 2 bước", text: "Vai trò bắt buộc **xác thực 2 bước**: quét mã QR bằng ứng dụng Authenticator, nhập mã 6 số, rồi **lưu mã khôi phục** (chỉ hiện một lần)." },
        ],
      },
      { t: "callout", tone: "tip", title: "Mất điện thoại?", text: "Ở màn nhập mã chọn **Dùng mã khôi phục** và nhập một mã còn dùng được (mỗi mã dùng một lần)." },
      {
        t: "accordion",
        items: [
          {
            title: "Tin cậy thiết bị này",
            blocks: [
              { t: "md", text: "Ở bước nhập mã 6 số có ô **“Tin cậy thiết bị này … ngày”**. Chỉ tick trên **máy của riêng bạn**: những lần đăng nhập sau trên máy đó (cùng trình duyệt) chỉ cần **mật khẩu**, không hỏi mã 6 số. Mật khẩu vẫn luôn phải đúng, và với thao tác nhạy cảm (xem CCCD đầy đủ, đặt lại mật khẩu, tắt xác thực 2 bước…) hệ thống vẫn hỏi lại mật khẩu **và mã 2 bước**." },
              { t: "md", text: "Thiết bị tự hết tin cậy khi hết hạn, khi bạn **đổi mật khẩu**, khi chủ cửa hàng **đặt lại mật khẩu hoặc khóa** tài khoản, hoặc khi bạn tắt xác thực 2 bước." },
              { t: "path", label: "Muốn bỏ ngay", items: ["Tài khoản", "Thiết bị tin cậy", "Bỏ"] },
              { t: "md", text: "Bấm **Bỏ** từng máy hoặc **Quên các thiết bị đã tin cậy**. Mất máy? Đổi mật khẩu là đủ để thu hồi tất cả. Chủ cửa hàng có thể tắt tính năng (Quản trị → Cài đặt → “Tin cậy thiết bị”, đặt 0 ngày)." },
            ],
          },
          {
            title: "Thiết bị đang đăng nhập",
            blocks: [{ t: "md", text: "Vào **Tài khoản** để xem các thiết bị và **thu hồi** thiết bị lạ. Với thao tác nhạy cảm (đổi vai trò, hủy phiếu…) hệ thống hỏi **nhập lại mật khẩu**." }],
          },
          {
            title: "Giao diện sáng / tối",
            blocks: [
              { t: "path", items: ["Tài khoản", "Giao diện"] },
              { t: "md", text: "Chọn **Sáng**, **Tối** hoặc **Theo hệ thống** (cũng có ở cuối **Menu** trên điện thoại, cuối thanh bên trên máy tính). Lựa chọn được nhớ trên thiết bị này; bản in luôn nền trắng chữ đen." },
            ],
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Cài app
  {
    id: "cai-ung-dung",
    title: "Cài ứng dụng & thông báo",
    summary: "Cài WatchFlow lên màn hình chính, mở link từ Zalo, nhận thông báo trên điện thoại.",
    icon: "app",
    tags: ["Mọi người"],
    blocks: [
      { t: "path", label: "Vào", items: ["Tài khoản", "Ứng dụng trên màn hình chính"] },
      { t: "md", text: "Trang chủ cũng có thẻ gợi ý nhỏ; đóng đi thì 21 ngày sau mới nhắc lại." },
      {
        t: "tabs",
        tabs: [
          { label: "Android / Chrome / Edge", blocks: [{ t: "steps", items: [{ title: "Bấm cài đặt", text: "Bấm **Cài WatchFlow lên màn hình chính** và xác nhận." }] }] },
          {
            label: "iPhone / iPad",
            blocks: [
              {
                t: "steps",
                items: [
                  { title: "Mở bằng Safari", text: "Phải dùng **Safari**, không dùng trình duyệt trong ứng dụng khác." },
                  { title: "Thêm vào màn hình chính", text: "Bấm nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**." },
                ],
              },
              { t: "callout", tone: "info", text: "Trên iPhone phải cài ra màn hình chính thì mới nhận được thông báo." },
            ],
          },
        ],
      },
      { t: "callout", tone: "warn", title: "Mở link qua Zalo / Facebook?", text: "Trình duyệt trong Zalo, Facebook, Messenger… **hay làm mất đăng nhập**, không cài được ứng dụng và không nhận được thông báo. Khi gặp, đầu trang hiện **dải vàng**: bấm **Mở bằng Chrome** (Android) hoặc **Sao chép liên kết** rồi dán vào Chrome/Safari." },
      { t: "heading", text: "Thông báo trên điện thoại" },
      {
        t: "steps",
        items: [
          { title: "Mở cài đặt thông báo", path: ["Tài khoản", "Thông báo trên thiết bị"] },
          { title: "Bật và cho phép", text: "Bật **Nhận thông báo trên thiết bị này** (trình duyệt sẽ hỏi quyền — chọn **Cho phép**). Mỗi thiết bị bật riêng." },
          { title: "Thử", text: "Bấm **Gửi thử** để kiểm tra thiết bị đã nhận chưa." },
        ],
      },
      {
        t: "table",
        head: ["Tùy chọn", "Ý nghĩa"],
        rows: [
          ["Giờ yên tĩnh", "Trong khoảng giờ bạn chọn (giờ Việt Nam), thông báo được giữ lại và gửi sau khi hết giờ."],
          ["Bấm vào thông báo", "Mở đúng trang và đánh dấu đã đọc."],
          ["Chuông trong ứng dụng", "Luôn có, dù bạn có bật thông báo trên thiết bị hay không."],
          ["Dùng chung máy", "Tắt công tắc trước khi đăng xuất để người sau không nhận tin của bạn."],
        ],
      },
      { t: "callout", tone: "info", title: "Mất mạng khi mở ứng dụng", text: "Hiện trang **Bạn đang mất kết nối** — bật mạng rồi bấm **Thử lại**. Dữ liệu cửa hàng không lưu trên máy nên cần có mạng để làm việc." },
    ],
  },

  // ------------------------------------------------------------------ Bán hàng
  {
    id: "ban-hang",
    title: "Bán hàng (POS)",
    summary: "Tìm chiếc, giỏ phiếu, thanh toán tiền mặt/chuyển khoản/kết hợp, bán nợ, thu thêm, hủy trong 24 giờ.",
    icon: "sale",
    tags: ["Bán hàng", "Chủ"],
    perms: ["sale.create_draft", "sale.view", "sale.view_own"],
    blocks: [
      {
        t: "flow",
        caption: "Vòng đời một phiếu bán",
        items: [
          { label: "Nháp", note: "tự lưu, không giữ hàng", tone: "neutral" },
          { label: "Đã xác nhận", note: "khóa chiếc, ghi giá vốn, thu tiền, cấp bảo hành", tone: "ok" },
          { label: "Đã hủy", note: "trong hạn (mặc định 24 giờ), cần lý do", tone: "bad" },
        ],
      },
      {
        t: "steps",
        title: "Lập phiếu bán",
        items: [
          { title: "Mở màn bán hàng", path: ["Nút +", "Bán hàng"], text: "Tìm chiếc theo mã, serial, tên hoặc quét QR; chạm để thêm vào phiếu. Chỉ chiếc **Sẵn sàng bán** mới thêm được." },
          { title: "Chọn khách", text: "Tìm theo SĐT/tên hoặc tạo nhanh. Khách lẻ không cần chọn, nhưng **bán nợ và thu cũ đổi mới bắt buộc có khách**." },
          { title: "Chỉnh giá", text: "Sửa **giá bán** từng dòng nếu cần; có thể **giảm giá tổng phiếu**. Giảm quá hạn mức vai trò của bạn sẽ bị chặn khi xác nhận — nhờ người có hạn mức cao hơn.", demo: "pos-cart" },
          { title: "Để phiếu tự lưu", text: "Phiếu **tự lưu nháp** vài giây sau mỗi thay đổi; nháp không giữ hàng. Trên điện thoại, thanh “Xem phiếu” mở giỏ kéo lên/xuống được." },
        ],
      },
      { t: "callout", tone: "tip", title: "Nút Thanh toán chờ một chút?", text: "Sau khi sửa giá hoặc thêm chiếc, nút **Thanh toán** mở lại ngay khi phiếu lưu xong (khoảng một giây) để số **Còn phải thu** luôn khớp với phiếu." },
      { t: "heading", text: "Thanh toán" },
      { t: "demo", name: "payment-methods" },
      {
        t: "table",
        head: ["Hình thức", "Cách làm", "Cần nhớ"],
        rows: [
          ["Tiền mặt", "Nhập **Khách đưa** để thấy **tiền thừa**.", "Tiền thừa chỉ để trả khách, không ghi vào doanh thu."],
          ["Chuyển khoản", "Hiện **mã QR VietQR** có sẵn số tiền và nội dung (mã phiếu), kèm nút **sao chép** số tài khoản, số tiền, nội dung. Khách quét bằng ứng dụng ngân hàng.", "**QR chỉ để quét — hệ thống không tự ghi nhận tiền.** Chỉ bấm **Xác nhận** sau khi đã thấy tiền vào tài khoản."],
          ["Kết hợp", "Chia một phần tiền mặt, một phần chuyển khoản.", "Phần chuyển khoản cũng hiện QR."],
          ["Thu thiếu (nợ)", "Nếu khách có số điện thoại, phần còn lại ghi **nợ**; có thể đặt **hẹn trả**.", "Bán nợ bắt buộc có khách."],
        ],
      },
      { t: "callout", tone: "info", title: "QR còn xuất hiện ở đâu? Chưa thấy QR?", text: "Phiếu chưa có mã (đang lập) dùng nội dung tạm như “BAN HANG 1A2B3C”. QR cũng hiện ở **Thu thêm**, đặt **cọc giữ hàng**, **cọc/giao máy sửa**, **CTV nộp quyết toán**. Chưa thấy QR? Chủ cửa hàng vào **Quản trị → Cài đặt → Thanh toán** chọn ngân hàng, nhập số tài khoản, tên chủ tài khoản (và mẫu nội dung nếu muốn)." },
      {
        t: "steps",
        items: [
          { title: "Bấm Xác nhận", text: "Máy chủ **khóa chiếc, ghi giá vốn, thu tiền và cấp bảo hành** trong một lần — hoặc cùng thành công, hoặc không thay đổi gì." },
          { title: "In hoặc gửi phiếu", text: "**In phiếu** (80mm) hoặc **Tải PDF** (A5, chữ tiếng Việt đầy đủ) / **Chia sẻ** (trên điện thoại, gửi qua Zalo/Messenger/Mail). Tải lại phiếu đã in vẫn được đánh dấu **BẢN IN LẠI**; PDF không bao giờ có giá vốn hay lãi." },
        ],
      },
      {
        t: "accordion",
        items: [
          { title: "Thu thêm (khách còn nợ)", blocks: [{ t: "md", text: "Mở phiếu còn nợ → **Thu thêm** → nhập số tiền khách trả." }] },
          { title: "Hủy phiếu", blocks: [{ t: "md", text: "Chỉ trong thời hạn cho phép (mặc định 24 giờ), cần lý do và nhập lại mật khẩu; máy trả về kho và các khoản thu bị hủy." }] },
          { title: "Tìm phiếu còn nợ", blocks: [{ t: "md", text: "Danh sách phiếu có bộ lọc **Còn nợ** kèm tổng nợ." }] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Giữ hàng
  {
    id: "giu-hang",
    title: "Giữ hàng & đặt cọc",
    summary: "Giữ chiếc cho khách, chuyển thành bán, hoàn hoặc tịch thu cọc.",
    icon: "reserve",
    tags: ["Bán hàng", "Chủ"],
    perms: ["reservation.manage"],
    blocks: [
      {
        t: "flow",
        caption: "Trạng thái một lần giữ hàng",
        items: [
          { label: "Đang giữ", note: "chiếc chuyển sang Đã giữ", tone: "hold" },
          { label: "Đã chuyển bán", note: "cọc tự trừ vào tiền phải thu", tone: "ok" },
          { label: "Hủy giữ", note: "hoàn cọc, hoặc tịch thu cọc", tone: "neutral" },
        ],
      },
      {
        t: "steps",
        items: [
          { title: "Tạo lần giữ", path: ["Giữ hàng", "Giữ hàng"], text: "Ở chi tiết chiếc (hoặc màn Giữ hàng) chọn khách, hạn giữ, hình thức và **số tiền cọc**. Cọc phải đạt mức tối thiểu theo cài đặt." },
          { title: "Chiếc được giữ", text: "Chiếc chuyển sang **Đã giữ**, không bán cho người khác được." },
          { title: "Khách đến mua", text: "Bấm **Chuyển thành bán** — phiếu bán nháp được tạo sẵn, cọc tự trừ vào tiền phải thu." },
          { title: "Khách không mua", text: "**Hủy giữ** và **hoàn cọc**. **Tịch thu cọc** chỉ người có quyền riêng làm được, cần lý do, nhập lại mật khẩu và **giữ nút 1,2 giây** để xác nhận." },
        ],
      },
      { t: "callout", tone: "warn", text: "Giữ quá hạn được tô đỏ trong danh sách và báo ở Tổng quan." },
    ],
  },

  // ------------------------------------------------------------------ Thu cũ
  {
    id: "thu-cu",
    title: "Thu cũ đổi mới",
    summary: "Nhận máy cũ của khách trừ vào phiếu bán.",
    icon: "tradein",
    tags: ["Bán hàng", "Chủ"],
    perms: ["sale.create_draft"],
    blocks: [
      {
        t: "steps",
        items: [
          { title: "Thêm máy cũ vào phiếu", text: "Trong phiếu bán bấm **Thêm máy cũ**: nhập loại, serial, tình trạng/hạng, vị trí kho và **giá thu**." },
          { title: "Chụp ảnh", text: "Chụp ảnh giấy tờ người bán và ảnh máy." },
          { title: "Chọn khách", text: "Bắt buộc có khách (người bán máy cũ)." },
        ],
      },
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "sale", title: "Trừ vào phiếu", text: "Giá thu máy cũ được **trừ** vào tổng phiếu và **không được lớn hơn** tổng tiền phiếu bán." },
          { icon: "stocktake", title: "Vào kho chờ kiểm tra", text: "Máy cũ vào kho ở trạng thái **Chờ kiểm tra**; sau khi kiểm tra đạt mới bán lại được." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Bảo hành
  {
    id: "bao-hanh",
    title: "Bảo hành",
    summary: "Tra cứu bảo hành, nhận máy bảo hành, phiếu bảo hành PDF.",
    icon: "warranty",
    tags: ["Bán hàng", "Chủ"],
    perms: ["warranty.view", "repair.view"],
    blocks: [
      { t: "md", text: "Bảo hành **tự được cấp** khi xác nhận phiếu bán (thời hạn theo cài đặt: hàng mới/cũ/đã sửa) và sau mỗi lần sửa chữa." },
      {
        t: "steps",
        items: [
          { title: "Tra cứu", path: ["Bảo hành"], text: "Tìm theo mã BH, mã phiếu, mã chiếc, serial hoặc số điện thoại khách. Chip cho biết **Còn hạn / Sắp hết / Hết hạn**." },
          { title: "Nhận máy bảo hành", text: "Chọn kết quả → nhập lỗi → hệ thống mở phiếu sửa miễn phí. Hết hạn thì báo rõ và gợi ý **nhận máy tính phí**." },
          { title: "Đưa phiếu cho khách", text: "Chọn kết quả → **PDF phiếu bảo hành** (hoặc **Chia sẻ** trên điện thoại) để gửi/in cho khách; có điều khoản bảo hành của cửa hàng. Phiếu **nhận/giao máy sửa** cũng có **Tải PDF** cạnh nút In." },
        ],
      },
      { t: "callout", tone: "info", title: "Không có “đổi trả”", text: "Khách có vấn đề thì xử lý qua bảo hành/sửa chữa." },
    ],
  },

  // ------------------------------------------------------------------ Nhập hàng
  {
    id: "nhap-hang",
    title: "Nhập hàng & nhập nhanh",
    summary: "Phiếu nhập nhiều dòng, chi phí phân bổ, nhập nhanh một chiếc, in tem QR.",
    icon: "purchase",
    tags: ["Kho", "Chủ"],
    perms: ["purchase.view", "purchase.create"],
    blocks: [
      {
        t: "steps",
        title: "Lập phiếu nhập",
        items: [
          { title: "Chọn loại phiếu", path: ["Nhập hàng", "Lập phiếu"], text: "**Mua vào** (ghi nguồn hàng bằng chữ — gõ vài chữ để chọn nguồn đã dùng, không cần gõ dấu), **Thu mua từ khách** (chọn khách, tải ảnh giấy tờ và ảnh máy) hoặc **Tồn đầu kỳ**." },
          { title: "Thêm dòng", text: "Dòng **đồng hồ** (loại, serial hoặc “không serial”, tình trạng, hạng, vị trí, giá nhập) và dòng **linh kiện**. Có nút **nhân bản dòng** để nhập nhiều chiếc giống nhau." },
          { title: "Thêm chi phí", text: "Vận chuyển, kiểm định… và chọn phân bổ theo giá trị hoặc chia đều — giá vốn từng chiếc đã gồm phần phân bổ." },
          { title: "Lưu nháp rồi Xác nhận", text: "Phiếu tự lưu nháp. Khi **Xác nhận**, hệ thống tạo từng chiếc với mã DH-…; bạn **in tem QR** để dán." },
        ],
      },
      { t: "callout", tone: "tip", title: "Hàng cũ / đã sửa", text: "Cần **ảnh tình trạng** trước khi bán — hoặc để trạng thái **Chờ kiểm tra**." },
      { t: "callout", tone: "info", title: "Đang nhập dở mà bấm ra ngoài?", text: "Bấm ra ngoài hộp thoại, sang trang khác hay đóng tab, ứng dụng sẽ hỏi **Bỏ thay đổi chưa lưu?** — chọn **Ở lại** để giữ nguyên dữ liệu. Khi bấm Lưu/Xác nhận, hộp thoại hiện **Đang xử lý…** và không đóng được cho tới khi xong (không lo bấm hai lần)." },
      {
        t: "accordion",
        items: [
          { title: "Hủy phiếu nhập", blocks: [{ t: "md", text: "Chỉ hủy được khi chưa có giao dịch nào dùng đến hàng đó; cần lý do và nhập lại mật khẩu." }] },
          { title: "Nhập nhanh một chiếc", blocks: [{ t: "path", items: ["Đồng hồ", "Thêm đồng hồ"] }, { t: "md", text: "Điền một chiếc và giá nhập; hệ thống tạo phiếu và xác nhận ngay." }] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Đồng hồ
  {
    id: "dong-ho",
    title: "Đồng hồ & tem QR",
    summary: "Tìm kiếm, lọc, chi tiết chiếc, đổi giá/vị trí, in tem.",
    icon: "watch",
    tags: ["Kho", "Bán hàng", "Chủ"],
    perms: ["catalog.view"],
    blocks: [
      { t: "heading", text: "Trạng thái của một chiếc" },
      { t: "demo", name: "unit-states" },
      { t: "md", text: "Trạng thái chỉ đổi qua các thao tác nghiệp vụ (bán, giữ hàng, giao CTV, sửa chữa, kiểm tra…), không sửa tay được." },
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "search", title: "Danh sách", text: "Lọc theo trạng thái (Sẵn sàng bán, Đã giữ, Đang ở CTV, Đang sửa, Chờ kiểm tra, Đã bán, Thanh lý/mất), thương hiệu, loại, vị trí, tình trạng, **tồn lâu**." },
          { icon: "watch", title: "Chi tiết chiếc", text: "Ảnh, giá, vị trí; các tab Thông tin, Ảnh, Giá, **Giá thu** (chỉ người có quyền), Lịch sử, Bảo hành & sửa chữa." },
          { icon: "stocktake", title: "Sửa giá, vị trí, kiểm tra", text: "**Sửa giá** và khuyến mãi theo khoảng ngày (cần quyền sửa giá); **Đổi vị trí**; **Kiểm tra đạt** cho chiếc Chờ kiểm tra. **Ghi mất/Khôi phục** cần lý do và nhập lại mật khẩu." },
          { icon: "start", title: "Tem QR 50×30mm", text: "**In tem QR**; quét tem bằng ô quét ở thanh tìm kiếm để mở chiếc ngay." },
        ],
      },
      {
        t: "accordion",
        items: [
          {
            title: "Ảnh đồng hồ",
            blocks: [{ t: "md", text: "Tải ảnh từ điện thoại/máy tính — ảnh được thu nhỏ ngay trên máy trước khi gửi (nhanh hơn, tiết kiệm mạng), có thanh tiến độ, nút **Hủy** và **Thử lại** khi mất mạng. Bấm vào ảnh để xem toàn màn hình: chụm/lăn chuột để phóng to, vuốt ngang để qua ảnh khác, **Esc** để đóng. Chủ cửa hàng xem dung lượng kho ảnh ở **Quản trị → Hệ thống**; ảnh giấy tờ của khách đã ẩn danh được xóa thật khỏi kho." }],
          },
          { title: "Loại & hãng, vị trí kho", blocks: [{ t: "md", text: "Danh mục **Loại & hãng** và **Vị trí kho** do người quản lý danh mục chỉnh." }] },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Linh kiện
  {
    id: "linh-kien",
    title: "Linh kiện",
    summary: "Tồn kho linh kiện, điều chỉnh, sắp hết.",
    icon: "part",
    tags: ["Kho", "Chủ"],
    perms: ["part.view"],
    blocks: [
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "search", title: "Danh sách", text: "Bộ lọc theo loại và **Sắp hết** (tồn ≤ mức đặt hàng lại)." },
          { icon: "stocktake", title: "Điều chỉnh tồn", text: "Chọn số lượng tăng/giảm và **ghi lý do** (≥ 10 ký tự); mọi điều chỉnh để lại lịch sử." },
          { icon: "purchase", title: "Nhập kho", text: "Linh kiện nhập qua **phiếu nhập**, trừ kho khi **xác nhận dùng** trong phiếu sửa hoặc khi bán lẻ." },
          { icon: "report", title: "Giá vốn", text: "Giá vốn bình quân chỉ hiện cho người có quyền xem giá vốn." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Khách hàng
  {
    id: "khach-hang",
    title: "Khách hàng & CCCD",
    summary: "Tạo khách, trùng SĐT, xem CCCD đầy đủ, ẩn danh.",
    icon: "customer",
    tags: ["Bán hàng", "Chủ"],
    perms: ["customer.view", "customer.view_own", "customer.create"],
    blocks: [
      { t: "md", text: "**Tạo nhanh** chỉ cần tên (và SĐT). Trùng số điện thoại thì hệ thống hiện khách đã có để bạn **mở khách đó** hoặc **vẫn tạo mới**." },
      {
        t: "steps",
        title: "Xem số CCCD/giấy tờ đầy đủ",
        items: [
          { title: "Mặc định chỉ thấy vài số cuối", text: "Số **CCCD/giấy tờ** được mã hóa; màn hình chỉ hiện vài số cuối." },
          { title: "Bấm Xem đầy đủ", text: "Người có quyền bấm **Xem đầy đủ**, nêu lý do, nhập lại mật khẩu." },
          { title: "Tự ẩn sau 30 giây", text: "Số hiện **30 giây** rồi tự ẩn và việc xem được ghi nhật ký." },
        ],
      },
      { t: "md", text: "Trang khách có **đồng hồ của khách**, phiếu còn nợ, giữ hàng/cọc và lịch sử mua." },
      { t: "callout", tone: "danger", title: "Ẩn danh", text: "**Ẩn danh** (xóa dữ liệu cá nhân) chỉ người có quyền làm, cần lý do và **không hoàn tác**." },
    ],
  },

  // ------------------------------------------------------------------ Nhập Excel
  {
    id: "nhap-excel",
    title: "Nhập từ Excel (hàng loạt)",
    summary: "Nhập khách hàng, đồng hồ tồn đầu kỳ, linh kiện từ tệp Excel/CSV — xem trước rồi mới ghi.",
    icon: "excel",
    tags: ["Kho", "Chủ"],
    perms: ["customer.create", "purchase.create"],
    blocks: [
      { t: "md", text: "Dùng khi chuyển từ sổ sách/Excel cũ sang WatchFlow." },
      { t: "path", label: "Vào", items: ["Menu", "Nhập từ Excel"] },
      { t: "md", text: "Hoặc nút **Nhập Excel** ở màn **Khách hàng**, **Đồng hồ**, **Linh kiện** (chỉ hiện nếu bạn có quyền)." },
      {
        t: "steps",
        items: [
          { title: "Tải tệp mẫu", text: "Chọn loại dữ liệu và bấm **Tải tệp mẫu (.xlsx)**. Tệp có 3 sheet: **Dữ liệu** (cột + 2 dòng ví dụ, có chữ [VÍ DỤ] — hệ thống tự bỏ qua), **Hướng dẫn**, **Danh mục** (hãng/loại/vị trí/nhóm đang có trong cửa hàng để điền cho khớp)." },
          { title: "Điền và chọn tệp", text: "Điền dữ liệu (**tối đa 300 dòng mỗi lần**), lưu lại rồi chọn tệp (.xlsx hoặc .csv, tối đa 5 MB) hoặc kéo thả vào khung. Tên cột có dấu hay không dấu đều được; cột lạ bị bỏ qua." },
          { title: "Xem trước", text: "Mỗi dòng là *Hợp lệ*, *Cảnh báo*, *Lỗi* (kèm lý do) hoặc *Trùng*. Chưa có gì được ghi. Sửa lỗi trong tệp rồi bấm **Chọn tệp khác**; tích chọn các dòng muốn nhập (dòng trùng mặc định **không** tích; dòng lỗi không thể nhập)." },
          { title: "Nhập", text: "Bấm **Nhập N dòng** (một lần — bấm đúp không nhập hai lần). Màn kết quả liệt kê từng dòng đã nhập kèm liên kết." },
        ],
      },
      {
        t: "tabs",
        tabs: [
          {
            label: "Khách hàng",
            blocks: [
              { t: "md", text: "Cột: Họ và tên (bắt buộc), SĐT, Email, Địa chỉ, Nhóm khách, Ghi chú, CCCD (tùy chọn, được mã hóa như khi tạo khách). SĐT được chuẩn hóa (+84, thiếu số 0 đầu đều được). **Trùng SĐT** với khách có sẵn hoặc với dòng khác trong tệp sẽ được báo — bạn chọn bỏ qua hay vẫn nhập." },
            ],
          },
          {
            label: "Đồng hồ tồn đầu kỳ",
            blocks: [
              { t: "md", text: "Cột: Hãng, Loại/Model (bắt buộc — khớp theo mã hoặc tên), Serial, Tình trạng (bắt buộc: Mới / Cũ / Đã sửa), Hạng, **Giá vốn (giá thu)** (bắt buộc), Giá niêm yết, Vị trí kho, Ghi chú. Tất cả dòng nhập được ghi bằng **một phiếu “Tồn đầu kỳ”** xác nhận ngay: giá vốn đúng như trong tệp, kho tăng đúng số chiếc. Giá là số nguyên đồng (6000000 hoặc 6.000.000), không âm." },
              { t: "md", text: "- Hàng **Cũ / Đã sửa** vào kho ở trạng thái **Chờ kiểm tra** (cần hạng tình trạng và ảnh mới chuyển được sang Sẵn sàng bán); hàng Mới vào thẳng Sẵn sàng bán.\n- Chưa có loại trong danh mục: tạo ở **Đồng hồ → Loại & hãng**, hoặc (nếu bạn có quyền quản lý danh mục) bật **Tự tạo hãng/loại chưa có** trước khi chọn tệp.\n- Serial đã có trong kho (cùng hãng) hoặc trùng trong tệp bị chặn. Ô Vị trí kho trống dùng **vị trí mặc định** bạn chọn." },
            ],
          },
          {
            label: "Linh kiện",
            blocks: [{ t: "md", text: "Cột: Mã, Tên, Danh mục (phải có sẵn), Đơn vị, Tồn đầu, Giá vốn, Ngưỡng cảnh báo, Giá bán. Tồn đầu > 0 được ghi bằng một phiếu “Tồn đầu kỳ”. Mã đã có sẽ báo **trùng**; nếu bạn vẫn chọn nhập, số lượng được **cộng thêm** vào tồn hiện có." }],
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ CTV (chủ)
  {
    id: "ctv",
    title: "Cộng tác viên (dành cho chủ)",
    summary: "Giao hàng, đơn chờ xác nhận, quyết toán, thống kê.",
    icon: "ctv",
    tags: ["Chủ"],
    perms: ["collab.view", "collab.manage"],
    blocks: [
      {
        t: "flow",
        caption: "Đường đi của một chiếc qua cộng tác viên",
        items: [
          { label: "Giao hàng", note: "nhập giá thu từng chiếc", tone: "check" },
          { label: "CTV tạo đơn", note: "chờ xác nhận", tone: "hold" },
          { label: "Chủ xác nhận", note: "chiếc thành Đã bán", tone: "ok" },
          { label: "Quyết toán", note: "CTV nộp tiền theo giá thu", tone: "info" },
        ],
      },
      { t: "demo", name: "money-split", caption: "Ví dụ: giá thu 8.000.000 ₫, CTV bán 9.000.000 ₫" },
      {
        t: "steps",
        items: [
          { title: "Giao hàng", path: ["Nút +", "Giao hàng cho CTV"], text: "Chọn CTV, chọn chiếc sẵn sàng bán và nhập **giá thu** từng chiếc (CTV bán cao hơn giá thu thì phần chênh là của CTV). Giá thu thấp hơn giá vốn sẽ có cảnh báo." },
          { title: "Xác nhận đơn", text: "CTV tạo **đơn chờ xác nhận**; bạn mở đơn và bấm **Xác nhận** (chuông thông báo cho bạn biết)." },
          { title: "Quyết toán", text: "Chọn các dòng đã bán chưa nộp → tổng phải nộp → tiền mặt/chuyển khoản → xác nhận. Hủy quyết toán cần lý do và nhập lại mật khẩu." },
          { title: "Thu hồi", text: "Thu hồi chiếc CTV chưa bán: chọn vị trí kho và lý do." },
          { title: "Thống kê", text: "**Thống kê CTV** theo tháng/quý/năm: số chiếc, bán ra, phải nộp, phần CTV hưởng, đã/chưa nộp." },
        ],
      },
      { t: "callout", tone: "info", title: "Doanh thu của cửa hàng", text: "Với đơn của CTV, doanh thu cửa hàng là **giá thu giao CTV**; phần CTV hưởng (giá bán − giá thu) không tính là doanh thu hay lãi của cửa hàng." },
    ],
  },

  // ------------------------------------------------------------------ Màn hình CTV
  {
    id: "man-ctv",
    title: "Màn hình của cộng tác viên",
    summary: "Hàng đang giữ, tạo đơn, đơn của tôi, thống kê.",
    icon: "me",
    tags: ["Cộng tác viên"],
    perms: ["collab.view_own"],
    blocks: [
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "watch", title: "Hàng", text: "Các chiếc cửa hàng giao cho bạn kèm **giá thu** và số ngày giữ. Bạn không thấy giá vốn." },
          { icon: "sale", title: "Đơn của tôi", text: "Trạng thái từng đơn, phần bạn hưởng và đã nộp tiền chưa." },
          { icon: "report", title: "Thống kê", text: "Số chiếc, tổng bán ra, phải nộp, phần tôi hưởng theo tháng/quý/năm." },
        ],
      },
      {
        t: "steps",
        title: "Tạo đơn bán",
        items: [
          { title: "Chọn chiếc", text: "Chọn chiếc đang giữ trong **Hàng**." },
          { title: "Nhập giá bán thực", text: "Cảnh báo nếu thấp hơn giá thu." },
          { title: "Chọn hoặc tạo khách", text: "Tên + SĐT." },
          { title: "Gửi chờ xác nhận", text: "Cửa hàng xác nhận thì đơn mới tính." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Sửa chữa
  {
    id: "sua-chua",
    title: "Sửa chữa",
    summary: "Nhận máy, tiến độ, dịch vụ và linh kiện, giao máy, sửa nội bộ.",
    icon: "repair",
    tags: ["Chủ"],
    perms: ["repair.view", "repair.create"],
    blocks: [
      {
        t: "flow",
        caption: "Tiến độ một phiếu sửa",
        items: [
          { label: "Đã nhận", tone: "info" },
          { label: "Đang kiểm tra", tone: "check" },
          { label: "Đang sửa", note: "có thể quay lại Chờ linh kiện", tone: "repair" },
          { label: "Hoàn thành", note: "khóa các dòng", tone: "ok" },
          { label: "Đã giao", note: "thu tiền, ghi doanh thu, cấp bảo hành", tone: "neutral" },
        ],
      },
      {
        t: "steps",
        title: "Nhận máy (5 bước)",
        items: [
          { title: "Khách", path: ["Sửa chữa", "Nhận máy"] },
          { title: "Máy" },
          { title: "Tình trạng & lỗi" },
          { title: "Cọc (tùy chọn)" },
          { title: "Nhận máy", text: "Chụp ảnh máy (tùy chọn) và **in phiếu nhận**." },
        ],
      },
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "repair", title: "Dòng trong phiếu", text: "Thêm dòng **dịch vụ** (giá mặc định theo loại việc), **linh kiện** (bấm **Xác nhận dùng** để trừ kho) và **chi phí khác**. Sửa giá cần quyền riêng." },
          { icon: "sale", title: "Hoàn thành & giao máy", text: "**Hoàn thành** khóa các dòng. **Giao máy**: thu tiền (hoặc ghi nợ), doanh thu ghi nhận lúc giao và cấp bảo hành sau sửa. **In phiếu giao**." },
          { icon: "reserve", title: "Hủy", text: "**Hủy** trước khi hoàn thành: hoàn linh kiện và hoàn cọc." },
          { icon: "watch", title: "Sửa nội bộ", text: "Chọn **Máy của cửa hàng**: chi phí sửa được cộng vào **giá vốn** chiếc khi hoàn thành; chọn chiếc về kho hay chờ kiểm tra." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Kiểm kê
  {
    id: "kiem-ke",
    title: "Kiểm kê",
    summary: "Đếm chiếc và linh kiện, đối chiếu, chốt.",
    icon: "stocktake",
    tags: ["Kho", "Chủ"],
    perms: ["stocktake.manage"],
    blocks: [
      {
        t: "steps",
        items: [
          { title: "Mở đợt", path: ["Kiểm kê", "Mở đợt"], text: "Chọn phạm vi: tất cả chiếc, theo vị trí, linh kiện, hoặc tất cả." },
          { title: "Đếm", text: "**Quét hoặc gõ mã** từng chiếc để đếm; với linh kiện nhập **số đếm**. Chiếc không thấy: bấm **Không thấy** và chọn lý do (mất, hư hỏng, nhập sai, đếm sai, tìm thấy, khác)." },
          { title: "Chốt", text: "Xem các dòng **Lệch**, rồi **Chốt**: linh kiện lệch tạo biến động tồn; chiếc mất được **ghi mất** (cần quyền ghi mất — nếu không, nhờ chủ chốt)." },
        ],
      },
      { t: "callout", tone: "info", text: "**Hủy đợt** bỏ toàn bộ số đếm, không điều chỉnh gì. Số hệ thống được lấy lại lúc chốt nên hàng bán trong lúc kiểm vẫn đúng." },
    ],
  },

  // ------------------------------------------------------------------ Báo cáo
  {
    id: "bao-cao",
    title: "Báo cáo & Tổng quan",
    summary: "Doanh thu, lãi gộp, tồn kho, công nợ, xuất Excel, in.",
    icon: "report",
    tags: ["Chủ"],
    perms: ["report.sales", "report.inventory", "profit.view", "debt.view"],
    blocks: [
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "book", title: "Tổng quan", text: "Doanh thu, lãi gộp, thực thu, tồn kho, giá trị tồn theo **kỳ** bạn chọn, kèm **việc cần xử lý** (giữ hàng quá hạn, nợ đến hạn, máy sửa xong chưa giao, linh kiện sắp hết…). Mỗi người chỉ thấy phần mình có quyền." },
          { icon: "report", title: "Báo cáo", text: "Liệt kê các báo cáo bạn được xem. Chọn khoảng ngày và nhóm theo ngày/tháng/quý/năm, xem bảng kèm dòng tổng." },
          { icon: "excel", title: "Xuất Excel & in", text: "**Xuất Excel** (cần quyền xuất) và **In / Lưu PDF** dùng cùng số liệu trên màn hình. Dòng “Dữ liệu đến lúc …” cho biết thời điểm tính." },
          { icon: "shield", title: "Giá vốn và lãi", text: "Chỉ hiện cho người có quyền tương ứng." },
        ],
      },
      { t: "callout", tone: "tip", title: "Vì sao doanh thu, thực thu và lãi là ba con số khác nhau?", text: "**Doanh thu** tính từ phiếu đã xác nhận; **thực thu** là tiền khách đã trả; **lãi gộp** là doanh thu trừ giá thu (giá vốn). Khách còn nợ thì doanh thu đã có nhưng thực thu chưa đủ." },
    ],
  },

  // ------------------------------------------------------------------ Quản trị
  {
    id: "quan-tri",
    title: "Quản trị & sao lưu",
    summary: "Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống.",
    icon: "admin",
    tags: ["Chủ"],
    perms: ["user.manage", "role.manage", "settings.view", "audit.view", "system.health"],
    blocks: [
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "customer", title: "Người dùng", text: "Tạo tài khoản (mật khẩu tạm chỉ hiện **một lần** — sao chép gửi cho người dùng), khóa/mở khóa kèm lý do, đặt lại mật khẩu, đổi vai trò." },
          { icon: "shield", title: "Vai trò & quyền", text: "Bật/tắt từng quyền theo nhóm; quyền nhạy cảm có nhãn. Vai trò Chủ luôn giữ quyền quản lý người dùng và vai trò." },
          { icon: "admin", title: "Cài đặt", text: "Hạn giữ hàng, thời hạn bảo hành, ngưỡng cảnh báo, bảo mật… có hiệu lực ngay." },
          { icon: "report", title: "Hệ thống & sao lưu", text: "Tình trạng máy chủ, **lần sao lưu gần nhất**, tác vụ nền và lỗi gần đây. Nếu sao lưu quá cũ, hãy báo người phụ trách vận hành." },
        ],
      },
      { t: "callout", tone: "warn", title: "Giới hạn", text: "Chỉ **chủ cửa hàng** mới sửa được tài khoản chủ, vai trò Chủ và cài đặt bảo mật. Không ai tự đổi vai trò, tự khóa hay tự đặt lại mật khẩu của chính mình (dùng **Đổi mật khẩu**)." },
      {
        t: "accordion",
        items: [
          {
            title: "Thanh toán: hiện mã VietQR",
            blocks: [{ t: "md", text: "Nhóm **Thanh toán** trong Cài đặt: ngân hàng (chọn từ danh sách, có ô tìm), số tài khoản, tên chủ tài khoản và mẫu nội dung chuyển khoản (“{code}” = mã phiếu) để hiện mã VietQR khi thu chuyển khoản; chưa nhập thì không hiện QR." }],
          },
          {
            title: "Nhật ký",
            blocks: [{ t: "md", text: "Mọi thay đổi quan trọng (ai, khi nào, trước/sau) — không sửa được." }],
          },
          {
            title: "Hoạt động",
            blocks: [
              { t: "md", text: "Ai đã làm thao tác gì, lúc nào, kết quả (thành công/lỗi/bị từ chối) và từ máy nào — kể cả khi **xuất Excel, in phiếu, xem giá vốn, xem báo cáo, xem CCCD đầy đủ** (tick “Chỉ sự kiện nhạy cảm” để xem riêng). Lọc theo người, khu vực, khoảng ngày; tab **Đăng nhập** cho biết ai đăng nhập, sai mật khẩu, bị khóa tạm hay dùng thiết bị tin cậy." },
              { t: "md", text: "Nhật ký **không ghi nội dung** bạn nhập hay số điện thoại/CCCD, chỉ ghi “làm gì” — không sửa/xóa được và tự dọn sau số ngày đặt ở Cài đặt (mặc định 180). Cần quyền xem nhật ký." },
            ],
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Khi có lỗi
  {
    id: "khi-co-loi",
    title: "Khi có lỗi",
    summary: "Thông báo hay gặp và cách xử lý.",
    icon: "help",
    tags: ["Mọi người"],
    blocks: [
      { t: "callout", tone: "tip", title: "Cần hỗ trợ?", text: "Mỗi thông báo lỗi có câu giải thích và một mã dạng **WF-…**. Hãy **chụp màn hình kèm mã này** gửi người phụ trách." },
      {
        t: "table",
        head: ["Thông báo / mã", "Nghĩa là", "Làm gì"],
        rows: [
          ["Phiên đăng nhập đã hết hạn · `WF-AUTH-UNAUTHENTICATED`", "Phiên dài nhất 30 ngày kể từ lần đăng nhập.", "Đăng nhập lại."],
          ["Tài khoản bị khóa tạm · `WF-AUTH-LOCKED`", "Nhập sai mật khẩu nhiều lần.", "Chờ hết thời gian khóa hoặc nhờ chủ cửa hàng đặt lại mật khẩu."],
          ["Bạn không có quyền · `WF-AUTH-FORBIDDEN`", "Việc này cần quyền khác.", "Nhờ chủ cửa hàng cấp quyền."],
          ["Vui lòng nhập lại mật khẩu · `WF-SEC-REAUTH`", "Thao tác nhạy cảm cần xác nhận lại.", "Nhập mật khẩu (và mã 2 bước nếu có) rồi bấm lại."],
          ["Dữ liệu vừa được người khác sửa · `WF-CONFLICT-VERSION`", "Có người khác vừa đổi cùng dữ liệu.", "Tải lại trang rồi làm lại. Với phiếu bán nháp, bấm **Tải lại phiếu** trong thông báo."],
          ["Chiếc này không còn bán được / đã được giữ", "Người khác vừa bán hoặc giữ.", "Tải lại để xem trạng thái mới."],
          ["Thao tác quá nhiều lần · `WF-RATE-LIMIT`", "Hệ thống tạm giới hạn.", "Chờ vài phút."],
          ["Yêu cầu này đã được xử lý trước đó · `WF-BUSY`", "Bạn vừa bấm hai lần.", "Tải lại trang để xem kết quả, đừng tạo lại."],
          ["Lý do quá ngắn · `WF-REASON-REQUIRED`", "Hủy/điều chỉnh cần lý do từ 10 ký tự.", "Nhập lý do rõ hơn."],
        ],
      },
      { t: "callout", tone: "info", title: "Mất mạng", text: "Thao tác chưa gửi được sẽ báo lỗi; khi có mạng bấm lại — hệ thống chống tạo trùng chứng từ." },
    ],
  },
];

export const guideFor = (can: (p: Permission | Permission[]) => boolean): GuideSection[] => GUIDE.filter((s) => !s.perms || can(s.perms));
