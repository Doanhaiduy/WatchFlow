# Báo cáo & tổng quan (dashboard)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Định nghĩa tiền: `glossary` §2, `money-and-ledger`, `costing-and-profit`

## 1. Nguyên tắc

1. **Mỗi con số có một định nghĩa duy nhất** ở bảng dưới; dashboard và báo cáo dùng **cùng hàm SQL** (`app.rpt_*`), không tính lại ở client.
2. **Tách theo trục ngày đúng nghĩa**: doanh thu bán theo *ngày phiếu*, doanh thu sửa theo *ngày giao*, đổi trả theo *ngày đổi trả*, thực thu/chi theo *ngày phiếu thu/chi*, tồn kho theo *thời điểm xem*.
3. **Quyền**: hàm báo cáo `SECURITY DEFINER` kiểm quyền trong thân; thiếu quyền ⇒ 403 (không trả 0). Xuất Excel/PDF dùng đúng hàm đó (BR-SEC-02).
4. **Múi giờ**: mọi lọc ngày theo giờ VN; khoảng `[từ, đến]` gồm cả hai đầu.
5. **Chứng từ `voided` luôn bị loại**; `draft` không tính.
6. Mọi báo cáo: lọc khoảng thời gian, xuất Excel (`write-excel-file`) và PDF (`pdfmake`), hiển thị "Dữ liệu đến lúc hh:mm"; kỳ đã khóa hiển thị nhãn.

## 2. Số liệu gốc (định nghĩa)

| Chỉ số | Công thức | Trục ngày | Quyền |
|---|---|---|---|
| Doanh thu bán hàng | Σ `sale_lines.line_total` (phiếu `confirmed`) − Σ giá trị dòng đổi trả (`confirmed`) | ngày phiếu / ngày đổi trả | `report.sales` |
| Doanh thu sửa chữa | Σ tổng phải thu phiếu `customer`, `paid`, `delivered` | ngày giao | `report.sales` |
| **Doanh thu** | Bán hàng + sửa chữa | | `report.sales` |
| Giá vốn hàng bán | Σ `sale_line_costs.cost` − giá vốn dòng đổi trả | như trên | `profit.view` |
| Lãi gộp bán hàng | Doanh thu bán hàng − Giá vốn hàng bán | | `profit.view` |
| Lãi gộp sửa chữa | Doanh thu sửa − giá vốn linh kiện − tiền công thợ (− chi phí bảo hành) | ngày giao | `profit.view` |
| **Lãi gộp** | Bán + sửa | | `profit.view` |
| Thực thu | Σ payment `in`, `method≠offset`, `purpose` ∈ {sale_receipt, repair_receipt, deposit_receipt} | ngày phiếu thu | `finance.view` |
| Thực chi | Σ payment `out`, `method≠offset`, trừ `loan_repay`/`third_party_out` (hiển thị riêng) | ngày phiếu chi | `finance.view` |
| Số đồng hồ tồn kho | Đếm chiếc ∈ {in_stock, reserved, in_repair, inspecting} | thời điểm xem | `report.inventory` |
| Số đồng hồ có thể bán | Đếm `in_stock` | thời điểm xem | `catalog.view` |
| Số đồng hồ đã bán | Đếm dòng bán đồng hồ hiệu lực (phiếu `confirmed` trừ đã đổi trả hết) | ngày phiếu | `report.sales` |
| Giá trị tồn theo giá vốn | Σ giá vốn chu kỳ hiện hành của chiếc tồn kho + Σ `qty × avg` linh kiện | thời điểm xem | `cost.view` |
| Công nợ khách / NCC | `money-and-ledger` §3 | thời điểm xem (hoặc "tính đến ngày") | `debt.view` |
| Tồn lâu | `in_stock` & `hôm nay − stock_since > aging_days` | thời điểm xem | `report.inventory` |

## 3. Danh mục báo cáo (FR-RPT-*)

| # | Báo cáo | Bộ lọc | Nội dung chính | Quyền |
|---|---|---|---|---|
| R1 | **Doanh thu** (FR-RPT-01) | Khoảng ngày, nhóm theo ngày/tháng/năm, nhân viên, CTV, khách | Doanh thu bán / sửa / tổng; số phiếu; trung bình/phiếu; đổi trả | `report.sales` |
| R2 | **Lợi nhuận gộp** (FR-RPT-02) | Khoảng ngày, nhóm theo ngày/tháng/thương hiệu/phiếu/sản phẩm | Doanh thu, giá vốn, lãi gộp, biên lãi %, từng phiếu/từng chiếc | `profit.view` |
| R3 | **Nhập & xuất hàng** (FR-RPT-03) | Khoảng ngày, loại phiếu nhập, NCC | Nhập: số phiếu, số chiếc, linh kiện, giá trị; Xuất: bán, đổi trả, linh kiện dùng cho sửa chữa, hao hụt | `report.inventory` (+ `cost.view` để thấy giá trị) |
| R4 | **Tồn kho theo giá vốn** (FR-RPT-04) | Thương hiệu, vị trí, tình trạng, trạng thái | Danh sách chiếc: mã, loại, serial, trạng thái, vị trí, **giá vốn**, giá bán, lãi dự kiến; linh kiện: SL × bình quân | `cost.view` |
| R5 | **Hàng tồn lâu ngày** (FR-RPT-05) | Ngưỡng ngày (mặc định `inventory.aging_days`) | Chiếc/linh kiện tồn quá ngưỡng, số ngày, giá vốn, gợi ý giảm giá | `report.inventory` |
| R6 | **Công nợ KH & NCC** (FR-RPT-06) | Tính đến ngày, nhóm khách | Theo khách/NCC: phiếu còn nợ, hạn trả, quá hạn; cọc đang giữ | `debt.view` |
| R7 | **Doanh thu sửa chữa & tiền công thợ** (FR-RPT-07) | Khoảng ngày, thợ | Phiếu giao: doanh thu nhân công/linh kiện, giá vốn linh kiện, tiền công theo thợ, lãi gộp sửa | `report.sales` + `profit.view` (lãi); thợ thấy của mình |
| R8 | **Thu chi & số dư tiền** (FR-RPT-08) | Khoảng ngày, quỹ | Số dư đầu kỳ, Thực thu theo mục đích, Thực chi theo hạng mục, vay/thu hộ, chuyển quỹ, điều chỉnh, số dư cuối kỳ; đối chiếu | `finance.view` |
| R9 | **Hoa hồng CTV** | Khoảng ngày, CTV, trạng thái | Phát sinh, đã trả, còn nợ, clawback | `commission.view`; CTV: của mình |
| R10 | **Hao hụt kiểm kê** | Đợt kiểm kê / khoảng ngày | Chiếc & linh kiện thiếu/thừa, lý do, giá trị | `report.inventory` + `cost.view` |
| R11 | **Bảo hành sắp hết hạn** | Số ngày tới | Phiếu/chiếc, khách, ngày hết hạn | `report.sales` |
| R12 | **Nhật ký hoạt động** | Người, hành động, thực thể, ngày | Từ `audit_logs` | `audit.view` |

Chi tiết mỗi báo cáo (cột, thứ tự, tổng cuối) sẽ nằm trong mã (`src/server/modules/reports.ts`) kèm test đối chiếu số liệu vàng; tài liệu này chỉ cố định **định nghĩa**.

## 4. Dashboard (trang chủ) theo vai trò

### Chủ cửa hàng (đủ quyền) — FR-DASH-01…10
Hàng thẻ số (chọn ngày/tháng/năm): **Doanh thu** · **Lãi gộp** · **Thực thu** / **Thực chi** · **Đồng hồ tồn kho** · **Giá trị tồn (giá vốn)** · **Đã bán**. Dưới: biểu đồ doanh thu & lãi gộp theo ngày/tháng; **Việc cần xử lý** (giữ hàng quá hạn, nợ đến hạn, máy sửa xong chưa giao, linh kiện sắp hết, hàng tồn lâu, bảo hành sắp hết); **Đơn hàng mới nhất**; **Đang sửa chữa**.

### Nhân viên bán hàng
Ô tìm kiếm lớn + nút **Bán nhanh**, **Quét QR**; doanh thu hôm nay (chỉ tổng doanh thu, không lãi); giữ hàng sắp hết hạn; đơn nháp của CTV chờ xác nhận; khách hẹn trả tiền hôm nay.

### Quản lý kho
Phiếu nhập gần đây; hàng chờ kiểm tra (`inspecting`); linh kiện sắp hết; hàng tồn lâu; đợt kiểm kê đang mở.

### Thợ sửa chữa
**Việc của tôi** theo trạng thái (kiểm tra / đang sửa / chờ linh kiện), máy sắp trễ hẹn, tiền công tháng này của tôi.

### Cộng tác viên
Hàng được phép (lưới ảnh + giá), đơn nháp của tôi, hoa hồng (chờ / có thể nhận / đã nhận).

Quy tắc hiển thị: widget thiếu quyền **không render và không gọi API** (FR-DASH-11); mọi thẻ số gọi `GET /api/v1/reports/dashboard` trả đúng những khóa người dùng được phép.

## 5. Hiệu năng & caching

- Quy mô nhỏ: hàm SQL trực tiếp trên bảng, có index theo ngày (`sale_date`, `delivered_at`, `paid_at`, `entry_date`).
- Dashboard cache ngắn (30–60 giây) theo `(người dùng, khoảng ngày)` bằng cache của framework/`Runtime Cache`; vô hiệu khi có `domain_events` liên quan nếu cần dữ liệu sát thời gian thực.
- Vật chất hóa (materialized view) **chưa dùng**; chỉ thêm khi đo thấy chậm (> 1 giây) và có test đối chiếu với hàm gốc.
