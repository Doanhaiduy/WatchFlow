// Hướng dẫn sử dụng (/huong-dan). Nội dung tĩnh do đội phát triển viết; hiển thị bằng bộ dựng an toàn (không HTML) ở src/components/guide/.
// Nguồn sự thật của docs/07-user-guide/HUONG_DAN_SU_DUNG.md (sinh bằng `pnpm docs:guide`, đọc trực tiếp file này — chỉ `import type`).
// Bản gọn (customer-feedback-02): 6 việc — kho đồng hồ, ghi đơn bán, giao CTV bán, sửa chữa (chủ), báo cáo, CTV dùng ở mức giới hạn.
//
// Mỗi mục là danh sách KHỐI có kiểu (bước, ghi chú, đường dẫn, bảng, thẻ, sơ đồ, minh họa giao diện…) để trang hiển thị trực quan.
// Chữ trong khối hỗ trợ **đậm**, `mã`, [liên kết](/duong-dan-noi-bo). Đoạn `md` còn có "## " (tiêu đề nhỏ), "- " (gạch đầu dòng), "1. " (đánh số).
// `perms` (nếu có): chỉ hiện cho người có BẤT KỲ quyền nào trong danh sách (ẩn theo quyền, không theo tên vai trò).
import type { Permission } from "@/lib/permissions";

export type GuideIcon =
  | "start" | "app" | "shield" | "sale" | "watch" | "customer" | "excel" | "ctv" | "me" | "repair" | "report" | "admin" | "help" | "bell" | "search" | "book";

/** Minh họa giao diện dựng bằng chính các lớp Glass của ứng dụng (xem src/components/guide/GuideDemos.tsx). */
export type GuideDemo = "layout-desktop" | "layout-mobile" | "badges" | "shortcuts" | "unit-states" | "multi-ctv";

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
  "WatchFlow giúp chủ cửa hàng làm đúng **sáu việc**: quản lý đồng hồ đang có, ghi lại đơn khi khách mua, giao đồng hồ cho cộng tác viên (CTV) đi bán, quản lý máy khách đưa sửa, xem báo cáo doanh thu/số lượng, và cho CTV dùng ở mức giới hạn. Bạn chỉ thấy những mục **hợp với quyền của mình**; thiếu mục nào cần dùng, nhờ chủ cửa hàng cấp quyền ở Quản trị.";

/** Các loại tài khoản thường gặp (mô tả để hiểu nhau — quyền thật do chủ cửa hàng chỉnh ở Quản trị → Vai trò & quyền). */
export const GUIDE_ROLES: { title: string; text: string }[] = [
  { title: "Chủ cửa hàng", text: "Thấy tất cả: đồng hồ, đơn bán, giao hàng cho CTV và xác nhận CTV báo bán, sửa chữa (chỉ chủ), báo cáo doanh thu, quản trị người dùng, cài đặt và sao lưu." },
  { title: "Nhân viên bán hàng", text: "Ghi đơn bán, xác nhận CTV báo bán, tạo khách, xem đồng hồ và báo cáo bán hàng. Không giao hàng cho CTV, không xem hay sửa máy khách đưa sửa." },
  { title: "Quản lý kho", text: "Thêm đồng hồ, tem QR, vị trí kho, nhập Excel. Không ghi đơn bán." },
  { title: "Cộng tác viên", text: "Chỉ thấy đồng hồ được giao cho mình (kèm giá niêm yết), báo “Đã bán”, xem kết quả và số chiếc đã bán. Không thấy doanh thu, giá vốn, khách của người khác hay đơn của cửa hàng." },
];

/** Lối tắt "Bắt đầu nhanh" ở đầu trang (chỉ hiện nếu mục đích có trong danh sách của người xem). */
export const GUIDE_QUICK: { icon: GuideIcon; title: string; text: string; target: string }[] = [
  { icon: "start", title: "Làm quen màn hình", text: "Thanh dưới, nút “+”, tìm nhanh Ctrl+K", target: "bat-dau" },
  { icon: "sale", title: "Ghi một đơn bán", text: "Chọn chiếc, nhập khách, giá, ngày", target: "ban-hang" },
  { icon: "watch", title: "Thêm đồng hồ vào kho", text: "Từng chiếc hoặc nhập Excel, in tem QR", target: "dong-ho" },
  { icon: "ctv", title: "Giao hàng cho CTV", text: "Một chiếc, nhiều CTV, ai báo trước được", target: "cong-tac-vien" },
  { icon: "me", title: "Tôi là CTV", text: "Xem hàng được giao, báo “Đã bán”", target: "man-ctv" },
  { icon: "repair", title: "Nhận máy sửa", text: "Khách, máy, lỗi, tiền sửa, giao máy", target: "sua-chua" },
  { icon: "report", title: "Xem báo cáo", text: "Doanh thu, số lượng, CTV theo ngày/tháng/quý/năm", target: "bao-cao" },
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
              { t: "md", text: "- **Thanh dưới cùng** có các mục chính theo công việc của bạn.\n- Nút **+** ở giữa mở các **hành động hay dùng** (ghi đơn bán, thêm đồng hồ, giao hàng cho CTV, nhận máy sửa…).\n- Mục **Menu** chứa các màn còn lại.\n- Nút **Quay lại** ở đầu trang (hoặc nút Back của điện thoại) đưa bạn về màn trước." },
            ],
          },
          {
            label: "Máy tính",
            blocks: [
              { t: "demo", name: "layout-desktop", caption: "Giao diện trên máy tính" },
              { t: "md", text: "- **① Thanh bên trái** liệt kê các mục theo nhóm; viên số cạnh mục là số việc cần xử lý. Ở cuối có công tắc **Sáng/Tối** và thẻ tài khoản.\n- **② Ô tìm nhanh** (phím tắt `Ctrl + K`): tìm mã, serial, khách, đơn hoặc mở trang.\n- **③ Quét QR và chuông**: quét tem đồng hồ; chuông là thông báo dành cho bạn.\n- **④ Nút hành động chính** (màu gradient) — thường là Ghi đơn bán." },
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
          { title: "Gõ mã hoặc tên", text: "Gõ **mã nội bộ, serial, tên đồng hồ, tên/số điện thoại khách, mã đơn** — không cần gõ dấu. Kết quả gom theo nhóm và chỉ gồm phần bạn có quyền xem." },
          { title: "Mở kết quả", text: "Gõ đúng mã hoặc serial rồi nhấn **Enter** là mở thẳng chiếc đó. Ô trống cho bạn các **hành động nhanh** và danh sách **trang**; **↑↓** để chọn, **Esc** để đóng." },
        ],
      },
      { t: "heading", text: "Số việc cần xử lý" },
      { t: "demo", name: "badges" },
      { t: "md", text: "Viên số cạnh mục trên thanh dưới, thanh bên và Menu cho biết còn bao nhiêu việc: **vàng** là đang chờ, **đỏ** là có việc quá hạn (CTV báo bán chờ hơn một ngày, máy sửa quá hẹn hoặc xong chưa lấy). Số tự cập nhật mỗi phút." },
      {
        t: "cards",
        cols: 3,
        items: [
          { icon: "search", title: "Quét QR", text: "Nút quét QR mở camera (hoặc ô nhập mã nếu máy không có camera)." },
          { icon: "bell", title: "Chuông thông báo", text: "Cho biết việc mới: CTV báo đã bán cần xác nhận, kết quả báo bán của CTV, đồng hồ mới được giao…" },
          { icon: "admin", title: "Dải cảnh báo", text: "Chủ cửa hàng thấy dải cảnh báo phía trên khi việc chạy nền quá hạn, sao lưu lỗi hoặc kho ảnh sắp đầy; bấm để mở **Quản trị → Hệ thống**." },
        ],
      },
      { t: "callout", tone: "info", title: "Số tiền", text: "Số tiền luôn hiển thị dạng **8.200.000 ₫**; mọi con số do máy chủ tính, màn hình chỉ hiển thị." },
      { t: "callout", tone: "warn", title: "Mất mạng", text: "Biểu ngữ vàng hiện lên; bạn vẫn nhập được nhưng **chưa thể lưu** cho tới khi có mạng lại." },
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
              { t: "md", text: "Ở bước nhập mã 6 số có ô **“Tin cậy thiết bị này … ngày”**. Chỉ tick trên **máy của riêng bạn**: những lần đăng nhập sau trên máy đó (cùng trình duyệt) chỉ cần **mật khẩu**, không hỏi mã 6 số. Mật khẩu vẫn luôn phải đúng, và với thao tác nhạy cảm (đặt lại mật khẩu, tắt xác thực 2 bước, hủy đơn…) hệ thống vẫn hỏi lại mật khẩu **và mã 2 bước**." },
              { t: "md", text: "Thiết bị tự hết tin cậy khi hết hạn, khi bạn **đổi mật khẩu**, khi chủ cửa hàng **đặt lại mật khẩu hoặc khóa** tài khoản, hoặc khi bạn tắt xác thực 2 bước." },
              { t: "path", label: "Muốn bỏ ngay", items: ["Tài khoản", "Thiết bị tin cậy", "Bỏ"] },
              { t: "md", text: "Bấm **Bỏ** từng máy hoặc **Quên các thiết bị đã tin cậy**. Mất máy? Đổi mật khẩu là đủ để thu hồi tất cả." },
            ],
          },
          {
            title: "Thiết bị đang đăng nhập",
            blocks: [{ t: "md", text: "Vào **Tài khoản** để xem các thiết bị và **thu hồi** thiết bị lạ. Với thao tác nhạy cảm (đổi vai trò, hủy đơn…) hệ thống hỏi **nhập lại mật khẩu**." }],
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
    title: "Ghi đơn bán",
    summary: "Khách mua chiếc nào, giá bao nhiêu, ngày nào — nhập một lần để tra cứu lại sau này.",
    icon: "sale",
    tags: ["Bán hàng", "Chủ"],
    perms: ["sale.confirm", "sale.view"],
    blocks: [
      { t: "md", text: "Đơn bán chỉ lưu **chiếc đã bán + khách + giá + ngày** (và hạn bảo hành). Hệ thống **không** theo dõi thanh toán, công nợ, giảm giá hay thu cũ — khách trả bao nhiêu, bằng cách nào là việc của cửa hàng." },
      { t: "path", label: "Vào", items: ["Bán hàng", "Ghi đơn bán"] },
      {
        t: "steps",
        title: "Ghi một đơn",
        items: [
          { title: "Chọn chiếc khách mua", text: "Tìm theo **mã nội bộ, serial hoặc tên** (hoặc quét tem QR). Chọn nhiều chiếc nếu khách mua nhiều. Chỉ chiếc **Sẵn sàng bán** mới chọn được." },
          { title: "Nhập giá bán", text: "Ô giá tự điền **giá niêm yết**; sửa nếu bán giá khác. Có thể đổi **hạn bảo hành** từng chiếc (mặc định hàng mới 12 tháng, hàng cũ 3 tháng, hoặc không bảo hành)." },
          { title: "Nhập khách", text: "Gõ tên/SĐT để chọn **khách đã có**, hoặc nhập **họ tên (+ SĐT)** khách mới — cùng SĐT hệ thống dùng lại khách cũ." },
          { title: "Chọn ngày bán, ghi chú, Lưu đơn", text: "Ngày mặc định là hôm nay (ghi lùi tối đa vài ngày theo cài đặt). Bấm **Lưu đơn** — đơn có mã `HD-…` và chiếc chuyển sang **Đã bán**." },
        ],
      },
      { t: "callout", tone: "tip", title: "Nhập sai?", text: "Mở đơn → **Hủy đơn** (kèm lý do, trong vòng 24 giờ, cần nhập lại mật khẩu). Chiếc quay về kho, bạn ghi lại đơn đúng." },
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "search", title: "Tra cứu đơn cũ", text: "Ở **Bán hàng** gõ tên/SĐT khách, mã đơn hoặc serial; lọc **Bán tại cửa hàng / CTV bán / Đã hủy**." },
          { icon: "customer", title: "Lịch sử của khách", text: "Mở **Khách hàng** → chọn khách để xem các đơn đã mua và các lần gửi sửa." },
          { icon: "book", title: "In phiếu", text: "Mở đơn → **In phiếu** (khổ 80mm hoặc PDF). Phiếu in kèm hạn bảo hành từng chiếc; lần in thứ hai ghi “BẢN IN LẠI”." },
          { icon: "ctv", title: "Đơn do CTV bán", text: "Khi bạn xác nhận CTV báo bán, hệ thống tự tạo đơn (có ghi tên CTV). Doanh thu = giá bạn xác nhận." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Đồng hồ
  {
    id: "dong-ho",
    title: "Đồng hồ & kho",
    summary: "Thêm đồng hồ, nhập Excel, giá, vị trí, tem QR.",
    icon: "watch",
    tags: ["Kho", "Chủ"],
    perms: ["catalog.view"],
    blocks: [
      { t: "heading", text: "Trạng thái của một chiếc" },
      { t: "demo", name: "unit-states" },
      { t: "md", text: "Trạng thái chỉ đổi qua các thao tác nghiệp vụ (bán, kiểm tra, sửa…), không sửa tay được. **Chiếc đang giao cho CTV vẫn là “Sẵn sàng bán”** — cửa hàng vẫn bán trực tiếp được." },
      {
        t: "steps",
        title: "Thêm một chiếc vào kho",
        items: [
          { title: "Mở form", path: ["Đồng hồ", "Thêm đồng hồ"] },
          { title: "Điền thông tin", text: "Chọn **loại đồng hồ**, **serial**, **tình trạng** (mới/cũ), **vị trí lưu kho** và **giá niêm yết**. Loại chưa có: tạo ở **Đồng hồ → Loại & hãng**." },
          { title: "Lưu", text: "Hàng **mới** vào thẳng “Sẵn sàng bán”. Hàng **cũ** vào “Chờ kiểm tra”: chụp ảnh, ghi hạng rồi bấm **Kiểm tra đạt** ở trang chiếc." },
        ],
      },
      { t: "callout", tone: "info", title: "Nhập nhiều chiếc cùng lúc", text: "**Menu → Nhập từ Excel** (hoặc nút ở trang Đồng hồ): tải tệp mẫu, điền, rồi xem trước từng dòng trước khi ghi. Cùng chỗ đó nhập được **khách hàng** hàng loạt." },
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "search", title: "Danh sách", text: "Lọc theo trạng thái (Sẵn sàng bán, Chờ kiểm tra, Đang sửa, Đã bán, Thanh lý/mất), thương hiệu, loại, vị trí, tình trạng." },
          { icon: "watch", title: "Chi tiết chiếc", text: "Ảnh, giá, vị trí; các tab Thông tin, Ảnh, Giá, Lịch sử. Từ đây bấm **Bán** hoặc **Giao CTV** cho chiếc này." },
          { icon: "book", title: "Sửa giá, vị trí, kiểm tra", text: "**Sửa giá** và khuyến mãi theo khoảng ngày; **Đổi vị trí**; **Kiểm tra đạt** cho chiếc Chờ kiểm tra. **Ghi mất/Khôi phục** cần lý do và nhập lại mật khẩu." },
          { icon: "start", title: "Tem QR 50×30mm", text: "**In tem QR**; quét tem bằng ô quét ở thanh tìm kiếm để mở chiếc ngay." },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ Khách hàng
  {
    id: "khach-hang",
    title: "Khách hàng",
    summary: "Lưu họ tên, SĐT, địa chỉ để tra cứu lịch sử mua và sửa.",
    icon: "customer",
    tags: ["Bán hàng", "Chủ"],
    perms: ["customer.view", "customer.view_own"],
    blocks: [
      { t: "md", text: "Khách được lưu **tự động** khi bạn ghi đơn bán hoặc nhận máy sửa; bạn cũng có thể thêm trước ở **Khách hàng → Thêm**. Mỗi khách có: họ tên, SĐT, địa chỉ, ghi chú, danh sách đồng hồ của khách, lịch sử mua và sửa." },
      { t: "callout", tone: "info", title: "Trùng số điện thoại", text: "Thêm khách có SĐT đã tồn tại, hệ thống cho bạn mở khách đó hoặc chọn “Vẫn tạo khách mới”. Khi ghi đơn/nhận máy, cùng SĐT sẽ dùng lại khách cũ." },
    ],
  },

  // ------------------------------------------------------------------ CTV (chủ)
  {
    id: "cong-tac-vien",
    title: "Giao hàng cho cộng tác viên",
    summary: "Một chiếc giao nhiều CTV; ai báo “Đã bán” trước được giữ; bạn xác nhận.",
    icon: "ctv",
    tags: ["Chủ", "Bán hàng"],
    perms: ["collab.manage", "collab.view", "sale.confirm"],
    blocks: [
      { t: "md", text: "CTV (cộng tác viên) đi bán giúp. Bạn **không cần ghi giá thu hay quyết toán**: CTV bán giá nào là việc của họ, cửa hàng chỉ cần biết chiếc đã bán được." },
      { t: "demo", name: "multi-ctv", caption: "Một chiếc giao cho 3 CTV: CTV nào báo “Đã bán” trước được giữ chiếc" },
      {
        t: "flow",
        caption: "Luồng một chiếc",
        items: [
          { label: "Giao cho 1 hay nhiều CTV", note: "Chiếc vẫn ở kho", tone: "info" },
          { label: "CTV báo “Đã bán”", note: "Tên + SĐT khách; ai trước được", tone: "hold" },
          { label: "Bạn xác nhận", note: "Giá mặc định = giá niêm yết", tone: "ok" },
          { label: "Đơn bán + Đã bán", note: "CTV khác tự mất chiếc", tone: "neutral" },
        ],
      },
      {
        t: "steps",
        title: "Giao đồng hồ",
        items: [
          { title: "Mở trang giao hàng", path: ["Cộng tác viên", "Giao đồng hồ"] },
          { title: "Chọn chiếc", text: "Tìm theo mã/serial/tên. Chọn được nhiều chiếc một lần. Chỉ chiếc “Sẵn sàng bán” giao được." },
          { title: "Chọn cộng tác viên", text: "Tick **một hoặc nhiều CTV** (hoặc “Chọn tất cả CTV”). Mỗi CTV nhận thông báo và thấy chiếc trong **Hàng của tôi**." },
          { title: "Bấm Giao", text: "Muốn thu hồi: **Cộng tác viên → Hàng đang giao** → mở chiếc → **Thu hồi** (một CTV hoặc tất cả)." },
        ],
      },
      {
        t: "steps",
        title: "Khi CTV báo đã bán",
        items: [
          { title: "Nhận thông báo", text: "Chuông + viên số vàng ở mục **Cộng tác viên**; hoặc vào **Cộng tác viên → Báo bán**." },
          { title: "Xác nhận", text: "Kiểm tra khách (gọi nếu cần), sửa **giá bán** nếu khác giá niêm yết, chọn ngày và bảo hành, bấm **Xác nhận đã bán**." },
          { title: "Hoặc từ chối", text: "Bấm **Từ chối** kèm lý do (từ 10 ký tự): chiếc vẫn còn cho các CTV khác báo, CTV bị từ chối nhận thông báo." },
        ],
      },
      {
        t: "table",
        head: ["Tình huống", "Hệ thống xử lý"],
        rows: [
          ["Hai CTV báo cùng lúc", "Chỉ người báo trước được ghi nhận; người sau nhận thông báo “đã có CTV khác báo bán trước”."],
          ["Đang chờ xác nhận mà cửa hàng bán chiếc đó", "Bị chặn — hãy xác nhận hoặc từ chối báo bán trước."],
          ["Chiếc bị ghi mất / chuyển “Chờ kiểm tra”", "Mọi chào hàng tự đóng; báo bán đang chờ tự huỷ."],
          ["Hủy đơn do CTV bán (trong 24 giờ)", "Chiếc về “Sẵn sàng bán”; chào hàng không tự mở lại — giao lại nếu cần."],
        ],
      },
      { t: "callout", tone: "warn", title: "Doanh thu của chiếc CTV bán", text: "Bằng **giá bạn xác nhận** (mặc định giá niêm yết), tính vào doanh thu cửa hàng ở ngày bán. Số chiếc và doanh thu từng CTV xem ở **Báo cáo → Cộng tác viên** (theo ngày/tháng/quý/năm). CTV không thấy các số này." },
    ],
  },

  // ------------------------------------------------------------------ CTV (người dùng CTV)
  {
    id: "man-ctv",
    title: "Dành cho cộng tác viên",
    summary: "Xem hàng được giao, báo “Đã bán”, theo dõi kết quả và số chiếc đã bán.",
    icon: "me",
    tags: ["Cộng tác viên"],
    perms: ["collab.view_own"],
    blocks: [
      {
        t: "cards",
        cols: 2,
        items: [
          { icon: "watch", title: "Hàng của tôi", text: "Các chiếc cửa hàng giao cho bạn, kèm **giá niêm yết** tham khảo. Chiếc có thể cũng được giao cho CTV khác." },
          { icon: "sale", title: "Báo bán của tôi", text: "Các lần bạn báo “Đã bán” và kết quả: chờ xác nhận, đã xác nhận, bị từ chối (kèm lý do)." },
          { icon: "report", title: "Thống kê", text: "Số chiếc bạn bán được theo ngày/tháng/quý/năm. Không hiển thị tiền." },
          { icon: "me", title: "Tài khoản của tôi", text: "Đổi mật khẩu, giao diện sáng/tối, thông báo trên điện thoại." },
        ],
      },
      {
        t: "steps",
        title: "Khi bán được một chiếc",
        items: [
          { title: "Mở Hàng của tôi", text: "Tìm chiếc đã bán, bấm **Đã bán**." },
          { title: "Nhập khách", text: "Họ tên và **số điện thoại** khách (bắt buộc), ghi chú nếu có. **Không cần nhập giá** — cửa hàng tự xác nhận." },
          { title: "Chờ xác nhận", text: "Bạn nhận thông báo khi cửa hàng xác nhận hoặc từ chối. Báo nhầm? Vào **Báo bán của tôi** → **Rút lại báo bán** (khi còn chờ)." },
        ],
      },
      { t: "callout", tone: "info", title: "Ai báo trước được giữ", text: "Nếu chiếc được giao cho nhiều CTV, người báo “Đã bán” **trước** sẽ giữ chiếc; chiếc hiện “CTV khác đã báo bán” ở máy của người sau. Khi cửa hàng xác nhận, chiếc biến khỏi danh sách của các CTV còn lại." },
      { t: "callout", tone: "warn", title: "Bạn không thấy gì?", text: "CTV chỉ thấy chiếc được giao cho mình. Doanh thu, giá vốn, đơn và khách của cửa hàng không hiển thị với CTV." },
    ],
  },

  // ------------------------------------------------------------------ Sửa chữa
  {
    id: "sua-chua",
    title: "Sửa chữa (chỉ chủ)",
    summary: "Nhận máy khách đưa sửa, theo dõi tiến độ, tiền sửa, giao máy.",
    icon: "repair",
    tags: ["Chủ"],
    perms: ["repair.view"],
    blocks: [
      { t: "md", text: "Chỉ người có quyền sửa chữa (mặc định **chủ cửa hàng**) thấy mục này. Phiếu sửa lưu **khách + máy + lỗi + tiến độ + tiền sửa**; không có linh kiện, cọc hay công nợ." },
      {
        t: "flow",
        caption: "Tiến độ một phiếu sửa",
        items: [
          { label: "Đã nhận", tone: "info" },
          { label: "Đang kiểm tra", tone: "check" },
          { label: "Đang sửa", note: "hoặc Chờ linh kiện", tone: "repair" },
          { label: "Sửa xong", tone: "ok" },
          { label: "Đã giao", note: "ghi doanh thu", tone: "neutral" },
        ],
      },
      {
        t: "steps",
        title: "Nhận một máy",
        items: [
          { title: "Mở form", path: ["Sửa chữa", "Nhận máy"] },
          { title: "Khách", text: "Tìm khách cũ hoặc nhập họ tên + **SĐT** (bắt buộc)." },
          { title: "Máy & lỗi", text: "Chọn đồng hồ đã có trong hồ sơ khách hoặc nhập thương hiệu/loại/serial; ghi **lỗi khách mô tả**, tình trạng lúc nhận, ngày hẹn trả. Máy còn bảo hành của cửa hàng: chọn để **sửa miễn phí**." },
          { title: "In phiếu nhận", text: "Bấm **Nhận máy & lập phiếu**, in phiếu cho khách và chụp ảnh máy (tùy chọn)." },
        ],
      },
      {
        t: "steps",
        title: "Trong lúc sửa",
        items: [
          { title: "Đổi tiến độ", text: "Bấm **Bắt đầu kiểm tra → Bắt đầu sửa**, hoặc **Chờ linh kiện** khi đang đợi hàng." },
          { title: "Ghi tiền sửa", text: "**Thêm khoản**: chọn loại việc (giá mặc định) hoặc khoản khác tự nhập (dây da, gia công ngoài…). Sửa giá cần quyền sửa giá." },
          { title: "Sửa xong → Giao máy", text: "Bấm **Sửa xong** (khóa các khoản), rồi **Giao máy** khi khách đến lấy: doanh thu sửa chữa được ghi nhận **lúc giao** và bắt đầu bảo hành sau sửa." },
        ],
      },
      { t: "callout", tone: "tip", title: "Hủy phiếu", text: "Phiếu chưa sửa xong có thể **Hủy** (lý do từ 10 ký tự). Đã giao thì bị khóa, không hủy được." },
    ],
  },

  // ------------------------------------------------------------------ Báo cáo
  {
    id: "bao-cao",
    title: "Báo cáo",
    summary: "Doanh thu, số lượng đồng hồ, cộng tác viên — theo ngày, tháng, quý, năm.",
    icon: "report",
    tags: ["Chủ", "Bán hàng"],
    perms: ["report.sales", "report.inventory", "collab.view"],
    blocks: [
      { t: "path", label: "Vào", items: ["Báo cáo"] },
      {
        t: "table",
        head: ["Báo cáo", "Cho biết", "Ai xem"],
        rows: [
          ["Doanh thu", "Bán tại cửa hàng + CTV bán + sửa chữa, kèm số đơn và số chiếc, theo ngày/tháng/quý/năm", "Người có quyền báo cáo bán hàng"],
          ["Số lượng đồng hồ", "Đã bán trong kỳ (theo hãng, theo kênh) và đang có trong kho theo hãng", "Báo cáo bán hàng hoặc kho"],
          ["Cộng tác viên", "Số chiếc và doanh thu từng CTV mang về, theo kỳ", "Chỉ người được xem CTV (chủ)"],
        ],
      },
      {
        t: "steps",
        items: [
          { title: "Chọn báo cáo", text: "Mở một báo cáo ở trang Báo cáo; biểu đồ phía trên cho cái nhìn nhanh." },
          { title: "Chọn khoảng thời gian", text: "7 ngày / 30 ngày / Tháng này / Quý / Năm / Tùy chọn, và **nhóm theo** ngày, tháng, quý hoặc năm." },
          { title: "Xuất hoặc in", text: "**Xuất Excel** (giới hạn vài lần mỗi giờ, có ghi nhật ký) hoặc **In / Lưu PDF**." },
        ],
      },
      { t: "callout", tone: "info", title: "Doanh thu tính từ đâu?", text: "Từ **đơn bán đã ghi** (theo ngày bán) và **phiếu sửa đã giao** (theo ngày giao) — không tính từ tiền thu. Đơn đã hủy không được tính." },
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
          { icon: "customer", title: "Người dùng", text: "Tạo tài khoản (mật khẩu tạm chỉ hiện **một lần** — sao chép gửi cho người dùng), khóa/mở khóa kèm lý do, đặt lại mật khẩu, đổi vai trò. Muốn có CTV: tạo người dùng vai trò **Cộng tác viên**." },
          { icon: "shield", title: "Vai trò & quyền", text: "Bật/tắt từng quyền theo nhóm; quyền nhạy cảm có nhãn. Vai trò Chủ luôn giữ quyền quản lý người dùng và vai trò." },
          { icon: "admin", title: "Cài đặt", text: "Thông tin cửa hàng in trên phiếu, hạn bảo hành, cửa sổ hủy đơn, bảo mật… có hiệu lực ngay." },
          { icon: "report", title: "Hệ thống & sao lưu", text: "Tình trạng máy chủ, **lần sao lưu gần nhất**, tác vụ nền và lỗi gần đây. Nếu sao lưu quá cũ, hãy báo người phụ trách vận hành." },
        ],
      },
      { t: "callout", tone: "warn", title: "Giới hạn", text: "Chỉ **chủ cửa hàng** mới sửa được tài khoản chủ, vai trò Chủ và cài đặt bảo mật. Không ai tự đổi vai trò, tự khóa hay tự đặt lại mật khẩu của chính mình (dùng **Đổi mật khẩu**)." },
      {
        t: "accordion",
        items: [
          {
            title: "Nhật ký",
            blocks: [
              { t: "md", text: "Một trang, hai mục: **Thay đổi dữ liệu** (ai sửa gì, khi nào, trước/sau — không sửa được) và **Truy cập & đăng nhập** (ai làm thao tác gì, từ máy nào, ai đăng nhập hay sai mật khẩu; lọc theo người, khu vực, khoảng ngày)." },
              { t: "md", text: "Nhật ký **không ghi nội dung** bạn nhập hay số điện thoại khách, chỉ ghi “làm gì” — không sửa/xóa được và tự dọn sau số ngày đặt ở Cài đặt (mặc định 180)." },
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
          ["Chiếc không còn sẵn sàng bán · `WF-SALE-UNIT-UNAVAILABLE`", "Chiếc vừa được bán hoặc chuyển trạng thái.", "Tải lại và bỏ chiếc đó khỏi đơn."],
          ["Chiếc đang có CTV báo bán · `WF-SALE-UNIT-CLAIMED`", "Có báo bán chờ xác nhận cho chiếc này.", "Vào Cộng tác viên → Báo bán, xác nhận hoặc từ chối trước."],
          ["Đã có CTV khác báo bán trước · `WF-COL-CLAIMED`", "Người báo trước đang giữ chiếc, chờ cửa hàng xác nhận.", "Chờ kết quả; nếu bị từ chối, chiếc mở lại cho bạn."],
          ["Quá thời hạn hủy đơn · `WF-SALE-VOID-EXPIRED`", "Chỉ hủy đơn trong thời hạn đặt ở Cài đặt (mặc định 24 giờ).", "Liên hệ chủ cửa hàng để xử lý riêng."],
          ["Dữ liệu vừa được người khác sửa · `WF-CONFLICT-VERSION`", "Có người khác vừa đổi cùng dữ liệu.", "Tải lại trang rồi làm lại."],
          ["Thao tác quá nhiều lần · `WF-RATE-LIMIT`", "Hệ thống tạm giới hạn.", "Chờ vài phút."],
          ["Yêu cầu này đã được xử lý trước đó · `WF-BUSY`", "Bạn vừa bấm hai lần.", "Tải lại trang để xem kết quả, đừng tạo lại."],
          ["Lý do quá ngắn · `WF-REASON-REQUIRED`", "Hủy/từ chối cần lý do từ 10 ký tự.", "Nhập lý do rõ hơn."],
        ],
      },
      { t: "callout", tone: "info", title: "Mất mạng", text: "Thao tác chưa gửi được sẽ báo lỗi; khi có mạng bấm lại — hệ thống chống tạo trùng đơn khi bạn bấm hai lần." },
    ],
  },
];

export const guideFor = (can: (p: Permission | Permission[]) => boolean): GuideSection[] => GUIDE.filter((s) => !s.perms || can(s.perms));
