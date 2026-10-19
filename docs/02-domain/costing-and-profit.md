# Giá vốn, phân bổ chi phí & lợi nhuận

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: **Chỉ còn tham khảo (đóng băng)** — từ `customer-feedback-02` sản phẩm không còn giá vốn/lãi gộp/linh kiện/phân bổ chi phí (ADR-028). Giá nhập vẫn được ghi nội bộ (không hiển thị); nếu bật lại tính năng, tài liệu này là thiết kế gốc.
> (Bản vòng 1: đã cập nhật theo `customer-feedback-01`) · Quy tắc gốc: BR-COST-*, BR-PUR-03/05, BR-PART-02, BR-SALE-13, BR-COL-04, BR-WAR-03, BR-REP-09

## 1. Hai phương pháp giá vốn

| Đối tượng | Phương pháp | Lưu ở | Lý do |
|---|---|---|---|
| **Đồng hồ** (từng chiếc) | **Đích danh**: giá vốn của chính chiếc đó | `unit_cost_entries` (append-only, theo chu kỳ) | Mỗi chiếc có giá mua, chi phí, lịch sử riêng |
| **Linh kiện** | **Bình quân gia quyền di động** | `part_costs.avg_cost` + `part_stock_movements.unit_cost` | Hàng đồng loại, nhập nhiều lô giá khác nhau |

> "Giá vốn" của chiếc chính là cái khách gọi là **giá thu** (xem `glossary`). **Giá thu giao CTV** là khái niệm khác (giá chủ báo cho CTV) và *không* làm đổi giá vốn (BR-COST-07).

## 2. Giá vốn một chiếc đồng hồ

`giá vốn(chiếc, chu kỳ c) = Σ unit_cost_entries.amount WHERE cycle = c`

`unit_cost_entries.kind`:
| kind | Khi nào sinh | Dấu |
|---|---|---|
| `purchase` | Xác nhận phiếu nhập (giá nhập của dòng) | + |
| `purchase_cost` | Xác nhận phiếu nhập (phần chi phí liên quan **được phân bổ** cho chiếc) | + |
| `repair_part` | Phiếu sửa nội bộ `completed` (linh kiện × giá bình quân lúc dùng, làm tròn đồng) | + |
| `repair_other` | Phiếu sửa nội bộ `completed` (chi phí khác chủ nhập: gửi hãng sửa, gia công ngoài…) | + |
| `other` | Chi phí khác gắn thẳng vào chiếc (có quyền `cost.adjust`) | + |
| `adjustment` | Điều chỉnh sau xác nhận (lý do bắt buộc) | ± |

Quy tắc: không sửa/xóa dòng; sai ⇒ thêm `adjustment`. Hủy phiếu nhập ⇒ thêm dòng đảo cùng `ref`. **Chu kỳ**: chiếc được mua lại (BR-PUR-10) ⇒ `cost_cycle + 1`; dòng mới thuộc chu kỳ mới; chu kỳ cũ giữ nguyên làm lịch sử.

**Chủ tự sửa** (CF-04): không tính tiền công cho thợ; vì vậy sửa nội bộ chỉ vốn hóa **linh kiện đã dùng** và **chi phí khác** (nếu có).

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

Chi phí phát sinh **sau** khi xác nhận phiếu ⇒ `adjustment` hoặc `other` có lý do, không sửa phiếu.

## 4. Giá vốn bình quân linh kiện

Trạng thái: `qty` (đang tồn), `avg` (`numeric(14,4)`).

- **Nhập lô** `(q, unit_cost_lô)` (đã gồm phân bổ chi phí): `avg' = (qty × avg + q × unit_cost_lô) / (qty + q)`; `qty' = qty + q`. Khi `qty = 0`, `avg' = unit_cost_lô`.
- **Xuất** `q`: giá vốn xuất `= round_half_up(q × avg)` (đồng); `qty' = qty − q`; **`avg` không đổi**. Giá vốn xuất được **chốt** vào dòng sử dụng/bán.
- **Điều chỉnh/kiểm kê**: lệch `−q` dùng `avg` hiện tại; lệch `+q` (tìm thấy) dùng `avg` hiện tại (không đổi `avg`).
- **Hủy phiếu nhập** lô: đảo bằng cách trừ `q` tại lô (yêu cầu `qty ≥ q`); `avg` tính lại từ trạng thái trước lô (lưu `prev_avg`/`prev_qty` trong movement) — chỉ khi chưa có xuất sau lô đó (BR-PUR-07 đảm bảo).

## 5. Làm tròn (một nơi, một hàm)

Hàm `src/lib/money.ts` (+ bản SQL `app.round_vnd`, `app.allocate_vnd`):
- `roundHalfUp(x)` — nửa lên về đồng.
- `allocate(total, weights, {tie: 'largest-then-first'})` — phân bổ nguyên theo trọng số, tổng khớp (chi phí, giảm giá tổng).
- Test đơn vị bắt buộc: dư 1 đồng, dư n−1 đồng, trọng số bằng nhau, một dòng, tổng 0, giá trị rất lớn (< 2^53); **thuộc tính ngẫu nhiên Σ = tổng**; đối chiếu TS ↔ SQL.

**Ví dụ (SC-11)**: chi phí 1.000.000 chia 3 dòng đều 3.000.000: `base = 333.333 ×3 = 999.999`, dư 1 ⇒ dòng đầu 333.334. Linh kiện: 3 cái × 10.000 + 4 cái × 11.000 ⇒ `avg = (30.000+44.000)/7 = 10.571,4286`; xuất 2 cái ⇒ `round_half_up(2 × 10.571,4286) = 21.143`.

## 6. Giảm giá & doanh thu từng dòng

- Mỗi dòng bán: `list_price_snapshot` (giá hiệu lực lúc lập), `unit_price` (giá bán thực), `line_discount = (list − unit_price) × qty`.
- **Giảm giá tổng phiếu** `D` phân bổ vào các dòng theo tỷ lệ `Σ unit_price × qty` bằng `allocate` (BR-SALE-13). `line_total_i = unit_price_i × qty_i − phân bổ D_i`.
- `grand_total = Σ line_total_i`.
- % giảm cho hạn mức vai trò (BR-SALE-03): `(Σ list × qty − grand_total) / Σ list × qty` (thu cũ đổi mới không tính vào đây). Đơn CTV không áp hạn mức.

## 7. Lãi gộp

### 7.1 Bán hàng — cửa hàng bán
- Dòng: `gross_profit_line = line_total − cost_snapshot` (cost chốt khi xác nhận; đồng hồ = giá vốn chu kỳ hiện hành tại lúc bán; linh kiện = `round(q × avg)`).
- Phiếu: `Σ gross_profit_line`.
- **Hủy phiếu** (void): phiếu loại khỏi mọi tổng (như chưa xảy ra). Không có đổi trả (CF-02).

### 7.2 Bán hàng — đơn của CTV (BR-COL-04)
Với dòng CTV bán, giá bán thực `P`, giá thu giao CTV `G`, giá vốn `V`:
- **Doanh thu cửa hàng** = `G`; **giá vốn** = `V`; **lãi gộp cửa hàng** = `G − V` (có thể âm nếu G < V — cần `collab.manage` biết khi giao: UI cảnh báo).
- **Phần CTV hưởng** = `P − G` (không thuộc doanh thu/lãi cửa hàng; chỉ ở Thống kê CTV).
- Ví dụ (SC-12): `P = 8.200.000`, `G = 7.000.000`, `V = 6.060.000` ⇒ doanh thu cửa hàng 7.000.000, lãi gộp 940.000, CTV hưởng 1.200.000.

### 7.3 Sửa chữa (khách)
`lãi gộp sửa chữa = doanh thu sửa chữa − giá vốn linh kiện đã dùng − chi phí bảo hành`

- **Doanh thu** = Σ dòng `service` + `part` + `other` của phiếu `delivered`, `paid` (không tính `warranty_free`).
- **Giá vốn linh kiện** = Σ `repair_line_costs.cost_amount` (chốt lúc xác nhận dùng) của phiếu tính phí.
- **Chi phí bảo hành** = Σ giá vốn linh kiện của phiếu `warranty_free` (BR-WAR-03), ghi vào kỳ báo cáo theo ngày giao phiếu bảo hành; hiển thị riêng một dòng "Chi phí bảo hành" (âm).
- **Không tính trùng**: linh kiện chỉ xuất hiện ở dòng sửa (không đồng thời là phiếu bán lẻ); không có tiền công thợ (CF-04) nên không còn khoản trừ này.

### 7.4 Sửa nội bộ
Không có doanh thu; chi phí đi vào giá vốn chiếc (BR-COST-04) ⇒ thể hiện ở lãi gộp lúc **bán** chiếc đó.

### 7.5 Lãi gộp tổng
`Lãi gộp = lãi gộp bán hàng (cửa hàng + dòng CTV) + lãi gộp sửa chữa (đã trừ chi phí bảo hành)`.
Không còn "lãi ròng tạm tính" — cửa hàng không theo dõi chi phí hoạt động (CF-07). Thu nhập khác (cọc tịch thu) hiển thị riêng ở báo cáo tiền thu, **không** cộng vào lãi gộp.

## 8. Quyền xem

| Dữ liệu | Quyền | Nơi lưu (RLS) |
|---|---|---|
| Giá nhập, giá vốn (giá thu của cửa hàng) chiếc | `cost.view` | `unit_cost_entries`, `purchase_lines/costs` (thêm `purchase.view`) |
| Giá vốn linh kiện | `cost.view` | `part_costs`, `part_stock_movements` (cần `part.manage` hoặc `cost.view`) |
| Giá vốn dòng bán, lãi gộp | `cost.view` / `profit.view` | `sale_line_costs`, hàm báo cáo `SECURITY DEFINER` kiểm quyền |
| Giá vốn linh kiện sửa | `cost.view` | `repair_line_costs` |
| Giá thu giao CTV của chiếc đang giữ | CTV đó, `collab.view` | `collaborator_assignment_lines` (RLS theo CTV) |
| Thống kê CTV (doanh thu bán ra, phần hưởng) | `collab.view` (chủ); `collab.view_own` | hàm `rpt_collaborator` |

Các hàm báo cáo nhạy cảm kiểm quyền **trong thân hàm**; thiếu quyền ⇒ lỗi 403 (không trả hàng rỗng gây hiểu lầm bằng 0).
