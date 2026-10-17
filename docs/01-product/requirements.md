# Yêu cầu chức năng (FR)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo phản hồi khách vòng 1 — `customer-feedback-01`) · Nguồn: bản yêu cầu gốc (14 nhóm) + bổ sung đã chốt (`vision-scope` §5)

**Cách dùng:** mỗi dòng có ID bền vững. Cột **Mốc** là mốc xây (`build-plan`), **BR** là quy tắc chi phối (`business-rules`), **Kiểm thử** là ca chứng minh (`golden-scenarios`/`test-plan`). Cột **✓** để đánh `☑` khi mốc hoàn thành và đã qua DoD. "Bổ sung" = thêm từ phiên xác nhận/phản hồi khách hoặc do phân tích.
**Yêu cầu đã bỏ/hoãn** (không xây, giữ ID để truy vết): xem §Hoãn cuối file.

Các nhóm: DASH · UNIT · PUR · STK · SALE · COST · REP · PART · CUS · PAY · RPT · SEC · BAK · RSV · TRD · WAR · COL · PLAT · IMP · NAV.

## 1. DASH — Tổng quan (module `reports`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-DASH-01 | Tổng doanh thu theo ngày, tháng, năm (cửa hàng; dòng CTV bán tính theo giá thu) | M8 | BR-SALE-12, BR-COL-04 | SC-10, SC-12 | ☑ |
| FR-DASH-02 | Tổng số đồng hồ đang tồn kho (gồm chiếc "đang ở CTV" hiển thị riêng) | M8 | BR-UNIT-04 | SC-10 | ☑ |
| FR-DASH-03 | Tổng giá trị hàng tồn theo giá vốn | M8 | BR-COST-01, BR-COST-06 | SC-01, SC-10 | ☑ |
| FR-DASH-04 | Tổng lợi nhuận gộp (bán hàng + sửa chữa) | M8 | BR-COST-02, BR-REP-09 | SC-10, SC-08 | ☑ |
| FR-DASH-05 | Tổng tiền thu (thực thu theo tiền mặt / chuyển khoản) | M8 | BR-PAY-07 | SC-10 | ☑ |
| FR-DASH-06 | Danh sách đơn hàng mới nhất | M8 | — | UAT-05 | ☑ |
| FR-DASH-07 | Danh sách đồng hồ đang sửa chữa | M8 | BR-REP-03 | SC-08 | ☑ |
| FR-DASH-08 | Cảnh báo hàng/linh kiện sắp hết, tồn kho lâu ngày | M8 | BR-PART-04, BR-INV-04 | SC-14 | ☑ |
| FR-DASH-09 | Biểu đồ doanh thu và lợi nhuận | M8 | — | UAT-05 | ☑ |
| FR-DASH-10 | Tổng số đồng hồ đã bán | M8 | BR-SALE-12 | SC-10 | ☑ |
| FR-DASH-11 | Bổ sung: widget **hiển thị theo quyền** (không có `profit.view` thì không thấy lãi; CTV có trang chủ riêng) | M8 | BR-SEC-02 | PT-01 | ☑ |
| FR-DASH-12 | Bổ sung: hàng đang ở CTV và số CTV chưa nộp (chủ) | M8 | BR-COL-11 | SC-12 | ☑ |

## 2. UNIT — Quản lý đồng hồ (module `catalog`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-UNIT-01 | Thêm, sửa, xem thông tin đồng hồ; "xóa" = chỉ khi chưa phát sinh giao dịch, ngược lại ngừng kinh doanh/thanh lý. **"Thêm" = Nhập nhanh một chiếc** (phiếu nhập 1 dòng) để giá vốn luôn có nguồn | M1, M4 | BR-GEN-03, BR-UNIT-06, BR-UNIT-07, BR-PUR-04 | UAT-01 | ☑ |
| FR-UNIT-02 | Mã sản phẩm riêng cho từng **loại** đồng hồ (`watch_models.code`) | M1 | BR-UNIT-01 | UAT-01 | ☑ |
| FR-UNIT-03 | Số serial riêng từng chiếc; **mã nội bộ** (tem QR) là định danh chính (đồng hồ cũ có thể thiếu/trùng serial) | M1 | BR-UNIT-01, BR-UNIT-02 | CT-09 | ☑ |
| FR-UNIT-04 | Thương hiệu, model, mã máy (caliber), xuất xứ, thông số kỹ thuật | M1 | — | UAT-01 | ☑ |
| FR-UNIT-05 | Lưu ảnh sản phẩm và tình trạng thực tế (EXIF GPS bị xóa, có ảnh thu nhỏ) | M1 | BR-UNIT-09 | UAT-01 | ☑ |
| FR-UNIT-06 | Giá nhập, giá vốn (= **giá thu**, chỉ người có quyền), giá bán niêm yết, giá khuyến mãi theo khoảng ngày | M1, M4 | BR-UNIT-05, BR-COST-06 | SC-02 | ☑ |
| FR-UNIT-07 | Phân loại đồng hồ mới, cũ, đã sửa chữa, kèm hạng tình trạng | M1 | BR-UNIT-10 | UAT-01 | ☑ |
| FR-UNIT-08 | Quản lý phụ kiện đi kèm và hạn bảo hành của hãng | M1 | BR-WAR-06 | UAT-01 | ☑ |
| FR-UNIT-09 | Tìm kiếm theo tên, thương hiệu, model, mã sản phẩm, mã nội bộ hoặc serial (không dấu, gõ sai nhẹ vẫn ra) | M1 | — | UAT-01 | ☑ |
| FR-UNIT-10 | Theo dõi lịch sử thay đổi giá và trạng thái sản phẩm | M1 | BR-UNIT-03, BR-UNIT-05 | UAT-01 | ☑ |
| FR-UNIT-11 | Quản lý vị trí lưu kho (két, tủ, trưng bày, xưởng…) và lịch sử di chuyển | M1 | BR-UNIT-08 | UAT-01 | ☑ |
| FR-UNIT-12 | Bổ sung: in **tem QR** (mã nội bộ) và quét QR/mã vạch bằng camera để tra cứu | M1 | — | UAT-01 | ☑ |
| FR-UNIT-13 | Bổ sung: trạng thái **"Đang ở CTV"** (vị trí = CTV); chỉ đổi qua phiếu giao/thu hồi/bán CTV | M5b | BR-UNIT-03, BR-UNIT-04, BR-COL-01 | SC-12, CT-06 | ☑ |

## 3. PUR — Nhập hàng (module `purchasing`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PUR-01 | Tạo phiếu nhập hàng (nháp → xác nhận) | M4 | BR-PUR-01, BR-GEN-02, BR-GEN-06 | SC-01 | ☑ |
| FR-PUR-02 | Nhập hàng **mua vào** (ghi nguồn hàng bằng chữ) hoặc **thu mua từ khách** (kèm thông tin người bán, CCCD mã hóa, ảnh giấy tờ) | M4 | BR-PUR-01, BR-PUR-09 | UAT-02 | ☑ |
| FR-PUR-03 | Lưu ngày nhập, người nhập, nguồn hàng (ngày giờ VN, không ở tương lai, lùi tối đa theo cấu hình) | M4 | BR-PUR-01, BR-GEN-08 | UAT-02 | ☑ |
| FR-PUR-04 | Nhập mã sản phẩm (loại), serial, số lượng, giá nhập (đồng hồ: 1 dòng/chiếc; linh kiện: số lượng) | M4 | BR-PUR-02 | SC-01 | ☑ |
| FR-PUR-05 | Ghi nhận chi phí vận chuyển, kiểm định, sửa trước nhập và chi phí liên quan; phân bổ vào giá vốn | M4 | BR-PUR-03, BR-PUR-05 | SC-01, SC-11 | ☑ |
| FR-PUR-06 | Tự động tính tổng tiền nhập | M4 | BR-PUR-03 | SC-01 | ☑ |
| FR-PUR-07 | Tự động cập nhật tồn kho khi xác nhận phiếu (tạo từng chiếc + mã nội bộ; cộng linh kiện) | M4 | BR-PUR-04 | SC-01 | ☑ |
| FR-PUR-08 | Ghi chú thanh toán tùy chọn trên phiếu (không theo dõi công nợ — CF-06) | M4 | BR-PUR-06 | SC-01 | ☑ |
| FR-PUR-09 | In hoặc xuất phiếu nhập Excel/PDF | M4 | — | UAT-02 | ☑ |
| FR-PUR-10 | Tra cứu lịch sử nhập hàng (lọc theo ngày, nguồn, người nhập, trạng thái) | M4 | — | UAT-02 | ☑ |
| FR-PUR-11 | Hủy hoặc điều chỉnh phiếu nhập theo quyền hạn, có nhật ký (hủy khi chưa phát sinh giao dịch; điều chỉnh giá vốn bằng bút toán) | M4 | BR-PUR-07, BR-PUR-08, BR-COST-05, BR-GEN-05 | SC-17, CT-12 | ☑ |
| FR-PUR-12 | Bổ sung: phiếu **tồn đầu kỳ** (`opening`) để đưa hàng có sẵn vào hệ thống | M4 | BR-PUR-11 | UAT-02 | ☑ |
| FR-PUR-13 | Bổ sung: nhập lại chiếc đã từng bán (khách bán lại/thu cũ đổi mới) dùng lại đúng chiếc, tăng chu kỳ giá vốn | M4, M5a | BR-PUR-10 | SC-06 | ☑ |

## 4. STK — Quản lý kho (module `inventory`, `catalog`, `parts`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-STK-01 | Theo dõi số lượng tồn kho theo thời gian thực | M1, M8 | BR-UNIT-04, BR-PART-01 | SC-10 | ☑ |
| FR-STK-02 | Quản lý từng chiếc đồng hồ theo serial/mã nội bộ (một trạng thái hợp lệ tại một thời điểm) | M1 | BR-UNIT-03 | CT-01 | ☑ |
| FR-STK-03 | Quản lý linh kiện riêng với đồng hồ hoàn chỉnh (theo số lượng) | M1 | BR-PART-01 | SC-10 | ☑ |
| FR-STK-04 | Tự động trừ kho khi bán hàng | M5a | BR-SALE-08 | SC-02 | ☑ |
| FR-STK-05 | Hoàn kho đúng quy tắc: **thu hồi hàng từ CTV**, hủy phiếu bán trong cửa sổ (không còn đổi trả) | M5a, M5b | BR-COL-07, BR-SALE-10 | SC-12, SC-15 | ☑ |
| FR-STK-06 | Kiểm kê và điều chỉnh tồn kho | M7 | BR-INV-01, BR-INV-03 | SC-14 | ☑ |
| FR-STK-07 | Ghi nhận lý do chênh lệch kho | M7 | BR-INV-02 | SC-14 | ☑ |
| FR-STK-08 | Cảnh báo linh kiện hoặc hàng hóa sắp hết | M7 | BR-PART-04 | SC-14 | ☑ |
| FR-STK-09 | Báo cáo hàng tồn lâu ngày | M8 | BR-INV-04 | SC-14 | ☑ |
| FR-STK-10 | Tra cứu lịch sử nhập, xuất và điều chỉnh kho | M7 | BR-PART-05, BR-UNIT-03 | UAT-04 | ☑ |

## 5. SALE — Bán hàng (module `sales`, `payments`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-SALE-01 | Tạo phiếu bán hàng nhanh (POS trên điện thoại) | M5a | BR-SALE-01 | SC-02 | ☑ |
| FR-SALE-02 | Tìm sản phẩm theo tên, mã hoặc serial; quét QR | M5a | — | UAT-03 | ☑ |
| FR-SALE-03 | Tự động lấy giá bán (giá hiệu lực: khuyến mãi nếu đang hiệu lực) và thông tin sản phẩm | M5a | BR-UNIT-05 | SC-02 | ☑ |
| FR-SALE-04 | Cho phép điều chỉnh giảm giá theo quyền hạn (hạn mức % của vai trò; bán dưới giá vốn cần quyền riêng) | M5a | BR-SALE-03, BR-SALE-04 | PT-11 | ☑ |
| FR-SALE-05 | Tự động tính tổng tiền hàng, giảm giá và số tiền phải trả | M5a | BR-SALE-05, BR-SALE-13 | SC-02 | ☑ |
| FR-SALE-06 | Nhập số tiền khách đưa và tự tính tiền thừa | M5a | BR-SALE-06 | SC-03 | ☑ |
| FR-SALE-07 | Hỗ trợ tiền mặt, chuyển khoản và thanh toán kết hợp | M5a | BR-SALE-06, BR-PAY-01 | SC-02 | ☑ |
| FR-SALE-08 | Cho phép ghi nhận khách nợ một phần hoặc toàn bộ (kèm hạn hẹn trả) | M5a | BR-SALE-07, BR-PAY-03 | SC-04 | ☑ |
| FR-SALE-09 | In phiếu bán hàng; in lại có đánh dấu | M5a | BR-SALE-11 | UAT-03 | ☑ |
| FR-SALE-12 | **PDF vector tiếng Việt** (A5, font nhúng) cho phiếu bán / phiếu nhận–giao máy sửa / phiếu bảo hành: Tải PDF, Chia sẻ (điện thoại); không lộ giá vốn/lãi; tải lại phiếu bán vẫn đánh dấu BẢN IN LẠI | M11 | BR-SALE-11, BR-SEC-02 | UAT-03 | ☑ |
| FR-SALE-10 | Lưu thông tin khách hàng gắn phiếu | M5a | BR-SALE-07 | UAT-03 | ☑ |
| FR-SALE-11 | Tự động cập nhật trạng thái sản phẩm và tồn kho khi chốt đơn (một giao dịch) | M5a | BR-SALE-08 | SC-02, CT-01 | ☑ |
| FR-SALE-12 | ~~Đổi trả hàng và hoàn tiền~~ → **thay bằng bảo hành** (FR-WAR-*) — CF-02 | — | BR-SALE-09 | — | — |
| FR-SALE-13 | Tra cứu lịch sử hóa đơn (lọc ngày, khách, người bán, còn nợ) | M5a | — | UAT-03 | ☑ |
| FR-SALE-14 | **Không cho phép bán** một chiếc đã được bán/đang giữ cho khách khác | M5a | BR-SALE-02 | CT-01, CT-03 | ☑ |
| FR-SALE-15 | Bổ sung: hủy phiếu bán (như chưa xảy ra) trong cửa sổ cho phép | M5a | BR-SALE-10 | SC-15, CT-08 | ☑ |
| FR-SALE-16 | Bổ sung: bán linh kiện/phụ kiện lẻ (dây, núm…) cùng phiếu | M5a | BR-SALE-14 | SC-10 | ☑ |
| FR-SALE-17 | Bổ sung: **thu thêm tiền** ngay trên phiếu còn nợ (thay màn công nợ) | M5a | BR-PAY-03, BR-PAY-04 | SC-04, CT-05 | ☑ |
| FR-SALE-18 | Bổ sung (CF-01): phiếu hiển thị **thông tin, giá thu và giá bán** (và lãi) cho người có quyền xem giá vốn | M5a | BR-SALE-16, BR-COST-06 | PT-01 | ☑ |

## 6. COST — Giá vốn và lợi nhuận (module `purchasing`, `sales`, `repairs`, `reports`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-COST-01 | Tự động tính giá vốn từng chiếc đồng hồ | M4 | BR-COST-01 | SC-01 | ☑ |
| FR-COST-02 | Ghi nhận giá mua và các chi phí trực tiếp liên quan | M4 | BR-PUR-03, BR-PUR-05 | SC-01 | ☑ |
| FR-COST-03 | Tính giá vốn sau khi sửa chữa/thay linh kiện trước khi bán (sửa nội bộ vốn hóa) | M6 | BR-COST-04, BR-REP-11 | SC-09 | ☑ |
| FR-COST-04 | Tính lãi gộp từng sản phẩm | M5a, M8 | BR-COST-02 | SC-02 | ☑ |
| FR-COST-05 | Tính lãi gộp từng hóa đơn | M5a, M8 | BR-COST-02 | SC-02 | ☑ |
| FR-COST-06 | Theo dõi lợi nhuận theo ngày, tháng, năm | M8 | BR-COST-02 | SC-10 | ☑ |
| FR-COST-07 | Phân biệt doanh thu, tiền thực thu và lợi nhuận | M3, M8 | BR-PAY-02, BR-PAY-07, BR-GEN-01 | SC-10, SC-13 | ☑ |
| FR-COST-09 | Lịch sử điều chỉnh giá vốn và lý do điều chỉnh | M4 | BR-COST-05 | SC-17 | ☑ |
| FR-COST-10 | Bổ sung: giá thu giao CTV **không phải** giá vốn; lãi gộp dòng CTV = giá thu − giá vốn | M5b | BR-COST-07, BR-COL-04 | SC-12 | ☑ |

## 7. REP — Sửa chữa và bảo dưỡng (module `repairs`) — chỉ chủ, gọn (CF-04/05)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-REP-01 | Tạo phiếu nhận đồng hồ sửa chữa | M6 | BR-REP-01, BR-REP-02 | SC-08 | ☑ |
| FR-REP-02 | Ghi tên khách hàng, số điện thoại, ngày nhận | M6 | BR-REP-02 | SC-08 | ☑ |
| FR-REP-03 | Ghi thương hiệu, model, serial và tình trạng ban đầu | M6 | BR-REP-02 | SC-08 | ☑ |
| FR-REP-04 | Chụp ảnh hiện trạng khi nhận (**tùy chọn**; đã lưu thì bất biến, có SHA-256) | M6 | BR-REP-14 | UAT-06 | ☑ |
| FR-REP-05 | Ghi lỗi khách mô tả và nội dung kiểm tra | M6 | BR-REP-02 | SC-08 | ☑ |
| FR-REP-06 | Ghi công việc cần làm, linh kiện cần thay; báo giá (ghi nhận khách đồng ý — tùy chọn) | M6 | BR-REP-04 | SC-08 | ☑ |
| FR-REP-07 | Quản lý trạng thái: đã nhận, đang kiểm tra, đang sửa, chờ linh kiện, hoàn thành, đã giao (+ hủy) | M6 | BR-REP-03 | SC-08 | ☑ |
| FR-REP-09 | Ghi tiền sửa (dịch vụ), chi phí linh kiện và tổng tiền sửa | M6 | BR-REP-07, BR-REP-09 | SC-08 | ☑ |
| FR-REP-10 | Theo dõi tiền đặt cọc và số tiền còn phải thu | M6 | BR-REP-05, BR-PAY-03 | SC-08 | ☑ |
| FR-REP-12 | Lưu lịch sử sửa chữa theo serial (hợp nhất máy khách và máy của shop) | M6 | BR-REP-13 | UAT-06 | ☑ |
| FR-REP-13 | In phiếu nhận đồng hồ và phiếu giao trả | M6 | — | UAT-06 | ☑ |
| FR-REP-14 | Tự động trừ linh kiện trong kho khi xác nhận sử dụng | M6 | BR-PART-03, BR-REP-06 | SC-08, CT-04 | ☑ |
| FR-REP-15 | Bổ sung: sửa **nội bộ** đồng hồ của shop (linh kiện + chi phí khác vốn hóa vào giá vốn, không có doanh thu) | M6 | BR-REP-01, BR-REP-11, BR-COST-04 | SC-09 | ☑ |
| FR-REP-17 | Bổ sung: cảnh báo máy đã hoàn thành nhưng khách chưa đến lấy | M7 | BR-REP-12 | UAT-06 | ☑ |
| FR-REP-18 | Bổ sung: thao tác sửa chữa theo quyền `repair.*` (mặc định **chỉ chủ**), không phân công thợ; hủy phiếu hoàn linh kiện/cọc | M6 | BR-REP-15, BR-REP-16 | PT-04, UAT-06 | ☑ |

## 8. PART — Quản lý linh kiện (module `parts`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PART-01 | Quản lý kim, núm, ron, kính sapphire, dây, chốt, bộ máy và linh kiện khác (danh mục loại tùy chỉnh) | M1 | — | UAT-04 | ☑ |
| FR-PART-02 | Mỗi linh kiện có mã riêng | M1 | — | UAT-04 | ☑ |
| FR-PART-03 | Lưu thương hiệu, model tương thích và thông số kỹ thuật | M1 | BR-PART-06 | UAT-04 | ☑ |
| FR-PART-04 | Quản lý giá nhập (bình quân gia quyền), giá bán và tồn kho | M1, M4 | BR-PART-02 | SC-10 | ☑ |
| FR-PART-06 | Theo dõi lịch sử nhập và xuất linh kiện | M1, M4 | BR-PART-05 | UAT-04 | ☑ |
| FR-PART-07 | Ghi nhận linh kiện sử dụng cho từng phiếu sửa chữa | M6 | BR-PART-03 | SC-08 | ☑ |
| FR-PART-08 | Tính chi phí linh kiện theo từng ca sửa | M6 | BR-PART-02, BR-REP-09 | SC-08 | ☑ |
| FR-PART-09 | Cảnh báo khi số lượng linh kiện xuống thấp (ngưỡng theo từng linh kiện) | M7 | BR-PART-04 | SC-14 | ☑ |

## 9. CUS — Quản lý khách hàng (module `partners`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-CUS-01 | Lưu tên, số điện thoại, email, địa chỉ và thông tin liên hệ | M2 | — | UAT-03 | ☑ |
| FR-CUS-02 | Lưu lịch sử mua hàng | M2, M5a | — | UAT-03 | ☑ |
| FR-CUS-03 | Lưu lịch sử sửa chữa, bảo dưỡng và bảo hành | M2, M6 | — | UAT-06 | ☑ |
| FR-CUS-04 | Theo dõi phiếu còn nợ và cọc đang giữ của khách (không màn công nợ riêng) | M5a | BR-PAY-03, BR-PAY-06 | SC-04 | ☑ |
| FR-CUS-05 | Theo dõi lịch sử thanh toán | M3, M5a | BR-PAY-01 | SC-04 | ☑ |
| FR-CUS-06 | Tìm kiếm khách hàng nhanh (tên/SĐT, không dấu) | M2 | — | UAT-03 | ☑ |
| FR-CUS-07 | Phân loại khách hàng theo nhóm | M2 | — | UAT-03 | ☑ |
| FR-CUS-08 | Tra cứu toàn bộ giao dịch theo khách hàng | M5a, M6 | — | UAT-03 | ☑ |

## 10. PAY — Thanh toán (module `payments`) — thay cho Thu chi (CF-06/07)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PAY-01 | Ghi nhận thanh toán của khách theo từng phiếu (tiền mặt / chuyển khoản / kết hợp) | M3, M5a | BR-PAY-01 | SC-02 | ☑ |
| FR-PAY-02 | Ghi nhận thanh toán và cọc của phiếu sửa chữa | M3, M6 | BR-PAY-01, BR-REP-05 | SC-08 | ☑ |
| FR-PAY-03 | Tính còn nợ từ dữ liệu (không cache); chặn trả vượt phải thu | M3 | BR-PAY-03 | SC-04, CT-05 | ☑ |
| FR-PAY-04 | Hủy thanh toán (lý do) — không xóa; hủy phiếu bán hủy theo | M3 | BR-PAY-05 | SC-15 | ☑ |
| FR-PAY-05 | Theo dõi cọc giữ hàng: đã thu, đã trừ, hoàn, tịch thu | M3, M5a | BR-PAY-06, BR-RSV-05 | SC-05 | ☑ |
| FR-PAY-06 | Báo cáo **Tiền thu** theo ngày/khoảng ngày (không số dư quỹ) | M8 | BR-PAY-07 | SC-10 | ☑ |
| FR-PAY-07 | Mã **VietQR** (tạo ngay trên trình duyệt, không dịch vụ ngoài) cho khoản chuyển khoản: số tiền + nội dung = mã phiếu, nút sao chép STK/số tiền/nội dung; tài khoản nhận cấu hình ở Cài đặt; QR chỉ hiển thị, **không tự ghi tiền** | M11 | BR-PAY-02 | UAT-03 | ☑ |

## 11. RPT — Báo cáo và xuất Excel (module `reports`)

Định nghĩa chi tiết từng báo cáo: `02-domain/reports-and-dashboard.md`.

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-RPT-01 | Báo cáo doanh thu | M8 | BR-SALE-12 | SC-10 | ☑ |
| FR-RPT-02 | Báo cáo lợi nhuận gộp | M8 | BR-COST-02 | SC-10 | ☑ |
| FR-RPT-03 | Báo cáo nhập hàng và xuất hàng | M8 | — | UAT-07 | ☑ |
| FR-RPT-04 | Báo cáo tồn kho theo giá vốn | M8 | BR-COST-01 | SC-10 | ☑ |
| FR-RPT-05 | Báo cáo hàng tồn lâu ngày | M8 | BR-INV-04 | SC-14 | ☑ |
| FR-RPT-06 | Báo cáo **phiếu còn nợ** (khách) và cọc đang giữ | M8 | BR-PAY-03 | SC-04 | ☑ |
| FR-RPT-07 | Báo cáo doanh thu sửa chữa (doanh thu, giá vốn linh kiện, chi phí bảo hành, lãi gộp sửa) | M8 | BR-REP-09, BR-WAR-03 | SC-08, SC-07 | ☑ |
| FR-RPT-08 | Báo cáo tiền thu (thực thu theo cách thanh toán và mục đích) | M8 | BR-PAY-07 | SC-10 | ☑ |
| FR-RPT-09 | Lọc báo cáo theo khoảng thời gian | M8 | — | UAT-07 | ☑ |
| FR-RPT-10 | Xuất Excel/PDF để lưu trữ và đối chiếu (theo đúng quyền xem) | M8 | BR-SEC-02 | PT-05 | ☑ |
| FR-RPT-11 | Bổ sung: báo cáo hao hụt kiểm kê; bảo hành sắp hết hạn | M8 | BR-INV-02, BR-WAR-04 | SC-14 | ☑ |
| FR-RPT-12 | Bổ sung (CF-08): **Thống kê CTV** theo tháng/quý/năm (xem FR-COL-09) | M8 | BR-COL-10 | SC-12 | ☑ |

## 12. SEC — Tài khoản và phân quyền (module `iam`)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-SEC-01 | Đăng nhập, đăng xuất và đổi mật khẩu | M0 | BR-SEC-04, BR-SEC-06 | PT-07 | ☑ |
| FR-SEC-02 | Phân quyền: chủ cửa hàng, nhân viên bán hàng, quản lý kho, cộng tác viên (vai trò là dữ liệu, chỉnh được; **không còn thợ**) | M0 | BR-SEC-01 | PT-01…04 | ☑ |
| FR-SEC-03 | Giới hạn quyền xem giá vốn (giá thu), lợi nhuận và phiếu còn nợ | M0, M4 | BR-SEC-02, BR-COST-06 | PT-01, PT-05 | ☑ |
| FR-SEC-04 | Giới hạn quyền giảm giá, hủy hóa đơn và điều chỉnh kho | M0, M5a, M7 | BR-SALE-03, BR-SALE-10, BR-PART-05 | PT-11 | ☑ |
| FR-SEC-05 | Lưu nhật ký người tạo, sửa, xác nhận hoặc hủy giao dịch; nhật ký không sửa/xóa được kể cả với chủ cửa hàng | M0 | BR-GEN-04, BR-SEC-05 | PT-08 | ☑ |
| FR-SEC-06 | Không xóa vĩnh viễn giao dịch đã xác nhận (chỉ hủy có kiểm soát) | M0, M3 | BR-GEN-03 | PT-09 | ☑ |
| FR-SEC-07 | **Giới hạn quyền xem của cộng tác viên** (chỉ hàng đang giữ + giá thu; chỉ đơn/khách/thống kê của mình; không giá vốn) | M5b | BR-SEC-08, BR-COL-09 | PT-02, PT-03 | ☑ |
| FR-SEC-08 | Bổ sung: MFA (TOTP) bắt buộc cho chủ cửa hàng; khóa tạm sau 5 lần sai | M0 | BR-SEC-04 | PT-07 | ☑ |
| FR-SEC-09 | Bổ sung: luôn còn ít nhất một chủ cửa hàng hoạt động | M0 | BR-SEC-07 | PT-10 | ☑ |
| FR-SEC-10 | **Tin cậy thiết bị này N ngày** ở bước 2FA (cookie httpOnly, DB chỉ SHA-256; chỉ bỏ mã 6 số — mật khẩu và xác thực lại vẫn bắt buộc; tự thu hồi khi đổi/đặt lại mật khẩu, khóa tài khoản, tắt 2FA; "Quên các thiết bị đã tin cậy" ở Cài đặt; tắt/đổi số ngày bằng `security.trusted_device_days`) | M11 | BR-SEC-10 | m11-trusted-device, PT-07 | ☑ |
| FR-SEC-11 | **Nhật ký hoạt động người dùng** (Quản trị → Hoạt động): ai gọi thao tác nào, lúc nào, kết quả, từ máy nào; kèm đọc nhạy cảm (xuất Excel, in, xem giá vốn/báo cáo/CCCD); lọc theo người, khu vực, ngày; tab Đăng nhập (tái dùng audit `auth.*`); chỉ `audit.view`; append-only; giữ `activity.retention_days` | M11 | BR-SEC-11 | m11-activity, UT-activity-route | ☑ |
| FR-SEC-12 | **Kiểm bố cục tự động** (`pnpm audit:layout`): mọi route × vai trò × 360/390/1366 × sáng/tối — tràn ngang, nhãn xuống dòng, chữ bị cắt, vùng chạm < 44px, ảnh thiếu alt, axe | M11 | — | UAT-08 | ☑ |

## 13. BAK — Sao lưu và bảo mật (module `ops`, nền tảng)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-BAK-01 | Sao lưu dữ liệu tự động theo lịch (hằng đêm, mã hóa) | M0, M9 | BR-BAK-01 | UAT-09 | ☐ |
| FR-BAK-02 | Hỗ trợ khôi phục dữ liệu từ bản sao lưu (có diễn tập) | M9 | BR-BAK-03 | UAT-09 | ☑ |
| FR-BAK-03 | Bảo vệ tài khoản và mật khẩu (Argon2id, khóa tạm, MFA) | M0 | BR-SEC-04 | PT-07 | ☑ |
| FR-BAK-04 | Phân quyền truy cập theo tài khoản | M0 | BR-SEC-01 | PT-01…04 | ☑ |
| FR-BAK-05 | Bảo vệ dữ liệu khách hàng (PII mã hóa, xem có lý do + audit) | M0, M2 | BR-SEC-03 | PT-12 | ☑ |
| FR-BAK-06 | Cơ chế hạn chế mất dữ liệu khi mất kết nối/lỗi hệ thống (nháp tự lưu, gửi lại idempotent, banner mất mạng) | M0, M5a | BR-GEN-09 | CT-07, UAT-08 | ☑ |
| FR-BAK-07 | Tối ưu sử dụng trên điện thoại và máy tính (PWA, mobile-first, phong cách Glass) | M0…M9 | — | UAT-08 | ☑ |
| FR-BAK-09 | Dọn tệp đã xóa khỏi kho lưu trữ; ẩn danh khách xóa thật ảnh giấy tờ; tệp bất biến không bị xóa | M9 | BR-SEC-09 | PT-13 | ☑ |
| FR-BAK-10 | Theo dõi dung lượng kho (theo bucket, tăng trưởng, ngày đầy, cảnh báo); nén ảnh trên trình duyệt trước khi tải (tiến độ, hủy, thử lại); xem ảnh phóng to | M9 | BR-BAK-04 | PT-13, UAT-08 | ☑ |
| FR-BAK-08 | Hướng dẫn sử dụng và bàn giao mã nguồn (phần mã/tài liệu xong: `/huong-dan`, `HUONG_DAN_SU_DUNG.md`; bàn giao tài khoản/đào tạo theo `runbook` §7 — ⏭ làm tay) | M9 | — | UAT-10 | ☐ |

## 14. RSV — Giữ hàng / đặt cọc (module `sales`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-RSV-01 | Giữ một chiếc cho khách với hạn giữ và tiền cọc tối thiểu | M5a | BR-RSV-01, BR-RSV-02 | SC-05, CT-02 | ☑ |
| FR-RSV-02 | Tiền cọc là khoản nhận trước, không phải doanh thu | M5a | BR-RSV-03 | SC-05 | ☑ |
| FR-RSV-03 | Chuyển giữ hàng thành phiếu bán (cọc trừ vào phiếu) | M5a | BR-RSV-04 | SC-05 | ☑ |
| FR-RSV-04 | Hủy giữ: hoàn cọc hoặc tịch thu (thu nhập khác) có lý do; nhắc giữ hàng quá hạn | M5a, M7 | BR-RSV-05 | SC-05 | ☑ |

## 15. TRD — Thu cũ đổi mới (module `sales`, `purchasing`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-TRD-01 | Trong phiếu bán, thêm đồng hồ cũ của khách với giá thu; trừ vào số phải trả | M5a | BR-TRD-01, BR-TRD-02 | SC-06 | ☑ |
| FR-TRD-02 | Máy thu về tự nhập kho (phiếu nhập `trade_in`) với giá vốn = giá thu | M5a | BR-TRD-03 | SC-06 | ☑ |
| FR-TRD-03 | Lưu thông tin người bán/giấy tờ theo quy định cửa hàng | M5a | BR-PUR-09, BR-TRD-04 | SC-06 | ☑ |

## 16. WAR — Bảo hành (module `sales`, `repairs`) — thay Đổi trả (CF-02)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-WAR-01 | Tự tạo bảo hành khi bán (theo tình trạng hàng) và sau sửa chữa; in hạn trên phiếu | M5a, M6 | BR-WAR-01 | SC-02, SC-08 | ☑ |
| FR-WAR-02 | Tra cứu bảo hành theo phiếu/khách/mã chiếc/serial; hiện hạn và trạng thái | M5a | BR-WAR-02 | SC-07 | ☑ |
| FR-WAR-03 | Yêu cầu bảo hành = nhận máy tạo phiếu sửa miễn phí liên kết; hết hạn ⇒ tính phí | M6 | BR-WAR-02, BR-WAR-03, BR-COST-03 | SC-07 | ☑ |
| FR-WAR-04 | Nhắc bảo hành sắp hết hạn; tự đánh dấu hết hạn | M7 | BR-WAR-04 | UAT-04 | ☑ |
| FR-WAR-05 | Hủy phiếu bán ⇒ hủy bảo hành của phiếu | M5a | BR-WAR-05 | SC-15 | ☑ |

## 17. COL — Cộng tác viên: giao hàng – giá thu – hưởng chênh lệch (module `sales`, `iam`) — CF-03/08

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-COL-01 | Hồ sơ CTV (SĐT, khu vực, ghi chú); không có % hoa hồng | M5b | BR-COL-01 | SC-12 | ☑ |
| FR-COL-02 | **Giao hàng cho CTV** bằng phiếu giao: chọn chiếc, nhập giá thu từng chiếc, in/chia sẻ phiếu | M5b | BR-COL-01, BR-COL-02 | SC-12, CT-06 | ☑ |
| FR-COL-03 | CTV xem hàng đang giữ (ảnh, thông số, giá thu), không thấy giá vốn | M5b | BR-COL-02, BR-COL-09 | PT-02 | ☑ |
| FR-COL-04 | CTV lập đơn bán nháp (giá bán thực + khách); cảnh báo khi giá bán < giá thu | M5b | BR-COL-03, BR-SALE-15 | SC-12, PT-03 | ☑ |
| FR-COL-05 | Chủ/nhân viên xác nhận đơn CTV: doanh thu cửa hàng = giá thu, phần CTV hưởng = chênh lệch | M5b | BR-COL-03, BR-COL-04, BR-COL-05 | SC-12 | ☑ |
| FR-COL-06 | **Quyết toán**: chủ ghi nhận CTV nộp giá thu các chiếc đã bán; hủy quyết toán có lý do | M5b | BR-COL-06, BR-COL-08 | SC-12, SC-16, CT-10 | ☑ |
| FR-COL-07 | **Thu hồi** chiếc chưa bán về kho; ghi mất chiếc hỏng/mất ở CTV | M5b | BR-COL-07 | SC-12 | ☑ |
| FR-COL-08 | Hủy đơn bán CTV trong cửa sổ cho phép (chiếc về lại "Đang ở CTV") | M5b | BR-COL-08, BR-SALE-10 | SC-16, CT-08 | ☑ |
| FR-COL-09 | **Thống kê doanh thu từng CTV theo tháng/quý/năm** (số chiếc, doanh thu bán ra, phải nộp, phần hưởng, đã/chưa nộp) | M5b, M8 | BR-COL-10 | SC-12 | ☑ |
| FR-COL-10 | CTV xem đơn, quyết toán và thống kê **của mình** | M5b | BR-COL-09 | PT-03 | ☑ |
| FR-COL-11 | Cảnh báo chiếc ở CTV quá hạn | M7 | BR-COL-11 | SC-12 | ☑ |

## 18. PLAT — Nền tảng (module `platform`) — Bổ sung

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PLAT-01 | Cài đặt hệ thống (cửa hàng, ngưỡng, chính sách) có lịch sử thay đổi | M0 | BR-GEN-04 | UAT-10 | ☑ |
| FR-PLAT-02 | Thông báo trong ứng dụng (hết hàng, tồn lâu, nợ đến hạn, bảo hành sắp hết, giữ hàng quá hạn, máy chưa lấy, đơn CTV chờ xác nhận) | M7 | — | UAT-04 | ☑ |
| FR-PLAT-03 | Sự kiện nghiệp vụ (`domain_events`) làm điểm mở rộng | M0 | — | UT-events | ☑ |
| FR-PLAT-04 | Giám sát: `/api/health`, `job_runs`, `error_events`, cảnh báo sao lưu | M0, M9 | BR-BAK-02 | UAT-09 | ☑ |
| FR-PLAT-05 | Hướng dẫn sử dụng trong ứng dụng theo vai trò; nhật ký phiên bản | M9 | — | UAT-10 | ☑ |
| FR-PLAT-06 | Cài lên màn hình chính điện thoại (PWA) | M0 | — | UAT-08 | ☑ |
| FR-PLAT-07 | Bổ sung (CF-09): giao diện theo hệ thống **Glass** (token, thành phần, dock/sidebar) và phần tử tương tác Lucian đã ánh xạ token | M0…M9 | BR-GEN-08 | UAT-08, UAT-10 | ☑ |

## 19. IMP — Nhập Excel hàng loạt (module `partners`, `purchasing`, `parts`) — Bổ sung (2026-10-17, theo yêu cầu người dùng)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-IMP-01 | Nhập **khách hàng** từ Excel/CSV: nhận tên cột tiếng Việt có/không dấu + đồng nghĩa, chuẩn hóa SĐT, xem trước từng dòng (hợp lệ/lỗi/trùng SĐT), chọn bỏ qua dòng trùng, ≤ 300 dòng | M11 | BR-IMP-01, BR-IMP-02, BR-IMP-03, BR-IMP-06 | m11-import, UT-import | ☑ |
| FR-IMP-02 | Nhập **đồng hồ tồn đầu kỳ** qua một phiếu `opening` đã xác nhận; báo trùng serial, giá không hợp lệ, thiếu cột; hàng cũ vào "Chờ kiểm tra"; tùy chọn tự tạo loại | M11 | BR-IMP-01, BR-IMP-02, BR-IMP-04, BR-IMP-06, BR-PUR-11 | m11-import | ☑ |
| FR-IMP-03 | Nhập **linh kiện** + tồn đầu kỳ (tạo mới hoặc cộng tồn mã có sẵn) | M11 | BR-IMP-05, BR-IMP-06 | m11-import | ☑ |
| FR-IMP-04 | **Tệp mẫu .xlsx** tải về cho từng loại (sheet "Dữ liệu" có 2 dòng ví dụ giả, "Hướng dẫn", "Danh mục" lấy từ cửa hàng) | M11 | BR-IMP-01 | m11-import | ☑ |
| FR-IMP-05 | Giao diện **/nhap-excel** (mobile-first, sáng & tối): chọn tệp/kéo thả → xem trước & chọn dòng → xác nhận → kết quả có liên kết; nút "Nhập Excel" ở Khách hàng, Đồng hồ, Linh kiện; chống bấm đúp (Idempotency-Key) | M11 | BR-IMP-02, BR-GEN-09 | m11-import, UAT-10 | ☑ |

## 20. NAV — Tìm nhanh & điều hướng (module `platform`) — Bổ sung (2026-10-17, theo yêu cầu người dùng; đối ứng Lưu Xá)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-NAV-01 | Bảng lệnh **Ctrl/⌘+K** và phím **/**: điều hướng + hành động nhanh theo quyền, tìm máy chủ gộp theo nhóm (chiếc theo mã nội bộ/serial/tên, khách, phiếu bán/sửa/nhập, giữ hàng, linh kiện) — không dấu, ≤ 5 dòng/nhóm, mỗi nhóm theo quyền + RLS, không giá vốn; gõ đúng mã/serial ⇒ Enter nhảy thẳng; gần đây chỉ lưu nhãn/đường dẫn | M11 | BR-SEC-01, BR-SEC-02 | m11-search, PT-02, UAT-10 | ☑ |
| FR-NAV-02 | **Huy hiệu số việc** trên dock/sidebar/menu (đơn CTV chờ xác nhận, giữ hàng sắp/quá hạn, máy sửa chờ/quá hẹn/chưa lấy, khách đến hạn trả nợ, linh kiện sắp hết, chiếc ở CTV quá hạn…), đếm theo quyền, đỏ khi quá hạn/vàng khi chờ, làm mới 60 giây + khi focus; tổng lên biểu tượng ứng dụng | M11 | BR-SEC-01 | m11-search, UAT-10 | ☑ |
| FR-NAV-03 | **Dải cảnh báo vận hành** cho người có `system.health`: cron quá hạn/lỗi, sao lưu lỗi/quá hạn, lỗi hệ thống mới, dung lượng lưu trữ; đỏ/vàng, bấm tới Quản trị → Hệ thống, ẩn đến hết ngày | M11 | BR-BAK-02 | m11-search, UAT-09 | ☑ |

## Hoãn / bỏ (không xây — giữ ID để truy vết; thiết kế ở archive)

| ID | Nội dung gốc | Lý do |
|---|---|---|
| FR-REP-08, FR-REP-16 | Phân công thợ; tiền công thợ theo từng thợ | CF-04/05 |
| FR-REP-11 | Bảo hành sau sửa (chuyển sang FR-WAR-01/03) | CF-02 |
| FR-SALE-12 | Đổi trả hàng và hoàn tiền | CF-02 |
| FR-PUR-08 (gốc) | Công nợ nhà cung cấp trên phiếu (nay: ghi chú thanh toán) | CF-06 |
| FR-PART-05 | Nhà cung cấp mặc định của linh kiện | CF-06 |
| FR-SUP-01…06 | Quản lý nhà cung cấp, công nợ NCC, thanh toán công nợ, báo cáo công nợ | CF-06 |
| FR-FIN-01…10 | Thu chi: quỹ, sổ quỹ, chuyển quỹ, chi nhập hàng/chi phí, đối chiếu & khóa kỳ, điều chỉnh quỹ, hủy phiếu chi (phần thu bán/sửa/cọc → FR-PAY-*) | CF-07 |
| FR-COST-08 | Không tính tiền thu hộ hoặc khoản vay thành doanh thu (không còn vay/thu hộ trong hệ thống; nguyên tắc doanh thu từ chứng từ giữ ở BR-PAY-02) | CF-07 |
| FR-RPT (gốc) | Báo cáo công nợ NCC, thu chi & số dư, tiền công thợ, hoa hồng | CF-06/07/04/03 |
| FR-COL (gốc) | Hoa hồng % / cố định cho CTV; CTV chỉ xem hàng "được phép" | CF-03 |
| Chế độ tối | Giao diện tối | **Đã làm 2026-10-17** theo yêu cầu người dùng (CQ-016): Sáng / Tối / Theo hệ thống |

## Phụ lục — Đối chiếu mục III & V của bản gốc

| Mục gốc | Nội dung | Được đáp ứng bởi |
|---|---|---|
| III.1 | Serial riêng, một trạng thái tồn kho hợp lệ | BR-UNIT-01…04, CT-01 |
| III.2 | Giá vốn gồm giá mua + chi phí trực tiếp, phân bổ thống nhất | BR-PUR-05, BR-COST-01, costing-and-profit |
| III.3 | Lãi gộp bán hàng = doanh thu sau giảm giá − giá vốn | BR-COST-02, SC-02 |
| III.4 | Tiền sửa, chi phí linh kiện và lợi nhuận sửa chữa theo dõi riêng, không trùng (không còn tiền công thợ) | BR-REP-09, SC-08 |
| III.5 | Chứng từ xác nhận có lịch sử sửa/hủy | BR-GEN-02, BR-GEN-04 |
| III.6 | Cập nhật hóa đơn–kho–thanh toán đồng bộ | `fn_*` nguyên tử, integrity-and-concurrency, CT-* |
| III.7 | Dữ liệu thử nghiệm trước khi dùng thật | `db/seed`, golden-scenarios, UAT |
| V | Tiêu chí nghiệm thu | `06-quality/uat-acceptance` |

## 21. PUSH — PWA & thông báo đẩy (module `platform`) — Bổ sung (2026-10-17, theo yêu cầu người dùng; đối ứng Lưu Xá)

| ID | Yêu cầu | Mốc | BR | Kiểm thử | ✓ |
|---|---|---|---|---|---|
| FR-PUSH-01 | **Gợi ý cài ứng dụng**: bắt `beforeinstallprompt` sớm; nút "Cài WatchFlow lên màn hình chính" (Android, Chrome/Edge máy tính); hướng dẫn riêng iOS Safari (Chia sẻ → Thêm vào MH chính); thẻ nhỏ ở trang chủ/CTV đóng ⇒ ẩn 21 ngày; không hiện khi đã chạy standalone; khối đầy đủ ở Cài đặt | M11 | — | UT-pwa, UAT-08 | ☑ |
| FR-PUSH-02 | **Cảnh báo trình duyệt nhúng** (Zalo/Facebook/Messenger/Instagram/TikTok/LINE): dải trên cùng ở trang đăng nhập và trong ứng dụng, nút sao chép liên kết + "Mở bằng Chrome" (intent:// trên Android), hướng dẫn Safari trên iOS | M11 | — | UT-pwa (detectInAppBrowser), UAT-08 | ☑ |
| FR-PUSH-03 | **Trang offline**: điều hướng lỗi mạng ⇒ `/offline.html` (Glass, sáng/tối, nút Thử lại, không script ngoài, CSP riêng); service worker chỉ tiền-cache trang này + biểu tượng, **không** cache API/trang đăng nhập (máy dùng chung) | M11 | — | UT-sw, UAT-08 | ☑ |
| FR-PUSH-04 | **Thông báo đẩy (Web Push/VAPID)**: mỗi `notifications` mới của người có thiết bị đang bật ⇒ tin đẩy (tiêu đề, nội dung ngắn, liên kết nội bộ an toàn); thử lại ≤ 5 lần; 404/410 ⇒ tắt thiết bị; giờ yên tĩnh theo giờ Việt Nam; thiếu khóa VAPID ⇒ tắt êm; bấm thông báo mở/đưa tab có sẵn tới trang và đánh dấu đã đọc (`?n=<id>`); số chưa đọc trên biểu tượng ứng dụng | M11 | — | m11-push, UT-sw | ☑ (gửi thật ⏭ cloud) |
| FR-PUSH-05 | **Cài đặt → Tài khoản**: công tắc "Nhận thông báo trên thiết bị này", giờ yên tĩnh, "Gửi thử"; khóa `p256dh/auth` chỉ máy chủ gửi tin đọc được; chỉ thấy/hủy thiết bị của mình | M11 | — | m11-push (PT), UAT-10 | ☑ |
