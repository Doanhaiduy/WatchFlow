# Hệ thống giao diện — phong cách Glass

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (khách chốt mẫu **v6-glass**, CF-09) · ADR-026, ADR-027
> Tài liệu này là **đặc tả để AI/dev dựng giao diện**. Nguồn hình ảnh tham chiếu: `design/ui-preview/v6-glass.html` (+ `assets/shared.js`: dữ liệu minh họa, biểu tượng, hàm vẽ biểu đồ). Mâu thuẫn giữa đặc tả này và mẫu ⇒ **đặc tả này thắng** (mẫu còn các màn đã bị loại và dữ liệu minh họa). Cách đọc nhanh: mở `design/ui-preview/v6-glass.html` trong trình duyệt (điện thoại 390px và máy tính ≥ 1000px).

## 1. Nguyên tắc

1. **Kính mờ trên nền gradient sáng.** Bề mặt là lớp kính (`rgba(255,255,255,.58)` + blur) nổi trên nền pastel; chỗ nhấn là một gradient tím–xanh dương.
2. **Mobile-first, một tay.** Thao tác chính nằm trong tầm ngón cái: dock nổi ở đáy, nút "+" lớn ở giữa, sheet trượt từ dưới lên.
3. **Số là nhân vật chính.** Số tiền/số lượng cỡ lớn, đậm (800), chữ phụ nhỏ xám; màu chỉ để phân loại trạng thái, **luôn kèm chữ** (không chỉ màu).
4. **Ít chữ, ít chạm.** Mỗi màn một mục đích; hành động hay dùng ≤ 3 chạm; nháp tự lưu.
5. **Nhẹ.** Không thư viện UI nặng; CSS thuần + Tailwind; `backdrop-filter` có phương án dự phòng.
6. **Nhất quán qua token.** Không gõ cứng màu/bo góc/đổ bóng trong component — dùng biến CSS ở §3.
7. **Chỉ bản sáng** ở giai đoạn đầu (khách chốt mẫu sáng; ưu tiên điện thoại). Token tổ chức để thêm bản tối sau (ADR-026).

## 2. Cấu trúc mẫu → cấu trúc ứng dụng

| Mẫu v6-glass | Ứng dụng thật |
|---|---|
| `assets/shared.js` (dữ liệu minh họa, icon, chart) | Không dùng làm mã thật. Biểu tượng: **`lucide-react`** (nét 1.8, bo tròn — cùng phong cách bộ SVG của mẫu); biểu đồ: thành phần riêng `src/components/charts/*` (SVG nhẹ như mẫu) hoặc phần tử Lucian (§8) |
| CSS trong `<style>` của v6-glass | Chuyển thành `src/styles/tokens.css` (token) + `src/styles/glass.css` (lớp tiện ích `.g`, `.wf-chip`…) + thành phần React `src/components/ui/*` |
| Lớp `.g`, `.ir`, `.pc`, `.btn`… | Thành phần có tên: `GlassCard`, `InsetList`/`InsetRow`, `ProductCard`, `Button`… (§5) |
| Phông Google Fonts | `@fontsource/be-vietnam-pro` (tự lưu trữ, trọng số 300–800, subset Vietnamese + Latin) |

## 3. Token

Đặt trong `src/styles/tokens.css` (`:root`). Giá trị lấy từ `v6-glass.html`; đổi giá trị ở **một nơi**.

```css
:root{
  /* chữ & bề mặt */
  --wf-ink:#1B1B3A; --wf-mute:#6E7194; --wf-mute-2:#8B8FB3; --wf-nav:#4B4E78;
  --wf-page:#EEF1FB;
  --wf-glass:rgba(255,255,255,.58); --wf-glass-line:rgba(255,255,255,.82);
  --wf-glass-strong:rgba(255,255,255,.86); --wf-glass-field:rgba(255,255,255,.75);
  --wf-glass-shadow:0 10px 32px rgba(91,91,240,.11), inset 0 1px 0 rgba(255,255,255,.95);
  --wf-blur:blur(22px) saturate(1.5);
  --wf-line:rgba(27,27,58,.07);
  /* nhấn */
  --wf-accent:#5B5BF0; --wf-accent-2:#7C9BFF;
  --wf-grad:linear-gradient(135deg,#6C63FF,#5B8DFF);                 /* nút chính */
  --wf-grad-hero:linear-gradient(140deg,#6C63FF 0%,#5B8DFF 60%,#8CC0FF 100%); /* thẻ số lớn */
  --wf-grad-fab:linear-gradient(145deg,#8E7CFF,#4C7DFF);              /* nút + */
  --wf-dark-btn:#15153A;
  /* trạng thái (màu chính + nền nhạt) */
  --wf-ok:#17A673;    --wf-ok-t:rgba(23,166,115,.14);
  --wf-bad:#E5484D;   --wf-bad-t:rgba(229,72,77,.13);
  --wf-hold:#D98A00;  --wf-hold-t:rgba(240,170,20,.20);
  --wf-info:#3B82F6;  --wf-info-t:rgba(59,130,246,.14);
  --wf-check:#8B5CF6; --wf-check-t:rgba(139,92,246,.14);
  --wf-repair:#F0742A;--wf-repair-t:rgba(240,116,42,.15);
  --wf-neutral:#6E7194; --wf-neutral-t:rgba(110,113,148,.14);         /* đã bán / nháp */
  /* hình khối */
  --wf-r-card:26px; --wf-r-list:24px; --wf-r-hero:30px; --wf-r-sheet:32px; --wf-r-field:20px; --wf-r-tile:14px; --wf-r-pill:999px;
  --wf-shadow-pri:0 10px 24px rgba(91,91,240,.4);
  --wf-shadow-hero:0 18px 40px rgba(91,91,240,.35);
  --wf-ease:cubic-bezier(.2,.8,.2,1);
  /* vùng an toàn (PWA, tai thỏ) */
  --safe-top:env(safe-area-inset-top,0px); --safe-bottom:env(safe-area-inset-bottom,0px);
}
body{ font:400 14px/1.5 'Be Vietnam Pro',system-ui,-apple-system,'Segoe UI',sans-serif; color:var(--wf-ink); background:var(--wf-page); -webkit-font-smoothing:antialiased }
body::before{ /* nền gradient cố định phía sau */
  content:''; position:fixed; inset:0; z-index:-1;
  background:
   radial-gradient(55% 45% at 8% 0%,#BCD6FF 0%,transparent 70%),
   radial-gradient(50% 42% at 100% 8%,#E3D2FF 0%,transparent 70%),
   radial-gradient(60% 50% at 90% 100%,#FFD8C8 0%,transparent 70%),
   radial-gradient(50% 50% at 0% 95%,#CDEFE3 0%,transparent 70%), var(--wf-page) }
```

**Màu trạng thái** dùng qua thuộc tính `data-tone="ok|bad|hold|info|check|repair|neutral"` đặt `--tc` (màu chữ/biểu tượng) và `--tb` (nền nhạt). Ánh xạ nghiệp vụ:

| Đối tượng | Giá trị → nhãn → tone |
|---|---|
| Chiếc (`unit_status`) | `in_stock` Sẵn sàng bán `ok` · `reserved` Đã giữ `hold` · `with_collaborator` Đang ở CTV `info` · `sold` Đã bán `neutral` · `in_repair` Đang sửa `repair` · `inspecting` Chờ kiểm tra `check` · `written_off` Thanh lý/mất `bad` · `cancelled` Nhập nhầm `neutral` |
| Phiếu sửa | `received` Đã nhận `info` · `inspecting` Đang kiểm tra `check` · `repairing` Đang sửa `repair` · `waiting_parts` Chờ linh kiện `hold` · `completed` Hoàn thành `ok` · `delivered` Đã giao `neutral` · `cancelled` Đã hủy `bad` |
| Chứng từ | `draft` Nháp `neutral` · `confirmed` Đã xác nhận `ok` · `voided` Đã hủy `bad` · còn nợ `hold` |
| Bảo hành | `active` Còn hạn `ok` · sắp hết (≤ 14 ngày) `hold` · `expired` Hết hạn `neutral` · `voided` `bad` |
| Giữ hàng | `active` `hold` · `expired` `bad` · `converted` `ok` · `cancelled`/`forfeited` `neutral` |

**Kiểu chữ** (Be Vietnam Pro): tiêu đề trang lớn (mobile) 34px/800, letter-spacing −.035em; tiêu đề mục 18px/700; số hero 34px (mobile) → 48px (desktop) / 800 / −.04em; số KPI 18px (mobile) → 26px (desktop) / 800; thân 14px; chữ phụ 12–13px màu `--wf-mute`; chip 11px/600; nhãn nhóm menu 10.5px in hoa, giãn chữ .1em. **Số tiền luôn `font-variant-numeric: tabular-nums`**, định dạng `8.200.000 ₫`.

**Chuyển động:** sheet/modal 0.35–0.4s `--wf-ease`; lớp phủ (scrim) 0.25s; nhấn nút nhẹ; tôn trọng `prefers-reduced-motion` (rút còn ~0).

## 4. Bố cục & điều hướng

### 4.1 Điện thoại (< 1000px)
- **Tiêu đề lớn** (`.lt`): hàng nhỏ (ngày/ngữ cảnh + nút quét QR + chuông thông báo có chấm đỏ) rồi tiêu đề 34px. Vùng nội dung `padding: 8px 14px calc(124px + var(--safe-bottom))` (chừa chỗ dock); khoảng cách giữa khối 12px.
- **Dock nổi** (`position:fixed; left/right:16px; bottom:calc(14px + safe); height:70px; radius:36px; kính`): lưới `1fr 1fr 74px 1fr 1fr`; mục có biểu tượng 23px + nhãn 10.5px/600; mục đang chọn tím `--wf-accent` kèm chấm 5px dưới; **nút "+" ở giữa** nhô lên (−30px), tròn 62px, gradient `--wf-grad-fab`, viền sáng + quầng sáng.
- **Action sheet** (nhấn "+"): nhóm các hành động nhanh theo vai trò (§4.3) trong thẻ kính trượt từ đáy, nút "Hủy" rời bên dưới, scrim mờ.
- **Menu** (mục cuối của dock): sheet toàn màn hình, nền gradient nhạt, các nhóm danh sách inset có biểu tượng màu theo tone.
- **Giỏ phiếu bán (POS)**: thanh nổi "N món · nháp — Xem phiếu" ngay trên dock; bấm mở **bottom sheet** (giữ 3 độ cao nếu dùng phần tử #336) gồm khách, các dòng, tổng, thanh toán, nút "Xác nhận & in phiếu".
- **Modal/Form nhiều bước** (nhận máy sửa…): bottom sheet với **bước** (`.stp`) dạng viên thuốc.

### 4.2 Máy tính (≥ 1000px)
- `shell` lưới `268px | 1fr`, khoảng cách 20px. **Sidebar đảo nổi** (kính, bo 32px, `sticky`): logo + tên cửa hàng, nhóm mục có nhãn in hoa nhỏ, mục chọn nền trắng + bóng nhẹ, thẻ người dùng dưới đáy.
- **Thanh trên** dạng viên thuốc kính (`sticky`): tiêu đề + mô tả, ô tìm 300px (có ⌘K nếu dùng palette #046), nút quét QR, chuông, nút hành động chính (gradient).
- Trang Tổng quan: lưới `1fr | 330px` (cột phải là cột tiện ích: Việc cần xử lý, v.v.); thẻ KPI 4 cột; lưới sản phẩm 4 cột; POS `1fr | 400px` với giỏ **dính** bên phải; chi tiết chiếc 2 cột; modal giữa màn hình rộng 520px.
- Điểm chuyển 1000px: dùng breakpoint Tailwind tùy chỉnh `desk: 1000px` (không dùng `lg` mặc định); bố cục nhiều cột trong trang có sidebar dùng `desk:`.

### 4.3 Dock & hành động nhanh theo vai trò
Mục hiển thị theo **quyền** (không theo tên vai trò); bảng là mặc định cho vai trò dựng sẵn.

| Vai trò | 4 mục dock (trái, trái, phải, phải) | Hành động trong "+" |
|---|---|---|
| Chủ cửa hàng | Tổng quan · Đồng hồ · **(+)** · Bán hàng · Menu | Bán hàng · Nhập hàng · Nhận máy sửa · Giữ hàng/đặt cọc · Giao hàng cho CTV |
| Nhân viên bán hàng | Bán hàng · Đồng hồ · **(+)** · Khách · Menu | Bán hàng · Giữ hàng/đặt cọc · Thêm khách · Đơn CTV chờ xác nhận |
| Quản lý kho | Tổng quan · Đồng hồ · **(+)** · Linh kiện · Menu | Nhập hàng · Nhập nhanh một chiếc · Kiểm kê · In tem QR |
| Cộng tác viên | Hàng · Đơn của tôi · **(+ Tạo đơn)** · Thống kê · Tôi | Tạo đơn bán · Quét QR chiếc |

Nhóm trong Menu (chủ): *Vận hành* (Tổng quan, Bán hàng, Đồng hồ, Nhập hàng, Sửa chữa) · *Khách & đối tác* (Khách hàng, Giữ hàng, Bảo hành, Cộng tác viên) · *Kho & hệ thống* (Linh kiện, Kiểm kê, Báo cáo, Quản trị). Đăng ký trong `src/components/layout/nav.ts` (đường dẫn, nhãn, biểu tượng, quyền, nhóm, thứ tự).

## 5. Thành phần Glass dùng chung (`src/components/ui/`)

| Thành phần | Mô tả (lớp trong mẫu) | Ghi chú dựng |
|---|---|---|
| `GlassCard` | Khối kính `.g`: nền `--wf-glass`, viền `--wf-glass-line`, bóng `--wf-glass-shadow`, blur, bo 26 | Nền mờ phải có phương án dự phòng (§7) |
| `StatusChip` | `.wf-chip[data-tone]` — viên thuốc 11px/600 | Nhận `status` + loại → tự ánh xạ nhãn/tone (§3) |
| `HeroCard` | `.wallet` — thẻ gradient lớn: nhãn, số cỡ 34/48px, thanh tiến độ, hàng 3 ô số nhỏ, nút phụ tối | Dùng cho Doanh thu ở Tổng quan; **không** có ngữ nghĩa "ví/quỹ" |
| `KpiTile` | `.g-kpi` / `.kt .g` — nhãn nhỏ + số 800 + chú thích | Lưới 3 cột (mobile) / 4 cột (desktop) |
| `InsetList` + `InsetRow` | `.ig`/`.ir` — danh sách kính liền khối: ô biểu tượng 44px (tone) hoặc ảnh chiếc 48px, tiêu đề, phụ đề, cột phải số/chip, kẻ chia lùi 72px | Dùng cho danh sách chiếc, phiếu, khách; thẻ cho desktop |
| `ProductCard` | `.pc` — ảnh vuông gradient nhạt + chip trạng thái, tên, mã, giá 800, nút tròn "+" | Lưới 2 cột (mobile) / 4 cột (desktop) |
| `SegmentedControl` | `.seg` — nền kính, viên trắng trượt | Chọn kỳ (Hôm nay/7 ngày/Tháng/Quý/Năm), tab (Doanh thu/Lãi gộp/Thực thu) |
| `FilterChips` | `.g-chips` — cuộn ngang, chip chọn nền tím | Lọc trạng thái |
| `Button` | `.btn` (kính), `.pri` (gradient), `.dk` (tối), `.sm`, `.block`; cao 46px | Đủ vùng chạm ≥ 44px |
| `SearchBar` | `.sbar` — viên thuốc kính + nút quét | Ô tìm **một** cho mọi mã |
| `Field` | `.fld` — nhãn nhỏ phía trên, ô bo 20 nền `--wf-glass-field` | `MoneyInput`, `PhoneInput`, `DatePicker`, `Select` bọc quanh |
| `Stepper` | `.stp` — các viên thuốc bước | Nhận máy, form dài |
| `BottomSheet` / `Modal` | `.modal`, `.sheet`, `.cart` — trượt từ đáy (mobile), giữa màn hình (desktop) | Có `gb` (thanh kéo), scrim, khóa cuộn nền |
| `ActionSheet` | `.as` — danh sách hành động + Hủy | Từ nút "+" |
| `Dock`, `Sidebar`, `TopBar` | §4 | Theo `nav.ts` và quyền |
| `CartBar` / `CartPanel` | `.cartbar`, `.cart` | POS |
| `Timeline` | `.tl` — chấm tím + đường nối | Lịch sử trạng thái/giá |
| `KeyValue` | `.kv` — hàng nhãn xám / giá trị đậm | Thông tin chiếc, phiếu |
| `ProgressRing` | `chart.ring` — vòng % + số giữa | Tiến độ sửa chữa |
| `LockNote` | `.lock` — dải vàng nhạt "Chỉ người có quyền xem giá vốn mới thấy mục này" | Gắn cạnh mọi khối giá vốn/lãi |
| `Toast`, `EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton` | Không có trong mẫu — dựng theo Glass hoặc phần tử Lucian (§8) | Văn bản tiếng Việt, hành động tiếp theo rõ ràng |
| `Chart` (area/bars/donut/ring) | Mẫu dùng SVG tự vẽ (`WF.chart.*`) | Tooltip kéo (scrub), nhãn trục nhỏ; màu: tím `--wf-accent` (doanh thu), xanh lá `--wf-ok` (lãi gộp) |

Quy tắc dùng chung: mọi khối giá vốn/lãi/giá thu bọc `CanSee permission="cost.view"` và kèm `LockNote`; người không có quyền **không render và không gọi API** (FR-DASH-11).

## 6. Màn hình: mẫu v6-glass → ứng dụng

| Màn trong mẫu | Quyết định | Ghi chú |
|---|---|---|
| `home` Tổng quan | **Giữ, sửa** | Bỏ "Thực chi", "Quỹ tiền", "Khách nợ/NCC"; thẻ gồm Doanh thu, Lãi gộp, Thực thu, Tồn kho (kèm "ở CTV"), Giá trị tồn, Đã bán; thêm việc cần xử lý: đơn nháp CTV, chiếc ở CTV quá hạn |
| `stock` Đồng hồ + chip trạng thái | **Giữ, sửa** | Thêm chip "Đang ở CTV"; thêm bộ lọc theo vị trí/tình trạng (drawer #305) |
| `unit` Chi tiết chiếc (Bán/Giữ/In tem/Vị trí; tab Thông tin/Giá vốn/Lịch sử) | **Giữ, sửa** | Tab "Giá vốn" đổi nhãn **"Giá thu"** cho người có `cost.view`; thêm nút "Giao CTV" (chủ); hiển thị bảo hành |
| `pos` Bán hàng + giỏ | **Giữ, gọn** | Phiếu tập trung: thông tin chiếc, khách, **giá thu & giá bán** (người có quyền), thanh toán tiền mặt/chuyển khoản/kết hợp, tiền thừa, nợ + hẹn trả; "Thêm máy cũ" (thu cũ đổi mới) |
| `sales` Phiếu bán | **Giữ, sửa** | Bộ lọc "Còn nợ"; nút "Thu thêm"; "Hủy trong 24 giờ" (chủ) |
| `repair` Sửa chữa (thẻ có vòng %, nhận máy 4 bước) | **Giữ, gọn** | Bỏ cột/nhãn thợ, "chưa gán thợ", doanh thu "công + linh kiện" → "doanh thu sửa"; bước "Máy" **ảnh tùy chọn**; mở rộng nhận máy bảo hành |
| `cash` Thu chi & công nợ | **BỎ** (CF-06/07) | Không dựng; "Thu thêm" nằm trên phiếu; báo cáo "Tiền thu" thay thế |
| `buy` Nhập hàng | **Giữ, sửa** | Bỏ NCC, công nợ; nguồn hàng nhập chữ |
| `cust` Khách hàng | **Giữ, sửa** | Bỏ "công nợ" như tab riêng; hiển thị phiếu còn nợ + cọc đang giữ |
| `reserve` Giữ hàng | **Giữ** | |
| `returns` Đổi trả | **BỎ** (CF-02) | Thay bằng màn **Bảo hành** (mới) |
| `parts` Linh kiện | **Giữ** | |
| `stocktake` Kiểm kê | **Giữ** | |
| `report` Báo cáo (R1–R8 trong mẫu) | **Giữ, sửa** | Danh sách báo cáo theo `reports-and-dashboard` §3 (bỏ công nợ KH&NCC, thu chi & số dư, tiền công thợ; thêm Phiếu còn nợ, Tiền thu, Thống kê CTV) |
| `collab` Cộng tác viên (hoa hồng) | **THIẾT KẾ LẠI** | Mô hình giao hàng + giá thu: danh sách CTV, chi tiết CTV (hàng đang giữ, đơn, quyết toán), phiếu giao, quyết toán, thống kê tháng/quý/năm |
| `admin` Quản trị | **Giữ, sửa** | Người dùng, vai trò & quyền, cài đặt, nhật ký, hệ thống & sao lưu, phiên bản; bỏ thợ |

**Màn mới cần thiết kế bổ sung theo Glass** (chưa có trong mẫu; làm bản tĩnh trong `design/ui-preview/` để khách xem trước khi code — xem §10): Đăng nhập · Đổi mật khẩu · Xác thực 2 bước · Bảo hành (tra cứu + nhận máy bảo hành) · Màn hình của **CTV** (Hàng đang giữ, Tạo đơn, Đơn của tôi, Thống kê, Tôi) · Cộng tác viên (chủ): Giao hàng, Quyết toán, Thống kê · Thông báo · Hướng dẫn sử dụng · Trạng thái rỗng/lỗi/mất mạng · Cài đặt cá nhân.

## 7. Quy tắc triển khai kỹ thuật

1. **Tailwind + biến CSS.** Cấu hình Tailwind đọc token (`theme.extend.colors = { ink:'var(--wf-ink)', … }`, `borderRadius`, `boxShadow`, `screens.desk=1000px`). Không hex trong component. Lớp tiện ích kính (`.g`) viết trong `glass.css`.
2. **Hiệu năng `backdrop-filter`.** Chỉ dùng cho khối nổi (dock, thẻ chính, sheet); danh sách dài dùng nền kính **không blur** (`rgba(255,255,255,.7)`). Có `@supports not (backdrop-filter: blur(1px)) { .g { background: var(--wf-glass-strong) } }` và tôn trọng `prefers-reduced-transparency`.
3. **Tương phản.** Chữ phụ `--wf-mute` (#6E7194) trên kính phải đạt WCAG AA (≥ 4.5:1) ở cỡ chữ đang dùng — **kiểm bằng axe/Lighthouse khi dựng**; nếu không đạt, tối hơn một nấc, **không** giảm cỡ chữ. Tone chỉ là phụ, luôn kèm chữ.
4. **Vùng chạm ≥ 44px**, vùng an toàn `viewport-fit=cover` + `--safe-*`; chữ nhập ≥ 16px (chống iOS tự phóng).
5. **Ảnh chiếc** nền gradient nhạt, bo 15–18px; ảnh lấy từ Storage (thumb WebP); có `loading="lazy"`, tỷ lệ cố định (không nhảy bố cục).
6. **Số liệu từ máy chủ.** Component hiển thị, không tính tiền/lãi (`conventions` §2); xem trước ở client chỉ để gợi ý.
7. **Mất mạng/nháp:** `OfflineBanner`, nút xác nhận khóa khi offline (`ux-and-navigation` §6).
8. **Không dựng màn đã bị loại** dù mẫu có.

## 8. Lucian UX/UI — dùng thế nào (skill `lucian-uxui`)

**Là gì:** thư viện phần tử UI tương tác tự chứa (400 phần tử/27 nhóm, kiểm tra 2026-10-16, catalog `34c4b3e61d`), giấy phép MIT. Mỗi phần tử: `<style>` scoped `.uNNN` + `<div class="ux uNNN">` + `<script>`; đọc màu qua token `--ux-*`. Skill `/lucian-uxui:lucian-uxui` (CLI `search` → `get` → port) dùng để **tìm và lấy đúng phần tử cần**.

**Vai trò trong dự án — quy tắc phân vai (ADR-027):**
- **Glass là nguồn sự thật về diện mạo & bố cục.** Dock, sidebar, thanh trên, thẻ, danh sách, hero, bố cục trang: **tự dựng** theo §4–§5.
- **Lucian cho hành vi/tương tác của phần tử riêng lẻ** khi có phần tử khớp: tab phân đoạn, công tắc, nhập số tiền, ô mã 6 số, toast, chuông thông báo, trạng thái rỗng/lỗi, skeleton, wizard, bottom sheet nhiều độ cao, biểu đồ có tương tác, hộp xác nhận nguy hiểm, bộ chọn ngày… (bảng §8.2).
- **Ánh xạ token trước khi dùng** (§8.1): phần tử Lucian hiển thị bằng màu/kính của Glass, không bằng màu gốc.
- Nếu một phần tử Lucian **mâu thuẫn quá lớn** với Glass (hình khối khác hẳn) ⇒ chỉ lấy ý tưởng chuyển động, tự dựng bằng token Glass.

### 8.1 Ánh xạ token `--ux-*` → Glass (đặt trong `src/styles/tokens.css`, dưới `:root`)

```css
:root{
  --ux-page:var(--wf-page);            --ux-surface:#FFFFFF;
  --ux-surface-2:#F4F6FF;               --ux-surface-3:#E7EBFB;
  --ux-ink:var(--wf-ink);               --ux-ink-2:var(--wf-nav);            --ux-ink-3:var(--wf-mute);
  --ux-line:var(--wf-line);             --ux-line-2:rgba(27,27,58,.15);
  --ux-accent:var(--wf-accent);         --ux-accent-2:var(--wf-accent-2);
  --ux-accent-soft:rgba(91,91,240,.12); --ux-accent-ink:#FFFFFF;
  --ux-mint:var(--wf-ok);               --ux-warn:var(--wf-hold);            --ux-danger:var(--wf-bad);
  --ux-glass:var(--wf-glass);           --ux-glass-line:var(--wf-glass-line);
  --ux-shadow:rgba(91,91,240,.14);      --ux-shadow-strong:rgba(91,91,240,.35);
  --ux-grad:var(--wf-grad);             --ux-ease:var(--wf-ease);
  --ux-spring:cubic-bezier(.34,1.45,.64,1);
}
.ux{ font-family:inherit }                /* dùng Be Vietnam Pro thay Pretendard */
```
Giữ nguyên khối quy tắc nền `.ux` (box-sizing, focus ring `outline:2px solid var(--ux-accent)`, ép giảm chuyển động) lấy từ `node <skill-dir>/scripts/lucian-uxui.mjs tokens` — **một lần cho cả dự án**. Chỉ định nghĩa nhánh sáng; khi thêm bản tối, thêm khối `[data-theme="dark"]` với cùng tên token.

### 8.2 Bản đồ phần tử cần → từ khóa tìm → ứng viên đã thấy (2026-10-16)

> **ID chỉ là gợi ý đã kiểm tra tại thời điểm viết; thư viện còn lớn dần — luôn chạy lại `search` trước khi chọn** (quy tắc của skill). Chỉ dùng mã do `get` trả về, không tự dựng lại từ trí nhớ.

| Thành phần WatchFlow | Màn hình | `search` | Ứng viên |
|---|---|---|---|
| Chọn kỳ / tab chỉ số (Hôm nay…Năm; Doanh thu/Lãi gộp/Thực thu) | Tổng quan, Báo cáo, Thống kê CTV | `period segmented control`, `sliding pill tabs` | #047, #039 |
| Công tắc cài đặt | Quản trị → Cài đặt | `toggle switch` | #013, #023 |
| Nhập số tiền (+ chip số tiền nhanh, dấu phân cách) | POS "Khách đưa", thanh toán, cọc, giá thu giao CTV | `money amount input` | #035 |
| Ô mã 6 số (TOTP) | Xác thực 2 bước | `6 digit code input` | #026 |
| Thẻ đăng nhập (rung khi sai, số lần còn lại) | Đăng nhập | `login form`, `sign-in card feedback` | #062, #025 |
| Select/Combobox | Form chung | `custom select listbox` | #031 |
| Chọn khoảng ngày | Báo cáo, Thống kê CTV | `date range calendar` | #030 |
| Ô tìm kiếm / palette lệnh (⌘K) | Thanh trên (desktop) | `command palette` | #046 |
| Toast xếp chồng | Toàn app | `toast notification` | #070 |
| Chuông thông báo (danh sách đẩy hàng mới) | Thanh tiêu đề | `notification bell` | #074 |
| Trạng thái rỗng / không có kết quả | Danh sách, tìm kiếm | `empty state` | #092, #088 |
| Lỗi tải widget / 404 | Widget, trang không tồn tại | `error state` | #090, #089 |
| Skeleton tải | Danh sách, Tổng quan | `skeleton loading` | #079 |
| Wizard nhận máy / form nhiều bước | Nhận máy sửa, giao hàng CTV | `stepper wizard` | #042 |
| Bottom sheet nhiều độ cao (giỏ POS) | POS | `bottom sheet` | #336 |
| Drawer bộ lọc có đếm kết quả | Đồng hồ, Phiếu | `filter drawer` | #305 |
| Tải ảnh (kéo thả, tiến trình) | Ảnh chiếc, ảnh nhận máy, giấy tờ | `image upload` | #032, #075 |
| Bộ chỉnh số lượng | Linh kiện, giỏ POS | `quantity stepper` | #018 |
| Biểu đồ đổi hình theo kỳ (ngày/tháng/năm) | Thống kê CTV, Báo cáo | `bar chart` | #095 |
| Biểu đồ vùng có tooltip kéo | Tổng quan (doanh thu/lãi) | `area chart` | #096 |
| Donut tỷ trọng (thương hiệu) | Báo cáo | `donut chart` | #097 |
| Số đổi theo từng chữ số | Thẻ KPI | `live metric rolling digits` | #098 |
| Dòng thời gian trạng thái | Phiếu sửa, lịch sử chiếc | `timeline`, `delivery steps` | #087 |
| Xác nhận thao tác nguy hiểm | Tịch thu cọc, hủy phiếu, ghi mất | `confirm dialog`, `hold to delete` | #269, #003 |
| Nút sao chép mã | Mã chiếc/phiếu | `copy button` | #008 |
| Tab dưới có nút nổi (tham khảo chuyển động) | Dock | `bottom navigation tab bar` | #041 (chỉ tham khảo) |
| Nút "+" mở hành động (tham khảo) | Dock | `floating action button` | #011, #010 (chỉ tham khảo; Glass dùng action sheet) |
| Bảng dữ liệu sống, kanban (tùy chọn desktop) | Danh sách phiếu, Sửa chữa | `data table`, `kanban board` | #227, #255 (COULD) |

### 8.3 Quy trình port một phần tử (rút gọn từ `references/porting.md`)
1. `search` đúng một thành phần → đọc tóm tắt → chọn phần tử có hành vi khớp; `get <id>` (tối đa vài cái một lần).
2. **Giữ nguyên CSS dạng CSS thuần** trong `src/components/lucian/lucian-NNN.css` (không viết lại thành Tailwind — mất giá trị chuyển động); mọi selector giữ tiền tố `.uNNN` (đổi tiền tố nhất quán nếu trùng).
3. Chuyển mã sang React client component (`'use client'`, `useRef` + `useEffect`, **dọn dẹp** listener/timer/rAF/observer khi unmount; React StrictMode không được nhân đôi hành vi). Markup → JSX; truyền dữ liệu thật qua props; gắn sự kiện thật (submit, chọn…), **bỏ chữ mẫu** thay bằng tiếng Việt thật.
4. Dòng đầu tệp giữ nguyên chú thích `<!-- Lucian UX/UI Prompt #ID · MIT License … -->` (dạng `//` hoặc `/* */` trong TS/CSS).
5. Ánh xạ token (§8.1); kiểm: 375px, bàn phím, `prefers-reduced-motion`, không lỗi console; **ghi vào sổ §9**.
6. Rà bảo mật: không `innerHTML` dữ liệu người dùng, không tải script/phông ngoài, không nới CSP.

### 8.4 Mẫu giao việc UI cho AI (copy & điền)

```
Việc UI: <màn/thành phần>. Mốc: M<n>.
Đọc trước: docs/03-architecture/ui-design-system.md (§3 token, §4 bố cục, §5 thành phần, §6 màn hình, §8 Lucian),
           docs/01-product/ux-and-navigation.md (màn hình tương ứng), design/ui-preview/v6-glass.html (xem mẫu).
Cách làm: (1) dùng skill /lucian-uxui:lucian-uxui để search/get phần tử tương tác cần (xem bảng §8.2); phần bố cục dựng theo Glass;
          (2) ánh xạ token --ux-* theo §8.1; (3) giữ dòng MIT; (4) ghi sổ phần tử đã dùng ở ui-design-system §9;
          (5) chụp 390px + 1366px, chạy axe; (6) không dựng màn đã bị loại (§6); (7) mọi số tiền lấy từ máy chủ.
Kết quả báo: danh sách phần tử Lucian đã dùng (#ID: dùng ở đâu, chỉnh gì), file đã đổi, ảnh chụp, điều chưa kiểm được.
```

## 9. Sổ phần tử Lucian đã dùng (điền khi dựng)

Mỗi lần port một phần tử, thêm một dòng (cũng là danh sách ghi công giấy phép MIT).

| # | Tên | Tệp trong dự án | Dùng ở | Chỉnh sửa so với bản gốc | Ngày | Người |
|---|---|---|---|---|---|---|
| — | (chưa có) | | | | | |

## 10. Quy trình thiết kế màn chưa có trong mẫu

1. Đọc `ux-and-navigation` (mục đích, nội dung, hành động của màn) và §3–§5 ở đây.
2. Dựng bản **tĩnh** trong `design/ui-preview/` theo cùng khung của `v6-glass.html` (đặt tên `v6-glass-<màn>.html` hoặc thêm vào bản mới), dùng dữ liệu giả; có điện thoại + máy tính.
3. Cho khách xem và chốt; ghi quyết định vào `customer-feedback-*.md` và cập nhật §6.
4. Mới dựng thật (M-tương ứng). Màn quan trọng cần khách duyệt trước: **CTV**, **Giao hàng/Quyết toán**, **Bảo hành**, **Phiếu bán gọn** (xem `build-plan` §Cổng thiết kế).

## 11. Kiểm thử giao diện (Định nghĩa hoàn thành cho UI)

- Playwright: ảnh chụp **390×844** và **1366×768** cho mọi màn mới, so với mẫu bằng mắt (không so điểm ảnh); không tràn ngang; dock không che nội dung (chừa 124px).
- `axe` không lỗi mức nghiêm trọng; Lighthouse Accessibility ≥ 95 trên các màn chính; tương phản chữ phụ đạt AA.
- Bàn phím: Tab/Enter/Space/Esc, vòng focus nhìn thấy; sheet/modal bẫy focus, đóng bằng Esc.
- `prefers-reduced-motion` và `prefers-reduced-transparency` hoạt động; không hiệu ứng nặng làm giật trên máy yếu (kiểm bằng CPU throttle 4×).
- Mọi phần tử Lucian đã ghi ở §9, có dòng giấy phép.
