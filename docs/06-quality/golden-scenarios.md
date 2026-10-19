# Kịch bản vàng (Golden Scenarios)

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-02`: **SC-18, SC-19 là mới và là kịch bản hiện hành cho CTV / ghi đơn bán**; **SC-07, SC-08, SC-10, SC-15 đã viết lại cho bản gọn**; SC-01…06, 09, 11, 12, 13, 14, 16, 17 thuộc phần đã đóng băng — thiết kế tham khảo, không còn test chạy) · **Số liệu ở đây là kết quả đúng** — code lệch số ⇒ code sai (hoặc docs sai và phải sửa ở đây trước). Mỗi SC hiện hành được kiểm bởi `tests/api/*.test.mjs` (ID dùng trong tên test: `m12-sales` SC-19/CT-01/CT-07, `m12-collab` SC-18/CT-14/PT-14, `m6-repairs` SC-07/SC-08, `m8-reports` SC-10, `db-simple-mode` SC-18/19 mức DB).
> Bản có quỹ/đổi trả/thợ (SC cũ): `docs/99-archive/2026-10-16-full-scope/06-quality/golden-scenarios.md`.

## 0. Quy ước

- Tiền VND, định dạng `8.200.000`. Ngày `2026-11-03` = giờ VN (`app.test_today`). Mã nội bộ chiếc (`DH-…`) do hệ thống sinh — test lấy từ phản hồi, không cứng số.
- Mỗi SC **bắt đầu từ bộ tiền đề F0** (reset DB test) trừ khi ghi "nối tiếp". Sau **mỗi bước** test kiểm các mục liệt kê; **cuối mỗi SC** gọi `fn_consistency_check()` ⇒ không vi phạm.
- "Thực thu" = Σ thanh toán `in` − `out` đã `posted`. Không có số dư quỹ.
- Dưới `wf_app` với người dùng ghi trong ngoặc (owner / sales / warehouse / collaborator `C1`).

## F0 — Bộ tiền đề chung (sinh bởi `db/seed/golden-fixture.mjs`, bằng quyền chủ DB, chỉ local/test)

| Hạng mục | Giá trị |
|---|---|
| Cài đặt | Mặc định (`settings-catalog`): đổi/hủy phiếu 24 giờ, giữ hàng 7 ngày, cọc tối thiểu 10%, bảo hành mới 12 tháng / cũ & đã sửa 3 tháng / sau sửa 90 ngày |
| Thương hiệu / loại | Seiko / `SEIKO-5-SRPD55`; Casio / `CASIO-MTP-V001`; Orient / `ORIENT-BAMBINO-V2` |
| Vị trí | "Tủ trưng bày 1", "Két" |
| Khách | `KH-A` Nguyễn Văn An (0901000001), `KH-B` Trần Thị Bình (0901000002), `KH-C` (do `C1` tạo) |
| Người dùng | `owner`; `sales` (hạn mức giảm giá **5%**); `warehouse`; `C1` (CTV) |
| Linh kiện (tồn đầu kỳ qua phiếu `opening`, tổng **2.750.000** = 10×80.000 + 5×250.000 + 20×35.000 — CQ-008) | `LK-0001` Dây da 20mm: SL 10, bình quân 80.000, giá bán 150.000 · `LK-0002` Kính sapphire 36mm: SL 5, bình quân 250.000, giá bán 450.000, ngưỡng 2 · `LK-0003` Ron chống nước: SL 20, bình quân 35.000, giá bán 70.000 · `LK-0004` Pin SR626: SL 50, bình quân 15.000, giá bán 40.000 |
| Loại việc | `Bảo dưỡng máy` (mặc định 300.000), `Thay pin` (mặc định 100.000) |
| Chiếc | Không có (tạo trong từng SC bằng helper qua phiếu nhập thật) |

---

## SC-01 — Nhập lô 3 đồng hồ + chi phí vận chuyển → giá vốn
**BR:** BR-PUR-01…06, BR-COST-01 · **FR:** FR-PUR-01…08, FR-COST-01/02 · **Người dùng:** warehouse, owner

**Bước (2026-11-02):** `warehouse` lập phiếu nhập **Mua vào**, nguồn hàng "Cửa hàng ABC", ngày 2026-11-02; 3 dòng đồng hồ mới (`initial_status=in_stock`, vị trí "Tủ trưng bày 1"):

| Dòng | Chiếc | Serial | Giá nhập |
|---|---|---|---|
| 1 | **A** — SEIKO-5-SRPD55 | SK-A-001 | 6.000.000 |
| 2 | **B** — CASIO-MTP-V001 | CS-B-001 | 1.200.000 |
| 3 | **C** — ORIENT-BAMBINO-V2 | OR-C-001 | 4.800.000 |

Chi phí: **Vận chuyển 120.000** (`by_value`). Xác nhận.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Tổng phiếu | `subtotal` 12.000.000 + chi phí 120.000 = **12.120.000** |
| Phân bổ vận chuyển | A **60.000** · B **12.000** · C **48.000** (Σ 120.000) |
| Giá vốn | A **6.060.000** · B **1.212.000** · C **4.848.000** (Σ 12.120.000) |
| Chiếc | 3 chiếc `in_stock`, `asset_code` mới, `cost_cycle=1`, mỗi chiếc có `unit_status_history` (∅→in_stock) |
| Thanh toán / công nợ | **Không có** (phiếu nhập không theo dõi trả tiền — BR-PUR-06) |
| Giá trị tồn | Đồng hồ **12.120.000**; linh kiện 2.750.000 |
| Doanh thu | **0** |
**Phủ định:** `sales` đọc giá vốn chiếc A ⇒ 403/không có trường (PT-01); nhập serial `SK-A-001` lần nữa ⇒ `WF-UNIT-SERIAL-DUPLICATE`; thiếu nguồn hàng ⇒ `WF-VALIDATION`; xác nhận phiếu hai lần cùng `Idempotency-Key` ⇒ một kết quả.

---

## SC-02 — Bán thường: giảm giá, thanh toán kết hợp, bảo hành
**BR:** BR-SALE-02/03/05/06/08/12, BR-COST-02, BR-PAY-01, BR-WAR-01 · **FR:** FR-SALE-01…11, FR-PAY-01 · **Người dùng:** sales · **Nối tiếp SC-01**

**Bước (2026-11-03):** `sales` lập phiếu bán cho KH-A: chiếc **A**, giá niêm yết **8.500.000**, bán **8.200.000** (giảm 300.000). Thanh toán **5.000.000 tiền mặt + 3.200.000 chuyển khoản**. Xác nhận.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Giảm giá | 300.000 / 8.500.000 = 3,53% ≤ 5% ✓ |
| Phiếu | `grand_total` **8.200.000**; `paid_net` 8.200.000; `due` **0** |
| Chiếc A | `sold`; `is_effective` dòng bán = true |
| Giá vốn chốt | **6.060.000** (`sales` không thấy; owner thấy) |
| Lãi gộp phiếu | 8.200.000 − 6.060.000 = **2.140.000** |
| Thanh toán | Hai `payments(in, sale_receipt)`: **5.000.000** `cash`, **3.200.000** `bank_transfer` |
| Bảo hành | Loại `sale`, hàng mới 12 tháng: **2026-11-03 → 2027-11-03** |
| Doanh thu ngày 2026-11-03 | **8.200.000**; thực thu **8.200.000** |
**Phủ định:** `sales` thử bán A lần nữa ⇒ `WF-SALE-UNIT-UNAVAILABLE`; giảm 500.000 (5,88%) ⇒ `WF-SALE-DISCOUNT-LIMIT`; `collaborator` gọi xác nhận ⇒ 403; sửa phiếu đã xác nhận ⇒ `WF-DOC-NOT-DRAFT`.

---

## SC-03 — Bán tiền mặt có tiền thừa
**BR:** BR-SALE-06 · **FR:** FR-SALE-06 · **Nối tiếp SC-01**

**Bước (2026-11-03):** bán chiếc **C** cho khách vãng lai (không nợ nên không bắt buộc khách) giá niêm yết **6.500.000**, không giảm; khách đưa **7.000.000 tiền mặt**; thanh toán ghi **6.500.000**.

**Kỳ vọng:** `payments(in)` = **6.500.000** (không phải 7.000.000); `cash_tendered` 7.000.000; **tiền thừa in = 500.000** (không phải thanh toán); giá vốn **4.848.000**; lãi gộp **1.652.000**; thực thu +6.500.000.

---

## SC-04 — Bán nợ & thu thêm trên phiếu
**BR:** BR-SALE-07, BR-PAY-03/04 · **FR:** FR-SALE-08/17, FR-PAY-03, FR-CUS-04 · **Nối tiếp SC-01**

**Bước:** (a) 2026-11-03 `sales` bán chiếc **B** giá **1.800.000** cho KH-B, trả **500.000 tiền mặt**, hẹn trả `due_date=2026-11-10`. Thử bán nợ **không chọn khách** ⇒ `WF-SALE-CUSTOMER-REQUIRED`. (b) 2026-11-05 `sales` bấm **Thu thêm** trên phiếu, **1.000.000 chuyển khoản**.

**Kỳ vọng:**
| Thời điểm | Mục | Giá trị |
|---|---|---|
| Sau (a) | Phiếu | `grand_total` 1.800.000; `paid_net` 500.000; **`due` 1.300.000** |
| | Giá vốn / lãi gộp | 1.212.000 / **588.000** |
| | Khách còn nợ (KH-B) | **1.300.000**; thực thu +500.000 |
| Sau (b) | `payment(in, sale_receipt)` 1.000.000 gắn phiếu | `due` **300.000**; thực thu ngày 05 +1.000.000 |
**Phủ định:** thu thêm 2.000.000 (vượt còn nợ 1.300.000) ⇒ `WF-PAY-OVERPAY`.

---

## SC-05 — Giữ hàng / đặt cọc: chuyển thành bán, hoàn cọc, tịch thu
**BR:** BR-RSV-01…05, BR-PAY-02/06 · **FR:** FR-RSV-01…04, FR-PAY-05 · Độc lập (helper tạo chiếc **D**, **E'**, **E''** giá vốn 10.000.000 / 2.000.000 / 2.000.000 đã nhập qua phiếu nhập)

**5a — Chuyển thành bán (D: giá niêm yết 14.000.000):**
1. 2026-11-04 `sales` giữ **D** cho KH-A, hạn 7 ngày (đến 2026-11-11), cọc **2.000.000 tiền mặt**. Thử cọc 1.000.000 (< 10% = 1.400.000) ⇒ `WF-RSV-DEPOSIT-TOO-LOW`.
   - Kỳ vọng: D `reserved`; **cọc đang giữ 2.000.000**; **doanh thu Δ 0**; thực thu +2.000.000.
2. `sales` khác thử bán D cho KH-B ⇒ `WF-SALE-UNIT-UNAVAILABLE`.
3. 2026-11-06 chuyển thành phiếu bán: giảm giá **500.000** (3,57% ≤ 5%) ⇒ `grand_total` **13.500.000**; cọc trừ vào phiếu (`applied_vnd` 2.000.000); `payable` **11.500.000**; khách trả **11.500.000 chuyển khoản**.
   - Kỳ vọng: D `sold`; `due` **0**; cọc đang giữ **0**; **doanh thu +13.500.000**; giá vốn 10.000.000; **lãi gộp 3.500.000**; thực thu tổng (2.000.000 + 11.500.000) = 13.500.000.

**5b — Hủy giữ, hoàn cọc (E'):** giữ E' với cọc 2.000.000 tiền mặt; `sales` hủy giữ chọn **hoàn cọc** ⇒ `payment(out, deposit_refund)` 2.000.000; E' `in_stock`; cọc giữ 0; thực thu ròng 0; doanh thu 0.

**5c — Tịch thu (E''):** giữ E'' cọc 2.000.000; `sales` thử tịch thu ⇒ 403 (cần `reservation.forfeit`); `owner` tịch thu với lý do ≥ 10 ký tự ⇒ `forfeited_vnd` = 2.000.000, giữ hàng `forfeited`; **thu nhập khác +2.000.000**; không thanh toán mới; E'' `in_stock`; doanh thu bán hàng **0**; `cọc đã thu = applied + refunded + forfeited` ⇒ 0 + 0 + 2.000.000.

---

## SC-06 — Thu cũ đổi mới
**BR:** BR-TRD-01…04, BR-PUR-09/10, BR-SALE-05 · **FR:** FR-TRD-01…03, FR-PUR-13 · Độc lập (chiếc **E** giá vốn 15.000.000, giá niêm yết 20.000.000)

**6a:** 2026-11-04 `sales` bán E cho KH-A giá **20.000.000**; khách đưa đồng hồ cũ (Orient, hạng B, đủ ảnh máy + giấy tờ người bán) **giá thu 6.000.000**; khách trả thêm **14.000.000 chuyển khoản**.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Phiếu bán | `grand_total` **20.000.000**; `payable` = 20.000.000 − 6.000.000 = **14.000.000**; `due` **0** |
| Phiếu nhập `trade_in` | Tự tạo + xác nhận, **6.000.000**, người bán KH-A; `sale_trade_ins.credit` 6.000.000 |
| Chiếc F (máy cũ thu về) | `inspecting`, giá vốn **6.000.000** |
| Doanh thu | **20.000.000** (không phải 14.000.000) |
| Giá vốn bán / lãi gộp | 15.000.000 / **5.000.000** |
| Thực thu | **14.000.000** (chỉ `bank_transfer`) |
| Giá trị tồn đồng hồ | −15.000.000 + 6.000.000 = **−9.000.000** |
**Phủ định:** giá thu 25.000.000 > 20.000.000 ⇒ `WF-SALE-TRADEIN-EXCEEDS`; thiếu ảnh giấy tờ người bán ⇒ `WF-PUR-SELLER-ID-REQUIRED`.

**6b — Mua lại đúng chiếc đã bán:** (nối SC-02) KH-A đưa chính chiếc **A** (đã bán ở SC-02) làm máy cũ, giá thu **5.000.000** vào phiếu bán mới. **Kỳ vọng:** dùng lại bản ghi A (cùng `asset_code`), **`cost_cycle=2`**, giá vốn A (chu kỳ 2) = **5.000.000**; các `unit_cost_entries` chu kỳ 1 (6.060.000) giữ nguyên; dòng bán SC-02 hết `is_effective` nhưng **doanh thu SC-02 giữ nguyên**; A có thể bán lại mà không vướng ràng buộc duy nhất; bảo hành SC-02 vẫn `active` theo hồ sơ cũ.

---

## SC-07 — Bảo hành: sửa miễn phí theo hạn trên đơn bán (thay cho đổi trả — CF-02, CF-15)
**BR:** BR-SALE-21, BR-REP-17, BR-WAR-01 · **FR:** FR-SALE-21, FR-REP-19 · Người dùng: owner (sales xem được phiếu bán nhưng không mở phiếu sửa) · Tiền đề: F0 + chiếc **A** (mới, niêm yết 8.500.000) bán 2026-11-03 cho KH-A giá **8.200.000** (bảo hành mặc định 12 tháng ⇒ đến 2027-11-03)

**Bước:**
1. 2026-11-20 khách quay lại vì lỗi dây. `owner` mở **Nhận máy sửa**, chọn KH-A ⇒ danh sách "Bảo hành còn hạn" của khách có A (hạn 2027-11-03); `sales` gọi cùng danh sách ⇒ 403.
2. Chọn bảo hành ⇒ phiếu sửa `warranty_free` liên kết `warranty_id` (khách, máy điền sẵn). Thêm một khoản *Bảo dưỡng máy*; sửa xong; giao máy. Không thu tiền, không ghi nợ.
3. Đồng hồ giả 2027-11-10 (bảo hành đã hết hạn): nhận máy chọn lại bảo hành đó ⇒ `WF-WAR-EXPIRED`; nhận máy tính phí bình thường được.

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Phiếu bảo hành | `charge_mode=warranty_free`; doanh thu sửa chữa **0** (dù có khoản tiền ghi trên phiếu) |
| Doanh thu đơn bán A | **Không đổi** (8.200.000) |
| Bảo hành bán | Vẫn `active` đến 2027-11-03; sau đó job đặt `expired` |
**Phủ định:** không tồn tại API đổi trả/hoàn tiền (404); `warranties/{id}/open-repair` đã gỡ (404); hủy đơn bán ⇒ bảo hành `voided` ⇒ không còn trong danh sách chọn. Kiểm bởi `tests/api/m6-repairs.test.mjs`.

---
---

## SC-08 — Sửa chữa máy khách (gọn): nhận máy → khoản tiền → giao ⇒ doanh thu
**BR:** BR-REP-01…03, 07, 16, 17, BR-WAR-01 · **FR:** FR-REP-19 · Người dùng: owner

**Bước:**
1. 2026-11-04 `owner` nhận máy: khách mới "Anh Mới" SĐT `0977 111 222` (nhập ngay trên phiếu), Casio serial `CS-9999`, tình trạng "trầy kính, dây mòn", lỗi "chạy chậm", hẹn trả 2026-11-10. Không ảnh (hợp lệ). `received`, mã `SC-2026-nnnn`.
   *Phủ định:* khách chưa có SĐT ⇒ `WF-VALIDATION`; thiếu lỗi/khách ⇒ 422; lần nhận sau cùng SĐT dùng lại **cùng khách**.
2. `inspecting` → `repairing`; thêm khoản: **Bảo dưỡng máy** (dịch vụ, mặc định **300.000**) + **Thay dây da** (khoản khác) **200.000**. Tạm tính **500.000**. Khoản khác không nội dung ⇒ 422.
3. `completed` ⇒ khóa các khoản (thêm khoản ⇒ `WF-REP-LOCKED`); doanh thu **chưa** ghi.
4. 2026-11-08 `delivered` (không thu tiền ở hệ thống).

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Doanh thu sửa chữa (ghi nhận ngày giao 2026-11-08) | **500.000** |
| Bảo hành sau sửa | 90 ngày từ 2026-11-08 → **2027-02-06** |
| Phiếu | Không có cọc/thanh toán/còn nợ/giá vốn/lãi (phản hồi không chứa các trường đó) |
| Hủy | Hủy phiếu `received…repairing` cần lý do ≥ 10 ký tự ⇒ `cancelled`, doanh thu 0; hủy phiếu đã giao ⇒ lỗi |
**Phủ định:** `sales`/`warehouse`/CTV mở màn/API sửa chữa ⇒ 403 (PT-04); không có API thợ/linh kiện (404). Kiểm bởi `tests/api/m6-repairs.test.mjs`.

---
---

## SC-09 — Sửa nội bộ (vốn hóa vào giá vốn) rồi bán
**BR:** BR-REP-11, BR-COST-04, BR-REP-01 · **FR:** FR-REP-15, FR-COST-03 · Độc lập (chiếc **G** mua 4.000.000, `used` hạng B, `in_stock`, niêm yết 6.000.000)

**Bước:** `owner` tạo phiếu sửa `internal` cho G ⇒ G `in_repair`. Dùng: **Ron chống nước (`LK-0003`) ×2** (bình quân 35.000 ⇒ **70.000**) + **Dây da (`LK-0001`) ×1** (**80.000**) + **chi phí khác** (gia công ngoài) **200.000**; xác nhận dùng, `completed` (chọn `condition=refurbished`, về `in_stock`).

**Kỳ vọng:**
| Mục | Giá trị |
|---|---|
| Chi phí vốn hóa | linh kiện 70.000 + 80.000 = **150.000**; chi phí khác **200.000** |
| Giá vốn G | 4.000.000 + 150.000 + 200.000 = **4.350.000** |
| Doanh thu sửa | **0** (nội bộ) |
| Kho | `LK-0003` 20 → 18; `LK-0001` 10 → 9 |
| Bán G cho KH-B giá 6.000.000 tiền mặt | Giá vốn chốt **4.350.000**; **lãi gộp 1.650.000** |
| Bảo hành bán | Hàng `refurbished` ⇒ **3 tháng** |

---

## SC-10 — Báo cáo gọn: doanh thu / số lượng đồng hồ / CTV trên một ngày (2027-01-03)
**BR:** BR-RPT-01, BR-SALE-23, BR-COL-14, BR-COL-18, BR-REP-17 · **FR:** FR-RPT-13, FR-DASH-01/11, FR-COL-17 · Người dùng: owner (+ sales, warehouse, CTV cho phần quyền)

Dữ liệu trong ngày 2027-01-03 (đồng hồ giả): `sales` ghi đơn #1 A **8.200.000** (niêm yết 8.500.000) và đơn #2 C **6.500.000** (khách vãng lai); CTV C1 được giao E (niêm yết **1.800.000**), báo "đã bán", `owner` xác nhận với giá mặc định; `owner` nhận và giao một máy sửa thu **140.000**.

**Kỳ vọng (khoảng 2027-01-03 → 2027-01-03):**
| Chỉ số | Giá trị |
|---|---|
| Doanh thu bán tại cửa hàng | 8.200.000 + 6.500.000 = **14.700.000** |
| Doanh thu CTV bán | **1.800.000** (giá chủ xác nhận) |
| Doanh thu sửa chữa | **140.000** |
| **Tổng doanh thu** | **16.640.000** |
| Số đơn bán / số chiếc / trong đó CTV / số máy sửa | **3 / 3 / 1 / 1** |
| Số lượng đồng hồ đã bán trong kỳ (tổng, cửa hàng, CTV) | **3 / 2 / 1** |
| Báo cáo CTV (owner) | C1: **1 chiếc, 1.800.000**; theo kỳ cùng số |
| Cùng khoảng, nhóm tháng/quý/năm | Tổng vẫn **16.640.000** (1 dòng mỗi nhóm) |
| Ngày 2027-01-05 (không phát sinh) | `[]` |

**Kiểm chéo:** Tổng quan (`rpt_dashboard`) = báo cáo cho cùng khoảng; xuất Excel cùng số.
**Phủ định (PT-05, PT-14):** không có giá vốn/lãi/nợ/thực thu trong bất kỳ phản hồi nào; `sales` xem doanh thu + số lượng và xuất file được (có `report.export`) nhưng báo cáo CTV ⇒ 403; `warehouse` chỉ xem số lượng đồng hồ (doanh thu ⇒ 403, xuất file ⇒ 403); CTV: mọi báo cáo ⇒ 403 và Tổng quan không có thẻ số. Kiểm bởi `tests/api/m8-reports.test.mjs`.

---
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

## SC-12 — Cộng tác viên: giao hàng → bán → quyết toán → thu hồi → thống kê (CF-03/08)
**BR:** BR-COL-01…11, BR-COST-07, BR-SALE-15, BR-SEC-08 · **FR:** FR-COL-01…11, FR-COST-10, FR-SEC-07 · Người dùng: owner, sales, C1 · **Nối tiếp SC-01** (A giá vốn 6.060.000, B 1.212.000, C 4.848.000, đều `in_stock`)

**Bước:**
1. **2026-11-03** `owner` tạo phiếu giao cho **C1**: A (giá thu **7.000.000**), B (giá thu **1.500.000**), C (giá thu **5.500.000**). Xác nhận ⇒ A, B, C `with_collaborator`, `held_by` = C1.
   - Kỳ vọng: tồn kho vẫn tính (giá trị tồn đồng hồ 12.120.000, hiển thị "ở CTV" 12.120.000); **doanh thu 0**. C1 đăng nhập: thấy đúng 3 chiếc với giá thu, **không** giá vốn, không chiếc nào khác (PT-02); C1 gọi `/catalog/units` ⇒ 403.
   - Thử giao chiếc đang `reserved` ⇒ không cho (`WF-COL-UNIT-ASSIGNED`/`WF-UNIT-INVALID-TRANSITION`); sửa giá thu sau xác nhận ⇒ bị chặn (trigger).
2. **C1** tạo khách **KH-C** (SĐT) và **đơn nháp** bán A giá **8.200.000**. C1 thử xác nhận ⇒ 403. Tạo đơn cho chiếc không phải của mình ⇒ `WF-COL-UNIT-NOT-HELD`.
3. **2026-11-03** `sales` xác nhận đơn A ⇒ A `sold`; dòng: giá bán 8.200.000, **giá thu chốt 7.000.000**, `shop_revenue` **7.000.000**, giá vốn **6.060.000**.
   - Kỳ vọng: doanh thu cửa hàng **+7.000.000**; **lãi gộp cửa hàng 940.000**; **phần C1 hưởng 1.200.000**; bảo hành A cho KH-C (12 tháng); không có thanh toán của khách trong hệ thống (BR-COL-05). Hạn mức giảm giá / "bán dưới giá vốn" không áp (thử giá bán 1.000.000 không bị `WF-SALE-BELOW-COST`).
4. **2026-11-04** C1 bán **C** giá **5.200.000** (< giá thu 5.500.000; UI cảnh báo, vẫn cho). `sales` xác nhận ⇒ `shop_revenue` **5.500.000**, giá vốn **4.848.000**, **lãi gộp cửa hàng 652.000**, **phần C1 hưởng −300.000**.
5. **2026-11-05** `owner` **quyết toán** dòng A: C1 nộp **7.000.000 chuyển khoản** ⇒ `collaborator_settlements` + `payment(in, collab_settlement)` 7.000.000; dòng A đã quyết toán; **thực thu +7.000.000**. Quyết toán lại dòng A ⇒ `WF-COL-ALREADY-SETTLED`.
6. **2026-11-06** `owner` **thu hồi** B (giá thu 1.500.000) về "Tủ trưng bày 1" với lý do ⇒ B `in_stock`, `held_by` NULL; giá vốn B **1.212.000** không đổi. Thu hồi chiếc đã bán (A) ⇒ `WF-COL-HAS-SOLD`.

**Kỳ vọng tổng hợp (cuối 2026-11-06):**
| Mục | Giá trị |
|---|---|
| Doanh thu cửa hàng (2 dòng CTV) | 7.000.000 + 5.500.000 = **12.500.000** |
| Giá vốn hàng bán | 6.060.000 + 4.848.000 = **10.908.000** |
| Lãi gộp cửa hàng | **1.592.000** (= 940.000 + 652.000 = 12.500.000 − 10.908.000 ✓) |
| **Thống kê CTV C1 — tháng 11** | Số chiếc bán **2** · doanh thu bán ra 8.200.000 + 5.200.000 = **13.400.000** · phải nộp (Σ giá thu) **12.500.000** · **phần C1 hưởng 900.000** (= 13.400.000 − 12.500.000 ✓) · đã nộp **7.000.000** · chưa nộp **5.500.000** |
| Tồn kho | B `in_stock` (giá trị tồn đồng hồ 1.212.000); không chiếc nào `with_collaborator` |
| Phân quyền | C1 xem thống kê của mình đúng bảng trên; C1 xem R1/R2 ⇒ 403; `sales` không thấy giá vốn/lãi dòng CTV |
**Biến thể:** giao A với giá thu 6.000.000 (< giá vốn 6.060.000) ⇒ cảnh báo, vẫn cho; khi bán 8.200.000: lãi gộp cửa hàng **−60.000**, phần CTV hưởng 2.200.000.

---

## SC-13 — Tách bạch doanh thu, thực thu, cọc, phần CTV (hằng đẳng thức)
**BR:** BR-PAY-02/03/06/07, BR-RSV-03/05, BR-COL-04/05 · **FR:** FR-COST-07, FR-PAY-05, FR-DASH-05 · Độc lập (nối tiếp SC-01; D giá niêm yết 14.000.000, giá vốn 10.000.000 đã nhập)

**Hằng đẳng thức kiểm sau MỖI bước (property test):**
`Doanh thu − Thực thu = Khách còn nợ + CTV chưa nộp − Cọc đang giữ − Cọc tịch thu − Tiền nhận trước sửa chữa (chưa giao)`

| # | Ngày | Sự kiện | Doanh thu | Thực thu | Khách nợ | CTV chưa nộp | Cọc giữ | Cọc tịch thu | Nhận trước sửa | Vế trái = Vế phải |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 11-03 | Bán A 8.200.000, khách trả 5.000.000 tiền mặt | 8.200.000 | 5.000.000 | 3.200.000 | 0 | 0 | 0 | 0 | 3.200.000 = 3.200.000 ✓ |
| 2 | 11-03 | Giữ hàng D, cọc 2.000.000 | 8.200.000 | 7.000.000 | 3.200.000 | 0 | 2.000.000 | 0 | 0 | 1.200.000 = 3.200.000 − 2.000.000 ✓ |
| 3 | 11-03 | C1 bán B (giao giá thu 1.500.000, bán 2.000.000); xác nhận | 9.700.000 | 7.000.000 | 3.200.000 | 1.500.000 | 2.000.000 | 0 | 0 | 2.700.000 = 3.200.000 + 1.500.000 − 2.000.000 ✓ |
| 4 | 11-04 | Nhận máy sửa, cọc 200.000 | 9.700.000 | 7.200.000 | 3.200.000 | 1.500.000 | 2.000.000 | 0 | 200.000 | 2.500.000 = 3.200.000 + 1.500.000 − 2.000.000 − 200.000 ✓ |
| 5 | 11-05 | Khách A trả thêm 3.200.000 | 9.700.000 | 10.400.000 | 0 | 1.500.000 | 2.000.000 | 0 | 200.000 | −700.000 = 0 + 1.500.000 − 2.000.000 − 200.000 ✓ |
| 6 | 11-06 | Tịch thu cọc D | 9.700.000 | 10.400.000 | 0 | 1.500.000 | 0 | 2.000.000 | 200.000 | −700.000 = 0 + 1.500.000 − 0 − 2.000.000 − 200.000 ✓ |
| 7 | 11-06 | C1 nộp giá thu 1.500.000 | 9.700.000 | 11.900.000 | 0 | 0 | 0 | 2.000.000 | 200.000 | −2.200.000 = 0 + 0 − 0 − 2.000.000 − 200.000 ✓ |
| 8 | 11-08 | Giao máy sửa 900.000 (dịch vụ), khách trả thêm 700.000 | 10.600.000 | 12.600.000 | 0 | 0 | 0 | 2.000.000 | 0 | −2.000.000 = −2.000.000 ✓ |

**Kỳ vọng cuối:** Doanh thu **10.600.000** (8.200.000 + 1.500.000 + 900.000); Thực thu **12.600.000**; "thu nhập khác" **2.000.000** (cọc tịch thu) **không** nằm trong doanh thu hay lãi gộp; phần C1 hưởng (2.000.000 − 1.500.000 = 500.000) **không** nằm trong doanh thu cửa hàng.

---

## SC-14 — Kiểm kê, hao hụt, hàng tồn lâu, cảnh báo thấp
**BR:** BR-INV-01…04, BR-PART-04/05 · **FR:** FR-STK-06…09, FR-PART-09 · Độc lập (đồng hồ test đặt `2026-11-01`)

**Tiền đề:** chiếc **H** giá vốn **3.000.000** `in_stock`; chiếc **I** `in_stock` từ **2026-07-01** (`stock_since`); chiếc **J** đang `with_collaborator` (không nằm trong kiểm kê kho); `LK-0001` SL **9** (sau SC-08); `LK-0002` SL **1** (ngưỡng 2).

**Bước:** `warehouse` mở đợt kiểm kê toàn bộ: quét H không thấy (lý do "mất"); đếm `LK-0001` = **8**. J không có trong danh sách đếm. Đối chiếu & chốt.

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

## SC-15 — Hủy đơn bán trong cửa sổ (nhập nhầm)
**BR:** BR-SALE-22, BR-SALE-21 · **FR:** FR-SALE-22 · Tiền đề: đơn **Q** ghi 2026-11-03 (chiếc niêm yết 8.500.000 bán 8.200.000 cho KH-A, bảo hành 12 tháng)

**Bước:** cùng ngày (≤ 24 giờ) `sales` thử hủy ⇒ 403; `owner` hủy khi chưa nhập lại mật khẩu ⇒ `WF-SEC-REAUTH`; lý do ngắn ("ngắn") ⇒ 422; sau nhập lại mật khẩu + lý do "Nhập nhầm khách hàng" ⇒ thành công; hủy lần hai ⇒ `WF-DOC-NOT-DRAFT`.

**Kỳ vọng:** chiếc `in_stock` (đảo `sold`); đơn `voided` (không xóa), loại khỏi doanh thu; bảo hành `voided`; báo bán CTV (nếu đơn do CTV bán) `voided` và chào hàng **không** tự mở lại (giao lại được).
**Phủ định:** ghi lại đơn mới cho cùng chiếc rồi để quá 25 giờ ⇒ hủy bị `WF-SALE-VOID-EXPIRED`. Kiểm bởi `tests/api/m12-sales.test.mjs`, `m12-collab.test.mjs`.

---
---

## SC-16 — Hủy đơn bán CTV & hủy quyết toán
**BR:** BR-COL-08, BR-SALE-10, BR-WAR-05 · **FR:** FR-COL-06/08 · Người dùng: owner · **Nối tiếp SC-12 bước 3** (A bán qua C1 lúc 2026-11-03 10:00)

**16a — Hủy khi chưa quyết toán (trong 24 giờ):** `owner` hủy đơn A lúc 2026-11-03 18:00 ⇒ A trở lại **`with_collaborator`** (held_by C1; dòng phiếu giao `active` trở lại), giá thu vẫn **7.000.000**, doanh thu cửa hàng **0**, bảo hành A (KH-C) `voided`, phần C1 hưởng 0. A **không** về `in_stock`.

**16b — Đã quyết toán:** làm lại bán A (10:00), `owner` quyết toán lúc 15:00 (thực thu +7.000.000). Hủy đơn lúc 18:00 ⇒ `WF-SALE-VOID-NOT-ALLOWED` (dòng đã quyết toán). `owner` **hủy quyết toán** (lý do, xác thực lại) ⇒ `payment(in, collab_settlement)` `voided` (thực thu −7.000.000), dòng về "chưa nộp"; **sau đó** hủy đơn lúc 18:05 được (trong cửa sổ) ⇒ như 16a.
**Phủ định:** `sales` không hủy quyết toán (403); hủy đơn sau 24 giờ ⇒ `WF-SALE-VOID-EXPIRED`.

---

## SC-17 — Hủy phiếu nhập & điều chỉnh giá vốn
**BR:** BR-PUR-07/08, BR-COST-05 · **FR:** FR-PUR-11, FR-COST-09 · Độc lập

| Ca | Bước | Kỳ vọng |
|---|---|---|
| a | Phiếu nhập 1 chiếc **J** giá 2.000.000 + vận chuyển 40.000. Hủy ngay (owner, lý do) | J `cancelled`; `unit_cost_entries` có dòng **đảo** (tổng 0); phiếu `voided`; mã J không tái sử dụng |
| b | Phiếu có chiếc **K** đã **giao CTV** (hoặc đang giữ). Hủy phiếu nhập | ⇒ `WF-PUR-HAS-DEPENDENTS` |
| c | Phiếu có chiếc **L**; bán L; rồi hủy phiếu nhập | ⇒ `WF-PUR-HAS-DEPENDENTS` |
| d | Chiếc **M** giá vốn 5.000.000 `in_stock`. `owner` điều chỉnh **+200.000** lý do "phí kiểm định bổ sung" | Giá vốn M **5.200.000**; `adjustment` có lý do; bán M 7.000.000 ⇒ lãi gộp **1.800.000**. `warehouse` (không `cost.adjust`) thử ⇒ 403. Điều chỉnh sau khi M đã bán ⇒ `WF-COST-NOT-ADJUSTABLE` |
| e | Phiếu nhập linh kiện: `LK-0001` +10 cái @90.000 (avg 80.000, SL 10 → `avg'` 85.000, SL 20). Hủy phiếu khi chưa xuất | Trở về SL 10, avg **80.000** (dùng `prev_qty/prev_avg`); nếu đã xuất sau lô ⇒ `WF-PUR-HAS-DEPENDENTS` |

---

## Bảng tóm tắt phủ nghiệp vụ

| Nhóm | SC |
|---|---|
| Nhập hàng, giá vốn | 01, 11, 17 |
| Bán, thanh toán, tiền thừa, nợ + thu thêm | 02, 03, 04, 10 |
| Giữ hàng/cọc, thu cũ đổi mới | 05, 06 |
| Bảo hành (thay đổi trả), hủy phiếu bán | 07, 15 |
| Sửa chữa gọn, vốn hóa sửa nội bộ | 08, 09 |
| Cộng tác viên (giao – bán – quyết toán – thu hồi – thống kê – hủy) | 12, 16 |
| Tách bạch doanh thu/thực thu/cọc/phần CTV | 10, 13 |
| Kiểm kê, tồn lâu, cảnh báo | 14 |
| Làm tròn | 11 |

---

## SC-18 — Cộng tác viên: giao nhiều người → ai báo trước được → xác nhận → thống kê (CF-10…12)
**BR:** BR-COL-12…18, BR-SALE-21, BR-SEC-08 · **FR:** FR-COL-12…17, FR-SALE-21 · Người dùng: owner, sales, C1, C2 · Tiền đề: F0 + 4 chiếc `in_stock` **A** (niêm yết 8.500.000), **B** (5.000.000), **C** (6.000.000), **D** (3.000.000)

**Bước:**
1. `owner` giao **A cho C1 và C2**, **B cho C2**. Kỳ vọng: A, B vẫn `in_stock`; chào hàng: A×2, B×1 (`active`); giao lại A cho C1 ⇒ không tạo thêm; `sales` giao ⇒ 403; giao chiếc `inspecting` ⇒ `WF-COL-UNIT-NOT-OFFERABLE`. C1 thấy đúng A (niêm yết 8.500.000), **không** thấy giá vốn/đơn/khách; C2 thấy A, B.
2. **C1** báo "Đã bán" A (khách "Khách Thử", 0988 123 456). ⇒ báo bán `pending`; **C2** báo A ⇒ `WF-COL-CLAIMED`; C1 báo lại ⇒ `WF-COL-CLAIMED-SELF`; máy C2 hiện A "CTV khác đã báo bán". `sales` ghi đơn bán A ⇒ `WF-SALE-UNIT-CLAIMED`; `owner` thu hồi chào hàng A của C1 ⇒ `WF-COL-CLAIM-PENDING`. C1/C2 không tự xác nhận được (403).
3. **Đua đồng thời:** C1 và C2 cùng báo bán B ⇒ đúng **một** thành công, người kia `WF-COL-CLAIMED` (CT-14).
4. `sales` **xác nhận** báo bán A với giá mặc định ⇒ đơn `HD-…` **8.500.000**, A `sold`; chào hàng C1 `won`, C2 `lost` (+ thông báo cho C2); khách "Khách Thử" tạo mới (cùng SĐT lần sau dùng lại); bảo hành 12 tháng (hàng mới); dòng bán có giá vốn chốt (nội bộ). C1 xem được báo bán `confirmed`, **không** xem được đơn/giá bán.
5. `owner` xác nhận báo bán B với giá **4.500.000** (sửa giá) ⇒ doanh thu dòng 4.500.000; `sales` từ chối một báo bán với lý do ngắn ⇒ `WF-REASON-REQUIRED`; lý do đủ ⇒ `rejected`, chào hàng còn nguyên, chiếc mở lại.
6. Ghi mất chiếc C khi đang giao C1 và có báo bán chờ ⇒ chào hàng `lost`, báo bán `cancelled` (trigger). `owner` hủy đơn A trong 24 giờ ⇒ A `in_stock`, báo bán `voided`, bảo hành `voided`; chào hàng KHÔNG tự mở lại; giao lại được.

**Kỳ vọng tổng hợp:**
| Mục | Giá trị |
|---|---|
| Doanh thu CTV (sau bước 5, trước hủy A) | 8.500.000 + 4.500.000 = **13.000.000**, số chiếc **2** |
| `rpt_collab_sales` (owner) | theo CTV: C1 8.500.000 (1 chiếc), C2 4.500.000 (1 chiếc) hoặc ngược lại theo người báo trước; `sales`/CTV gọi ⇒ `WF-AUTH-FORBIDDEN` |
| `fn_my_collab_stats` (C1) | chỉ `period_start`, `units_sold` — **không cột tiền** |
| Bất biến | `fn_consistency_check()` sạch (I4, I8, I11, I13, I14, I15) |

---

## SC-19 — Ghi đơn bán gọn, bảo hành, hủy trong hạn, in (CF-13/15)
**BR:** BR-SALE-20…24, BR-SALE-11 · **FR:** FR-SALE-20…22 · Người dùng: sales, owner · Tiền đề: F0 + chiếc **A** (mới, niêm yết 9.000.000), **B** (cũ hạng A, 2.500.000)

**Bước:**
1. `sales` ghi đơn: khách mới "Khách Mẫu" (0912 000 111), A giá **8.700.000** (bảo hành mặc định), B giá **2.500.000** với bảo hành **0**. ⇒ đơn `HD-…` tổng **11.200.000**; A, B `sold`; bảo hành chỉ cho A (đến +12 tháng); **không** có thanh toán/nợ; niêm yết 11.500.000 nên "bán thấp hơn 300.000" chỉ hiển thị, không bị chặn.
2. Ghi lại chiếc đã bán / trùng chiếc trong đơn / ngày tương lai / ghi lùi quá hạn mức (không có `doc.backdate`) / thiếu khách / `warehouse` ghi đơn ⇒ lần lượt `WF-SALE-UNIT-UNAVAILABLE`, `WF-VALIDATION`, `WF-DOC-FUTURE`, `WF-DOC-BACKDATE`, `WF-SALE-CUSTOMER-REQUIRED`, `WF-AUTH-FORBIDDEN`.
3. `sales` thử hủy ⇒ 403; `owner` hủy với lý do ngắn ⇒ `WF-REASON-REQUIRED`; lý do đủ ⇒ A, B về `in_stock`, bảo hành `voided`. Hủy lần hai ⇒ `WF-DOC-NOT-DRAFT`. Đơn ghi quá 24 giờ ⇒ `WF-SALE-VOID-EXPIRED`.
4. In phiếu lần 1 ⇒ phiếu thường (kèm hạn bảo hành từng chiếc); lần 2 ⇒ "BẢN IN LẠI" + audit.

**Kỳ vọng:** `rpt_revenue` ngày đó: doanh thu **11.200.000** (trước khi hủy), số đơn 1, số chiếc 2, không giá vốn/lãi trong bất kỳ phản hồi nào; `fn_consistency_check()` sạch.

