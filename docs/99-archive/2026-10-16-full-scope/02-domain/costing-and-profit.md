# Giá vốn, phân bổ chi phí & lợi nhuận

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Quy tắc gốc: BR-COST-*, BR-PUR-03/05, BR-PART-02, BR-SALE-13, BR-REP-08/09

## 1. Hai phương pháp giá vốn

| Đối tượng | Phương pháp | Lưu ở | Lý do |
|---|---|---|---|
| **Đồng hồ** (từng chiếc) | **Đích danh**: giá vốn của chính chiếc đó | `unit_cost_entries` (append-only, theo chu kỳ) | Mỗi chiếc có giá mua, chi phí, lịch sử riêng |
| **Linh kiện** | **Bình quân gia quyền di động** | `part_costs.avg_cost` + `part_stock_movements.unit_cost` | Hàng đồng loại, nhập nhiều lô giá khác nhau |

## 2. Giá vốn một chiếc đồng hồ

`giá vốn(chiếc, chu kỳ c) = Σ unit_cost_entries.amount WHERE cycle = c`

`unit_cost_entries.kind`:
| kind | Khi nào sinh | Dấu |
|---|---|---|
| `purchase` | Xác nhận phiếu nhập (giá nhập của dòng) | + |
| `purchase_cost` | Xác nhận phiếu nhập (phần chi phí liên quan **được phân bổ** cho chiếc) | + |
| `repair_part` | Phiếu sửa nội bộ `completed` (linh kiện × giá bình quân lúc dùng, làm tròn đồng) | + |
| `repair_labor` | Phiếu sửa nội bộ `completed` (nhân công nội bộ) | + |
| `other` | Chi phí khác gắn thẳng vào chiếc (có quyền `cost.adjust`) | + |
| `adjustment` | Điều chỉnh sau xác nhận (lý do bắt buộc) | ± |

Quy tắc: không sửa/xóa dòng; sai ⇒ thêm `adjustment`. Hủy phiếu nhập ⇒ thêm dòng đảo cùng `ref`. **Chu kỳ**: chiếc được mua lại (BR-PUR-10) ⇒ `cost_cycle + 1`; dòng mới thuộc chu kỳ mới; chu kỳ cũ giữ nguyên làm lịch sử.

**Nhân công nội bộ** [`repair.internal_labor_costing`]: mặc định = số tiền dòng nhân công trên phiếu sửa nội bộ (người dùng nhập). Nếu thợ là `salary` có thể nhập 0.

## 3. Phân bổ chi phí liên quan của phiếu nhập

Đầu vào: các dòng đồng hồ/linh kiện có `line_total_i = giá_i × SL_i` (VND nguyên); một chi phí `C` (vd. vận chuyển) với `method` ∈ {`by_value` (mặc định), `equal`}.

**Thuật toán (xác định, tổng luôn khớp tuyệt đối):**
1. Với `by_value`: `base_i = floor(C × line_total_i / Σ line_total)`; với `equal`: `base_i = floor(C / n)`. (Chia số nguyên, không dùng số thực.)
2. `dư = C − Σ base_i` (0 ≤ dư < n).
3. Cộng `dư` vào dòng có `line_total` **lớn nhất**; hòa ⇒ dòng có số thứ tự nhỏ nhất.
4. Cuối cùng `Σ phân bổ_i = C` chính xác.

Nhiều chi phí ⇒ phân bổ từng chi phí độc lập rồi cộng.

**Dòng linh kiện** nhận phần phân bổ của dòng; đơn giá vốn lô = `(line_total_i + phân bổ_i) / SL_i` (giữ `numeric(14,4)`).
**Dòng đồng hồ** nhận phần phân bổ thành một `unit_cost_entries(kind='purchase_cost')`.

Chi phí phát sinh **sau** khi xác nhận phiếu (vd. phí giao hàng đến muộn) ⇒ `adjustment` hoặc `other` có lý do, không sửa phiếu.

## 4. Giá vốn bình quân linh kiện

Trạng thái: `qty` (đang tồn), `avg` (`numeric(14,4)`).

- **Nhập lô** `(q, unit_cost_lô)` (unit_cost_lô đã gồm phân bổ chi phí): `avg' = (qty × avg + q × unit_cost_lô) / (qty + q)`; `qty' = qty + q`. Khi `qty = 0`, `avg' = unit_cost_lô`.
- **Xuất** `q`: giá vốn xuất `= round_half_up(q × avg)` (đồng); `qty' = qty − q`; **`avg` không đổi**. Giá vốn xuất được **chốt** vào dòng sử dụng/bán.
- **Điều chỉnh/kiểm kê**: lệch `−q` dùng `avg` hiện tại; lệch `+q` (tìm thấy) dùng `avg` hiện tại (không đổi `avg`).
- **Hủy phiếu nhập** lô: đảo bằng cách trừ `q` tại lô (yêu cầu `qty ≥ q`); `avg` tính lại từ trạng thái trước lô (lưu `prev_avg`/`prev_qty` trong movement để đảo chính xác) — cho phép hủy chỉ khi chưa có xuất sau lô đó (BR-PUR-07 đảm bảo "chưa phát sinh giao dịch khác").

## 5. Làm tròn (một nơi, một hàm)

Hàm `src/lib/money.ts` (+ bản SQL tương ứng `app.round_vnd`):
- `roundHalfUp(x: number-like) → bigint` — nửa lên về đồng.
- `allocate(total, weights, {tie: 'largest-then-first'})` — phân bổ nguyên theo trọng số, tổng khớp (dùng cho chi phí, giảm giá tổng).
- Test đơn vị bắt buộc cho: dư 1 đồng, dư n−1 đồng, trọng số bằng nhau, một dòng, tổng 0, giá trị rất lớn (< 2^53).

**Ví dụ (SC-11)**: chi phí 1.000.000 chia 3 dòng đều 3.000.000: `base = 333.333 ×3 = 999.999`, dư 1 ⇒ dòng đầu 333.334. Linh kiện: 3 cái × 10.000 + 4 cái × 11.000 ⇒ `avg = (30.000+44.000)/7 = 10.571,4286`; xuất 2 cái ⇒ `round_half_up(2 × 10.571,4286) = round(21.142,8572) = 21.143`.

## 6. Giảm giá & doanh thu từng dòng

- Mỗi dòng bán: `list_price_snapshot` (giá hiệu lực lúc lập), `unit_price` (giá bán thực, người dùng có thể giảm), `line_discount = (list − unit_price) × qty`.
- **Giảm giá tổng phiếu** `D` phân bổ vào các dòng theo tỷ lệ `Σ unit_price × qty` bằng `allocate` (BR-SALE-13). `line_total_i = unit_price_i × qty_i − phân bổ D_i`.
- `grand_total = Σ line_total_i`.
- Tính % giảm cho hạn mức vai trò (BR-SALE-03): `(Σ list × qty − grand_total) / Σ list × qty` (thu cũ đổi mới không tính vào đây).

## 7. Lãi gộp

### 7.1 Bán hàng
- Dòng: `gross_profit_line = line_total − cost_snapshot` (cost chốt khi xác nhận; đồng hồ = giá vốn chu kỳ hiện hành tại lúc bán; linh kiện = `round(q × avg)`).
- Phiếu: `Σ gross_profit_line`.
- **Đổi trả** (ngày R): doanh thu −= `giá trị trả` và giá vốn −= `cost_snapshot` của dòng trả *ghi nhận ở ngày R* ⇒ lãi gộp kỳ R giảm đúng phần đã ghi nhận trước đó.
- **Hủy phiếu** (void): phiếu loại khỏi mọi tổng (như chưa xảy ra).

### 7.2 Sửa chữa (khách)
`lãi gộp sửa chữa = doanh thu sửa chữa − Σ giá vốn linh kiện đã dùng (chốt lúc dùng) − tiền công thợ theo ca`

- **Doanh thu** = Σ dòng `labor` + `part` + `other` của phiếu `delivered`, `paid` (không tính `warranty_free`).
- **Giá vốn linh kiện** = Σ `repair_line_costs.cost_amount` (chốt lúc xác nhận dùng).
- **Tiền công thợ** = `repair_tech_pay.amount` (BR-REP-08):
  - `percent`: `round_half_up(pay_percent × Σ dòng labor)` (nhân công *tính cho khách*, không gồm linh kiện);
  - `fixed_per_service`: Σ mức cố định `technician_rates` theo từng `service_type` của dòng labor;
  - `salary`: 0.
- **Không tính trùng**: linh kiện chỉ xuất hiện ở dòng sửa (không đồng thời là phiếu bán lẻ); tiền công thợ là *chi phí*, nhân công khách trả là *doanh thu* — hai chiều khác nhau.
- **Bảo hành** (`warranty_free`): doanh thu 0; chi phí linh kiện & công (nếu thợ `percent`/`fixed` thì theo mức dòng labor tham chiếu bảng giá) ghi vào **chi phí bảo hành** (âm trong lãi gộp sửa chữa).

### 7.3 Sửa nội bộ
Không có doanh thu; chi phí đi vào giá vốn chiếc (BR-COST-04) ⇒ thể hiện ở lãi gộp lúc **bán** chiếc đó.

### 7.4 Lãi ròng tạm tính
`= Lãi gộp (bán + sửa) − Chi phí hoạt động (payments purpose=expense, category.is_operating) − Hoa hồng CTV (chốt) − Hao hụt kiểm kê (giá vốn chiếc/linh kiện written_off) + Thu nhập khác`

Không gồm: lương nhân viên, khấu hao, thuế (ngoài phạm vi). Dùng để *tham khảo quản trị*, không phải báo cáo thuế.

## 8. Quyền xem

| Dữ liệu | Quyền | Nơi lưu (RLS) |
|---|---|---|
| Giá nhập, giá vốn chiếc | `cost.view` | `unit_cost_entries`, `purchase_lines/costs` (thêm `purchase.view`) |
| Giá vốn linh kiện | `cost.view` | `part_costs`, `part_stock_movements` (cần `part.manage` hoặc `cost.view`) |
| Giá vốn dòng bán, lãi gộp | `cost.view` / `profit.view` | `sale_line_costs`, hàm báo cáo `SECURITY DEFINER` kiểm quyền |
| Giá vốn linh kiện sửa, tiền công thợ | `cost.view`; thợ luôn thấy tiền công **của mình** | `repair_line_costs`, `repair_tech_pay` |
| Hoa hồng | `commission.view`; CTV thấy của mình | `sale_commissions` |

Các hàm báo cáo nhạy cảm kiểm quyền **trong thân hàm**; thiếu quyền ⇒ lỗi 403 (không trả hàng rỗng gây hiểu lầm bằng 0).
