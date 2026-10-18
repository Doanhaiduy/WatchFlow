# Toàn vẹn dữ liệu & xử lý đồng thời

> Cập nhật lần cuối: 2026-10-17 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`) · Đáp ứng yêu cầu III.1, III.6 (kho và tiền luôn khớp) · Test: CT-01…CT-13, `fn_consistency_check`

Bài học từ dự án mẫu: các lỗi nặng nhất (trùng chỗ, thất thoát tiền qua đường vòng, ghi lọt vào dữ liệu đã chốt) **chỉ lộ khi chạy hai phiên song song** — đọc tài liệu không thấy. Vì vậy phần này vừa là quy tắc thiết kế vừa là danh sách ca đồng thời bắt buộc.

## 1. Mức cô lập & chiến lược

- Mức mặc định `READ COMMITTED` + **khóa tường minh** (`SELECT … FOR UPDATE`) trên đúng các dòng cần bảo vệ + **ràng buộc `UNIQUE` một phần** làm lưới an toàn cuối. Không dùng `SERIALIZABLE` (khó dự đoán retry, không cần thiết khi khóa đúng).
- Một thao tác nghiệp vụ = một `fn_*` = một transaction. Hàm **không** gọi ra ngoài (HTTP/Storage) bên trong transaction.
- API xử lý lỗi `40001` (serialization) và `40P01` (deadlock) bằng **thử lại tối đa 2 lần** với cùng `Idempotency-Key`; `55P03` (lock timeout) → `WF-BUSY` thân thiện. Đặt `lock_timeout = 5s`, `statement_timeout = 15s` trong mỗi `fn_*`.

## 2. Thứ tự khóa (để không deadlock)

Mọi `fn_*` khóa theo thứ tự cố định, trong mỗi loại sắp theo `id` tăng dần:

1. `watch_units` (các chiếc liên quan)
2. `parts` (các linh kiện liên quan)
3. `reservations`
4. chứng từ gốc (`sales`, `collaborator_assignments`, `collaborator_settlements`, `repair_orders`, `purchase_receipts`) — khi cần khóa để kiểm tổng thanh toán hoặc trạng thái
5. ghi `payments` (kiểm tổng với chứng từ đã khóa ở bước 4)

Quy tắc: ai cần chiếc + chứng từ thì khóa chiếc trước rồi chứng từ. `fn_settle_collaborator` khóa các **phiếu bán cha** (theo id) bằng một câu lệnh riêng, rồi mới khóa/đọc các `sale_lines` và tạo thanh toán (cùng thứ tự phiếu → dòng với `fn_void_sale`). (Không còn khóa quỹ/kỳ — CF-07.)

> **Bẫy READ COMMITTED (0022):** `SELECT … FROM sale_lines JOIN sales … FOR UPDATE OF sale_lines` chỉ kiểm lại dòng **đã khóa** sau khi chờ khóa; cột của bảng nối (`sales.status`) giữ giá trị cũ từ snapshot của câu lệnh. Muốn đọc trạng thái chứng từ cha sau khi đối thủ commit thì phải khóa chứng từ cha bằng câu lệnh **riêng, đứng trước** (câu lệnh sau lấy snapshot mới) — hoặc `FOR UPDATE` cả hai bảng theo đúng thứ tự khóa chung.

## 3. Hợp đồng từng hàm trọng yếu

### `fn_confirm_sale(sale_id, payload)`
1. Kiểm quyền (`sale.confirm`), phiếu `draft`.
2. Khóa chiếc (`FOR UPDATE`, theo id) và linh kiện; kiểm `status` hợp lệ (BR-SALE-02): cửa hàng bán ⇒ `in_stock`, hoặc `reserved` bởi **chính** giữ hàng của phiếu; đơn CTV ⇒ `with_collaborator` với `held_by_collaborator_id` = CTV của đơn **và** dòng phiếu giao `active`. Sai ⇒ `WF-SALE-UNIT-UNAVAILABLE`.
3. Kiểm hạn mức giảm giá, bán dưới giá vốn (chỉ đơn cửa hàng), khách bắt buộc nếu còn nợ, tổng thanh toán ≤ phải thu.
4. Đổi trạng thái chiếc → `sold`; trừ linh kiện (movement `sale`); đặt `sale_lines.is_effective=true` (partial unique chặn trùng ở mức cuối). Đơn CTV: đóng dòng phiếu giao (`sold`), chốt `base_price_vnd` từ dòng phiếu giao, đặt `shop_revenue_vnd = base_price`; phiếu giao tự `closed` nếu hết dòng active.
5. Ghi `sale_line_costs` (chốt giá vốn) và các `payments` của phiếu (đơn cửa hàng); xử lý thu cũ đổi mới (gọi nội bộ `fn_confirm_purchase` kiểu `trade_in`); trừ cọc (`reservations.applied_vnd`, giữ hàng → `converted`).
6. Tạo `warranties`; `audit_logs`; `domain_events('sale.confirmed')`. Trả `sale` đã cập nhật.
Mọi lỗi ở bất kỳ bước ⇒ `RAISE` ⇒ rollback toàn bộ (không có "có thanh toán mà kho chưa trừ").

### `fn_confirm_purchase`
Khóa chiếc cũ (nếu mua lại) và linh kiện; kiểm trùng serial (unique một phần là lưới cuối); sinh `asset_code` (`fn_next_number`); phân bổ chi phí (`allocate`); ghi `unit_cost_entries`; cập nhật `parts.qty_on_hand` + `part_costs.avg_cost` (khóa dòng linh kiện).

### `fn_record_payment(doc_type, doc_id, purpose, method, amount, …)`
Khóa dòng chứng từ gốc → tính lại `payable`/`paid_net` từ dữ liệu → kiểm không vượt (BR-PAY-03) → chèn `payments`. Hai phiên cùng thu thêm vào một phiếu: phiên sau thấy `paid_net` của phiên trước (do khóa dòng chứng từ) nên bị `WF-PAY-OVERPAY` nếu vượt (CT-05).

### `fn_confirm_assignment(assignment_id)`
Khóa các chiếc theo id; kiểm `in_stock` (không `reserved`/đã giao); chuyển `with_collaborator`, đặt `held_by_collaborator_id`; trigger chặn đổi `base_price_vnd`. Hai phiên giao cùng chiếc cho hai CTV: unique `U(unit_id) WHERE status='active'` là lưới cuối (CT-06).

### `fn_settle_collaborator(collaborator_id, line_ids, method, doc_date)`
Khóa các phiếu bán cha (theo id) rồi `sale_lines` theo id; mỗi dòng phải là dòng CTV của đúng CTV, phiếu `confirmed`, chưa có `settlement_id`; tạo `collaborator_settlements` + `payments(collab_settlement)` = Σ giá thu; gán `settlement_id`. Hai phiên quyết toán cùng dòng: phiên sau thấy `settlement_id` đã gán ⇒ lỗi (CT-10).

### `fn_void_sale`
Khóa chiếc, rồi phiếu; kiểm cửa sổ hủy, chưa dùng cọc, (đơn CTV) dòng chưa quyết toán; đảo kho/trạng thái, hủy các `payments` và `warranties`. Hủy vs quyết toán đồng thời: kết quả duy nhất một bên thắng (CT-08).

### `fn_use_repair_part` / `fn_adjust_part_stock`
Khóa dòng `parts`; kiểm `qty_on_hand − q ≥ 0` (CHECK là lưới cuối); ghi movement với `prev_qty`, `prev_avg`.

### `fn_create_reservation`
Khóa chiếc; kiểm `in_stock`; chèn `reservations` (unique một phần `(unit_id) WHERE status IN ('active','expired')` là lưới cuối); ghi cọc.

## 4. Bất biến dữ liệu (DB tự bảo vệ)

| # | Bất biến | Cơ chế |
|---|---|---|
| B1 | Một chiếc chỉ ở một trạng thái hợp lệ; chuyển đúng ma trận | Cột `status` + `tg_unit_status_guard` + GRANT (không UPDATE trực tiếp) |
| B2 | Một chiếc có tối đa một dòng bán hiệu lực | `UNIQUE (unit_id) WHERE is_effective` |
| B3 | Một chiếc có tối đa một giữ hàng hiệu lực | `UNIQUE (unit_id) WHERE status IN ('active','expired')` |
| B4 | Tồn linh kiện không âm | `CHECK (qty_on_hand >= 0)` + khóa dòng |
| B5 | Một chiếc thuộc tối đa một dòng phiếu giao CTV `active`; `with_collaborator` ⇔ có `held_by_collaborator_id` | `UNIQUE (unit_id) WHERE status='active'` + `CHECK` |
| B6 | Lịch sử/audit/giá vốn/movements không sửa xóa | `tg_immutable`, `tg_no_truncate` |
| B7 | Chứng từ đã xác nhận không sửa; thanh toán không sửa số tiền | `tg_confirmed_doc_guard` |
| B8 | Serial duy nhất theo thương hiệu | `UNIQUE (brand_id, serial_norm) WHERE …` |
| B9 | Tổng thanh toán `in` của một phiếu ≤ phải thu | Khóa dòng chứng từ + kiểm trong `fn_record_payment` + view đối chiếu I2 |
| B10 | Giá thu giao CTV không đổi sau xác nhận | `tg_assignment_price_guard` |
| B11 | Luôn còn ≥ 1 owner | `tg_ensure_owner` |
| B12 | Mã chứng từ không trùng | `U(code)` + `number_sequences` trong transaction |
| B13 | Mỗi dòng bán CTV quyết toán tối đa một lần | `sale_lines.settlement_id` đặt trong khóa dòng; kiểm `NULL` trước khi gán |

## 5. Idempotency

Bảng `idempotency_keys(key, user_id, route, request_hash, response, status_code)`. Quy trình trong `api()`:
1. Header `Idempotency-Key` (UUID do client sinh, **giữ nguyên khi thử lại**).
2. Trong transaction: chèn khóa; nếu đã tồn tại ⇒ so `request_hash`: khớp ⇒ trả lại `response` đã lưu (status cũ); khác ⇒ `WF-IDEMPOTENCY-MISMATCH` (422).
3. Lưu `response` cùng transaction với `fn_*` (nên "đã ghi nhưng chưa lưu khóa" là không thể).
4. TTL 48 giờ (job dọn).
Bắt buộc cho: xác nhận/hủy mọi chứng từ, ghi thanh toán, giữ hàng, giao/thu hồi/quyết toán CTV, giao máy sửa, kiểm kê chốt.

## 6. Khóa lạc quan (sửa nháp)

Chứng từ nháp và danh mục có `version`; `PATCH` gửi `If-Match: <version>`; lệch ⇒ `WF-CONFLICT-VERSION` (412) kèm bản mới nhất để người dùng hợp nhất. Tránh hai người sửa đè lên nhau trên cùng một phiếu nháp.

**Tự lưu nháp ở POS (`/ban-hang/moi`)** tuân theo khóa này như sau (đã kiểm bằng kịch bản trình duyệt giả lập máy chủ):
- Một lúc chỉ **một** yêu cầu ghi nháp bay (vòng lưu tuần tự, luôn gửi nội dung mới nhất); thanh toán chờ vòng lưu xong rồi mới xác nhận.
- **Mở** một nháp có sẵn không ghi lại gì; chỉ ghi khi người dùng sửa.
- Gặp 412: lấy lại phiếu. Nếu **nội dung máy chủ không đổi** so với lần đồng bộ gần nhất (chỉ lệch số phiên bản — ví dụ mất phản hồi của lần lưu trước) ⇒ nhận phiên bản mới và lưu lại một lần. Nếu **nội dung đã khác** (người khác sửa thật) ⇒ **không ghi đè**, báo xung đột kèm nút **Tải lại phiếu**. Phiếu đã xác nhận/hủy ở nơi khác ⇒ chuyển sang trang chi tiết phiếu.

## 7. Bộ kiểm bất biến định kỳ `app.fn_consistency_check()`

Chạy hằng đêm (cron evening) và sau mỗi bộ SC/CT; ghi `job_runs`; lệch ⇒ thông báo chủ + `error_events`. Mỗi kiểm tra trả danh sách vi phạm (id, mô tả).

| # | Kiểm tra |
|---|---|
| I1 | Mỗi `payment` `posted` gắn đúng một chứng từ tồn tại; `purpose` ↔ `doc_type` ↔ `direction` hợp lệ |
| I2 | Với mỗi phiếu: Σ thanh toán `in` ≤ phải thu; giữ hàng: `applied + refunded + forfeited ≤ đã thu cọc` và `= ` khi đã đóng |
| I3 | Trạng thái chiếc = `to_status` của dòng lịch sử cuối |
| I4 | Mỗi chiếc `sold` có đúng 1 dòng bán hiệu lực; không chiếc nào có 2 dòng hiệu lực |
| I5 | Mỗi chiếc `reserved` có đúng 1 giữ hàng hiệu lực; mỗi giữ hàng hiệu lực ↔ chiếc `reserved` |
| I6 | Mỗi chiếc `with_collaborator` có đúng 1 dòng phiếu giao `active` và `held_by_collaborator_id` khớp CTV của phiếu; ngược lại |
| I7 | `parts.qty_on_hand` = Σ `part_stock_movements.qty_delta` |
| I8 | Mỗi dòng bán hiệu lực có `sale_line_costs`; giá vốn chiếc = Σ `unit_cost_entries` chu kỳ hiện hành |
| I9 | Mỗi dòng phiếu nhập `confirmed` kiểu đồng hồ có `unit_id`; phiếu `voided` không còn chiếc `in_stock` |
| I10 | `collaborator_settlements.total_vnd` = Σ `base_price_vnd` các dòng trỏ tới; thanh toán `collab_settlement` khớp (khi `confirmed`) |
| I11 | Dòng bán: `shop_revenue_vnd = line_total` (cửa hàng bán) hoặc `= base_price_vnd` (CTV bán) |
| I12 | Phiếu sửa `delivered` có doanh thu = Σ dòng; phiếu `warranty_free` có doanh thu 0 |

## 8. Danh sách ca đồng thời bắt buộc (chi tiết ở `test-plan`)

CT-01 hai phiên bán cùng một chiếc · CT-02 hai phiên giữ cùng một chiếc · CT-03 bán vs giữ cùng chiếc · CT-04 hai phiên dùng linh kiện còn 1 · CT-05 hai phiên thu thêm vào cùng phiếu (vượt phải thu) · CT-06 hai phiên giao cùng một chiếc cho hai CTV / giao vs giữ hàng vs bán · CT-07 xác nhận hai lần cùng khóa idempotency · CT-08 hủy phiếu bán CTV vs quyết toán · CT-09 hai phiếu nhập cùng serial · CT-10 hai phiên quyết toán cùng dòng · CT-11 sinh mã chứng từ song song · CT-12 hủy phiếu nhập vs bán chiếc của phiếu đó · CT-13 hai kiểm kê điều chỉnh cùng linh kiện.

**Cách test:** mỗi ca mở N kết nối riêng (mỗi request là một kết nối mới — kinh nghiệm từ dự án mẫu: smoke test một phiên không bắt được race), chạy song song bằng `Promise.all`, kiểm đúng kết quả + `fn_consistency_check()` sạch. Các ca này phải **thất bại khi cố tình bỏ khóa/ràng buộc** (kiểm chứng test thật sự phát hiện lỗi).
