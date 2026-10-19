# Thuật ngữ & định nghĩa

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-02`: thuật ngữ **đóng băng** đánh dấu ⏸ — còn trong DB/dữ liệu cũ nhưng không còn trong sản phẩm)
> **Dùng đúng từ trong file này** ở UI, docs, và đặt tên trong code. Nếu một từ mơ hồ, sửa ở đây trước.

## 1. Định nghĩa nghiệp vụ (chính xác)

| Thuật ngữ | Định nghĩa | Ghi chú |
|---|---|---|
| **Loại đồng hồ** (model) | Mẫu sản phẩm: thương hiệu + tên + mã tham chiếu + thông số. Có **mã sản phẩm** riêng. | `watch_models` |
| **Chiếc** (unit) | Một cái đồng hồ vật lý cụ thể. Có **mã nội bộ**, serial (nếu có), tình trạng, giá vốn. | `watch_units` |
| **Mã nội bộ** | Mã định danh chính của một chiếc, vd. `DH-000123`, in thành tem QR. Không bao giờ đổi, không tái sử dụng. | `asset_code` |
| **Serial** | Số seri do hãng khắc. Chỉ là thuộc tính (có thể thiếu/trùng ở hàng cũ). | `serial_no`, `serial_norm` |
| **Linh kiện** (part) ⏸ | Hàng quản lý theo **số lượng** — đã bỏ khỏi sản phẩm (CF-14); bảng còn trong DB. | `parts` |
| **Tồn kho (đồng hồ)** | Các chiếc đang thuộc sở hữu cửa hàng: `in_stock` (sẵn sàng bán) và `inspecting` (chờ kiểm tra). Chiếc đang giao CTV **vẫn là `in_stock`**. | BR-UNIT-04 |
| **Có thể bán** | Chiếc ở trạng thái `in_stock` — cả cửa hàng lẫn các CTV được giao đều bán được; ai bán trước (ghi đơn / CTV báo "đã bán" được chủ xác nhận) thì chiếc thuộc về đơn đó. | BR-SALE-20, BR-COL-13 |
| **Giá niêm yết** | Giá bán chuẩn của chiếc. **Giá khuyến mãi** có hiệu lực theo khoảng ngày; **giá hiệu lực** = khuyến mãi nếu đang hiệu lực, không thì niêm yết. | |
| **Giá nhập** ⏸ | Số tiền trả để mua một chiếc. Chỉ ghi **nội bộ**, không hiển thị ở đâu (CF-14). | `purchase_lines.unit_price` |
| **Giá vốn** (chiếc) ⏸ | Giá nhập + chi phí nhập phân bổ + chi phí sửa nội bộ (linh kiện + chi phí khác) + điều chỉnh, **của chu kỳ hiện hành**. | BR-COST-01 |
| **Giá thu** ⏸ | Từ vòng 1: giá gốc của chiếc / giá thu giao CTV. **Đã bỏ khỏi sản phẩm** (CF-11, CF-14): CTV không còn giá thu, chỉ thấy **giá niêm yết**; giá nhập không hiển thị. | `customer-feedback-01` CF-01/CF-03 |
| **Chu kỳ giá vốn** (cost cycle) ⏸ | Số lần chiếc đó được cửa hàng *mua vào*. Bán rồi mua lại (thu cũ đổi mới, khách bán lại) thì sang chu kỳ mới, giá vốn bắt đầu lại. | `watch_units.cost_cycle` |
| **Giá vốn bình quân** (linh kiện) ⏸ | Bình quân gia quyền di động: (giá trị tồn + giá trị lô nhập mới) / (số lượng tồn + số lượng nhập). | BR-PART-02 |
| **Phiếu nhập** | Chứng từ ghi nguồn gốc khi **thêm đồng hồ vào kho**: sản phẩm chỉ còn phiếu **một dòng** (`purchase` qua "Thêm đồng hồ", `opening` qua Nhập Excel). Người dùng không thấy "phiếu nhập" — chỉ thấy "Thêm đồng hồ". | Không còn nhà cung cấp |
| **Đơn bán** (phiếu bán) | Bản ghi một lần khách mua: **chiếc + khách + giá + ngày** (+ hạn bảo hành, ghi chú). Có hiệu lực ngay, không nháp/thanh toán/nợ. Không phải hóa đơn điện tử thuế. | `sales` |
| **Giữ hàng / đặt cọc** ⏸ | Đã bỏ khỏi sản phẩm. | `reservations` |
| **Thu cũ đổi mới** (trade-in) ⏸ | Đã bỏ khỏi sản phẩm. | |
| **Phiếu sửa chữa** | Chứng từ nhận–sửa–giao máy **của khách** (sửa nội bộ đã bỏ). Gồm các **khoản tiền** (dịch vụ hoặc khoản khác). Chỉ **chủ** thao tác. | `repair_orders` |
| **Bảo hành** | Cam kết sửa miễn phí trong thời hạn. Loại: `sale` (**hạn ghi trên từng dòng đơn bán**, in trên phiếu), `repair` (sau sửa chữa). **Yêu cầu bảo hành = phiếu sửa miễn phí** chọn từ bảo hành còn hạn của khách. Không có màn tra cứu riêng (CF-15). Thay thế chức năng *đổi trả* (CF-02). | `warranties` |
| **Cộng tác viên** (CTV) | Người ngoài được chủ **giao đồng hồ để bán**; dùng web ở mức giới hạn: chỉ thấy hàng được giao + giá niêm yết, báo "đã bán", xem số chiếc bán được. CTV bán giá nào, hưởng bao nhiêu — ngoài hệ thống. | CF-10…12 |
| **Chào hàng** (giao cho CTV) | Việc chủ giao một chiếc cho một CTV bán. **Một chiếc giao được cho nhiều CTV**; chiếc vẫn `in_stock`. Trạng thái: `active`, `won` (CTV này bán được), `lost`, `withdrawn` (thu hồi). | `collaborator_offers` |
| **Báo bán** (CTV báo "đã bán") | CTV báo đã bán một chiếc được giao, kèm tên + SĐT khách (không giá). **Ai báo trước được giữ** (mỗi chiếc một báo bán chờ). Chủ xác nhận ⇒ tạo đơn bán; hoặc từ chối. Trạng thái: `pending`, `confirmed`, `rejected`, `cancelled`, `voided`. | `collaborator_claims` |
| **Thu hồi chào hàng** | Chủ rút chiếc khỏi một hay mọi CTV (khi không có báo bán chờ). | `fn_withdraw_offer` |
| **Quyết toán CTV** ⏸ | Đã bỏ khỏi sản phẩm (CF-11). | `collaborator_settlements` |
| **Phần CTV hưởng** ⏸ | Đã bỏ khỏi sản phẩm: hệ thống không ghi giá CTV bán cho khách (CF-12). | |
| **Thanh toán** (phiếu thu) ⏸ | Đã bỏ khỏi sản phẩm (CF-13); bảng còn trong DB. | `payments` |
| **Còn nợ** ⏸ | Đã bỏ khỏi sản phẩm (CF-13). | BR-PAY-03 |
| **Cọc đang giữ** ⏸ | Đã bỏ khỏi sản phẩm. | |
| **"Đang giao CTV"** | Chiếc `in_stock` có ít nhất một chào hàng `active` (không phải trạng thái riêng). Hiển thị riêng ở kho và báo cáo. | `collaborator_offers` |

## 2. Các khái niệm tiền (bản gọn)

| Khái niệm | Định nghĩa | Tính từ | Không bao gồm |
|---|---|---|---|
| **Doanh thu bán tại cửa hàng** | Σ giá bán các dòng của đơn `confirmed` do **cửa hàng** ghi (theo ngày đơn) | Đơn bán | Đơn đã hủy |
| **Doanh thu CTV bán** | Σ **giá chủ xác nhận** của đơn `confirmed` gắn CTV (mặc định = giá niêm yết hiện hành). Giá CTV bán cho khách **không** ghi nhận | Đơn bán | Phần CTV hưởng (không có trong hệ thống) |
| **Doanh thu sửa chữa** | Σ khoản tiền của phiếu sửa `customer` **đã giao**, tính phí (theo ngày giao) | Phiếu sửa | Bảo hành miễn phí, máy chưa giao |
| **Doanh thu** | Cửa hàng + CTV + sửa chữa | | |
| **CTV mang về** | Số chiếc + Σ giá xác nhận của đơn gắn CTV, theo CTV và theo kỳ | Đơn bán | |

> Không còn: thực thu, giá vốn hàng bán, lãi gộp, còn nợ, cọc, thu nhập khác (CF-13/14). Thiết kế cũ ở `costing-and-profit` và `99-archive/`.

## 3. Phân biệt các thao tác "ngược"

| Thao tác | Khi dùng | Hiệu ứng |
|---|---|---|
| **Sửa** | Chỉ thông tin phụ của chứng từ chưa khóa (phiếu sửa chưa `completed`); **đơn bán đã ghi không sửa** | Thay đổi trực tiếp |
| **Hủy** (void) | Đơn bán nhập nhầm/lỗi trong cửa sổ cho phép (chủ, lý do, nhập lại mật khẩu) | Như chưa từng xảy ra: chiếc về kho, bảo hành hủy, báo bán CTV (nếu có) `voided`; chứng từ giữ lại, trạng thái `voided` |
| **Thu hồi chào hàng** | Chủ rút chiếc khỏi CTV | Chiếc vẫn `in_stock`; CTV không còn thấy chiếc |
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
| Đơn bán · dòng | `sales` · `sale_lines` | `HD-2026-0001` |
| Thu cũ đổi mới | `sale_trade_ins` | — |
| Bảo hành | `warranties` | `BH-2026-0001` |
| Phiếu sửa chữa | `repair_orders` · `repair_lines` | `SC-2026-0001` |
| Hồ sơ CTV | `collaborator_profiles` | — |
| Chào hàng (giao CTV) · báo bán | `collaborator_offers` · `collaborator_claims` | — |
| *(đóng băng)* Phiếu giao CTV · quyết toán CTV | `collaborator_assignments` · `collaborator_settlements` | `GC-…`, `QT-…` |
| Thanh toán (phiếu thu) | `payments` (`direction` in/out) | `PT-2026-0001` |
| Kiểm kê | `stocktakes` · `stocktake_lines` | `KK-2026-0001` |
| Trạng thái chiếc | `unit_status`: `in_stock` Sẵn sàng bán · `inspecting` Chờ kiểm tra · `sold` Đã bán · `written_off` Thanh lý/mất · `cancelled` Nhập nhầm (· ⏸ `reserved` Đã giữ · `with_collaborator` Đang ở CTV · `in_repair` Đang sửa — chỉ còn với dữ liệu cũ) | — |
| Tình trạng hàng | `condition`: `new` Mới · `used` Cũ · `refurbished` Đã sửa chữa/làm mới | — |

Mã chứng từ: tiền tố + năm + số tăng dần (đệm 4 chữ số tối thiểu, tự dài ra); mã danh mục (KH/LK/DH) không có năm. Xem BR-GEN-06.

**Đã hoãn (không còn trong phạm vi xây):** `suppliers`, `cash_accounts`, `ledger_entries`, `payment_allocations`, `account_transfers`, `expense_categories`, `financial_periods`, `account_reconciliations`, `returns` (+`return_lines`), `sale_commissions`, `technician_profiles`, `technician_rates`, `repair_tech_pay`. Thiết kế ở `docs/99-archive/2026-10-16-full-scope/`.
