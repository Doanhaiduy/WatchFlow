# Thuật ngữ & định nghĩa

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`)
> **Dùng đúng từ trong file này** ở UI, docs, và đặt tên trong code. Nếu một từ mơ hồ, sửa ở đây trước.

## 1. Định nghĩa nghiệp vụ (chính xác)

| Thuật ngữ | Định nghĩa | Ghi chú |
|---|---|---|
| **Loại đồng hồ** (model) | Mẫu sản phẩm: thương hiệu + tên + mã tham chiếu + thông số. Có **mã sản phẩm** riêng. | `watch_models` |
| **Chiếc** (unit) | Một cái đồng hồ vật lý cụ thể. Có **mã nội bộ**, serial (nếu có), tình trạng, giá vốn. | `watch_units` |
| **Mã nội bộ** | Mã định danh chính của một chiếc, vd. `DH-000123`, in thành tem QR. Không bao giờ đổi, không tái sử dụng. | `asset_code` |
| **Serial** | Số seri do hãng khắc. Chỉ là thuộc tính (có thể thiếu/trùng ở hàng cũ). | `serial_no`, `serial_norm` |
| **Linh kiện** (part) | Hàng quản lý theo **số lượng** (kim, núm, ron, kính, dây, chốt, bộ máy…). | `parts` |
| **Tồn kho (đồng hồ)** | Các chiếc đang thuộc sở hữu cửa hàng: `in_stock`, `reserved`, `with_collaborator`, `in_repair`, `inspecting`. | BR-UNIT-04 |
| **Có thể bán** | Chiếc ở trạng thái `in_stock` (cửa hàng tự bán). Chiếc `with_collaborator` do CTV bán. | |
| **Giá niêm yết** | Giá bán chuẩn của chiếc. **Giá khuyến mãi** có hiệu lực theo khoảng ngày; **giá hiệu lực** = khuyến mãi nếu đang hiệu lực, không thì niêm yết. | |
| **Giá nhập** | Số tiền trả để mua một chiếc/linh kiện (chưa gồm chi phí liên quan). | `purchase_lines.unit_price` |
| **Giá vốn** (chiếc) | Giá nhập + chi phí nhập phân bổ + chi phí sửa nội bộ (linh kiện + chi phí khác) + điều chỉnh, **của chu kỳ hiện hành**. | BR-COST-01 |
| **Giá thu** | Cách khách gọi **giá gốc** của một chiếc. (a) Với chủ/nhân viên có quyền: là **giá vốn** của chiếc (UI hiển thị nhãn "Giá thu"). (b) Với CTV: **giá thu giao CTV** — giá gốc chủ báo khi giao hàng; CTV nộp lại đúng số này cho cửa hàng khi bán, phần còn lại CTV hưởng. | `customer-feedback-01` CF-01/CF-03, Q8 |
| **Chu kỳ giá vốn** (cost cycle) | Số lần chiếc đó được cửa hàng *mua vào*. Bán rồi mua lại (thu cũ đổi mới, khách bán lại) thì sang chu kỳ mới, giá vốn bắt đầu lại. | `watch_units.cost_cycle` |
| **Giá vốn bình quân** (linh kiện) | Bình quân gia quyền di động: (giá trị tồn + giá trị lô nhập mới) / (số lượng tồn + số lượng nhập). | BR-PART-02 |
| **Phiếu nhập** | Chứng từ nhập hàng. Loại: `purchase` (mua vào — ghi **nguồn hàng** bằng chữ), `customer_buyback` (thu mua từ khách), `trade_in` (thu cũ đổi mới), `opening` (tồn đầu kỳ). | Không còn nhà cung cấp |
| **Phiếu bán** (phiếu bán hàng nội bộ) | Chứng từ bán hàng cho khách. Không phải hóa đơn điện tử thuế. | `sales` |
| **Giữ hàng / đặt cọc** | Giữ riêng một chiếc cho khách trong N ngày, có tiền cọc. | `reservations` |
| **Thu cũ đổi mới** (trade-in) | Khách đưa đồng hồ cũ, giá thu được trừ vào phiếu bán. | |
| **Phiếu sửa chữa** | Chứng từ nhận–sửa–giao. Loại `customer` (máy của khách) hoặc `internal` (máy của cửa hàng). Chỉ **chủ** thao tác sửa. | `repair_orders` |
| **Bảo hành** | Cam kết sửa miễn phí trong thời hạn. Loại: `sale` (cửa hàng bán ra), `repair` (sau sửa chữa). **Yêu cầu bảo hành = phiếu sửa miễn phí liên kết.** Bảo hành của hãng chỉ ghi nhận hạn. Thay thế chức năng *đổi trả* (CF-02). | `warranties` |
| **Cộng tác viên** (CTV) | Người ngoài nhận đồng hồ từ chủ để bán; **hưởng phần chênh lệch** giữa giá bán và giá thu giao CTV. Không có hoa hồng. | CF-03 |
| **Phiếu giao CTV** | Chứng từ chủ giao một hoặc nhiều chiếc cho một CTV, kèm **giá thu** từng chiếc. Chiếc chuyển sang `with_collaborator`. | `collaborator_assignments` |
| **Thu hồi từ CTV** | CTV trả lại chiếc chưa bán: chiếc về `in_stock`. | |
| **Quyết toán CTV** | Chủ ghi nhận CTV đã nộp giá thu của các chiếc đã bán (số tiền, cách nộp, ngày). | `collaborator_settlements` |
| **Phần CTV hưởng** | Σ (giá bán − giá thu giao CTV) của các chiếc CTV bán được. Có thể âm nếu CTV bán dưới giá thu. | |
| **Thanh toán** (phiếu thu) | Một lần khách trả tiền cho một chứng từ (phiếu bán, phiếu sửa, giữ hàng) bằng tiền mặt hoặc chuyển khoản; hoặc cửa hàng hoàn cọc. | `payments` |
| **Còn nợ** | Phần phiếu bán/phiếu sửa khách chưa trả. Thu thêm ngay trên phiếu. | BR-PAY-03 |
| **Cọc đang giữ** | Tiền cọc đã nhận nhưng chưa chuyển vào phiếu bán / hoàn / tịch thu. Là **khoản phải trả khách**, không phải doanh thu. | |
| **Trạng thái "Đang ở CTV"** | Chiếc thuộc sở hữu cửa hàng nhưng đang do CTV giữ để bán. Tính vào tồn kho (hiển thị riêng). | `with_collaborator` |

## 2. Các khái niệm tiền (hay bị nhầm — phải phân biệt)

| Khái niệm | Định nghĩa | Tính từ | Không bao gồm |
|---|---|---|---|
| **Doanh thu bán hàng** (của cửa hàng) | Σ tiền hàng sau giảm giá của dòng bán do **cửa hàng** bán (theo ngày phiếu) **+** Σ **giá thu** của dòng do **CTV** bán (cửa hàng nhận giá thu, phần chênh thuộc CTV) | Chứng từ bán | Cọc chưa chuyển, phần chênh của CTV |
| **Doanh thu sửa chữa** | Σ tổng phải thu của phiếu sửa `customer` **đã giao**, tính phí (theo ngày giao) | Chứng từ sửa | Sửa nội bộ, bảo hành miễn phí, cọc chưa giao |
| **Doanh thu** | Bán hàng + sửa chữa | | |
| **Doanh thu bán ra của CTV** | Σ giá bán thực tế CTV bán cho khách. Chỉ để thống kê CTV, **không** là doanh thu cửa hàng | Dòng bán của CTV | |
| **Thực thu** | Tiền khách **thật sự trả** (bán, sửa, cọc, thu thêm) + CTV nộp giá thu (quyết toán), theo ngày thu; trừ hoàn cọc | Thanh toán `posted` | Tiền CTV thu của khách (cửa hàng không biết) |
| **Giá vốn hàng bán** (COGS) | Giá vốn đã chốt trên các dòng bán (cả dòng CTV) | `sale_line_costs` | Chi phí bảo hành sau bán |
| **Lãi gộp bán hàng** | Doanh thu bán hàng − Giá vốn hàng bán. Dòng CTV: giá thu − giá vốn | | Phần CTV hưởng |
| **Lãi gộp sửa chữa** | Doanh thu sửa chữa − giá vốn linh kiện đã dùng − chi phí bảo hành (linh kiện dùng cho phiếu bảo hành) | | Tiền công (không còn) |
| **Lãi gộp** | Lãi gộp bán hàng + Lãi gộp sửa chữa. **Không còn "lãi ròng"** (không theo dõi chi phí hoạt động) | | |
| **Thu nhập khác** | Cọc bị tịch thu | | Bán hàng |

> Chênh lệch **Doanh thu − Thực thu** trong một khoảng ≈ biến động nợ khách (bán nợ − thu thêm) + cọc + giá thu CTV chưa nộp.

## 3. Phân biệt các thao tác "ngược"

| Thao tác | Khi dùng | Hiệu ứng |
|---|---|---|
| **Sửa** | Chỉ chứng từ **nháp** | Thay đổi trực tiếp |
| **Hủy** (void) | Nhập nhầm/lỗi trong cửa sổ cho phép, chưa phát sinh giao dịch phụ thuộc | Như chưa từng xảy ra: kho, thanh toán, giá vốn được đảo; chứng từ giữ lại, trạng thái `voided` |
| **Điều chỉnh** (adjustment) | Sửa giá vốn, tồn linh kiện sau xác nhận | Bút toán mới (±), có lý do, không sửa bút toán cũ |
| **Thu hồi từ CTV** | CTV không bán được | Chiếc về `in_stock` (không phải đổi trả) |
| **Bảo hành** | Khách quay lại trong hạn vì lỗi máy | Phiếu sửa `warranty_free` liên kết; không hoàn tiền |

## 4. Bảng đối chiếu tên (VN ↔ code)

| Tiếng Việt | Code (bảng / enum / hàm) | Mã chứng từ |
|---|---|---|
| Người dùng · vai trò · quyền | `users` · `roles` · `permissions` | — |
| Thương hiệu · loại đồng hồ · chiếc | `brands` · `watch_models` · `watch_units` | `DH-000001` (chiếc) |
| Vị trí kho | `storage_locations` | — |
| Linh kiện · loại linh kiện | `parts` · `part_categories` | `LK-0001` |
| Khách hàng · nhóm khách | `customers` · `customer_groups` | `KH-000001` |
| Phiếu nhập · dòng · chi phí | `purchase_receipts` · `purchase_lines` · `purchase_costs` | `PN-2026-0001` |
| Giữ hàng | `reservations` | `GH-2026-0001` |
| Phiếu bán · dòng | `sales` · `sale_lines` | `HD-2026-0001` |
| Thu cũ đổi mới | `sale_trade_ins` | — |
| Bảo hành | `warranties` | `BH-2026-0001` |
| Phiếu sửa chữa | `repair_orders` · `repair_lines` | `SC-2026-0001` |
| Hồ sơ CTV | `collaborator_profiles` | — |
| Phiếu giao CTV | `collaborator_assignments` · `collaborator_assignment_lines` | `GC-2026-0001` |
| Quyết toán CTV | `collaborator_settlements` | `QT-2026-0001` |
| Thanh toán (phiếu thu) | `payments` (`direction` in/out) | `PT-2026-0001` |
| Kiểm kê | `stocktakes` · `stocktake_lines` | `KK-2026-0001` |
| Trạng thái chiếc | `unit_status`: `in_stock` Sẵn sàng bán · `reserved` Đã giữ · `with_collaborator` Đang ở CTV · `sold` Đã bán · `in_repair` Đang sửa · `inspecting` Chờ kiểm tra · `written_off` Thanh lý/mất · `cancelled` Nhập nhầm | — |
| Tình trạng hàng | `condition`: `new` Mới · `used` Cũ · `refurbished` Đã sửa chữa/làm mới | — |

Mã chứng từ: tiền tố + năm + số tăng dần (đệm 4 chữ số tối thiểu, tự dài ra); mã danh mục (KH/LK/DH) không có năm. Xem BR-GEN-06.

**Đã hoãn (không còn trong phạm vi xây):** `suppliers`, `cash_accounts`, `ledger_entries`, `payment_allocations`, `account_transfers`, `expense_categories`, `financial_periods`, `account_reconciliations`, `returns` (+`return_lines`), `sale_commissions`, `technician_profiles`, `technician_rates`, `repair_tech_pay`. Thiết kế ở `docs/99-archive/2026-10-16-full-scope/`.
