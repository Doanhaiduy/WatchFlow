# Hệ thống giao diện — phong cách Glass

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (khách chốt mẫu **v6-glass**, CF-09; §4.3 và §6 đã cập nhật theo `customer-feedback-02` — bản đồ màn hình hiện hành) · ADR-026, ADR-027
> Tài liệu này là **đặc tả để AI/dev dựng giao diện**. Nguồn hình ảnh tham chiếu: `design/ui-preview/v6-glass.html` (+ `assets/shared.js`: dữ liệu minh họa, biểu tượng, hàm vẽ biểu đồ). Mâu thuẫn giữa đặc tả này và mẫu ⇒ **đặc tả này thắng** (mẫu còn các màn đã bị loại và dữ liệu minh họa). Cách đọc nhanh: mở `design/ui-preview/v6-glass.html` trong trình duyệt (điện thoại 390px và máy tính ≥ 1000px).

## 1. Nguyên tắc

1. **Kính mờ trên nền gradient sáng.** Bề mặt là lớp kính (`rgba(255,255,255,.58)` + blur) nổi trên nền pastel; chỗ nhấn là một gradient tím–xanh dương.
2. **Mobile-first, một tay.** Thao tác chính nằm trong tầm ngón cái: dock nổi ở đáy, nút "+" lớn ở giữa, sheet trượt từ dưới lên.
3. **Số là nhân vật chính.** Số tiền/số lượng cỡ lớn, đậm (800), chữ phụ nhỏ xám; màu chỉ để phân loại trạng thái, **luôn kèm chữ** (không chỉ màu).
4. **Ít chữ, ít chạm.** Mỗi màn một mục đích; hành động hay dùng ≤ 3 chạm; nháp tự lưu.
5. **Nhẹ.** Không thư viện UI nặng; CSS thuần + Tailwind; `backdrop-filter` có phương án dự phòng.
6. **Nhất quán qua token.** Không gõ cứng màu/bo góc/đổ bóng trong component — dùng biến CSS ở §3.
7. **Hai chế độ: Sáng (mặc định, mẫu khách chốt) và Tối** (thêm 2026-10-17 theo yêu cầu người dùng, ADR-026 cập nhật). Người dùng chọn Sáng / Tối / Theo hệ thống (`ThemeSwitch`, lưu `localStorage` khoá `wf-theme`); tất cả màu đi qua token nên hai chế độ chỉ khác giá trị token (`tokens.css`, khối `:root[data-theme="dark"]` trong `@media screen` — **in luôn dùng bản sáng**). Quy ước token: `--wf-on-accent` (chữ trên nền nhấn/gradient, luôn trắng), `--wf-surface` (mặt nổi: núm tab, mục sidebar đang chọn…), `--wf-paper`/`--wf-paper-ink` (tem, biên lai, mã QR — luôn trắng/đen), `--wf-accent` là màu TÔ còn `--wf-accent-text` là màu CHỮ/biểu tượng nhấn (đạt AA ở cả hai chế độ), `--wf-bad-solid` (nền nút nguy hiểm), `--wf-field-line` (viền ô nhập), `--wf-bg-a…d` (nền gradient). Chống nháy: `src/app/layout.tsx` chèn script nhỏ có CSP nonce đặt `data-theme` trước khi vẽ (`src/lib/theme-script.ts`).

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
| Chủ cửa hàng | Tổng quan · Đồng hồ · **(+)** · Bán hàng · Menu | Ghi đơn bán · Nhận máy sửa · Giao đồng hồ cho CTV · CTV báo bán chờ xác nhận · Thêm đồng hồ |
| Nhân viên bán hàng | Bán hàng · Đồng hồ · **(+)** · Khách · Menu | Ghi đơn bán · CTV báo bán chờ xác nhận · Thêm khách |
| Quản lý kho | Tổng quan · Đồng hồ · **(+)** · Vị trí kho · Menu | Thêm đồng hồ · In tem QR |
| Cộng tác viên | Hàng · Báo bán · **(+)** · Thống kê · Tôi | Tìm chiếc được giao |

Nhóm trong Menu (chủ): *Vận hành* (Tổng quan, Bán hàng, Đồng hồ, Cộng tác viên, Sửa chữa) · *Khách & báo cáo* (Khách hàng, Báo cáo) · *Kho & hệ thống* (Vị trí kho, Nhập từ Excel, Quản trị) · *Tài khoản* (Hướng dẫn, Tài khoản). Đăng ký trong `src/components/layout/nav.ts` (đường dẫn, nhãn, biểu tượng, quyền, nhóm, thứ tự); dock/"+" suy từ **quyền** (`detectProfile`), không theo tên vai trò.

## 5. Thành phần Glass dùng chung (`src/components/ui/`)

| Thành phần | Mô tả (lớp trong mẫu) | Ghi chú dựng |
|---|---|---|
| `GlassCard` | Khối kính `.g`: nền `--wf-glass`, viền `--wf-glass-line`, bóng `--wf-glass-shadow`, blur, bo 26 | Nền mờ phải có phương án dự phòng (§7) |
| `StatusChip` | `.wf-chip[data-tone]` — viên thuốc 11px/600 | Nhận `status` + loại → tự ánh xạ nhãn/tone (§3) |
| `HeroCard` | `.wallet` — thẻ gradient lớn: nhãn, số cỡ 34/48px, thanh tiến độ, hàng 3 ô số nhỏ, nút phụ tối | Dùng cho Doanh thu ở Tổng quan; **không** có ngữ nghĩa "ví/quỹ" |
| `KpiTile` | `.wf-kpi` — ô biểu tượng màu (`tone`) + nhãn nhỏ + số 800 + (▲▼ % so kỳ trước: `delta`, `deltaInverse` khi giảm là tốt) + chú thích + đường xu hướng `spark`; có `href` ⇒ cả thẻ là liên kết, có `onClick` ⇒ nút lọc (`active` = đang chọn) | Lưới 2 cột (mobile) / 4 cột (desktop) trong `KpiGrid`. Số do máy chủ trả, KHÔNG tính tiền ở UI |
| `StatStrip` | Dải 2–4 `KpiTile` ở đầu trang danh sách (Đồng hồ, Sửa chữa, Bán hàng, Khách hàng, Giữ hàng, Linh kiện) | Mobile: một hàng cuộn ngang (không chiếm chỗ danh sách); desktop: lưới. Số lấy từ `counts` của danh sách hoặc `useDashKpis()` (cùng khóa SWR với Tổng quan); thiếu khóa/quyền ⇒ không vẽ thẻ |
| `WatchArt` / `UnitArt` / `UnitThumb` | Ảnh đồng hồ **vẽ SVG** khi chiếc chưa có ảnh thật (port từ `WF.watch` của mẫu đã duyệt, viết lại bằng JSX): vỏ thép/vàng/hồng/đen, mặt (roman/vạch/chấm/số), dây da/cao su/kim loại/NATO, G-Shock điện tử; `crop="head"` cho ảnh nhỏ | Kiểu dáng suy ra từ chữ mô tả (màu mặt, chất liệu vỏ, loại dây) nếu có, còn lại băm theo `artSeed(hãng, loại)` ⇒ **mọi nơi** vẽ cùng một kiểu cho cùng một loại. Có ảnh thật thì dùng ảnh thật |
| `Avatar` | Hình tròn chữ cái đầu, gradient theo màu ổn định của tên (`neutral` cho tài khoản ngưng) | Khách hàng, CTV, người dùng, đầu hồ sơ (`InsetRow lead=`) |
| `ShortcutGrid` | Lưới ô biểu tượng màu + nhãn (+ mô tả, + số việc) | Tổng quan "Làm nhanh", trang Quản trị |
| `Sparkline`, `HBarList` | Đường xu hướng nhỏ; thanh ngang xếp hạng | Thẻ KPI; tồn theo hãng, thực thu theo hình thức |
| `InsetList` + `InsetRow` | `.ig`/`.ir` — danh sách kính liền khối: ô biểu tượng 44px (tone) hoặc ảnh chiếc 48px, tiêu đề, phụ đề, cột phải số/chip, kẻ chia lùi 72px | Dùng cho danh sách chiếc, phiếu, khách; thẻ cho desktop |
| `ProductCard` | `.pc` — ảnh vuông gradient nhạt + chip trạng thái, tên, mã, giá 800, nút tròn "+" | Lưới 2 cột (mobile) / 4 cột (desktop) |
| `SegmentedControl` | `.seg` — nền kính, viên trắng trượt | Chọn kỳ (Hôm nay/7 ngày/Tháng/Quý/Năm), tab (Doanh thu/Lãi gộp/Thực thu) |
| `FilterChips` | `.g-chips` — cuộn ngang, chip chọn nền tím | Lọc trạng thái |
| `Button` | `.btn` (kính), `.pri` (gradient), `.dk` (tối), `.sm`, `.block`; cao 46px | Đủ vùng chạm ≥ 44px |
| `SearchBar` | `.sbar` — viên thuốc kính + nút quét | Ô tìm **một** cho mọi mã |
| `Field` | `.fld` — nhãn nhỏ phía trên, ô bo 20 nền `--wf-glass-field` | `MoneyInput`, `PhoneInput`, `DateInput`, `Select` bọc quanh |
| `Select` | Listbox TỰ DỰNG (không còn `<select>` gốc). Desktop: `Popover` (portal, tự lật lên khi sát đáy, rộng ≥ nút); điện thoại < 1000px: bottom sheet (`Modal`) tiêu đề = nhãn; ô tìm không dấu khi > 8 lựa chọn; ✓ mục đang chọn; mục `disabled`; `placeholder` là dòng đầu giá trị `""`; `invalid` → `aria-invalid` | API giữ như cũ (`value`, `onChange(e)` với `e.target.value`, `options`, `placeholder`); thêm `onValueChange`, `label`, `searchable`, `name`. A11y: `role=combobox/listbox/option`, `aria-activedescendant`, ↑↓ Home End Enter Esc Tab, gõ chữ nhảy mục |
| `DateInput` / `DateRange` | Chọn ngày tự dựng: giá trị `"YYYY-MM-DD"` (hoặc `""`), hiển thị dd/mm/yyyy, gõ tay được (tự chèn `/`), lịch tháng tiếng Việt (T2…CN, tuần bắt đầu thứ Hai), `min`/`max`, nút Hôm nay / Xóa, lưới chọn tháng/năm. Desktop popover, điện thoại bottom sheet. `DateRange`: một nút "dd/mm/yyyy – dd/mm/yyyy", chọn đầu–cuối rồi "Áp dụng" | `onChange(value)` nhận **chuỗi** (không phải sự kiện). Phép tính ngày qua `src/lib/dates.ts` |
| `Popover` | Bảng nổi gắn nút neo (portal, `--wf-z-popover`, tự lật, bám nút khi cuộn, đóng khi bấm ngoài/Esc chỉ lớp trên cùng) | Dùng bởi `Select`, `DateInput` |
| `Checkbox` / `Switch` / `RadioGroup` | Ô chọn, công tắc, nhóm chọn một — tự dựng Glass (input gốc ẩn để có phím/Tab chuẩn; vùng chạm 44px) | Không dùng `<input type="checkbox|radio">` trần ở màn nghiệp vụ |
| `ThemeSwitch` | `SegmentedControl` 3 lựa chọn Sáng / Tối / Theo hệ thống (`compact` = "Hệ thống") | Đặt ở menu tài khoản (mobile), sidebar (desktop), trang Tài khoản |
| `Stepper` | `.stp` — các viên thuốc bước | Nhận máy, form dài |
| `BottomSheet` / `Modal` | `.modal`, `.sheet`, `.cart` — trượt từ đáy (mobile), giữa màn hình (desktop) | Có `gb` (thanh kéo), scrim, khóa cuộn nền; `dirty`/`busy` (§5.2) |
| `ActionSheet` | `.as` — danh sách hành động + Hủy | Từ nút "+"; có `dirty`/`busy` (§5.2) |
| `Combobox` | Ô nhập CÓ GỢI Ý (gõ tự do + chọn gợi ý, không dấu, chữ mờ Tab nhận) — §5.3 | Nguồn hàng ở phiếu nhập/Thêm đồng hồ; khác `Select` ở chỗ không bắt buộc chọn trong danh sách |
| `DiscardConfirm`, `useDirtyGuard`, `ModalClose` | Hộp "Bỏ thay đổi chưa lưu?" + hook bảo vệ trang + nút Hủy qua cổng đóng — §5.2 | Mọi form dài / hộp thoại có form |
| `Dock`, `Sidebar`, `TopBar` | §4 | Theo `nav.ts` và quyền |
| `CartBar` / `CartPanel` | `.cartbar`, `.cart` | POS |
| `Timeline` | `.tl` — chấm tím + đường nối | Lịch sử trạng thái/giá |
| `KeyValue` | `.kv` — hàng nhãn xám / giá trị đậm | Thông tin chiếc, phiếu |
| `ProgressRing` | `chart.ring` — vòng % + số giữa | Tiến độ sửa chữa |
| `LockNote` | `.lock` — dải vàng nhạt "Chỉ người có quyền xem giá vốn mới thấy mục này" | Gắn cạnh mọi khối giá vốn/lãi |
| `Toast`, `EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton` | Không có trong mẫu — dựng theo Glass hoặc phần tử Lucian (§8) | Văn bản tiếng Việt, hành động tiếp theo rõ ràng |
| `Chart` (area/bars/donut/ring) | Mẫu dùng SVG tự vẽ (`WF.chart.*`) | Tooltip kéo (scrub), nhãn trục nhỏ trải đều; màu: tím `--wf-accent` (doanh thu), xanh lá `--wf-ok` (lãi gộp). `AreaChart` hỗ trợ **2 đường** (`data2`, `legend`), `BarChart` hỗ trợ **cột đôi** (`value2`) |

Quy tắc dùng chung: khối dữ liệu theo quyền (vd. doanh thu, báo bán chờ xác nhận) bọc `CanSee permission="…"`; người không có quyền **không render và không gọi API** (FR-DASH-11). Giá vốn/lãi/giá thu không còn trong giao diện (CF-14).

### 5.2 Bảo vệ form: `dirty` / `busy` / `useDirtyGuard` (cập nhật 2026-10-17)

Ứng dụng **khai báo** trạng thái bằng prop rõ ràng — **không** dò DOM theo chữ nút (khác `ModalGuard` của ref Lưu Xá). Mã: `ui/CloseGuard.tsx`, `ui/useDirtyGuard.tsx`, `ui/Modal.tsx`, `ui/ActionSheet.tsx`, `lucian/DetentSheet.tsx`; trình diễn ở `/dev/design` (mục "Bảo vệ form").

| Prop / hook | Ở đâu | Hành vi |
|---|---|---|
| `dirty` | `Modal`, `ActionSheet`, `DetentSheet` | Có thay đổi chưa lưu ⇒ mọi đường đóng (bấm nền, Esc, nút X, vuốt xuống tờ 3 nấc, nút Hủy dùng `<ModalClose>`) hỏi **"Bỏ thay đổi chưa lưu?"** — "Ở lại" là nút mặc định (focus + Esc = ở lại), "Bỏ thay đổi" đỏ. Tờ 3 nấc vuốt xuống mà hỏi thì tự bật về mức cũ. Chọn một hành động của `ActionSheet` không hỏi (là chủ ý). Kèm `beforeunload` (đóng tab/tải lại). |
| `busy` | cùng ba thành phần | Đang gửi dữ liệu ⇒ chặn đóng, nội dung `inert` (không bấm/Tab được), phủ lớp **"Đang xử lý…"** (hiện sau 0,2 giây để lần xử lý nhanh không nháy), trả focus sau khi xong. `locked` cũ vẫn dùng được (chỉ chặn đóng, không có lớp phủ). Mọi `locked={busy}` hiện có đã đổi thành `busy={busy}`. |
| `<ModalClose>Hủy</ModalClose>` / `useModalClose()` | trong `Modal` | Nút Hủy/Đóng của chân hộp thoại phải đi qua cổng này (không phải `onClick={onClose}` trần) để `dirty` có tác dụng. |
| `useDirtyGuard(dirty)` → `{ dialog, release }` | trang/biểu mẫu dài (ghi đơn bán, nhận máy sửa, thêm đồng hồ, giao CTV) | `beforeunload` + chặn bấm liên kết nội bộ (menu, dock, `<Link>`) bằng hộp trên; nút "Quay lại" của app đi qua `guardedNavigate`. Phải render `{dialog}` trong trang. Liên kết có `data-allow-leave` không bị chặn. **Giới hạn đã biết:** App Router không có `router.events` — `router.push()` trong mã và nút Back/vuốt Back của trình duyệt **không chặn được** (chỉ `beforeunload` còn tác dụng khi tải lại), nên biểu mẫu quan trọng vẫn nên tự lưu nháp (POS, phiếu nhập đã làm). |
| `Button guard` | mọi nút | Bỏ lần bấm thứ hai trong 600ms (hoặc số ms nêu). **Mặc định bật cho `type="submit"`**; nút xác nhận/gửi khác (Xác nhận thu, Giữ hàng, Nhận máy…) bật tay bằng `guard`. Không bật mặc định cho nút primary thường vì nút "Tiếp" của wizard có thể bấm liên tiếp hợp lệ. Logic thuần: `src/lib/submit-guard.ts` (có test). |

Cách tính `dirty`: **khác giá trị lúc mở** (hộp sửa) hoặc **đã nhập/chọn gì** (hộp thêm mới); xong lưu (`onDone`) đóng bằng `open=false` thì không hỏi. Biểu mẫu tự lưu nháp chỉ tính dirty khi chưa kịp lưu / lưu lỗi (POS: `!saleId || saving || error || body ≠ bản đã gửi`).

### 5.3 `Combobox` — ô nhập có gợi ý (Lucian #034)

- Giá trị luôn là **chữ trong ô** (gõ tự do được); chọn gợi ý chỉ điền nhãn (`onPick` nếu cần thêm). Gợi ý `string | { value, label, sublabel?, keywords? }`, lọc **không dấu** bằng `foldVi` (logic thuần `src/lib/suggest.ts`: xếp hạng đầu chuỗi → đầu từ → chứa → chữ phụ; tô đậm phần khớp).
- Desktop: `Popover` (lật lên/xuống) + chữ mờ hoàn thành, **Tab** nhận. Điện thoại: danh sách nối liền dưới ô (không chiếm cả màn hình, không che bàn phím).
- Phím: ↑↓ chọn · **Enter chỉ nhận khi đang trỏ một gợi ý** (còn lại Enter vẫn gửi biểu mẫu) · **Esc chỉ đóng danh sách** (hộp thoại chứa nó vẫn mở) · danh sách chỉ mở khi gõ / bấm vào ô / ↓ (không tự bật khi vừa focus).
- A11y: `role="combobox"` + `aria-expanded/controls/activedescendant/autocomplete`, `role="listbox"`/`option`.
- Đang dùng: ô **Khách** trên Ghi đơn bán / Nhận máy sửa (gợi ý khách đã có theo tên/SĐT). (Gợi ý "Nguồn hàng" từ `/purchases/sources` đã gỡ cùng màn Nhập hàng — CF-14.)

## 6. Màn hình: mẫu v6-glass → ứng dụng (hiện hành — customer-feedback-02)

| Màn trong mẫu | Quyết định | Ghi chú |
|---|---|---|
| `home` Tổng quan | **Giữ, gọn** | Thẻ theo quyền: Doanh thu (▲▼ kỳ trước), Số chiếc bán, Đồng hồ trong kho (kèm "đang giao CTV"), Báo bán CTV chờ xác nhận, Máy đang sửa; biểu đồ doanh thu; việc cần xử lý. Bỏ Lãi gộp, Thực thu, Giá trị tồn, Nợ |
| `stock` Đồng hồ + chip trạng thái | **Giữ, sửa** | Chip "Đang giao CTV" khi có chào hàng; bộ lọc vị trí/tình trạng; bỏ giá vốn/giá thu |
| `unit` Chi tiết chiếc | **Giữ, gọn** | Ghi đơn bán · In tem · Đổi vị trí · Giao CTV (chủ); tab Thông tin · Ảnh · Giá & lịch sử giá · Lịch sử trạng thái; **bỏ tab giá vốn/giá thu** |
| `pos` Bán hàng + giỏ | **Thay bằng "Ghi đơn bán"** | Chọn chiếc + khách + giá + ngày + hạn bảo hành → Lưu. Bỏ thanh toán, tiền thừa, nợ, giảm giá, thu cũ đổi mới |
| `sales` Phiếu bán | **Giữ, gọn** | Danh sách đơn tìm tên/SĐT/mã/serial, lọc kênh (cửa hàng/CTV); chi tiết: in, hủy trong hạn (chủ). Bỏ "Còn nợ"/"Thu thêm" |
| `repair` Sửa chữa | **Giữ, gọn** | Nhận máy 1 trang; khoản tiền (dịch vụ/khoản khác); sửa xong; giao máy. Bỏ thợ, linh kiện, cọc, thu tiền |
| `cash` Thu chi & công nợ | **BỎ** (CF-06/07) | Không dựng |
| `buy` Nhập hàng | **BỎ** (CF-14) | Thay bằng "Thêm đồng hồ" (1 chiếc) + Nhập từ Excel |
| `cust` Khách hàng | **Giữ, gọn** | Hồ sơ, lịch sử mua/sửa; bỏ công nợ/cọc |
| `reserve` Giữ hàng | **BỎ** (CF-13) | |
| `returns` Đổi trả | **BỎ** (CF-02) | Thay bằng hạn bảo hành trên đơn + nhận máy sửa bảo hành |
| `parts` Linh kiện · `stocktake` Kiểm kê | **BỎ** (CF-14) | |
| `report` Báo cáo | **Giữ, gọn** | 3 báo cáo: Doanh thu · Số lượng đồng hồ · Cộng tác viên (`reports-and-dashboard` §3) |
| `collab` Cộng tác viên (hoa hồng) | **THIẾT KẾ LẠI** (CF-10…12) | Chủ: danh sách CTV + thống kê, Giao hàng nhiều CTV, Hàng đang giao, Báo bán chờ xác nhận. CTV: Hàng của tôi (giá niêm yết) + "Đã bán", Báo bán của tôi, Thống kê (số chiếc) |
| `admin` Quản trị | **Giữ, gọn** | Người dùng, vai trò & quyền, cài đặt, **nhật ký (gộp)**, hệ thống & sao lưu; bỏ tab Phiên bản |

**Màn đã có bản dựng ngoài mẫu** (theo ngôn ngữ Glass; chủ dự án đã duyệt qua bản chạy): Đăng nhập · Đổi mật khẩu · Xác thực 2 bước · Màn hình của **CTV** · Cộng tác viên (chủ): Giao hàng, Hàng đang giao, Báo bán · Thông báo · Hướng dẫn sử dụng · Nhập từ Excel · Trạng thái rỗng/lỗi/mất mạng · Cài đặt cá nhân. Màn mới sau này vẫn cần bản tĩnh được duyệt trước khi code (§10).

## 7. Quy tắc triển khai kỹ thuật

1. **Tailwind + biến CSS.** Cấu hình Tailwind đọc token (`theme.extend.colors = { ink:'var(--wf-ink)', … }`, `borderRadius`, `boxShadow`, `screens.desk=1000px`). Không hex trong component. Lớp tiện ích kính (`.g`) viết trong `glass.css`.
2. **Hiệu năng `backdrop-filter`.** Chỉ dùng cho khối nổi (dock, thẻ chính, sheet); danh sách dài dùng nền kính **không blur** (`rgba(255,255,255,.7)`). Có `@supports not (backdrop-filter: blur(1px)) { .g { background: var(--wf-glass-strong) } }` và tôn trọng `prefers-reduced-transparency`.
3. **Tương phản.** Chữ phụ `--wf-mute` (#6E7194) trên kính phải đạt WCAG AA (≥ 4.5:1) ở cỡ chữ đang dùng — **kiểm bằng axe/Lighthouse khi dựng**; nếu không đạt, tối hơn một nấc, **không** giảm cỡ chữ. Tone chỉ là phụ, luôn kèm chữ.
4. **Vùng chạm ≥ 44px**, vùng an toàn `viewport-fit=cover` + `--safe-*`; chữ nhập ≥ 16px (chống iOS tự phóng).
5. **Ảnh chiếc** nền gradient nhạt, bo 15–18px; ảnh lấy từ Storage (thumb WebP); có `loading="lazy"`, tỷ lệ cố định (không nhảy bố cục).
6. **Số liệu từ máy chủ.** Component hiển thị, không tính tiền/lãi (`conventions` §2); xem trước ở client chỉ để gợi ý.
7. **Mất mạng/nháp:** `OfflineBanner`, nút xác nhận khóa khi offline (`ux-and-navigation` §6).
8. **Không dựng màn đã bị loại** dù mẫu có.

**Lớp phủ thống nhất (2026-10-17).** Mọi lớp phủ (`Modal`/`BottomSheet`, `ActionSheet`, `Popover`, `DetentSheet`, `FilterDrawer`, `ConfirmDialog`) dùng chung `useOverlayBehavior` (`ui/overlay.ts`): Esc đóng lớp TRÊN CÙNG, bẫy focus, khóa cuộn nền, trả focus; chung scrim `.wf-scrim`, hoạt ảnh `usePresence` (tôn trọng `prefers-reduced-motion`), safe-area đáy. Thang z-index ở `tokens.css`: sticky 20 · fab 55 · nav 60 · dim 90 · detent 97 · banner 98 · overlay 120 · popover 130 · toast 140 · skip 200. `Modal` = bottom sheet trên điện thoại, hộp giữa 520px trên desktop. Không dùng `window.alert/confirm/prompt`/`<dialog>`.

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
Giữ nguyên khối quy tắc nền `.ux` (box-sizing, focus ring `outline:2px solid var(--ux-accent)`, ép giảm chuyển động) lấy từ `node <skill-dir>/scripts/lucian-uxui.mjs tokens` — **một lần cho cả dự án**. Nhánh sáng ở `:root`; nhánh tối ở `:root[data-theme="dark"]` (đã có, định nghĩa lại mọi `--wf-*` và các `--ux-*` không trỏ về `--wf-*`).

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
| Wizard nhận máy / form nhiều bước | Nhận máy sửa, giao hàng CTV, **Nhập Excel hàng loạt** (`/nhap-excel`: Chọn tệp → Xem trước → Kết quả; khu thả tệp tự dựng theo Glass — không có trong Lucian) | `stepper wizard` | #042 (+#047 lọc dòng) |
| Tab nhóm nội dung (Điện thoại / Máy tính, loại tệp Excel…) | Hướng dẫn sử dụng (`/huong-dan`; còn lại — hero, thẻ mục, bước, ghi chú, bảng, sơ đồ luồng, minh họa — tự dựng theo Glass ở `src/components/guide/`) | `segmented control` | #047 |
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
| 034 | Airport autocomplete | `src/components/lucian/lucian-034.css` · `src/components/ui/Combobox.tsx` · `src/lib/suggest.ts` | Ô nhập có gợi ý (`Combobox`): nguồn hàng ở phiếu nhập / thêm đồng hồ | Chỉ lấy chữ mờ hoàn thành (Tab nhận), danh sách lọc tô đậm phần khớp, thanh sáng trượt theo mục; bỏ biểu tượng máy bay/mã sân bay/khung 340×380; lọc không dấu; Enter chỉ nhận khi đang trỏ (để Enter vẫn gửi form), Esc chỉ đóng danh sách; Popover (desktop) / danh sách nối liền dưới ô (điện thoại); chữ mờ chỉ desktop | 2026-10-17 | AI (Claude) |
| 031 | Custom select listbox | `src/components/lucian/lucian-031.css` · `src/components/ui/Select.tsx` | Mọi ô chọn (`Select`) | Chỉ lấy danh sách chọn: thanh sáng trượt theo mục đang trỏ (`--i` × `--row`), dấu ✓ nảy, mũi tên xoay; bỏ cờ/chú thích phụ/nút Lưu/khung 340×436; danh sách nằm trong `Popover` (desktop) hoặc `Modal` (điện thoại), cuộn được, ô tìm không dấu, mục disabled, phím ↑↓ Home End gõ-chữ-nhảy; logic viết lại bằng state React | 2026-10-17 | AI (Claude) |
| 030 | Date range calendar | `src/components/lucian/lucian-030.css` · `src/components/lucian/CalendarPanel.tsx` · `src/components/ui/DateInput.tsx` | Mọi ô ngày (`DateInput`), khoảng ngày báo cáo (`DateRange`) | Lấy lưới ngày + dải chọn khoảng + nút chuyển tháng; bỏ khung thẻ 350px; thêm chế độ MỘT ngày, tuần bắt đầu thứ Hai (T2…CN, CN đỏ), `min`/`max`, lưới chọn tháng/năm, nút Hôm nay/Xóa, tiếng Việt; ngày là chuỗi ISO, cộng trừ qua `src/lib/dates.ts`; phím mũi tên/Home/End/PageUp/PageDown | 2026-10-17 | AI (Claude) |
| 070 | Stacking toasts | `src/components/lucian/lucian-070.css` · `src/components/ui/Toast.tsx` | Toàn app (`ToastProvider`/`useToast`) | Bỏ nút demo + khung 350×370; vùng toast cố định (**đầu màn hình dưới tai thỏ ở mobile**, góc phải dưới ở desktop; `--k` lật chiều xếp chồng; z = `--wf-z-toast`, trên mọi lớp phủ); viết lại logic bằng state/ref React (xếp chồng, xòe khi hover/focus, vuốt bỏ, đếm ngược rAF, dọn timer); chữ tiếng Việt; thêm kind cảnh báo/loading + `promise()`; vùng chạm nút ×/hành động ≥ 44px | 2026-10-16 | AI (Claude) |
| 047 | Period segmented control | `src/components/lucian/lucian-047.css` · `src/components/ui/SegmentedControl.tsx` | Chọn kỳ, tab chỉ số (Tổng quan, Báo cáo, Thống kê CTV) | Chỉ lấy công tắc phân đoạn (núm giãn khi trượt); bỏ thẻ số đếm + biểu đồ; mặc áo Glass (`.wf-seg`, viên pill, núm trắng); N tùy chọn thay vì 4; vai trò radiogroup hoặc tablist; phím mũi tên; ResizeObserver dọn khi unmount | 2026-10-16 | AI (Claude) |
| 026 | 6-digit code input | `src/components/lucian/lucian-026.css` · `src/components/lucian/OtpInput.tsx` | Xác thực 2 bước (TOTP) | Bỏ khung 350×250 + biểu tượng/tiêu đề mẫu; mã đúng do `onComplete` (không gắn cứng); chữ tiếng Việt; chữ số vào ô bằng JSX (không innerHTML); bỏ đếm ngược gửi lại; thu nhỏ ô ≤ 360px | 2026-10-16 | AI (Claude) |
| 062 | Sign-in card feedback | `src/components/lucian/lucian-062.css` · `src/components/lucian/LoginCard.tsx` | Đăng nhập | Thành phần trình bày (props `onSubmit`, `loading`, `error`, `attemptsLeft`, `success`); bỏ ngăn chào mừng; logo + nút theo token Glass; nhập chữ 16px; nút vô hiệu khi thiếu dữ liệu; không còn mật khẩu mẫu | 2026-10-16 | AI (Claude) |
| 035 | Money transfer amount | `src/components/lucian/lucian-035.css` · `src/components/lucian/MoneyAmountInput.tsx` | POS "Khách đưa", thanh toán, cọc, giá thu giao CTV | Bỏ chip người nhận, đổi tiền tệ, nút Gửi; số theo VND (dấu chấm nghìn, hậu tố ₫); chip cộng nhanh/"Đủ"/"Xóa" cao 44px; hạn mức `max` làm số đỏ + rung; dòng phụ do cha truyền | 2026-10-16 | AI (Claude) |
| 092 | Empty search that loosens filters | `src/components/lucian/lucian-092.css` · `src/components/ui/EmptyState.tsx` | Danh sách/tìm kiếm không có kết quả | Chỉ lấy ngăn rỗng (kính lúp quét kệ + nút "gỡ bộ lọc → N kết quả"); bỏ ô tìm, chip, lưới, dữ liệu mẫu; biến thể "plain" cho câu hướng dẫn bắt đầu; tròng kính dùng token | 2026-10-16 | AI (Claude) |
| 090 | Error widget that plugs back in | `src/components/lucian/lucian-090.css` · `src/components/ui/ErrorState.tsx` | Lỗi tải widget/danh sách | Bỏ thẻ widget + sân khấu thành công + biểu đồ; giữ phích cắm, đếm ngược tự thử lại (vòng trên nút), chấm lần thử, chi tiết lỗi; `onRetry` thật; nút "Chi tiết" ≥ 44px | 2026-10-16 | AI (Claude) |
| 079 | Skeleton that blooms into a post | `src/components/lucian/lucian-079.css` · `src/components/ui/Skeleton.tsx` | Skeleton danh sách/KPI/avatar | Chỉ lấy vệt sáng quét (`u079-sk`); mỗi khối quét riêng (không căn vệt chung `--sx`); bỏ bài đăng mẫu + hiệu ứng nở nội dung | 2026-10-16 | AI (Claude) |
| 008 | Copy button that turns into a check | `src/components/lucian/lucian-008.css` · `CopyCodeButton.tsx` | Mã nội bộ chiếc; dùng lại (không port mới) ở `TransferQr` — sao chép STK/số tiền/nội dung chuyển khoản (VietQR) | Chỉ lấy nút (biểu tượng thành dấu tích, vệt sáng, bong bóng "Đã sao chép"); bỏ tab và hộp lệnh; vùng chạm 44px | 2026-10-16 | AI (Claude) |
| 018 | Rolling quantity stepper | `lucian-018.css` · `QuantityStepper.tsx` | Điều chỉnh tồn linh kiện (sau này giỏ POS) | Chỉ lấy bộ chỉnh số lăn; bỏ thẻ sản phẩm + tổng tiền; hỗ trợ số âm có dấu +/− | 2026-10-16 | AI (Claude) |
| 032 | Drag-and-drop upload | `lucian-032.css` · `ImageUpload.tsx` | Ảnh chiếc (sản phẩm/tình trạng) | Tải thật bằng XHR có % tiến trình, thử lại khi lỗi; bỏ dữ liệu mẫu; chỉ nhận ảnh; chữ tiếng Việt | 2026-10-16 | AI (Claude) |
| 305 | Filter drawer with live result count | `lucian-305.css` · `FilterDrawer.tsx` | Danh sách đồng hồ | Lấy nút Lọc + huy hiệu, chip bộ lọc đang áp dụng, nút "Xem N kết quả" số lăn; ngăn kéo dùng Modal Glass; số kết quả lấy từ API (pageSize=1); bỏ lưới/thanh giá/màu/cỡ mẫu | 2026-10-16 | AI (Claude) |
| 042 | Step-by-step wizard | `lucian-042.css` · `WizardSteps.tsx` | Phiếu nhập nhiều bước | Chỉ lấy thanh bước (đường tiến độ + chấm đổi thành dấu tích, bấm để quay lại); bỏ thẻ khung, nội dung và nút mẫu; chấm ≥ 44px | 2026-10-17 | AI (Claude) |
| 336 | Bottom sheet with three detents | `lucian-336.css` · `DetentSheet.tsx` | Giỏ phiếu bán (POS mobile) | Chỉ lấy tờ 3 nấc (đóng · nửa · đầy) kéo + lò xo; bỏ bản đồ/danh sách mẫu; nền kính Glass; nội dung cuộn riêng + chừa đáy | 2026-10-17 | AI (Claude) |
| 003 | Hold to delete | `lucian-003.css` · `HoldButton.tsx` | Tịch thu cọc giữ hàng | Chỉ lấy nút giữ-để-xác-nhận (đổ đầy đỏ 1,2 giây); bỏ tệp mẫu/hoàn tác; hỗ trợ phím cách/Enter; tự đặt lại sau khi xác nhận | 2026-10-17 | AI (Claude) |
| 074 | Notification bell dropdown | `lucian-074.css` · `NotificationBell.tsx` | Chuông ở thanh trên (desktop) và tiêu đề mobile | Chỉ lấy chuông (lắc khi có thông báo mới, huy hiệu nảy) + bảng thả xuống + hàng có chấm chưa đọc; bỏ tab Nhắc tên/avatar emoji/dữ liệu mẫu; bấm hàng = đánh dấu đã đọc + mở liên kết; đóng khi bấm ngoài/Esc | 2026-10-17 | AI (Claude) |
| 046 | Command palette | `src/components/lucian/lucian-046.css` · `src/components/layout/CommandPalette.tsx` (+ `palette-bus.ts`) | Bảng lệnh Ctrl+K / tìm toàn cục (nút tìm ở thanh trên và đầu trang điện thoại) | Lấy ô tìm + thanh sáng trượt theo mục (`--y`/`--h` đo thật) + chữ khớp tô màu (nhiều từ khóa, không dấu) + phím tắt `kbd` + hoạt ảnh mở xuống (clip-path); bỏ pill thu gọn, dữ liệu mẫu, màu gradient từng mục; thêm nhóm có tiêu đề, dòng phụ, tag "Enter để mở", trạng thái đang tải/lỗi/trống, combobox/listbox (`aria-activedescendant`); điện thoại = toàn màn hình, desktop = hộp giữa 640px; mở bằng Ctrl/⌘+K, `/`; Esc/bẫy focus/khóa cuộn qua `useOverlayBehavior`; logic viết lại bằng state React (không innerHTML) | 2026-10-17 | AI (Claude) |

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
