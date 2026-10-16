# Yêu cầu chức năng (FR)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Nguồn: bản yêu cầu gốc (14 nhóm) + bổ sung đã chốt (`vision-scope` §5)

**Cách dùng:** mỗi dòng có ID bền vững. Cột **Mốc** là mốc xây (`build-plan`), **BR** là quy tắc chi phối (`business-rules`), **Kiểm thử** là ca chứng minh (`golden-scenarios`/`test-plan`). Cột **✓** để đánh `☑` khi mốc hoàn thành và đã qua DoD. "Gốc" = có trong bản yêu cầu ban đầu; "Bổ sung" = thêm từ phiên xác nhận hoặc do phân tích (lý do ghi ở cột Yêu cầu).

Các nhóm: DASH · UNIT · PUR · STK · SALE · COST · REP · PART · CUS · SUP · FIN · RPT · SEC · BAK · RSV · TRD · COL · PLAT.

## 1. DASH — Tổng quan (module `reports`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-DASH-01 | Tổng doanh thu theo ngày, tháng, năm | M8 | BR-SALE-12, BR-REP-07, BR-FIN-04 | SC-10 | ☐ |
| FR-DASH-02 | Tổng số đồng hồ đang tồn kho (theo định nghĩa "tồn kho") | M8 | BR-UNIT-04 | SC-10 | ☐ |
| FR-DASH-03 | Tổng giá trị hàng tồn theo giá vốn | M8 | BR-COST-01, BR-COST-06 | SC-01, SC-10 | ☐ |
| FR-DASH-04 | Tổng lợi nhuận gộp (bán hàng + sửa chữa) | M8 | BR-COST-02, BR-REP-09 | SC-10, SC-08 | ☐ |
| FR-DASH-05 | Tổng tiền thu và chi (thực thu / thực chi, tách theo mục đích) | M8 | BR-FIN-01, BR-FIN-04 | SC-10 | ☐ |
| FR-DASH-06 | Danh sách đơn hàng mới nhất | M8 | — | UAT-05 | ☐ |
| FR-DASH-07 | Danh sách đồng hồ đang sửa chữa | M8 | BR-REP-03 | SC-08 | ☐ |
| FR-DASH-08 | Cảnh báo hàng/linh kiện sắp hết, tồn kho lâu ngày | M8 | BR-PART-04, BR-INV-04 | SC-14 | ☐ |
| FR-DASH-09 | Biểu đồ doanh thu và lợi nhuận | M8 | — | UAT-05 | ☐ |
| FR-DASH-10 | Tổng số đồng hồ đã bán | M8 | BR-SALE-12 | SC-10 | ☐ |
| FR-DASH-11 | Bổ sung: widget **hiển thị theo quyền** (không có `profit.view` thì không thấy lãi; CTV/thợ có trang chủ riêng) | M8 | BR-SEC-02 | PT-01 | ☐ |

## 2. UNIT — Quản lý đồng hồ (module `catalog`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-UNIT-01 | Thêm, sửa, xem thông tin đồng hồ; "xóa" = chỉ khi chưa phát sinh giao dịch, ngược lại ngừng kinh doanh/thanh lý. **"Thêm" = Nhập nhanh một chiếc** (phiếu nhập 1 dòng) để giá vốn luôn có nguồn | M1, M4 | BR-GEN-03, BR-UNIT-06, BR-UNIT-07, BR-PUR-04 | UAT-01 | ☐ |
| FR-UNIT-02 | Mã sản phẩm riêng cho từng **loại** đồng hồ (`watch_models.code`) | M1 | BR-UNIT-01 | UAT-01 | ☐ |
| FR-UNIT-03 | Số serial riêng từng chiếc; **mã nội bộ** (tem QR) là định danh chính (Bổ sung: đồng hồ cũ có thể thiếu/trùng serial) | M1 | BR-UNIT-01, BR-UNIT-02 | CT-09 | ☐ |
| FR-UNIT-04 | Thương hiệu, model, mã máy (caliber), xuất xứ, thông số kỹ thuật | M1 | — | UAT-01 | ☐ |
| FR-UNIT-05 | Lưu ảnh sản phẩm và tình trạng thực tế (EXIF GPS bị xóa, có ảnh thu nhỏ) | M1 | BR-UNIT-09 | UAT-01 | ☐ |
| FR-UNIT-06 | Giá nhập, giá vốn (chỉ người có quyền), giá bán niêm yết, giá khuyến mãi theo khoảng ngày | M1, M4 | BR-UNIT-05, BR-COST-06 | SC-02 | ☐ |
| FR-UNIT-07 | Phân loại đồng hồ mới / cũ / đã sửa chữa, kèm hạng tình trạng (cũ, đã sửa) | M1 | BR-UNIT-10 | UAT-01 | ☐ |
| FR-UNIT-08 | Quản lý phụ kiện đi kèm (hộp, giấy tờ, thẻ bảo hành, dây phụ…) và hạn bảo hành của hãng | M1 | — | UAT-01 | ☐ |
| FR-UNIT-09 | Tìm kiếm theo tên, thương hiệu, model, mã sản phẩm, mã nội bộ hoặc serial (không dấu, gõ sai nhẹ vẫn ra) | M1 | — | UAT-01 | ☐ |
| FR-UNIT-10 | Theo dõi lịch sử thay đổi giá và tình trạng/trạng thái sản phẩm | M1 | BR-UNIT-03, BR-UNIT-05 | UAT-01 | ☐ |
| FR-UNIT-11 | Quản lý vị trí lưu kho (két, tủ, trưng bày, xưởng…) và lịch sử di chuyển | M1 | BR-UNIT-08 | UAT-01 | ☐ |
| FR-UNIT-12 | Bổ sung: in **tem QR** (mã nội bộ) và quét QR/mã vạch bằng camera để tra cứu | M1 | — | UAT-01 | ☐ |
| FR-UNIT-13 | Bổ sung: cờ `collab_visible` — chủ chọn chiếc nào CTV được thấy | M1 | BR-SEC-08 | PT-02 | ☐ |

## 3. PUR — Nhập hàng (module `purchasing`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PUR-01 | Tạo phiếu nhập hàng (nháp → xác nhận) | M4 | BR-PUR-01, BR-GEN-02 | SC-01 | ☐ |
| FR-PUR-02 | Nhập từ nhà cung cấp hoặc **thu mua từ khách** (kèm thông tin người bán, CCCD mã hóa, ảnh giấy tờ) | M4 | BR-PUR-01, BR-PUR-09 | UAT-02 | ☐ |
| FR-PUR-03 | Lưu ngày nhập, người nhập, nguồn hàng (ngày chứng từ theo giờ VN, không ở tương lai, không ở kỳ đã khóa) | M4 | BR-PUR-01, BR-GEN-08 | UAT-02 | ☐ |
| FR-PUR-04 | Nhập mã sản phẩm (loại), serial, số lượng, giá nhập (đồng hồ: 1 dòng/chiếc; linh kiện: số lượng) | M4 | BR-PUR-02 | SC-01 | ☐ |
| FR-PUR-05 | Ghi nhận chi phí vận chuyển, kiểm định, sửa chữa trước nhập và chi phí liên quan; phân bổ vào giá vốn | M4 | BR-PUR-03, BR-PUR-05 | SC-01, SC-11 | ☐ |
| FR-PUR-06 | Tự động tính tổng tiền nhập | M4 | BR-PUR-03 | SC-01 | ☐ |
| FR-PUR-07 | Tự động cập nhật tồn kho khi xác nhận phiếu (tạo từng chiếc + mã nội bộ; cộng linh kiện) | M4 | BR-PUR-04 | SC-01 | ☐ |
| FR-PUR-08 | Quản lý công nợ nhà cung cấp trên từng phiếu | M4 | BR-PUR-06, BR-FIN-06 | SC-01 | ☐ |
| FR-PUR-09 | In hoặc xuất phiếu nhập ra Excel/PDF | M4 | — | UAT-02 | ☐ |
| FR-PUR-10 | Tra cứu lịch sử nhập hàng (lọc theo ngày, NCC, người nhập, trạng thái) | M4 | — | UAT-02 | ☐ |
| FR-PUR-11 | Hủy hoặc điều chỉnh phiếu nhập theo quyền hạn, có nhật ký (hủy khi chưa phát sinh giao dịch; điều chỉnh giá vốn bằng bút toán) | M4 | BR-PUR-07, BR-PUR-08, BR-COST-05, BR-GEN-05 | SC-17, CT-12 | ☐ |
| FR-PUR-12 | Bổ sung: phiếu **tồn đầu kỳ** (`opening`) để đưa hàng có sẵn vào hệ thống | M4 | BR-PUR-11 | UAT-02 | ☐ |
| FR-PUR-13 | Bổ sung: nhập lại chiếc đã từng bán (khách bán lại/thu cũ đổi mới) dùng lại đúng chiếc, tăng chu kỳ giá vốn | M4, M5 | BR-PUR-10 | SC-06 | ☐ |

## 4. STK — Quản lý kho (module `inventory`, `catalog`, `parts`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-STK-01 | Theo dõi số lượng tồn kho theo thời gian thực | M1, M8 | BR-UNIT-04, BR-PART-01 | SC-10 | ☐ |
| FR-STK-02 | Quản lý từng chiếc đồng hồ theo serial/mã nội bộ (một trạng thái hợp lệ tại một thời điểm) | M1 | BR-UNIT-03 | CT-01 | ☐ |
| FR-STK-03 | Quản lý linh kiện riêng với đồng hồ hoàn chỉnh (theo số lượng) | M1 | BR-PART-01 | SC-10 | ☐ |
| FR-STK-04 | Tự động trừ kho khi bán hàng | M5 | BR-SALE-08 | SC-02 | ☐ |
| FR-STK-05 | Tự động hoàn kho khi trả hàng hợp lệ | M5 | BR-RET-03 | SC-07 | ☐ |
| FR-STK-06 | Kiểm kê và điều chỉnh tồn kho | M7 | BR-INV-01, BR-INV-03 | SC-14 | ☐ |
| FR-STK-07 | Ghi nhận lý do chênh lệch kho | M7 | BR-INV-02 | SC-14 | ☐ |
| FR-STK-08 | Cảnh báo linh kiện/hàng hóa sắp hết | M7 | BR-PART-04 | SC-14 | ☐ |
| FR-STK-09 | Báo cáo hàng tồn lâu ngày | M8 | BR-INV-04 | SC-14 | ☐ |
| FR-STK-10 | Tra cứu lịch sử nhập, xuất và điều chỉnh kho | M7 | BR-PART-05, BR-UNIT-03 | UAT-04 | ☐ |

## 5. SALE — Bán hàng và tính tiền (module `sales`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-SALE-01 | Tạo hóa đơn (phiếu) bán hàng nhanh (POS trên điện thoại) | M5 | BR-SALE-01 | SC-02 | ☐ |
| FR-SALE-02 | Tìm sản phẩm theo tên, mã hoặc serial; quét QR | M5 | — | UAT-03 | ☐ |
| FR-SALE-03 | Tự động lấy giá bán (giá hiệu lực: khuyến mãi nếu đang hiệu lực) và thông tin sản phẩm | M5 | BR-UNIT-05 | SC-02 | ☐ |
| FR-SALE-04 | Cho phép điều chỉnh giảm giá theo quyền hạn (hạn mức % của vai trò; bán dưới giá vốn cần quyền riêng) | M5 | BR-SALE-03, BR-SALE-04 | PT-11 | ☐ |
| FR-SALE-05 | Tự động tính tổng tiền hàng, giảm giá và số tiền phải trả | M5 | BR-SALE-05, BR-SALE-13 | SC-02 | ☐ |
| FR-SALE-06 | Nhập số tiền khách đưa và tự tính tiền thừa | M5 | BR-SALE-06 | SC-03 | ☐ |
| FR-SALE-07 | Hỗ trợ tiền mặt, chuyển khoản và thanh toán kết hợp | M5 | BR-SALE-06 | SC-02 | ☐ |
| FR-SALE-08 | Cho phép ghi nhận khách nợ một phần hoặc toàn bộ (kèm hạn hẹn trả) | M5 | BR-SALE-07 | SC-04 | ☐ |
| FR-SALE-09 | In hóa đơn (phiếu) bán hàng; in lại có đánh dấu | M5 | BR-SALE-11 | UAT-03 | ☐ |
| FR-SALE-10 | Lưu thông tin khách hàng gắn phiếu | M5 | BR-SALE-07 | UAT-03 | ☐ |
| FR-SALE-11 | Tự động cập nhật trạng thái sản phẩm và tồn kho khi chốt đơn (một giao dịch) | M5 | BR-SALE-08 | SC-02, CT-01 | ☐ |
| FR-SALE-12 | Hỗ trợ đổi trả hàng và hoàn tiền có kiểm soát (đổi hàng = đổi trả + phiếu bán mới) | M5 | BR-RET-01, BR-RET-02, BR-RET-03, BR-RET-04, BR-RET-05, BR-RET-06, BR-RET-07, BR-SALE-09 | SC-07 | ☐ |
| FR-SALE-13 | Tra cứu lịch sử hóa đơn | M5 | — | UAT-03 | ☐ |
| FR-SALE-14 | **Không cho phép bán** một chiếc đã được bán/đang giữ cho khách khác | M5 | BR-SALE-02 | CT-01, CT-03 | ☐ |
| FR-SALE-15 | Bổ sung: hủy phiếu bán (như chưa xảy ra) trong cửa sổ cho phép | M5 | BR-SALE-10 | SC-15 | ☐ |
| FR-SALE-16 | Bổ sung: bán linh kiện/phụ kiện lẻ (dây, núm…) cùng phiếu | M5 | BR-SALE-14 | SC-10 | ☐ |

## 6. COST — Giá vốn và lợi nhuận (module `purchasing`, `sales`, `repairs`, `reports`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-COST-01 | Tự động tính giá vốn từng chiếc đồng hồ | M4 | BR-COST-01 | SC-01 | ☐ |
| FR-COST-02 | Ghi nhận giá mua và các chi phí trực tiếp liên quan | M4 | BR-PUR-03, BR-PUR-05 | SC-01 | ☐ |
| FR-COST-03 | Tính giá vốn sau khi sửa chữa/thay linh kiện trước khi bán (sửa nội bộ vốn hóa) | M6 | BR-COST-04, BR-REP-11 | SC-09 | ☐ |
| FR-COST-04 | Tính lãi gộp từng sản phẩm | M5, M8 | BR-COST-02 | SC-02 | ☐ |
| FR-COST-05 | Tính lãi gộp từng hóa đơn | M5, M8 | BR-COST-02 | SC-02 | ☐ |
| FR-COST-06 | Theo dõi lợi nhuận theo ngày, tháng, năm | M8 | BR-COST-02 | SC-10 | ☐ |
| FR-COST-07 | Phân biệt doanh thu, tiền thực thu và lợi nhuận | M3, M8 | BR-FIN-04 | SC-10 | ☐ |
| FR-COST-08 | Không tính tiền thu hộ hoặc khoản vay thành doanh thu bán hàng | M3 | BR-FIN-04 | SC-13 | ☐ |
| FR-COST-09 | Lịch sử điều chỉnh giá vốn và lý do điều chỉnh | M4 | BR-COST-05 | SC-17 | ☐ |

## 7. REP — Sửa chữa và bảo dưỡng (module `repairs`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-REP-01 | Tạo phiếu nhận đồng hồ sửa chữa | M6 | BR-REP-01, BR-REP-02 | SC-08 | ☐ |
| FR-REP-02 | Ghi tên khách hàng, số điện thoại, ngày nhận | M6 | BR-REP-02 | SC-08 | ☐ |
| FR-REP-03 | Ghi thương hiệu, model, serial và tình trạng ban đầu | M6 | BR-REP-02 | SC-08 | ☐ |
| FR-REP-04 | Chụp ảnh hiện trạng khi nhận đồng hồ (bất biến, có SHA-256) | M6 | BR-REP-14 | UAT-06 | ☐ |
| FR-REP-05 | Ghi lỗi khách mô tả và nội dung kiểm tra của thợ | M6 | BR-REP-02 | SC-08 | ☐ |
| FR-REP-06 | Ghi công việc cần làm, linh kiện cần thay và báo giá; ghi nhận khách đồng ý báo giá | M6 | BR-REP-04 | SC-08 | ☐ |
| FR-REP-07 | Quản lý trạng thái: đã nhận, đang kiểm tra, đang sửa, chờ linh kiện, hoàn thành, đã giao (+ hủy) | M6 | BR-REP-03 | SC-08 | ☐ |
| FR-REP-08 | Phân công thợ sửa chữa | M6 | BR-REP-03 | SC-08 | ☐ |
| FR-REP-09 | Ghi tiền công, chi phí linh kiện và tổng tiền sửa | M6 | BR-REP-07, BR-REP-09 | SC-08 | ☐ |
| FR-REP-10 | Theo dõi tiền đặt cọc và số tiền còn phải thu | M6 | BR-REP-05 | SC-08 | ☐ |
| FR-REP-11 | Quản lý thời hạn bảo hành sau sửa chữa; bảo hành = phiếu sửa miễn phí liên kết | M6 | BR-REP-10 | SC-08 | ☐ |
| FR-REP-12 | Lưu lịch sử sửa chữa theo serial (hợp nhất máy khách và máy của shop) | M6 | BR-REP-13 | UAT-06 | ☐ |
| FR-REP-13 | In phiếu nhận đồng hồ và phiếu giao trả | M6 | — | UAT-06 | ☐ |
| FR-REP-14 | Tự động trừ linh kiện trong kho khi xác nhận sử dụng | M6 | BR-PART-03, BR-REP-06 | SC-08, CT-04 | ☐ |
| FR-REP-15 | Bổ sung: sửa **nội bộ** đồng hồ của shop (chi phí vốn hóa vào giá vốn, không có doanh thu) | M6 | BR-REP-01, BR-REP-11 | SC-09 | ☐ |
| FR-REP-16 | Bổ sung: tiền công thợ theo từng thợ (`percent` / `fixed_per_service` / `salary`) | M6 | BR-REP-08 | SC-08 | ☐ |
| FR-REP-17 | Bổ sung: cảnh báo máy đã hoàn thành nhưng khách chưa đến lấy | M7 | BR-REP-12 | UAT-06 | ☐ |

## 8. PART — Quản lý linh kiện (module `parts`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PART-01 | Quản lý kim, núm, ron, kính sapphire, dây, chốt, bộ máy, linh kiện khác (danh mục loại tùy chỉnh) | M1 | — | UAT-04 | ☐ |
| FR-PART-02 | Mỗi linh kiện có mã riêng | M1 | — | UAT-04 | ☐ |
| FR-PART-03 | Lưu thương hiệu, model tương thích và thông số kỹ thuật | M1 | BR-PART-06 | UAT-04 | ☐ |
| FR-PART-04 | Quản lý giá nhập (bình quân gia quyền), giá bán và tồn kho | M1, M4 | BR-PART-02 | SC-10 | ☐ |
| FR-PART-05 | Quản lý nhà cung cấp mặc định của linh kiện | M2 | — | UAT-04 | ☐ |
| FR-PART-06 | Theo dõi lịch sử nhập và xuất linh kiện | M1, M4 | BR-PART-05 | UAT-04 | ☐ |
| FR-PART-07 | Ghi nhận linh kiện sử dụng cho từng phiếu sửa chữa | M6 | BR-PART-03 | SC-08 | ☐ |
| FR-PART-08 | Tính chi phí linh kiện theo từng ca sửa | M6 | BR-PART-02, BR-REP-09 | SC-08 | ☐ |
| FR-PART-09 | Cảnh báo khi số lượng linh kiện xuống thấp (ngưỡng theo từng linh kiện) | M7 | BR-PART-04 | SC-14 | ☐ |

## 9. CUS — Quản lý khách hàng (module `partners`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-CUS-01 | Lưu tên, số điện thoại, email, địa chỉ và thông tin liên hệ | M2 | — | UAT-03 | ☐ |
| FR-CUS-02 | Lưu lịch sử mua hàng | M2, M5 | — | UAT-03 | ☐ |
| FR-CUS-03 | Lưu lịch sử sửa chữa, bảo dưỡng và bảo hành | M2, M6 | — | UAT-06 | ☐ |
| FR-CUS-04 | Theo dõi số tiền khách còn nợ (và cọc đang giữ) | M5 | BR-FIN-05 | SC-04 | ☐ |
| FR-CUS-05 | Theo dõi lịch sử thanh toán | M3, M5 | — | SC-04 | ☐ |
| FR-CUS-06 | Tìm kiếm khách hàng nhanh (tên/SĐT, không dấu) | M2 | — | UAT-03 | ☐ |
| FR-CUS-07 | Phân loại khách hàng theo nhóm | M2 | — | UAT-03 | ☐ |
| FR-CUS-08 | Tra cứu toàn bộ giao dịch theo khách hàng | M5, M6 | — | UAT-03 | ☐ |

## 10. SUP — Quản lý nhà cung cấp (module `partners`, `purchasing`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-SUP-01 | Lưu thông tin nhà cung cấp | M2 | — | UAT-02 | ☐ |
| FR-SUP-02 | Quản lý lịch sử nhập hàng theo NCC | M4 | — | UAT-02 | ☐ |
| FR-SUP-03 | Theo dõi số tiền đã thanh toán và còn nợ | M4 | BR-FIN-06 | SC-01 | ☐ |
| FR-SUP-04 | Ghi nhận các lần thanh toán công nợ (phân bổ vào phiếu) | M3, M4 | BR-PUR-06, BR-FIN-07 | SC-01 | ☐ |
| FR-SUP-05 | Tra cứu công nợ theo từng nhà cung cấp | M4 | BR-FIN-06 | SC-01 | ☐ |
| FR-SUP-06 | Xuất báo cáo công nợ | M8 | BR-FIN-06 | UAT-02 | ☐ |

## 11. FIN — Quản lý thu chi (module `finance`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-FIN-01 | Ghi nhận tiền thu từ bán hàng | M3, M5 | BR-FIN-01 | SC-02 | ☐ |
| FR-FIN-02 | Ghi nhận tiền thu từ sửa chữa | M3, M6 | BR-FIN-01 | SC-08 | ☐ |
| FR-FIN-03 | Ghi nhận tiền thu nợ khách hàng (phân bổ nhiều phiếu) | M3, M5 | BR-FIN-07 | SC-04 | ☐ |
| FR-FIN-04 | Ghi nhận tiền chi nhập hàng, linh kiện, vận chuyển và chi phí khác (theo hạng mục) | M3, M4 | BR-FIN-01, BR-FIN-11 | SC-01 | ☐ |
| FR-FIN-05 | Quản lý quỹ tiền mặt và tài khoản chuyển khoản (số dư đầu kỳ, chuyển quỹ) | M3 | BR-FIN-08, BR-FIN-13 | SC-16 | ☐ |
| FR-FIN-06 | Theo dõi tiền đặt cọc, hoàn tiền và thanh toán công nợ | M3, M5 | BR-RSV-03, BR-FIN-05 | SC-05 | ☐ |
| FR-FIN-07 | Báo cáo thu chi theo ngày, tháng, năm | M8 | BR-FIN-09 | SC-16 | ☐ |
| FR-FIN-08 | Đối chiếu số dư đầu kỳ, thu, chi và số dư cuối kỳ; khóa kỳ | M3 | BR-FIN-09 | SC-16, CT-06 | ☐ |
| FR-FIN-09 | Bổ sung: điều chỉnh quỹ (lệch kiểm quỹ) bằng bút toán có lý do | M3 | BR-FIN-12 | SC-16 | ☐ |
| FR-FIN-10 | Bổ sung: hủy phiếu thu/chi bằng bút toán đảo | M3 | BR-FIN-10 | SC-15 | ☐ |

## 12. RPT — Báo cáo và xuất Excel (module `reports`)

Định nghĩa chi tiết từng báo cáo: `02-domain/reports-and-dashboard.md`.

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-RPT-01 | Báo cáo doanh thu | M8 | BR-SALE-12 | SC-10 | ☐ |
| FR-RPT-02 | Báo cáo lợi nhuận gộp | M8 | BR-COST-02 | SC-10 | ☐ |
| FR-RPT-03 | Báo cáo nhập hàng và xuất hàng | M8 | — | UAT-07 | ☐ |
| FR-RPT-04 | Báo cáo tồn kho theo giá vốn | M8 | BR-COST-01 | SC-10 | ☐ |
| FR-RPT-05 | Báo cáo hàng tồn lâu ngày | M8 | BR-INV-04 | SC-14 | ☐ |
| FR-RPT-06 | Báo cáo công nợ khách hàng và nhà cung cấp | M8 | BR-FIN-05, BR-FIN-06 | SC-04 | ☐ |
| FR-RPT-07 | Báo cáo doanh thu sửa chữa và tiền công thợ | M8 | BR-REP-08, BR-REP-09 | SC-08 | ☐ |
| FR-RPT-08 | Báo cáo thu chi và số dư tiền | M8 | BR-FIN-09 | SC-16 | ☐ |
| FR-RPT-09 | Lọc báo cáo theo khoảng thời gian | M8 | — | UAT-07 | ☐ |
| FR-RPT-10 | Xuất Excel/PDF để lưu trữ và đối chiếu (theo đúng quyền xem) | M8 | BR-SEC-02 | PT-05 | ☐ |
| FR-RPT-11 | Bổ sung: báo cáo hoa hồng CTV; hao hụt kiểm kê; bảo hành sắp hết hạn | M8 | BR-COM-*, BR-INV-02 | SC-12, SC-14 | ☐ |

## 13. SEC — Tài khoản và phân quyền (module `iam`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-SEC-01 | Đăng nhập, đăng xuất và đổi mật khẩu | M0 | BR-SEC-04, BR-SEC-06 | PT-07 | ☐ |
| FR-SEC-02 | Phân quyền: chủ cửa hàng, nhân viên bán hàng, thợ sửa chữa, quản lý kho, cộng tác viên (vai trò là dữ liệu, chỉnh được) | M0 | BR-SEC-01 | PT-01…04 | ☐ |
| FR-SEC-03 | Giới hạn quyền xem giá vốn, lợi nhuận và công nợ | M0, M4 | BR-SEC-02, BR-COST-06 | PT-01, PT-05 | ☐ |
| FR-SEC-04 | Giới hạn quyền giảm giá, hủy hóa đơn và điều chỉnh kho | M0, M5, M7 | BR-SALE-03, BR-SALE-10, BR-PART-05 | PT-11 | ☐ |
| FR-SEC-05 | Lưu nhật ký người tạo, sửa, xác nhận hoặc hủy giao dịch; nhật ký không sửa/xóa được kể cả với chủ cửa hàng | M0 | BR-GEN-04, BR-SEC-05 | PT-08 | ☐ |
| FR-SEC-06 | Không xóa vĩnh viễn giao dịch tài chính đã xác nhận (chỉ đảo/hủy có kiểm soát) | M0, M3 | BR-GEN-03, BR-FIN-02 | PT-09 | ☐ |
| FR-SEC-07 | **Giới hạn quyền xem của cộng tác viên** (chỉ hàng được phép + giá bán; chỉ đơn/khách của mình; không giá vốn/lãi) | M5 | BR-SEC-08, BR-SALE-15 | PT-02, PT-03 | ☐ |
| FR-SEC-08 | Bổ sung: MFA (TOTP) bắt buộc cho chủ cửa hàng; khóa tạm sau 5 lần sai | M0 | BR-SEC-04 | PT-07 | ☐ |
| FR-SEC-09 | Bổ sung: luôn còn ít nhất một chủ cửa hàng hoạt động | M0 | BR-SEC-07 | PT-10 | ☐ |

## 14. BAK — Sao lưu và bảo mật (module `ops`, nền tảng)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-BAK-01 | Sao lưu dữ liệu tự động theo lịch (hằng đêm, mã hóa) | M0, M9 | BR-BAK-01 | UAT-09 | ☐ |
| FR-BAK-02 | Hỗ trợ khôi phục dữ liệu từ bản sao lưu (có diễn tập) | M9 | BR-BAK-03 | UAT-09 | ☐ |
| FR-BAK-03 | Bảo vệ tài khoản và mật khẩu (Argon2id, khóa tạm, MFA) | M0 | BR-SEC-04 | PT-07 | ☐ |
| FR-BAK-04 | Phân quyền truy cập theo tài khoản | M0 | BR-SEC-01 | PT-01…04 | ☐ |
| FR-BAK-05 | Bảo vệ dữ liệu khách hàng (PII mã hóa, xem có lý do + audit) | M0, M2 | BR-SEC-03 | PT-12 | ☐ |
| FR-BAK-06 | Cơ chế hạn chế mất dữ liệu khi mất kết nối/lỗi hệ thống (nháp tự lưu, gửi lại idempotent, banner mất mạng) | M0, M5 | BR-GEN-09 | CT-07, UAT-08 | ☐ |
| FR-BAK-07 | Tối ưu sử dụng trên điện thoại và máy tính (PWA, mobile-first) | M0…M9 | — | UAT-08 | ☐ |
| FR-BAK-08 | Hướng dẫn sử dụng và bàn giao mã nguồn | M9 | — | UAT-10 | ☐ |

## 15. RSV — Giữ hàng / đặt cọc (module `sales`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-RSV-01 | Giữ một chiếc cho khách với hạn giữ và tiền cọc tối thiểu | M5 | BR-RSV-01, BR-RSV-02 | SC-05, CT-02 | ☐ |
| FR-RSV-02 | Tiền cọc là khoản nhận trước, không phải doanh thu | M5 | BR-RSV-03 | SC-05 | ☐ |
| FR-RSV-03 | Chuyển giữ hàng thành phiếu bán (cọc trừ vào phiếu) | M5 | BR-RSV-04 | SC-05 | ☐ |
| FR-RSV-04 | Hủy giữ: hoàn cọc hoặc tịch thu (thu nhập khác) có lý do; nhắc giữ hàng quá hạn | M5, M7 | BR-RSV-05 | SC-05 | ☐ |

## 16. TRD — Thu cũ đổi mới (module `sales`, `purchasing`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-TRD-01 | Trong phiếu bán, thêm đồng hồ cũ của khách với giá thu; trừ vào số phải trả | M5 | BR-TRD-01, BR-TRD-02 | SC-06 | ☐ |
| FR-TRD-02 | Máy thu về tự nhập kho (phiếu nhập `trade_in`) với giá vốn = giá thu | M5 | BR-TRD-03 | SC-06 | ☐ |
| FR-TRD-03 | Lưu thông tin người bán/giấy tờ theo quy định cửa hàng | M5 | BR-PUR-09, BR-TRD-04 | SC-06 | ☐ |

## 17. COL — Cộng tác viên & hoa hồng (module `sales`, `iam`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-COL-01 | Hồ sơ CTV: cách tính hoa hồng (`percent_of_price` / `percent_of_profit` / `fixed_per_unit`) | M5 | BR-COM-01 | SC-12 | ☐ |
| FR-COL-02 | CTV xem hàng được phép (ảnh, thông số, giá bán), lập đơn nháp cho khách của mình | M5 | BR-SALE-15, BR-SEC-08 | PT-02, PT-03 | ☐ |
| FR-COL-03 | Nhân viên xác nhận đơn CTV; hoa hồng được chốt khi xác nhận và trả khi phiếu thu đủ | M5 | BR-COM-01, BR-COM-02 | SC-12 | ☐ |
| FR-COL-04 | Chi trả hoa hồng qua phiếu chi; đổi trả/hủy thì hủy hoa hồng (clawback nếu đã chi) | M5 | BR-COM-02, BR-COM-03 | SC-12 | ☐ |
| FR-COL-05 | CTV xem hoa hồng của chính mình; không thấy cơ sở tính (giá vốn/lãi) | M5 | BR-COM-04 | PT-03 | ☐ |

## 18. PLAT — Nền tảng (module `platform`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PLAT-01 | Cài đặt hệ thống (cửa hàng, ngưỡng, chính sách) có lịch sử thay đổi | M0 | BR-GEN-04 | UAT-10 | ☐ |
| FR-PLAT-02 | Thông báo trong ứng dụng (hết hàng, tồn lâu, nợ đến hạn, bảo hành sắp hết, giữ hàng quá hạn, máy chưa lấy) | M7 | — | UAT-04 | ☐ |
| FR-PLAT-03 | Sự kiện nghiệp vụ (`domain_events`) làm điểm mở rộng | M0 | — | UT-events | ☐ |
| FR-PLAT-04 | Giám sát: `/api/health`, `job_runs`, `error_events`, cảnh báo sao lưu | M0, M9 | BR-BAK-02 | UAT-09 | ☐ |
| FR-PLAT-05 | Hướng dẫn sử dụng trong ứng dụng theo vai trò; nhật ký phiên bản | M9 | — | UAT-10 | ☐ |
| FR-PLAT-06 | Cài lên màn hình chính điện thoại (PWA) | M0 | — | UAT-08 | ☐ |

## Phụ lục — Đối chiếu mục III & V của bản gốc

| Mục gốc | Nội dung | Được đáp ứng bởi |
|---|---|---|
| III.1 | Serial riêng, một trạng thái tồn kho hợp lệ | BR-UNIT-01…04, CT-01 |
| III.2 | Giá vốn gồm giá mua + chi phí trực tiếp, phân bổ thống nhất | BR-PUR-05, BR-COST-01, costing-and-profit |
| III.3 | Lãi gộp = doanh thu sau giảm giá − giá vốn | BR-COST-02, SC-02 |
| III.4 | Tiền công, linh kiện, lợi nhuận sửa chữa theo dõi riêng, không trùng | BR-REP-09, SC-08 |
| III.5 | Chứng từ xác nhận có lịch sử sửa/hủy | BR-GEN-02, BR-GEN-04 |
| III.6 | Cập nhật hóa đơn–kho–tiền đồng bộ | `fn_*` nguyên tử, integrity-and-concurrency, CT-* |
| III.7 | Dữ liệu thử nghiệm trước khi dùng thật | `db/seed`, golden-scenarios, UAT |
| V | Tiêu chí nghiệm thu | `06-quality/uat-acceptance` |
