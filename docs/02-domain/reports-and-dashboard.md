# Báo cáo & tổng quan (dashboard)

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (viết lại theo `customer-feedback-02`: chỉ còn **3 báo cáo**, không giá vốn/lãi/nợ/thực thu) · Định nghĩa tiền: `glossary` §2, `money-and-payments`
> Các báo cáo cũ (lợi nhuận gộp, nhập–xuất, tồn kho theo giá vốn, tồn lâu, phiếu còn nợ, tiền thu, hao hụt kiểm kê, bảo hành sắp hết, doanh thu sửa chữa riêng) **đã bỏ** — hàm `rpt_*` tương ứng còn ở DB (đóng băng) nhưng không có API/giao diện gọi. Thiết kế cũ: `99-archive/2026-10-16-full-scope/02-domain/reports-and-dashboard.md`.

## 1. Nguyên tắc

1. **Mỗi con số có một định nghĩa duy nhất** ở bảng dưới; dashboard và báo cáo dùng **cùng hàm SQL** (`app.rpt_*`), không tính lại ở client.
2. **Trục ngày đúng nghĩa:** doanh thu bán theo *ngày đơn* (`sales.doc_date`), doanh thu sửa theo *ngày giao máy* (`repair_orders.delivered_date`), tồn kho theo *thời điểm xem*. Doanh thu **không bao giờ** tính từ thanh toán (BR-PAY-02) — bản gọn không có thanh toán.
3. **Quyền:** hàm báo cáo `SECURITY DEFINER` kiểm quyền trong thân; thiếu quyền ⇒ 403 (không trả 0). Xuất Excel dùng đúng hàm đó (BR-SEC-02, PT-05).
4. **Múi giờ:** mọi lọc ngày theo giờ VN; khoảng `[từ, đến]` gồm cả hai đầu.
5. **Chứng từ `voided` luôn bị loại.**
6. Nhóm kỳ: **ngày / tháng / quý / năm** (`app.rpt_bucket`).
7. **Không có giá vốn, lãi gộp, công nợ, cọc, thực thu, số dư quỹ ở bất kỳ báo cáo nào** (CF-14). CTV không có báo cáo (BR-COL-17).

## 2. Số liệu gốc (định nghĩa)

| Chỉ số | Công thức | Trục ngày | Quyền |
|---|---|---|---|
| Doanh thu bán tại cửa hàng | Σ `sale_lines.shop_revenue_vnd` của đơn `confirmed` **không** có `collaborator_id` | ngày đơn | `report.sales` |
| Doanh thu CTV bán | Σ `shop_revenue_vnd` của đơn `confirmed` có `collaborator_id` (= giá chủ xác nhận — BR-COL-14) | ngày đơn | `report.sales` |
| Doanh thu sửa chữa | Σ `revenue_vnd` phiếu `customer`, `delivered` (bảo hành miễn phí = 0) | ngày giao | `report.sales` |
| **Doanh thu** | Cửa hàng + CTV + sửa chữa | | `report.sales` |
| Số đơn bán | Đếm đơn `confirmed` | ngày đơn | `report.sales` |
| Số chiếc đã bán (và "trong đó CTV") | Đếm dòng đồng hồ của đơn `confirmed` | ngày đơn | `report.sales` / `report.inventory` |
| Số máy sửa đã giao | Đếm phiếu `delivered` | ngày giao | `report.sales` |
| Tồn kho: sẵn sàng bán / chờ kiểm tra | Đếm chiếc `in_stock` / `inspecting` | thời điểm xem | `report.inventory`/`catalog.view` |
| Đang giao CTV | Đếm chiếc có ≥ 1 chào hàng `active` | thời điểm xem | `report.inventory`/`catalog.view` |
| CTV mang về | Số chiếc + Σ giá xác nhận của đơn có `collaborator_id`, theo CTV và theo kỳ | ngày đơn | `collab.view` |
| Báo bán chờ xác nhận | Đếm `collaborator_claims.status='pending'` | thời điểm xem | `collab.view` / `sale.confirm` |

## 3. Danh mục báo cáo (FR-RPT-13, BR-RPT-01)

| # | Mã API | Báo cáo | Bộ lọc | Nội dung chính | Quyền |
|---|---|---|---|---|---|
| R1 | `revenue` | **Doanh thu** | Khoảng ngày; nhóm ngày/tháng/quý/năm | Mỗi kỳ: doanh thu cửa hàng / CTV / sửa chữa / tổng, số đơn, số chiếc (trong đó CTV), số máy sửa, trung bình/đơn | `report.sales` |
| R2 | `units` | **Số lượng đồng hồ** | Khoảng ngày | Đã bán trong kỳ (tổng, tại cửa hàng, CTV bán; theo hãng); đang có: sẵn sàng bán, chờ kiểm tra, đang giao CTV; tồn theo hãng | `report.sales` hoặc `report.inventory` |
| R3 | `collab` | **Cộng tác viên** | Khoảng ngày; nhóm ngày/tháng/quý/năm | Theo kỳ (số chiếc, doanh thu, số CTV có đơn) · theo từng CTV · chi tiết kỳ × CTV | `collab.view` (chỉ chủ) |

API: `GET /api/v1/reports/{revenue|units|collab}?from=&to=&group=&format=json|xlsx`; `GET /api/v1/reports/collaborators` (trang Cộng tác viên → Thống kê, cùng hàm `rpt_collab_sales`). Xuất Excel cần `report.export`, tối đa 5 lần/giờ/người, ghi audit `report.exported` (cùng `request_id` với nhật ký hoạt động), mỗi sheet có tiêu đề + "Dữ liệu đến lúc".

Giao diện `/bao-cao`: ba thẻ chọn báo cáo → bộ chọn khoảng ngày + nhóm kỳ → thẻ tổng + biểu đồ + bảng → nút **Xuất Excel**, **In**. Chi tiết cột nằm trong `src/server/reports.ts` (`REPORTS`) kèm test đối chiếu số vàng (SC-10).

## 4. Dashboard (trang chủ) theo vai trò

`GET /api/v1/reports/dashboard?period=today|7d|month|quarter|year` (hoặc `from`/`to`) → `rpt_dashboard` chỉ trả **đúng những khóa người dùng được phép** (FR-DASH-11). Widget thiếu quyền không render và không gọi dữ liệu.

### Chủ cửa hàng (đủ quyền)
Thẻ số: **Doanh thu** (kèm ▲/▼ so với kỳ trước) · **Số chiếc bán** · **Đồng hồ trong kho** (sẵn sàng bán / chờ kiểm tra / đang giao CTV) · **Báo bán CTV chờ xác nhận** · **Máy đang sửa / máy xong chờ giao**. Biểu đồ doanh thu (cửa hàng/CTV/sửa chữa) theo ngày hoặc tháng. Dưới: **Báo bán chờ xác nhận** (xác nhận ngay), **Đơn bán gần đây**, **Đang sửa chữa**, tồn theo hãng.

### Nhân viên bán hàng (`sale.confirm`, `report.sales`)
Nút **Ghi đơn bán** + tìm kiếm; doanh thu và số chiếc bán; báo bán CTV chờ xác nhận; đơn gần đây. Không có thẻ sửa chữa.

### Quản lý kho
Số chiếc trong kho (sẵn sàng / chờ kiểm tra / đang giao CTV), tồn theo hãng, nút **Thêm đồng hồ**. Không thẻ tiền.

### Cộng tác viên
Không thẻ số cửa hàng (PT-14). Trang chủ dẫn tới **Hàng của tôi** (`/ctv`): lưới ảnh chiếc được giao + giá niêm yết + nút **Đã bán**; **Báo bán của tôi** (chờ / đã xác nhận / bị từ chối); **Thống kê của tôi** (chỉ số chiếc theo ngày/tháng/quý/năm, không tiền).

**Dữ liệu trả thêm cho giao diện:**
- `prev` — các khóa số (`revenue`, `salesRevenue`, `repairRevenue`, `invoiceCount`, `unitsSold`) của **kỳ liền trước**; UI tính "▲/▼ x% so với kỳ trước" (`src/lib/series.ts` · `deltaPct`).
- `series.revenue` — chuỗi theo ngày (hôm nay: 7 ngày gần nhất) hoặc theo tháng (quý/năm), **đã điền kỳ không phát sinh bằng 0** (`fillSeries`); mỗi dòng có `shopRevenue`/`collabRevenue`/`repairRevenue`.
- `recentSales`, `pendingClaims`, `openRepairs` — danh sách ngắn theo quyền; `stockByBrand` — số chiếc tồn theo hãng (chỉ cần `catalog.view`, không giá).

## 5. Việc cần xử lý & huy hiệu

Huy hiệu số trên điều hướng (`GET /api/v1/me/badges`, làm mới 60 giây) — chỉ số lượng, không tiền; **đỏ** khi quá hạn, **vàng** khi chỉ đang chờ:

| Khóa | Điều hướng | Điều kiện | Quyền | Đỏ khi |
|---|---|---|---|---|
| `claim_pending` | Cộng tác viên | Báo bán CTV chờ xác nhận | `sale.confirm` | chờ > 1 ngày |
| `repair_new` | Sửa chữa | Máy mới nhận (`received`) | `repair.view` | — |
| `repair_late` | Sửa chữa | Quá ngày hẹn trả, chưa xong | `repair.view` | luôn đỏ |
| `repair_pickup` | Sửa chữa | Máy xong chưa lấy | `repair.view` | quá [`repair.pickup_alert_days`] ngày |

Job hằng ngày (`fn_daily_alerts`): đánh dấu bảo hành hết hạn (chỉ đổi trạng thái, không thông báo), nhắc "Máy chưa lấy" và "CTV báo bán chờ xác nhận quá 1 ngày". Kiểm bất biến I1–I15 mỗi tối (`fn_consistency_check`).

## 6. Hiệu năng & caching

- Quy mô nhỏ: hàm SQL trực tiếp trên bảng, có index theo ngày (`doc_date`, `delivered_date`).
- Dashboard gọi 2 lần `rpt_dashboard` (kỳ này + kỳ trước) và 1 lần `rpt_revenue` cho biểu đồ; cache ngắn phía trình duyệt (SWR 30–60 giây).
- Vật chất hóa (materialized view) **chưa dùng**; chỉ thêm khi đo thấy chậm (> 1 giây) và có test đối chiếu với hàm gốc.
