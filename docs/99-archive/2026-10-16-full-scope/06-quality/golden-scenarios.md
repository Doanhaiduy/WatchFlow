# Kịch bản vàng (Golden Scenarios)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · **Số liệu ở đây là kết quả đúng** — code lệch số ⇒ code sai (hoặc docs sai và phải sửa ở đây trước). Mỗi SC có file test `scripts/test-api/sc-NN-*.mjs`; ID dùng trong tên test.

## 0. Quy ước

- Tiền VND, định dạng `8.200.000`. Ngày `2026-11-03` = giờ VN. Mã nội bộ chiếc (`DH-…`) do hệ thống sinh — test lấy từ phản hồi, không cứng số.
- Mỗi SC **bắt đầu từ bộ tiền đề F0** (reset DB test) trừ khi ghi "nối tiếp". Sau **mỗi bước** test kiểm các mục liệt kê; **cuối mỗi SC** gọi `fn_consistency_check()` ⇒ không vi phạm.
- "Δ" là thay đổi so với trước bước. "Quỹ" = số dư `balance_after` của bút toán cuối.
- Dưới `wf_app` với người dùng ghi trong ngoặc (owner / sales / warehouse / technician / collaborator).

## F0 — Bộ tiền đề chung (sinh bởi `db/seed/golden-fixture.mjs`, bằng quyền chủ DB, chỉ local/test)

| Hạng mục | Giá trị |
|---|---|
| Cài đặt | Mặc định (`settings-catalog`); `finance.books_start_date = 2026-11-01`; kỳ 2026-11 mở |
| Quỹ | **Tiền mặt** (cash) số dư đầu kỳ **20.000.000**; **Ngân hàng** (bank) **10.000.000**; ngày mở 2026-11-01; không cho âm |
| Thương hiệu / loại | Seiko / `SEIKO-5-SRPD55`; Casio / `CASIO-MTP-V001`; Orient / `ORIENT-BAMBINO-V2` |
| Vị trí | "Tủ trưng bày 1", "Két" |
| Khách | `KH-A` Nguyễn Văn An (0901000001), `KH-B` Trần Thị Bình (0901000002), `KH-C` do CTV tạo |
| NCC | `NCC-1` Công ty Đồng hồ Phương Nam |
| Người dùng | `owner`; `sales` (hạn mức giảm giá **5%**); `warehouse`; `T1` thợ `percent` **40%**; `T2` thợ `fixed_per_service` (Thay pin = **50.000**); `C1` CTV `percent_of_profit` **20%** |
| Linh kiện (tồn đầu kỳ qua phiếu `opening`, tổng **3.500.000**) | `LK-0001` Dây da 20mm: SL 10, bình quân 80.000, giá bán 150.000 · `LK-0002` Kính sapphire 36mm: SL 5, bình quân 250.000, giá bán 450.000, ngưỡng 2 · `LK-0003` Ron chống nước: SL 20, bình quân 35.000, giá bán 70.000 · `LK-0004` Pin SR626: SL 50, bình quân 15.000, giá bán 40.000 |
| Loại việc | `Bảo dưỡng máy` (mặc định 300.000), `Thay pin` (mặc định 100.000) |
| Chiếc | Không có (tạo trong từng SC bằng helper qua phiếu nhập thật) |

Tổng quỹ đầu: **30.000.000** (20.000.000 + 10.000.000). Giá trị tồn đầu: linh kiện 3.500.000, đồng hồ 0.

---

## SC-01 — Nhập lô 3 đồng hồ + chi phí vận chuyển + công nợ NCC
**BR:** BR-PUR-01…06, BR-COST-01, BR-FIN-06 · **FR:** FR-PUR-01…08, FR-COST-01/02 · **Người dùng:** warehouse, owner

**Bước (2026-11-02):** `warehouse` lập phiếu nhập `supplier` NCC-1, ngày 2026-11-02; 3 dòng đồng hồ mới (`initial_status=in_stock`, vị trí "Tủ trưng bày 1"):

| Dòng | Chiếc | Serial | Giá nhập |
|---|---|---|---|
| 1 | **A** — SEIKO-5-SRPD55 | SK-A-001 | 6.000.000 |
| 2 | **B** — CASIO-MTP-V001 | CS-B-001 | 1.200.000 |
| 3 | **C** — ORIENT-BAMBINO-V2 | OR-C-001 | 4.800.000 |

Chi phí: **Vận chuyển 120.000** (`by_value`). Xác nhận. Sau đó `owner` ghi phiếu chi trả NCC **5.000.000 tiền mặt**.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Tổng phiếu | `subtotal` 12.000.000 + chi phí 120.000 = **12.120.000** |
| Phân bổ vận chuyển | A **60.000** · B **12.000** · C **48.000** (Σ 120.000) |
| Giá vốn | A **6.060.000** · B **1.212.000** · C **4.848.000** (Σ 12.120.000) |
| Chiếc | 3 chiếc `in_stock`, `asset_code` mới, `cost_cycle=1`, mỗi chiếc có `unit_status_history` (∅→in_stock) |
| Công nợ NCC-1 | 12.120.000 − 5.000.000 = **7.120.000** |
| Quỹ | Tiền mặt **15.000.000** (Δ −5.000.000); Ngân hàng **10.000.000** |
| Giá trị tồn | Đồng hồ **12.120.000**; linh kiện 3.500.000 |
| Doanh thu | **0** |
**Phủ định:** `sales` gọi `GET` giá vốn chiếc A ⇒ 403/không có trường (PT-01); trả NCC 8.000.000 (vượt dư nợ 7.120.000) ⇒ `WF-PUR-OVERPAY`; nhập serial `SK-A-001` lần nữa ⇒ `WF-UNIT-SERIAL-DUPLICATE`; xác nhận phiếu hai lần cùng `Idempotency-Key` ⇒ một kết quả.

---

## SC-02 — Bán thường: giảm giá, thanh toán kết hợp, bảo hành
**BR:** BR-SALE-02/03/05/06/08/12, BR-COST-02, BR-FIN-01 · **FR:** FR-SALE-01…11 · **Người dùng:** sales · **Nối tiếp SC-01**

**Bước (2026-11-03):** `sales` lập phiếu bán cho KH-A: chiếc **A**, giá niêm yết **8.500.000**, bán **8.200.000** (giảm 300.000). Thanh toán **5.000.000 tiền mặt + 3.200.000 chuyển khoản**. Xác nhận.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Giảm giá | 300.000 / 8.500.000 = 3,53% ≤ 5% ✓ |
| Phiếu | `grand_total` **8.200.000**; `paid_net` 8.200.000; `due` **0** |
| Chiếc A | `sold`; `is_effective` dòng bán = true |
| Giá vốn chốt | **6.060.000** |
| Lãi gộp phiếu | 8.200.000 − 6.060.000 = **2.140.000** |
| Quỹ | Tiền mặt **20.000.000** (Δ +5.000.000); Ngân hàng **13.200.000** (Δ +3.200.000) |
| Bảo hành | Loại `sale`, hàng mới 12 tháng: **2026-11-03 → 2027-11-03** |
| Doanh thu ngày 2026-11-03 | **8.200.000** |
**Phủ định:** `sales` thử bán A lần nữa ⇒ `WF-SALE-UNIT-UNAVAILABLE`; `sales` giảm 500.000 (5,88%) ⇒ `WF-SALE-DISCOUNT-LIMIT`; `collaborator` gọi xác nhận ⇒ 403; sửa phiếu đã xác nhận ⇒ `WF-DOC-NOT-DRAFT`.

---

## SC-03 — Bán tiền mặt có tiền thừa
**BR:** BR-SALE-06 · **FR:** FR-SALE-06 · **Nối tiếp SC-01**

**Bước (2026-11-03):** bán chiếc **C** cho khách vãng lai (không nợ nên không bắt buộc khách) giá niêm yết **6.500.000**, không giảm; khách đưa **7.000.000 tiền mặt**; thanh toán ghi **6.500.000**.

**Kỳ vọng:** `payments(in)` = **6.500.000** (không phải 7.000.000); `cash_tendered` 7.000.000; **tiền thừa in = 500.000** (không vào sổ quỹ); giá vốn **4.848.000**; lãi gộp **1.652.000**; Quỹ tiền mặt Δ **+6.500.000**.

---

## SC-04 — Bán nợ & thu nợ
**BR:** BR-SALE-07, BR-FIN-05/07 · **FR:** FR-SALE-08, FR-FIN-03, FR-CUS-04/05 · **Nối tiếp SC-01**

**Bước:** (a) 2026-11-03 `sales` bán chiếc **B** giá **1.800.000** cho KH-B, trả **500.000 tiền mặt**, hẹn trả `due_date=2026-11-10`. Thử bán nợ **không chọn khách** ⇒ `WF-SALE-CUSTOMER-REQUIRED`. (b) 2026-11-05 `sales` thu nợ **1.000.000 chuyển khoản** qua "Thu nợ" KH-B.

**Kỳ vọng:**
| Thời điểm | Mục | Giá trị |
|---|---|---|
| Sau (a) | Phiếu | `grand_total` 1.800.000; `paid_net` 500.000; **`due` 1.300.000** |
| | Giá vốn / lãi gộp | 1.212.000 / **588.000** |
| | Công nợ KH-B | **1.300.000**; Quỹ tiền mặt Δ +500.000 |
| Sau (b) | `payment(in, sale_receipt)` 1.000.000 phân bổ vào phiếu | `due` **300.000**; Ngân hàng Δ +1.000.000 |
| | Công nợ KH-B | **300.000** |
**Phủ định:** thu 2.000.000 (vượt dư nợ 1.300.000) ⇒ `WF-FIN-ALLOC-EXCEEDS`.

---

## SC-05 — Giữ hàng / đặt cọc: chuyển thành bán, hoàn cọc, tịch thu
**BR:** BR-RSV-01…05, BR-FIN-04 · **FR:** FR-RSV-01…04 · Độc lập (helper tạo chiếc **D**, **E'**, **E''** giá vốn 10.000.000 / 2.000.000 / 2.000.000 đã nhập & trả đủ qua phiếu nhập; ghi Δ so với trước mỗi bước)

**5a — Chuyển thành bán (D: giá niêm yết 14.000.000):**
1. 2026-11-04 `sales` giữ **D** cho KH-A, hạn 7 ngày (đến 2026-11-11), cọc **2.000.000 tiền mặt**. Thử cọc 1.000.000 (< 10% = 1.400.000) ⇒ `WF-RSV-DEPOSIT-TOO-LOW`.
   - Kỳ vọng: D `reserved`; **cọc đang giữ 2.000.000**; **doanh thu Δ 0**; Quỹ tiền mặt Δ +2.000.000.
2. `sales` khác thử bán D cho KH-B ⇒ `WF-SALE-UNIT-UNAVAILABLE`.
3. 2026-11-06 chuyển thành phiếu bán: giảm giá **500.000** (3,57% ≤ 5%) ⇒ `grand_total` **13.500.000**; cọc chuyển vào phiếu (cặp bù trừ 2.000.000); khách trả **11.500.000 chuyển khoản**.
   - Kỳ vọng: D `sold`; `due` **0**; cọc đang giữ **0**; Ngân hàng Δ +11.500.000; **doanh thu +13.500.000**; giá vốn 10.000.000; **lãi gộp 3.500.000**; tổng quỹ thật vào (2.000.000 + 11.500.000) = 13.500.000.

**5b — Hủy giữ, hoàn cọc (E'):** giữ E' với cọc 2.000.000 tiền mặt; `sales` hủy giữ chọn **hoàn cọc** ⇒ `payment(out, deposit_refund)` 2.000.000 tiền mặt; E' `in_stock`; cọc giữ 0; Quỹ tiền mặt: +2.000.000 rồi −2.000.000 (ròng 0); doanh thu 0.

**5c — Tịch thu (E''):** giữ E'' cọc 2.000.000; `sales` thử tịch thu ⇒ 403 (cần `reservation.forfeit`); `owner` tịch thu với lý do ≥ 10 ký tự ⇒ cặp bù trừ `forfeited_deposit` 2.000.000; **thu nhập khác +2.000.000**; **không có bút toán quỹ mới**; E'' `in_stock`; doanh thu bán hàng **0**.

---

## SC-06 — Thu cũ đổi mới
**BR:** BR-TRD-01…04, BR-PUR-09/10, BR-SALE-05 · **FR:** FR-TRD-01…03, FR-PUR-13 · Độc lập (chiếc **E** giá vốn 15.000.000, giá niêm yết 20.000.000)

**6a:** 2026-11-04 `sales` bán E cho KH-A giá **20.000.000**; khách đưa đồng hồ cũ (Orient, hạng B, đủ ảnh máy + giấy tờ người bán) **giá thu 6.000.000**; khách trả thêm **14.000.000 chuyển khoản**.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Phiếu bán | `grand_total` **20.000.000**; `due` **0** |
| Phiếu nhập `trade_in` | Tự tạo + xác nhận, **6.000.000**, người bán KH-A; công nợ phiếu **0** |
| Bù trừ | `offset_in(trade_in)` 6.000.000 → phiếu bán; `offset_out(trade_in)` 6.000.000 → phiếu nhập |
| Chiếc F (máy cũ thu về) | `inspecting`, giá vốn **6.000.000** |
| Doanh thu | **20.000.000** (không phải 14.000.000) |
| Giá vốn bán / lãi gộp | 15.000.000 / **5.000.000** |
| Quỹ | Ngân hàng Δ **+14.000.000**; tiền mặt Δ 0 |
| Giá trị tồn đồng hồ | −15.000.000 + 6.000.000 = **−9.000.000** |
**Phủ định:** giá thu 25.000.000 > 20.000.000 ⇒ `WF-SALE-TRADEIN-EXCEEDS`; thiếu ảnh giấy tờ người bán ⇒ `WF-PUR-SELLER-ID-REQUIRED`.

**6b — Mua lại đúng chiếc đã bán:** (nối SC-02) KH-A đưa chính chiếc **A** (đã bán ở SC-02) làm máy cũ, giá thu **5.000.000** vào phiếu bán mới. **Kỳ vọng:** dùng lại bản ghi A (cùng `asset_code`), **`cost_cycle=2`**, giá vốn A (chu kỳ 2) = **5.000.000**; các `unit_cost_entries` chu kỳ 1 (6.060.000) giữ nguyên; dòng bán SC-02 hết `is_effective` nhưng **doanh thu SC-02 giữ nguyên**; A có thể bán lại mà không vướng ràng buộc duy nhất.

---

## SC-07 — Đổi trả, hoàn tiền, hoàn kho
**BR:** BR-RET-01…07, BR-COM-03 · **FR:** FR-SALE-12, FR-STK-05 · **Nối tiếp SC-02**

**Bước:** 2026-11-06 (3 ngày sau bán, trong 7 ngày) `sales` lập đổi trả cho phiếu SC-02: lý do `defect`, trả cả dòng chiếc A, nhận lại vào `inspecting`, không phí khấu trừ, hoàn **5.000.000 tiền mặt + 3.200.000 chuyển khoản**. `owner` xác nhận. Thử hoàn 9.000.000 ⇒ `WF-RET-REFUND-EXCEEDS`.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Phiếu bán SC-02 | `net_total` **0**; `paid_net` 0 sau hoàn; `due` 0 |
| Chiếc A | `inspecting`; giá vốn chu kỳ 1 **6.060.000** còn nguyên |
| Quỹ | Tiền mặt Δ **−5.000.000**; Ngân hàng Δ **−3.200.000** |
| Doanh thu ngày 2026-11-06 | **−8.200.000** (đổi trả); giá vốn **−6.060.000**; lãi gộp ngày **−2.140.000** |
| Doanh thu ngày 2026-11-03 | Vẫn **8.200.000** (không sửa quá khứ) |
| Bảo hành SC-02 | `voided` |
**Phủ định:** đổi trả ngày 2026-11-11 (8 ngày) bởi `sales` ⇒ `WF-RET-WINDOW-EXPIRED`; `owner` với `return.override` + lý do ⇒ được. Sau đó `owner`/`warehouse` `release` A: `inspecting → in_stock`.

---

## SC-08 — Sửa chữa máy khách có cọc, linh kiện, tiền công thợ
**BR:** BR-REP-01…10, BR-PART-02/03, BR-COST-03 · **FR:** FR-REP-01…14/16 · Người dùng: sales, T1, owner

**Bước:**
1. 2026-11-04 `sales` nhận máy của KH-A: Casio, serial `CS-9999`, tình trạng "trầy kính, dây mòn", lỗi "chạy chậm", **ảnh hiện trạng ≥ 1**, cọc **200.000 tiền mặt**. (Thiếu ảnh ⇒ `WF-REP-PHOTO-REQUIRED`.) `received`.
2. `owner` giao cho T1; T1 chuyển `inspecting`, ghi nhận xét; thêm dòng: **Bảo dưỡng máy 300.000** (nhân công), **Dây da 20mm ×1 = 150.000** (`LK-0001`), **Kính sapphire ×1 = 450.000** (`LK-0002`). Báo giá **900.000**. (Chuyển `repairing` khi chưa ghi khách đồng ý ⇒ `WF-REP-QUOTE-NOT-APPROVED`.)
3. `sales` ghi "khách đồng ý" (tại quầy) ⇒ `repairing`.
4. T1 bấm **Xác nhận dùng** từng linh kiện ⇒ trừ kho.
5. T1 `completed`; 2026-11-08 `sales` `delivered`: khách trả thêm **700.000 chuyển khoản**.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Kho | `LK-0001` **10 → 9** (bình quân 80.000); `LK-0002` **5 → 4** (bình quân 250.000) |
| Giá vốn linh kiện chốt | 80.000 + 250.000 = **330.000** |
| Doanh thu sửa chữa (ghi ngày 2026-11-08) | **900.000** |
| Tiền công T1 (40% × nhân công 300.000) | **120.000** (`repair_tech_pay`, `pending`) |
| **Lãi gộp sửa chữa** | 900.000 − 330.000 − 120.000 = **450.000** |
| Quỹ | Tiền mặt Δ +200.000 (2026-11-04); Ngân hàng Δ +700.000 (2026-11-08); `due` = 0 |
| Bảo hành sau sửa | 90 ngày từ 2026-11-08 → **2027-02-06** |
| Quyền | T1 thấy phiếu của mình + tiền công 120.000; **không** thấy giá vốn linh kiện, doanh thu; T1 gọi phiếu không được giao ⇒ 404/403 (PT-04) |

**8b — Thợ `fixed_per_service` (T2):** nhận máy, dòng nhân công **Thay pin 100.000** + linh kiện `LK-0004` Pin ×1 giá bán **40.000** (giá vốn bình quân **15.000**). Giao & thu 140.000 tiền mặt. **Kỳ vọng:** doanh thu 140.000; giá vốn linh kiện 15.000; tiền công T2 **50.000** (cố định theo `Thay pin`); lãi gộp sửa = 140.000 − 15.000 − 50.000 = **75.000**; kho `LK-0004` 50 → 49.

**8c — Bảo hành sau sửa:** (nối 8) 2026-11-20 khách quay lại (trong hạn) ⇒ `sales` tạo phiếu `warranty_free` liên kết bảo hành; dùng `LK-0001` ×1. **Kỳ vọng:** doanh thu **0**; chi phí bảo hành **80.000** (giá vốn linh kiện) ghi vào lãi gộp sửa chữa (−80.000); `LK-0001` 9 → 8; không thu tiền; không phát sinh tiền công T1 (nhân công doanh thu 0 ⇒ 40% × 0 = 0).

---

## SC-09 — Sửa nội bộ (vốn hóa vào giá vốn) rồi bán
**BR:** BR-REP-11, BR-COST-04, BR-REP-01 · **FR:** FR-REP-15, FR-COST-03 · Độc lập (chiếc **G** mua 4.000.000, `used` hạng B, `in_stock`, niêm yết 6.000.000)

**Bước:** `owner` tạo phiếu sửa `internal` cho G ⇒ G `in_repair`. T1 thêm: **Ron chống nước (`LK-0003`) ×2** (bình quân 35.000 ⇒ **70.000**) + **Dây da (`LK-0001`) ×1** (**80.000**) + nhân công nội bộ **200.000**; xác nhận dùng, `completed` (chọn `condition=refurbished`, về `in_stock`).

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Chi phí vốn hóa | linh kiện 70.000 + 80.000 = **150.000**; công **200.000** |
| Giá vốn G | 4.000.000 + 150.000 + 200.000 = **4.350.000** |
| Doanh thu sửa | **0** (nội bộ) |
| Kho | `LK-0003` 20 → 18; `LK-0001` 10 → 9 |
| Bán G cho KH-B giá 6.000.000 tiền mặt | Giá vốn chốt **4.350.000**; **lãi gộp 1.650.000** |
| Bảo hành bán | Loại hàng `refurbished` ⇒ **3 tháng** |

---

## SC-10 — Chốt ngày tổng hợp (SC-01 → SC-04 liên tiếp, đối chiếu mọi báo cáo)
**BR:** BR-FIN-04, BR-SALE-12, BR-COST-02, BR-UNIT-04 · **FR:** FR-DASH-*, FR-RPT-*, FR-COST-06/07 · Người dùng: owner

Chạy SC-01, SC-02, SC-03, SC-04(a) [2026-11-02/03], rồi SC-04(b) [2026-11-05] trên cùng DB.

**Kỳ vọng (cuối ngày 2026-11-03):**
| Chỉ số | Giá trị |
|---|---|
| Doanh thu | 8.200.000 + 6.500.000 + 1.800.000 = **16.500.000** |
| Giá vốn hàng bán | 6.060.000 + 4.848.000 + 1.212.000 = **12.120.000** |
| Lãi gộp | 2.140.000 + 1.652.000 + 588.000 = **4.380.000** (= 16.500.000 − 12.120.000 ✓) |
| Thực thu (ngày 03) | tiền mặt 5.000.000 + 6.500.000 + 500.000 = 12.000.000; ngân hàng 3.200.000 ⇒ **15.200.000** |
| Thực chi (ngày 02) | **5.000.000** (trả NCC) |
| Công nợ khách | **1.300.000** (KH-B) = Doanh thu 16.500.000 − Thực thu 15.200.000 ✓ |
| Công nợ NCC | **7.120.000** |
| Số đồng hồ tồn kho / có thể bán | **0 / 0**; đã bán **3** |
| Giá trị tồn | Đồng hồ **0**; linh kiện **3.500.000** |
| Quỹ cuối ngày 03 | Tiền mặt **27.000.000**; Ngân hàng **13.200.000** (tổng 40.200.000) |

**Sau 2026-11-05 (thu nợ 1.000.000 ngân hàng):** công nợ KH-B **300.000**; Ngân hàng **14.200.000**; tổng quỹ **41.200.000** = 30.000.000 (đầu) + thực thu 16.200.000 − thực chi 5.000.000 ✓.

**Kiểm chéo:** dashboard = báo cáo R1/R2/R4/R6/R8 cho cùng khoảng ngày; xuất Excel cùng số; `sales` xem R1 chỉ thấy doanh thu, **không** thấy giá vốn/lãi (PT-05).

---

## SC-11 — Làm tròn, phân bổ & bình quân linh kiện
**BR:** BR-GEN-01, BR-PUR-05, BR-PART-02, BR-SALE-13 · Kiểm cả `lib/money.ts` (vitest) và SQL `app.allocate_vnd`/`app.round_vnd` (cùng đầu vào ⇒ cùng kết quả)

| Ca | Đầu vào | Kết quả |
|---|---|---|
| a | Chi phí **1.000.000** chia `by_value` cho 3 dòng 3.000.000 / 3.000.000 / 3.000.000 | **333.334 / 333.333 / 333.333** (dư 1 ⇒ dòng đầu do hòa) |
| b | Chi phí **100.000** `by_value` cho 1.000.000 / 2.000.000 / 3.000.000 | base 16.666 / 33.333 / 50.000 (Σ 99.999), dư 1 ⇒ dòng lớn nhất ⇒ **16.666 / 33.333 / 50.001** |
| c | Chi phí **100.000** `equal` cho 3 dòng (giá trị 1.000.000 / 2.000.000 / 3.000.000) | base 33.333 ×3, dư 1 ⇒ dòng giá trị lớn nhất ⇒ **33.333 / 33.333 / 33.334** |
| d | Linh kiện: nhập 3 cái @10.000 rồi 4 cái @11.000 | bình quân **10.571,4286** (74.000 / 7); xuất 2 ⇒ giá vốn `round_half_up(2 × 10.571,4286 = 21.142,8572)` = **21.143**; `avg` giữ nguyên |
| e | Linh kiện: SL 10 @ avg 30.000; nhập 10 cái @36.000 + vận chuyển phân bổ 20.000 | lô = 360.000 + 20.000 = 380.000 ⇒ `avg' = (300.000 + 380.000)/20 =` **34.000**, SL 20; xuất 5 ⇒ giá vốn **170.000**, SL 15 |
| f | Giảm giá tổng **100.000** cho phiếu 2 dòng 3.000.000 / 1.000.000 | phân bổ **75.000 / 25.000** ⇒ `line_total` **2.925.000 / 975.000** |
| g | Giảm giá tổng **100.001** cho 3 dòng 1.000.000 đều | base 33.333 ×3 = 99.999, dư 2 ⇒ **cả 2 gán cho một dòng (dòng đầu do hòa)** ⇒ **33.335 / 33.333 / 33.333** |
| h | Tổng 0, 1 dòng, trọng số 0, số rất lớn (< 2^53) | không chia 0; một dòng nhận trọn; Σ luôn bằng tổng |
Thuộc tính (property test): với mọi đầu vào ngẫu nhiên, **Σ phân bổ = tổng** và mỗi phần ≥ 0 (tổng ≥ 0).

---

## SC-12 — Hoa hồng cộng tác viên
**BR:** BR-COM-01…04, BR-SALE-15, BR-SEC-08, BR-RET-07 · **FR:** FR-COL-01…05 · Người dùng: C1, sales, owner · Nối tiếp SC-01

**Bước:**
1. Chủ đặt `collab_visible=true` cho A, B; `false` cho C. C1 đăng nhập: danh sách hàng chỉ có A, B (giá hiệu lực, ảnh, thông số; **không** serial nội bộ nhạy cảm/giá vốn/NCC) (PT-02).
2. C1 tạo khách **KH-C** và đơn **nháp** bán A (8.500.000, giảm 300.000). C1 thử xác nhận ⇒ 403.
3. 2026-11-03 `sales` xác nhận, thu đủ 8.200.000 (như SC-02).
4. Hoa hồng chốt: `percent_of_profit` 20% × lãi gộp dòng 2.140.000 = **428.000**; trạng thái `payable` (đã thu đủ). C1 xem "Hoa hồng của tôi" = 428.000, **không** thấy giá vốn/lãi (BR-COM-04).
5. `owner` chi trả **428.000 tiền mặt** ⇒ `paid`; Quỹ tiền mặt Δ −428.000.
6. Đổi trả A (SC-07) ⇒ hoa hồng `voided`; do đã chi ⇒ dòng **clawback −428.000** `pending` (trừ vào kỳ chi sau).

**Biến thể chế độ:** `percent_of_price` 5% ⇒ 8.200.000 × 5% = **410.000**; `fixed_per_unit` 300.000 ⇒ **300.000**. Phiếu chưa thu đủ ⇒ hoa hồng `pending` (chưa `payable`). C1 xem khách/đơn của người khác ⇒ không thấy (PT-03).

---

## SC-13 — Tách bạch các khái niệm tiền
**BR:** BR-FIN-04, BR-RSV-03 · **FR:** FR-COST-07/08 · Độc lập từ F0

**Bước:** (a) `owner` ghi `loan_in` **50.000.000** vào Ngân hàng. (b) Ghi `third_party_in` **5.000.000** tiền mặt rồi `third_party_out` 5.000.000. (c) Thu cọc 2.000.000 (xem SC-05). (d) Hoàn tiền không qua chứng từ đổi trả là **không cho phép** (chỉ qua đổi trả/hoàn cọc).

**Kỳ vọng:** Ngân hàng **60.000.000** (10.000.000 + 50.000.000); **Doanh thu = 0**; **Thực thu bán/sửa = 0** (vay/thu hộ hiển thị riêng ở R8 dòng "Vay / thu hộ"); cọc không là doanh thu; báo cáo lãi gộp = 0; `loan_in` không thể phân bổ vào phiếu bán.

---

## SC-14 — Kiểm kê, hao hụt, hàng tồn lâu, cảnh báo thấp
**BR:** BR-INV-01…04, BR-PART-04/05 · **FR:** FR-STK-06…09, FR-PART-09 · Độc lập (đồng hồ test đặt `2026-11-01`)

**Tiền đề:** chiếc **H** giá vốn **3.000.000** `in_stock`; chiếc **I** `in_stock` từ **2026-07-01** (`stock_since`); `LK-0001` SL **9** (sau SC-08); `LK-0002` SL **1** (ngưỡng 2).

**Bước:** `warehouse` mở đợt kiểm kê toàn bộ: quét H không thấy (lý do "mất"); đếm `LK-0001` = **8**. Đối chiếu & chốt.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| H | `written_off`, tổn thất **3.000.000** |
| `LK-0001` | 9 → 8, movement `stocktake` **−1** × 80.000 = tổn thất **80.000** |
| Báo cáo hao hụt (R10) | **3.080.000** |
| Hàng tồn lâu | I: 2026-07-01 → 2026-11-01 = **123 ngày** > 90 ⇒ có trong R5 |
| Cảnh báo | `LK-0002` (1 ≤ 2) ⇒ thông báo `part.low_stock` cho warehouse/owner |
| Phủ định | Chốt chênh lệch không lý do ⇒ `WF-REASON-REQUIRED`; hai kiểm kê song song cùng linh kiện (CT-13) |

---

## SC-15 — Hủy phiếu bán trong cửa sổ
**BR:** BR-SALE-10, BR-FIN-10 · **FR:** FR-SALE-15, FR-FIN-10 · **Nối tiếp SC-02**

**Bước:** cùng ngày 2026-11-03 (≤ 24 giờ) `owner` hủy phiếu SC-02 với lý do "Nhập nhầm khách".

**Kỳ vọng:** A `in_stock` (đảo `sold`); các `payments` của phiếu `voided` với **bút toán đảo**: Tiền mặt Δ **−5.000.000**, Ngân hàng Δ **−3.200.000** (về lại 15.000.000 / 10.000.000); phiếu `voided` loại khỏi doanh thu (doanh thu ngày 03 = 0 nếu chỉ có phiếu này); bảo hành `voided`; hoa hồng (nếu có) `voided`.
**Phủ định:** `sales` thử hủy ⇒ 403; hủy sau 25 giờ ⇒ `WF-SALE-VOID-EXPIRED`; phiếu đã dùng cọc (SC-05a) hoặc đã có đổi trả ⇒ `WF-SALE-VOID-NOT-ALLOWED`; kỳ đã khóa ⇒ `WF-PERIOD-CLOSED`.

---

## SC-16 — Đối chiếu quỹ & khóa kỳ
**BR:** BR-FIN-02/03/09/12, BR-GEN-07 · **FR:** FR-FIN-05/08/09 · **Nối tiếp SC-10** (đồng hồ DB test đặt `2026-12-01` để kỳ 2026-11 đã kết thúc)

**Bước:** (1) Kiểm đếm tiền mặt thực **26.950.000** so sổ **27.000.000** (SC-10 sau ngày 03; nếu nối cả ngày 05 vẫn 27.000.000 vì thu nợ qua ngân hàng). `owner` điều chỉnh quỹ **chi 50.000** lý do "Lệch kiểm đếm két ngày 03/11". (2) Đối chiếu Ngân hàng: sổ **14.200.000** = thực **14.200.000** ✓. (3) `fn_verify_ledger_chain` cả hai quỹ ⇒ sạch. (4) **Khóa kỳ 2026-11**. (5) Thử ghi phiếu thu ngày 2026-11-20 ⇒ `WF-PERIOD-CLOSED`. (6) Thử `UPDATE ledger_entries` bằng `wf_app` ⇒ từ chối. (7) `owner` mở lại kỳ (lý do) ⇒ ghi được; ghi audit; khóa lại.

**Kỳ vọng:** Tiền mặt **26.950.000**; Ngân hàng **14.200.000**; báo cáo thu chi kỳ 11: đầu kỳ **30.000.000** + thực thu **16.200.000** − thực chi **5.050.000** (5.000.000 NCC + 50.000 điều chỉnh, hiển thị riêng "Điều chỉnh 50.000") = cuối kỳ **41.150.000** (= 26.950.000 + 14.200.000 ✓). Khóa kỳ khi kỳ **chưa kết thúc** (ngày giả 2026-11-15) ⇒ `WF-PERIOD-NOT-ENDED`. Khóa khi một quỹ chưa đối chiếu ⇒ `WF-FIN-RECONCILE-REQUIRED`.

---

## SC-17 — Hủy phiếu nhập & điều chỉnh giá vốn
**BR:** BR-PUR-07/08, BR-COST-05 · **FR:** FR-PUR-11, FR-COST-09 · Độc lập

| Ca | Bước | Kỳ vọng |
|---|---|---|
| a | Phiếu nhập `supplier` 1 chiếc **J** giá 2.000.000 + vận chuyển 40.000 (chưa trả). Hủy ngay (owner, lý do) | J `cancelled`; `unit_cost_entries` có dòng **đảo** (tổng 0); công nợ NCC **0**; phiếu `voided`; mã J không tái sử dụng |
| b | Phiếu có chiếc **K** 3.000.000 đã trả 3.000.000 tiền mặt. Hủy phiếu | ⇒ `WF-PUR-HAS-PAYMENTS` (phải hủy phiếu chi trước). Hủy phiếu chi (đảo quỹ +3.000.000) rồi hủy phiếu nhập ⇒ OK |
| c | Phiếu có chiếc **L**; bán L; rồi hủy phiếu nhập | ⇒ `WF-PUR-HAS-DEPENDENTS` |
| d | Chiếc **M** giá vốn 5.000.000 `in_stock`. `owner` điều chỉnh **+200.000** lý do "phí kiểm định bổ sung" | Giá vốn M **5.200.000**; `adjustment` có lý do; bán M 7.000.000 ⇒ lãi gộp **1.800.000**. `warehouse` (không `cost.adjust`) thử ⇒ 403. Điều chỉnh sau khi M đã bán ⇒ `WF-COST-NOT-ADJUSTABLE` |
| e | Phiếu nhập có linh kiện: `LK-0001` +10 cái @90.000 (avg 80.000, SL 10 → `avg'` 85.000, SL 20). Hủy phiếu khi chưa xuất | Trở về SL 10, avg **80.000** (dùng `prev_qty/prev_avg`); nếu đã xuất sau lô ⇒ `WF-PUR-HAS-DEPENDENTS` |

---

## Bảng tóm tắt phủ nghiệp vụ

| Nhóm | SC |
|---|---|
| Nhập hàng, giá vốn, công nợ NCC | 01, 11, 17 |
| Bán, thanh toán, tiền thừa, nợ | 02, 03, 04, 10 |
| Giữ hàng/cọc, thu cũ đổi mới | 05, 06 |
| Đổi trả, hủy phiếu | 07, 15 |
| Sửa chữa, tiền công thợ, bảo hành, vốn hóa | 08, 09 |
| Hoa hồng CTV, phân quyền | 12 (+ PT) |
| Tiền: vay/thu hộ/doanh thu/thực thu | 10, 13 |
| Kiểm kê, tồn lâu, cảnh báo | 14 |
| Quỹ, đối chiếu, khóa kỳ, sổ bất biến | 16 |
| Làm tròn | 11 |
