# Thuật ngữ & định nghĩa

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt
> **Dùng đúng từ trong file này** ở UI, docs, và đặt tên trong code. Nếu một từ mơ hồ, sửa ở đây trước.

## 1. Định nghĩa nghiệp vụ (chính xác)

| Thuật ngữ | Định nghĩa | Ghi chú |
|---|---|---|
| **Loại đồng hồ** (model) | Mẫu sản phẩm: thương hiệu + tên + mã tham chiếu + thông số. Có **mã sản phẩm** riêng. | `watch_models` |
| **Chiếc** (unit) | Một cái đồng hồ vật lý cụ thể. Có **mã nội bộ**, serial (nếu có), tình trạng, giá vốn. | `watch_units` |
| **Mã nội bộ** | Mã định danh chính của một chiếc, vd. `DH-000123`, in thành tem QR. Không bao giờ đổi, không tái sử dụng. | `asset_code` |
| **Serial** | Số seri do hãng khắc. Chỉ là thuộc tính (có thể thiếu/trùng ở hàng cũ). | `serial_no`, `serial_norm` |
| **Linh kiện** (part) | Hàng quản lý theo **số lượng** (kim, núm, ron, kính, dây, chốt, bộ máy…). | `parts` |
| **Tồn kho (đồng hồ)** | Các chiếc đang thuộc sở hữu cửa hàng: trạng thái `in_stock`, `reserved`, `in_repair`, `inspecting`. | BR-UNIT-04 |
| **Có thể bán** | Chiếc ở trạng thái `in_stock`. | |
| **Giá niêm yết** | Giá bán chuẩn của chiếc. **Giá khuyến mãi** có hiệu lực theo khoảng ngày; **giá hiệu lực** = khuyến mãi nếu đang hiệu lực, không thì niêm yết. | |
| **Giá nhập** | Số tiền trả để mua một chiếc/linh kiện (chưa gồm chi phí liên quan). | `purchase_lines.unit_price` |
| **Giá vốn** (chiếc) | Giá nhập + chi phí nhập phân bổ + chi phí sửa chữa nội bộ (công + linh kiện) + điều chỉnh, **của chu kỳ hiện hành**. | BR-COST-01 |
| **Chu kỳ giá vốn** (cost cycle) | Số lần chiếc đó được cửa hàng *mua vào*. Bán rồi mua lại (thu cũ đổi mới, khách bán lại) thì sang chu kỳ mới, giá vốn bắt đầu lại. | `watch_units.cost_cycle` |
| **Giá vốn bình quân** (linh kiện) | Bình quân gia quyền di động: (giá trị tồn + giá trị lô nhập mới) / (số lượng tồn + số lượng nhập). | BR-PART-02 |
| **Phiếu nhập** | Chứng từ nhập hàng. Loại: `supplier` (nhà cung cấp), `customer_buyback` (thu mua từ khách), `trade_in` (thu cũ đổi mới), `opening` (tồn đầu kỳ). | |
| **Phiếu bán** (hóa đơn bán hàng nội bộ) | Chứng từ bán hàng cho khách. Không phải hóa đơn điện tử thuế. | `sales` |
| **Giữ hàng / đặt cọc** | Giữ riêng một chiếc cho khách trong N ngày, có tiền cọc. | `reservations` |
| **Thu cũ đổi mới** (trade-in) | Khách đưa đồng hồ cũ, giá thu được trừ vào phiếu bán. | |
| **Đổi trả** (return) | Giao dịch có thật: khách trả lại hàng đã bán, cửa hàng hoàn tiền/giảm nợ, hàng về kho. | `returns` |
| **Phiếu sửa chữa** | Chứng từ nhận–sửa–giao. Loại `customer` (máy của khách) hoặc `internal` (máy của cửa hàng). | `repair_orders` |
| **Bảo hành** | Cam kết sửa miễn phí trong thời hạn. Loại: `sale` (cửa hàng bán ra), `repair` (sau sửa chữa). Bảo hành của hãng chỉ ghi nhận hạn. | `warranties` |
| **Cộng tác viên** (CTV) | Người ngoài bán hộ ăn **hoa hồng**. Không sở hữu hàng. | |
| **Phiếu thu / phiếu chi** | Một lần tiền vào / ra (hoặc bù trừ không tiền mặt). Kỹ thuật: bản ghi `payments`. | |
| **Quỹ** | Nơi giữ tiền: tiền mặt, tài khoản ngân hàng, ví. | `cash_accounts` |
| **Sổ quỹ** | Chuỗi bút toán không sửa/xóa của từng quỹ, có số dư sau mỗi bút toán và chuỗi băm. | `ledger_entries` |
| **Bù trừ** (offset) | Thanh toán **không qua quỹ** (thu cũ đổi mới, chuyển cọc vào phiếu bán, tịch thu cọc). Luôn đi theo cặp vào–ra. | `payments.method='offset'` |
| **Công nợ khách** | Số tiền khách còn nợ cửa hàng (phiếu bán đã xác nhận + phiếu sửa đã giao, sau trừ đã thu và đổi trả). | BR-FIN-05 |
| **Công nợ NCC** | Số tiền cửa hàng còn nợ nhà cung cấp/người bán (phiếu nhập đã xác nhận chưa trả hết). | BR-FIN-06 |
| **Cọc đang giữ** | Tiền cọc đã nhận nhưng chưa chuyển vào phiếu/hoàn/tịch thu. Là **khoản phải trả khách**, không phải doanh thu. | |
| **Kỳ** | Tháng dương lịch. **Khóa kỳ** = không cho tạo/hủy/sửa chứng từ có ngày trong kỳ. | |

## 2. Các khái niệm tiền (hay bị nhầm — phải phân biệt)

| Khái niệm | Định nghĩa | Tính từ | Không bao gồm |
|---|---|---|---|
| **Doanh thu bán hàng** | Σ tiền hàng sau giảm giá của phiếu bán đã xác nhận (theo ngày phiếu) **trừ** giá trị hàng đổi trả (theo ngày đổi trả) | Chứng từ bán/đổi trả | Cọc chưa chuyển, vay, thu hộ, thu nợ cũ |
| **Doanh thu sửa chữa** | Σ tổng phải thu của phiếu sửa `customer` **đã giao**, tính phí (theo ngày giao) | Chứng từ sửa | Sửa nội bộ, bảo hành miễn phí, cọc chưa giao |
| **Thực thu** | Tiền **thật** vào quỹ từ khách (bán, sửa, cọc, thu nợ), theo ngày thu | Phiếu thu (không offset) | Vay, thu hộ, bù trừ |
| **Thực chi** | Tiền **thật** ra khỏi quỹ (nhập hàng, chi phí, hoàn tiền, hoa hồng, tiền công…), theo ngày chi | Phiếu chi (không offset) | Chuyển quỹ nội bộ, bù trừ |
| **Giá vốn hàng bán** (COGS) | Giá vốn đã chốt trên các dòng bán, trừ giá vốn hàng đổi trả | `sale_line_costs` | Chi phí bảo hành sau bán |
| **Lãi gộp bán hàng** | Doanh thu bán hàng − Giá vốn hàng bán | | |
| **Lãi gộp sửa chữa** | Doanh thu sửa chữa − giá vốn linh kiện đã dùng − tiền công thợ theo ca (− chi phí bảo hành) | | |
| **Lãi gộp** | Lãi gộp bán hàng + Lãi gộp sửa chữa | | |
| **Lãi ròng tạm tính** | Lãi gộp − chi phí hoạt động (hạng mục chi phí `is_operating`) − hoa hồng CTV − hao hụt kiểm kê + thu nhập khác | Báo cáo | Lương nhân viên (ngoài phạm vi), khấu hao, thuế |
| **Thu nhập khác** | Cọc bị tịch thu, phí khấu trừ đổi trả, thu khác | | Bán hàng |

> Chênh lệch **Doanh thu − Thực thu** trong một khoảng ≈ biến động công nợ (bán nợ − thu nợ) và cọc. Kịch bản SC-10 chứng minh hằng đẳng thức này.

## 3. Phân biệt các thao tác "ngược"

| Thao tác | Khi dùng | Hiệu ứng |
|---|---|---|
| **Sửa** | Chỉ chứng từ **nháp** | Thay đổi trực tiếp |
| **Hủy** (void) | Nhập nhầm/lỗi trong cửa sổ cho phép, chưa phát sinh giao dịch phụ thuộc | Như chưa từng xảy ra: kho, tiền, giá vốn được đảo bằng bút toán; chứng từ giữ lại, trạng thái `voided` |
| **Đảo** (reversal) | Hủy một phiếu thu/chi/bút toán quỹ | Bút toán ngược dấu, liên kết `reverses_entry_id` |
| **Điều chỉnh** (adjustment) | Sửa giá vốn, số dư quỹ, tồn linh kiện sau xác nhận | Bút toán mới (±), có lý do, không sửa bút toán cũ |
| **Đổi trả** (return) | Khách trả hàng đã bán (ngoài cửa sổ hủy hoặc đã giao hàng) | Giao dịch có thật, ngày đổi trả, doanh thu & giá vốn đảo theo ngày đó |

## 4. Bảng đối chiếu tên (VN ↔ code)

| Tiếng Việt | Code (bảng / enum / hàm) | Mã chứng từ |
|---|---|---|
| Người dùng · vai trò · quyền | `users` · `roles` · `permissions` | — |
| Thương hiệu · loại đồng hồ · chiếc | `brands` · `watch_models` · `watch_units` | `DH-000001` (chiếc) |
| Vị trí kho | `storage_locations` | — |
| Linh kiện · loại linh kiện | `parts` · `part_categories` | `LK-0001` |
| Khách hàng · nhóm khách | `customers` · `customer_groups` | `KH-000001` |
| Nhà cung cấp | `suppliers` | `NCC-0001` |
| Phiếu nhập · dòng · chi phí | `purchase_receipts` · `purchase_lines` · `purchase_costs` | `PN-2026-0001` |
| Giữ hàng | `reservations` | `GH-2026-0001` |
| Phiếu bán · dòng | `sales` · `sale_lines` | `HD-2026-0001` |
| Đổi trả | `returns` · `return_lines` | `DT-2026-0001` |
| Hoa hồng | `sale_commissions` | — |
| Bảo hành | `warranties` | `BH-2026-0001` |
| Phiếu sửa chữa | `repair_orders` · `repair_lines` | `SC-2026-0001` |
| Tiền công thợ | `repair_tech_pay` | — |
| Quỹ · sổ quỹ | `cash_accounts` · `ledger_entries` | — |
| Phiếu thu / chi | `payments` (`direction` in/out) | `PT-2026-0001` / `PC-2026-0001` |
| Phân bổ thanh toán | `payment_allocations` | — |
| Chuyển quỹ | `account_transfers` | `CQ-2026-0001` |
| Kiểm kê | `stocktakes` · `stocktake_lines` | `KK-2026-0001` |
| Kỳ | `financial_periods` | — |
| Trạng thái chiếc | `unit_status`: `in_stock` Sẵn sàng bán · `reserved` Đã giữ · `sold` Đã bán · `in_repair` Đang sửa · `inspecting` Chờ kiểm tra · `written_off` Thanh lý/mất · `cancelled` Nhập nhầm | — |
| Tình trạng hàng | `condition`: `new` Mới · `used` Cũ · `refurbished` Đã sửa chữa/làm mới | — |

Mã chứng từ: tiền tố + năm + số tăng dần (đệm 4 chữ số tối thiểu, tự dài ra); mã danh mục (KH/NCC/LK/DH) không có năm. Xem BR-GEN-06.
