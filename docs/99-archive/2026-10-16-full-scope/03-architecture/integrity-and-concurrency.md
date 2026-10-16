# Toàn vẹn dữ liệu & xử lý đồng thời

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Đáp ứng yêu cầu III.1, III.6 (kho và tiền luôn khớp) · Test: CT-01…CT-13, `fn_consistency_check`

Bài học từ dự án mẫu: các lỗi nặng nhất (chi tiền lọt vào kỳ đã khóa, trùng sức chứa, thất thoát tiền qua đường vòng) **chỉ lộ khi chạy hai phiên song song** — đọc tài liệu không thấy. Vì vậy phần này vừa là quy tắc thiết kế vừa là danh sách ca đồng thời bắt buộc.

## 1. Mức cô lập & chiến lược

- Mức mặc định `READ COMMITTED` + **khóa tường minh** (`SELECT … FOR UPDATE`) trên đúng các dòng cần bảo vệ + **ràng buộc `UNIQUE` một phần** làm lưới an toàn cuối. Không dùng `SERIALIZABLE` (khó dự đoán retry, không cần thiết khi khóa đúng).
- Một thao tác nghiệp vụ = một `fn_*` = một transaction. Hàm **không** gọi ra ngoài (HTTP/Storage) bên trong transaction.
- API xử lý lỗi `40001` (serialization) và `40P01` (deadlock) bằng **thử lại tối đa 2 lần** với cùng `Idempotency-Key`; `55P03` (lock timeout) → `WF-BUSY` thân thiện. Đặt `lock_timeout = 5s`, `statement_timeout = 15s` trong mỗi `fn_*`.

## 2. Thứ tự khóa (để không deadlock)

Mọi `fn_*` khóa theo thứ tự cố định, trong mỗi loại sắp theo `id` tăng dần:

1. `watch_units` (các chiếc liên quan)
2. `parts` (các linh kiện liên quan)
3. `reservations`
4. chứng từ gốc (`purchase_receipts`/`sales`/`repair_orders`… nếu cần khóa)
5. `cash_accounts` (các quỹ liên quan)
6. đọc `financial_periods` (không khóa; đọc **sau** khi khóa quỹ)

Quy tắc: ai cần chiếc + quỹ thì khóa chiếc trước rồi quỹ; `fn_close_period` khóa các quỹ trước khi đọc/ghi trạng thái kỳ; `fn_transfer_between_accounts` khóa hai quỹ theo `id` tăng.

## 3. Hợp đồng từng hàm trọng yếu

### `fn_confirm_sale(sale_id, payload)`
1. Kiểm quyền (`sale.confirm`), phiếu `draft`, người dùng được phép (CTV không xác nhận).
2. Khóa chiếc (`FOR UPDATE`, theo id) và linh kiện; kiểm `status` hợp lệ: `in_stock`, hoặc `reserved` bởi **chính** `reservation` của phiếu (BR-SALE-02). Chiếc đã bán/đang giữ khác ⇒ `WF-SALE-UNIT-UNAVAILABLE`.
3. Kiểm hạn mức giảm giá (BR-SALE-03), bán dưới giá vốn (BR-SALE-04), khách bắt buộc nếu còn nợ (BR-SALE-07), tổng thanh toán ≤ `grand_total`.
4. Kiểm kỳ của `doc_date` đang mở **sau** khi khóa quỹ (bước 6).
5. Đổi trạng thái chiếc → `sold`; trừ linh kiện (movement `sale`); đặt `sale_lines.is_effective=true` (partial unique chặn trùng ở mức cuối).
6. Khóa các quỹ cần ghi (theo id). Ghi `sale_line_costs` (chốt giá vốn), `payments` + `payment_allocations` + `ledger_entries` (BR-FIN-01), bù trừ (thu cũ đổi mới / cọc) theo cặp.
7. Tạo `sale_commissions`, `warranties`; nếu có trade-in: tạo + xác nhận phiếu nhập `trade_in` trong cùng hàm (gọi nội bộ `fn_confirm_purchase`).
8. `audit_logs`, `domain_events('sale.confirmed')`. Trả `sale` đã cập nhật.
Mọi lỗi ở bất kỳ bước ⇒ `RAISE` ⇒ rollback toàn bộ (không có "tiền vào mà kho chưa trừ").

### `fn_confirm_purchase`
Khóa chiếc cũ (nếu mua lại) và linh kiện; kiểm trùng serial (unique một phần là lưới cuối); sinh `asset_code` (`fn_next_number`); phân bổ chi phí (`allocate`); ghi `unit_cost_entries`; cập nhật `parts.qty_on_hand` + `part_costs.avg_cost` (khóa dòng linh kiện); ghi payments/ledger nếu có thanh toán kèm theo.

### `fn_post_ledger_entry` (nội bộ)
Khóa dòng `cash_accounts` → đọc entry cuối → kiểm kỳ mở → kiểm số dư không âm → chèn `seq+1` với `balance_after`, `prev_hash`, `hash`. **Không bao giờ** tính số dư bằng `SUM` lúc ghi (dựa vào entry cuối đã khóa).

### `fn_close_period(month)`
Khóa **tất cả** quỹ (id tăng) → kiểm đã đối chiếu → `fn_verify_ledger_chain` → đặt `closed`. Vì `fn_post_ledger_entry` cùng khóa quỹ rồi mới đọc kỳ, một bút toán đang chờ sẽ hoặc hoàn tất trước khi khóa kỳ (được tính vào đối chiếu) hoặc bị từ chối sau khi kỳ khóa — không bao giờ lọt vào kỳ đã khóa (CT-06).

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
| B5 | `seq` sổ quỹ liên tục, không trùng | `UNIQUE (account_id, seq)` + khóa quỹ |
| B6 | Sổ quỹ/audit/lịch sử/giá vốn không sửa xóa | `tg_immutable`, `tg_no_truncate` |
| B7 | Chứng từ đã xác nhận không sửa | `tg_confirmed_doc_guard` |
| B8 | Serial duy nhất theo thương hiệu | `UNIQUE (brand_id, serial_norm) WHERE …` |
| B9 | Tổng phân bổ ≤ số tiền payment | trigger trên `payment_allocations` (khóa dòng payment) |
| B10 | `payment` offset không có quỹ; thật phải có quỹ | `CHECK ((method='offset') = (account_id IS NULL))` |
| B11 | Luôn còn ≥ 1 owner | `tg_ensure_owner` |
| B12 | Mã chứng từ không trùng | `U(code)` + `number_sequences` trong transaction |

## 5. Idempotency

Bảng `idempotency_keys(key, user_id, route, request_hash, response, status_code)`. Quy trình trong `api()`:
1. Header `Idempotency-Key` (UUID do client sinh, **giữ nguyên khi thử lại**).
2. Trong transaction: chèn khóa; nếu đã tồn tại ⇒ so `request_hash`: khớp ⇒ trả lại `response` đã lưu (status cũ); khác ⇒ `WF-IDEMPOTENCY-MISMATCH` (422).
3. Lưu `response` cùng transaction với `fn_*` (nên "đã ghi nhưng chưa lưu khóa" là không thể).
4. TTL 48 giờ (job dọn).
Bắt buộc cho: xác nhận/hủy mọi chứng từ, tạo payment, giữ hàng, đổi trả, giao máy, kiểm kê chốt, chi trả hoa hồng/tiền công.

## 6. Khóa lạc quan (sửa nháp)

Chứng từ nháp và danh mục có `version`; `PATCH` gửi `If-Match: <version>`; lệch ⇒ `WF-CONFLICT-VERSION` (412) kèm bản mới nhất để người dùng hợp nhất. Tránh hai người sửa đè lên nhau trên cùng một phiếu nháp.

## 7. Bộ kiểm bất biến định kỳ `app.fn_consistency_check()`

Chạy hằng đêm (cron evening) và trước khi khóa kỳ; ghi `job_runs`; lệch ⇒ thông báo chủ + `error_events`. Mỗi kiểm tra trả danh sách vi phạm (id, mô tả).

| # | Kiểm tra |
|---|---|
| I1 | Mỗi payment `posted` không offset có đúng 1 bút toán `normal`; mỗi payment `voided` có bút toán đảo tương ứng |
| I2 | `balance_after` của bút toán cuối mỗi quỹ = Σ vào − Σ ra + số dư đầu; chuỗi băm toàn vẹn (`fn_verify_ledger_chain`) |
| I3 | Với mỗi `offset_kind` + tham chiếu: Σ offset vào = Σ offset ra |
| I4 | Σ allocations ≤ số tiền payment; allocations không vượt dư nợ chứng từ |
| I5 | Trạng thái chiếc = `to_status` của dòng lịch sử cuối |
| I6 | Mỗi chiếc `sold` có đúng 1 dòng bán hiệu lực; không chiếc nào có 2 dòng hiệu lực |
| I7 | Mỗi chiếc `reserved` có đúng 1 giữ hàng hiệu lực; mỗi giữ hàng hiệu lực ↔ chiếc `reserved` |
| I8 | `parts.qty_on_hand` = Σ `part_stock_movements.qty_delta` |
| I9 | Mỗi dòng bán hiệu lực có `sale_line_costs`; giá vốn chiếc = Σ `unit_cost_entries` chu kỳ hiện hành |
| I10 | Mỗi dòng phiếu nhập `confirmed` kiểu đồng hồ có `unit_id`; phiếu `voided` không còn chiếc `in_stock` |
| I11 | Không bút toán/chứng từ có ngày trong kỳ `closed` được tạo sau thời điểm khóa kỳ |
| I12 | Hoa hồng `paid` ≤ Σ phân bổ `commission_payout`; mọi sale `confirmed` của CTV có hoa hồng |
| I13 | Phiếu sửa `delivered` có `repair_tech_pay` (hoặc thợ `salary`) và doanh thu bằng Σ dòng |

## 8. Danh sách ca đồng thời bắt buộc (chi tiết ở `test-plan`)

CT-01 hai phiên bán cùng một chiếc · CT-02 hai phiên giữ cùng một chiếc · CT-03 bán vs giữ cùng chiếc · CT-04 hai phiên dùng linh kiện còn 1 · CT-05 ghi quỹ song song (chuỗi băm/số dư) · CT-06 khóa kỳ vs ghi quỹ · CT-07 xác nhận hai lần cùng khóa idempotency · CT-08 hủy vs đổi trả cùng phiếu · CT-09 hai phiếu nhập cùng serial · CT-10 trả nợ vượt dư nợ song song · CT-11 sinh mã chứng từ song song · CT-12 hủy phiếu nhập vs bán chiếc của phiếu đó · CT-13 hai kiểm kê điều chỉnh cùng linh kiện.

**Cách test:** mỗi ca mở N kết nối riêng (mỗi request là một kết nối mới — kinh nghiệm từ dự án mẫu: smoke test một phiên không bắt được race), chạy song song bằng `Promise.all`, kiểm đúng kết quả + `fn_consistency_check()` sạch. Các ca này phải **thất bại khi cố tình bỏ khóa/ràng buộc** (kiểm chứng test thật sự phát hiện lỗi).
