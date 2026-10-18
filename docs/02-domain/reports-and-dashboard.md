# Báo cáo & tổng quan (dashboard)

> Cập nhật lần cuối: 2026-10-17 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`) · Định nghĩa tiền: `glossary` §2, `money-and-payments`, `costing-and-profit`

## 1. Nguyên tắc

1. **Mỗi con số có một định nghĩa duy nhất** ở bảng dưới; dashboard và báo cáo dùng **cùng hàm SQL** (`app.rpt_*`), không tính lại ở client.
2. **Tách theo trục ngày đúng nghĩa**: doanh thu bán theo *ngày phiếu*, doanh thu sửa theo *ngày giao*, thực thu theo *ngày thanh toán*, tồn kho theo *thời điểm xem*.
3. **Quyền**: hàm báo cáo `SECURITY DEFINER` kiểm quyền trong thân; thiếu quyền ⇒ 403 (không trả 0). Xuất Excel/PDF dùng đúng hàm đó (BR-SEC-02).
4. **Múi giờ**: mọi lọc ngày theo giờ VN; khoảng `[từ, đến]` gồm cả hai đầu.
5. **Chứng từ `voided` luôn bị loại**; `draft` không tính.
6. Mọi báo cáo: lọc khoảng thời gian, xuất Excel (`write-excel-file`) và PDF (`pdfmake`), hiển thị "Dữ liệu đến lúc hh:mm".

## 2. Số liệu gốc (định nghĩa)

| Chỉ số | Công thức | Trục ngày | Quyền |
|---|---|---|---|
| Doanh thu bán hàng (cửa hàng) | Σ `line_total` các dòng do **cửa hàng** bán + Σ `base_price_snapshot` các dòng do **CTV** bán (phiếu `confirmed`) | ngày phiếu | `report.sales` |
| Doanh thu sửa chữa | Σ tổng phải thu phiếu `customer`, `paid`, `delivered` | ngày giao | `report.sales` |
| **Doanh thu** | Bán hàng + sửa chữa | | `report.sales` |
| Giá vốn hàng bán | Σ `sale_line_costs.cost` (cả dòng CTV) | ngày phiếu | `profit.view` |
| Lãi gộp bán hàng | Doanh thu bán hàng − Giá vốn hàng bán | | `profit.view` |
| Lãi gộp sửa chữa | Doanh thu sửa − giá vốn linh kiện (phiếu tính phí) − chi phí bảo hành (linh kiện phiếu `warranty_free`) | ngày giao | `profit.view` |
| **Lãi gộp** | Bán + sửa | | `profit.view` |
| Thực thu | Σ thanh toán `in` − Σ `out` (`posted`) | ngày thanh toán | `report.sales` |
| Số đồng hồ tồn kho | Đếm chiếc ∈ {in_stock, reserved, with_collaborator, in_repair, inspecting} | thời điểm xem | `report.inventory` |
| Số đồng hồ có thể bán (cửa hàng) | Đếm `in_stock` | thời điểm xem | `catalog.view` |
| Số đồng hồ đang ở CTV | Đếm `with_collaborator` | thời điểm xem | `report.inventory` |
| Số đồng hồ đã bán | Đếm dòng bán đồng hồ hiệu lực (phiếu `confirmed`, gồm đơn CTV) | ngày phiếu | `report.sales` |
| Giá trị tồn theo giá vốn | Σ giá vốn chu kỳ hiện hành của chiếc tồn kho + Σ `qty × avg` linh kiện (hiện riêng phần "ở CTV") | thời điểm xem | `cost.view` |
| Khách còn nợ | `money-and-payments` §3 | thời điểm xem | `debt.view` |
| CTV chưa nộp | Σ `base_price_snapshot` dòng CTV chưa quyết toán | thời điểm xem | `collab.view` |
| Tồn lâu | `in_stock` & `hôm nay − stock_since > aging_days` | thời điểm xem | `report.inventory` |

## 3. Danh mục báo cáo (FR-RPT-*)

| # | Báo cáo | Bộ lọc | Nội dung chính | Quyền |
|---|---|---|---|---|
| R1 | **Doanh thu** (FR-RPT-01) | Khoảng ngày, nhóm theo ngày/tháng/năm, người bán, CTV, khách | Doanh thu bán / sửa / tổng; số phiếu; trung bình/phiếu | `report.sales` |
| R2 | **Lợi nhuận gộp** (FR-RPT-02) | Khoảng ngày, nhóm theo ngày/tháng/thương hiệu/phiếu/sản phẩm | Doanh thu, giá vốn, lãi gộp, biên lãi %, từng phiếu/từng chiếc | `profit.view` |
| R3 | **Nhập & xuất hàng** (FR-RPT-03) | Khoảng ngày, loại phiếu nhập | Nhập: số phiếu, số chiếc, linh kiện, giá trị theo nguồn hàng; Xuất: bán, giao CTV/thu hồi, linh kiện dùng cho sửa chữa, hao hụt | `report.inventory` (+ `cost.view` để thấy giá trị) |
| R4 | **Tồn kho theo giá vốn** (FR-RPT-04) | Thương hiệu, vị trí, tình trạng, trạng thái | Danh sách chiếc: mã, loại, serial, trạng thái, vị trí, **giá vốn (giá thu)**, giá bán, lãi dự kiến; linh kiện: SL × bình quân | `cost.view` |
| R5 | **Hàng tồn lâu ngày** (FR-RPT-05) | Ngưỡng ngày (mặc định `inventory.aging_days`) | Chiếc/linh kiện tồn quá ngưỡng, số ngày, giá vốn | `report.inventory` |
| R6 | **Phiếu còn nợ** (FR-RPT-06) | Tính đến ngày, khách | Phiếu bán/sửa còn nợ: khách, số tiền, hạn trả, quá hạn; cọc đang giữ (thay cho "công nợ KH & NCC" — CF-06) | `debt.view` |
| R7 | **Doanh thu sửa chữa** (FR-RPT-07) | Khoảng ngày | Phiếu giao: doanh thu dịch vụ/linh kiện, giá vốn linh kiện, chi phí bảo hành, lãi gộp sửa (không tiền công thợ — CF-04) | `report.sales` + `profit.view` (lãi) |
| R8 | **Tiền thu** (FR-RPT-08) | Khoảng ngày | Thực thu theo cách thanh toán (tiền mặt/chuyển khoản) và theo mục đích (bán, sửa, cọc nhận/hoàn, CTV nộp); thu nhập khác (cọc tịch thu). Không có số dư quỹ (CF-07) | `report.sales` |
| R9 | **Thống kê CTV** (FR-COL-09, CF-08) | Tháng/quý/năm, CTV, trạng thái quyết toán | Mỗi CTV: số chiếc bán, doanh thu bán ra (Σ giá bán), phải nộp (Σ giá thu), phần CTV hưởng, đã/chưa quyết toán; tab "Hàng đang giữ" (chiếc, giá thu, số ngày) | `collab.view`; CTV: `collab.view_own` |
| R10 | **Hao hụt kiểm kê** | Đợt kiểm kê / khoảng ngày | Chiếc & linh kiện thiếu/thừa, lý do, giá trị | `report.inventory` + `cost.view` |
| R11 | **Bảo hành sắp hết hạn** | Số ngày tới | Phiếu/chiếc, khách, ngày hết hạn | `report.sales` |
| R12 | **Nhật ký hoạt động** | Người, hành động, thực thể, ngày | Từ `audit_logs` | `audit.view` |

Chi tiết mỗi báo cáo (cột, thứ tự, tổng cuối) sẽ nằm trong mã (`src/server/modules/reports.ts`) kèm test đối chiếu số liệu vàng; tài liệu này chỉ cố định **định nghĩa**. Đã bỏ: *Công nợ NCC*, *Thu chi & số dư tiền*, *Tiền công thợ*, *Hoa hồng CTV* (hoãn/thay thế).

## 4. Dashboard (trang chủ) theo vai trò

### Chủ cửa hàng (đủ quyền) — FR-DASH-01…10
Hàng thẻ số (chọn ngày/tháng/năm): **Doanh thu** · **Lãi gộp** · **Thực thu** · **Đồng hồ tồn kho** (kèm "ở CTV") · **Giá trị tồn (giá vốn)** · **Đã bán**. Dưới: biểu đồ doanh thu & lãi gộp theo ngày/tháng; **Việc cần xử lý** (giữ hàng quá hạn, khách hẹn trả hôm nay, máy sửa xong chưa giao, linh kiện sắp hết, hàng tồn lâu, bảo hành sắp hết, chiếc ở CTV quá hạn); **Đơn hàng mới nhất**; **Đang sửa chữa**.

### Nhân viên bán hàng
Ô tìm kiếm lớn + nút **Bán nhanh**, **Quét QR**; doanh thu hôm nay (chỉ tổng doanh thu, không lãi); giữ hàng sắp hết hạn; đơn nháp của CTV chờ xác nhận; khách hẹn trả tiền hôm nay.

### Quản lý kho
Phiếu nhập gần đây; hàng chờ kiểm tra (`inspecting`); linh kiện sắp hết; hàng tồn lâu; đợt kiểm kê đang mở.

### Cộng tác viên
**Hàng đang giữ** (lưới ảnh + giá thu), đơn nháp của tôi, thống kê của tôi (số chiếc bán, phần tôi hưởng, đã/chưa nộp).

Quy tắc hiển thị: widget thiếu quyền **không render và không gọi API** (FR-DASH-11); mọi thẻ số gọi `GET /api/v1/reports/dashboard` trả đúng những khóa người dùng được phép.

**Dữ liệu trả thêm cho giao diện (2026-10-17):**
- `prev` — các khóa số (`revenue`, `salesRevenue`, `repairRevenue`, `grossProfit`, `collections`, `invoiceCount`, `unitsSold`) của **kỳ liền trước** (hôm nay → hôm qua; 7 ngày → 7 ngày trước đó; tháng/quý/năm → cùng khoảng của kỳ trước; khoảng tùy chọn → khoảng liền trước cùng số ngày), chỉ khóa mà hàm DB trả cho người gọi. UI tính "▲/▼ x% so với kỳ trước" từ `kpis` và `prev` (`src/lib/series.ts` · `deltaPct`).
- `series.revenue` / `series.profit` — chuỗi theo ngày (hôm nay: 7 ngày gần nhất) hoặc theo tháng (quý/năm), **đã điền kỳ không phát sinh bằng 0** (`fillSeries`) để biểu đồ luôn đủ điểm; mỗi dòng doanh thu có `salesRevenue`/`repairRevenue` để vẽ cột bán hàng vs sửa chữa.
- `stockByBrand` — số chiếc tồn theo hãng (chỉ cần `catalog.view`, không chứa giá vốn).

Bố cục Tổng quan: hero doanh thu (kèm so sánh kỳ trước) → thẻ KPI có biểu tượng/xu hướng → biểu đồ doanh thu & lãi gộp (tab Doanh thu / Lãi gộp / Cả hai) → bán hàng vs sửa chữa, tồn kho theo trạng thái, tồn theo hãng, thực thu theo hình thức → bán gần đây; cột phải: việc cần xử lý, làm nhanh, đang sửa. Điện thoại xếp một cột và đưa "Việc cần xử lý" lên ngay sau thẻ KPI.

## 5. Hiệu năng & caching

- Quy mô nhỏ: hàm SQL trực tiếp trên bảng, có index theo ngày (`doc_date`, `delivered_at`, `paid_at`).
- Dashboard cache ngắn (30–60 giây) theo `(người dùng, khoảng ngày)` bằng cache của framework/`Runtime Cache`; vô hiệu khi có `domain_events` liên quan nếu cần dữ liệu sát thời gian thực.
- Vật chất hóa (materialized view) **chưa dùng**; chỉ thêm khi đo thấy chậm (> 1 giây) và có test đối chiếu với hàm gốc.
