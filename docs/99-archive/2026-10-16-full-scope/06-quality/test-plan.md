# Kế hoạch kiểm thử & truy vết

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Chiến lược/công cụ: `04-engineering/testing-strategy` · Số liệu: `golden-scenarios`

## 1. Cổng chất lượng (bắt buộc đạt trước phát hành)

| Cổng | Điều kiện |
|---|---|
| Q1 Quy tắc | Mọi BR có ít nhất một SC/CT/PT/UT trỏ tới (bảng §6 + `check-docs`) |
| Q2 Số liệu | Mọi SC liên quan mốc xanh trên DB thật dưới `wf_app` |
| Q3 Đồng thời | Mọi CT liên quan xanh (lặp ≥ 20 lần) và **đỏ khi bỏ cơ chế bảo vệ** (kiểm tra test có ý nghĩa) |
| Q4 Quyền | Mọi PT xanh; ma trận quyền sinh từ `security-model` không có ô thiếu |
| Q5 Cấu trúc | `db:audit` xanh; migrate ×2 sạch |
| Q6 Toàn vẹn | `fn_consistency_check()` sạch sau mỗi bộ SC/CT |
| Q7 Sao lưu | Diễn tập khôi phục có biên bản (trước go-live và hằng quý) |

## 2. Ca đồng thời (CT) — mỗi lời gọi là một kết nối riêng, chạy `Promise.all`

| ID | Tình huống | Thiết lập | Hành động song song | Kết quả đúng | Lưới an toàn (bỏ đi ⇒ test phải đỏ) |
|---|---|---|---|---|---|
| CT-01 | Bán trùng một chiếc | A `in_stock` | `sales` & `owner` xác nhận phiếu bán A cho 2 khách (+ biến thể 2 phiếu chứa cùng 2 chiếc theo thứ tự ngược nhau) | Đúng 1 thành công; bên kia `WF-SALE-UNIT-UNAVAILABLE`; 1 dòng `is_effective`; tiền ghi 1 lần; không deadlock | `FOR UPDATE` theo id tăng; `UNIQUE (unit_id) WHERE is_effective` |
| CT-02 | Giữ trùng một chiếc | A `in_stock` | 2 phiên `fn_create_reservation` | 1 giữ hàng; `WF-RSV-UNIT-HELD`; cọc chỉ ghi 1 | Khóa chiếc; unique một phần `reservations` |
| CT-03 | Bán vs giữ cùng chiếc | A `in_stock` | 1 phiên bán, 1 phiên giữ | Đúng 1 thắng; trạng thái chiếc nhất quán với bên thắng | Khóa chiếc + kiểm trạng thái |
| CT-04 | Dùng linh kiện còn 1 | `LK-X` SL 1 | 2 phiên `fn_use_repair_part` (hoặc 1 bán lẻ + 1 sửa) | 1 thành công; SL 0, không âm; bên kia `WF-REP-PART-INSUFFICIENT`/`WF-SALE-STOCK-INSUFFICIENT` | Khóa dòng `parts`; `CHECK (qty_on_hand>=0)` |
| CT-05 | Ghi quỹ song song | Quỹ 100.000 | (a) 50 phiếu thu 1.000 song song; (b) 5 phiếu chi 30.000 song song | (a) `seq` 1..N liên tục, `balance_after` đúng, chuỗi băm hợp lệ, số dư = tổng; (b) tối đa 3 thành công, số dư ≥ 0 (`WF-FIN-NEGATIVE-CASH`) | Khóa dòng `cash_accounts`; `UNIQUE (account_id, seq)` |
| CT-06 | Khóa kỳ vs ghi quỹ | Kỳ 11 đã đối chiếu | `fn_close_period` song song 20 phiếu thu ngày trong kỳ | Mỗi phiếu hoặc nằm trong kỳ **trước** khi khóa (đã tính đối chiếu) hoặc bị `WF-PERIOD-CLOSED`; I11 sạch (không bút toán mới trong kỳ đã khóa) | Thứ tự khóa quỹ → đọc kỳ trong cả hai hàm |
| CT-07 | Idempotency | — | (a) 2 request đồng thời cùng `Idempotency-Key`; (b) gửi lại sau khi thành công; (c) cùng khóa khác nội dung | (a)(b) 1 chứng từ, cùng phản hồi; (c) `WF-IDEMPOTENCY-MISMATCH` | `idempotency_keys` PK + lưu phản hồi cùng transaction |
| CT-08 | Hủy vs đổi trả | Phiếu bán trong cửa sổ | `fn_void_sale` ∥ `fn_confirm_return` | Đúng 1 thành công; không vừa hủy vừa trả | Khóa phiếu/chiếc; kiểm trạng thái |
| CT-09 | Hai phiếu nhập cùng serial | — | 2 phiên xác nhận phiếu nhập cùng brand+serial | 1 thành công; bên kia `WF-UNIT-SERIAL-DUPLICATE` | `UNIQUE (brand_id, serial_norm) WHERE …` |
| CT-10 | Trả nợ vượt dư nợ | Phiếu còn nợ 1.000.000 | 2 phiên thu 700.000 | 1 thành công; tổng phân bổ ≤ dư nợ; bên kia `WF-FIN-ALLOC-EXCEEDS` | Khóa chứng từ khi phân bổ; trigger tổng phân bổ |
| CT-11 | Sinh mã chứng từ | — | 100 phiên tạo+xác nhận phiếu | Mã không trùng, liên tục (gapless) | `number_sequences` cập nhật trong transaction |
| CT-12 | Hủy phiếu nhập vs bán | Chiếc L `in_stock` từ phiếu R | `fn_void_purchase(R)` ∥ `fn_confirm_sale(L)` | Hoặc bán xong ⇒ hủy `WF-PUR-HAS-DEPENDENTS`; hoặc hủy xong ⇒ bán `WF-SALE-UNIT-UNAVAILABLE`; không trạng thái lai | Khóa chiếc trước; kiểm phụ thuộc |
| CT-13 | Điều chỉnh tồn vs dùng | `LK-X` SL 5 | điều chỉnh kiểm kê ∥ dùng ∥ bán | `qty_on_hand` = Σ movements; I8 sạch | Khóa dòng `parts`; movements append-only |

**Cách chạy:** bộ nhanh (CT-01…05, 07) trong PR; bộ đầy đủ lặp ≥ 20 lần ban đêm. Mỗi ca có chế độ "đột biến" (`MUTATE=1` tắt khóa/ràng buộc trên DB test) và khẳng định test **đỏ** — chứng minh test có khả năng bắt lỗi.

## 3. Ca phân quyền (PT)

| ID | Nội dung | Cách kiểm |
|---|---|---|
| PT-01 | `sales`/`technician`/`collaborator` không lấy được giá vốn/lãi/giá nhập qua **mọi đường**: danh sách & chi tiết chiếc/phiếu bán/phiếu nhập, báo cáo, dashboard, PDF, Excel | Với mỗi vai trò × endpoint, khẳng định thiếu trường hoặc 403; quét JSON tìm khóa `cost*`, `profit*`, `purchase_price` |
| PT-02 | CTV chỉ thấy chiếc `in_stock` + `collab_visible`, chỉ cột an toàn (giá hiệu lực, ảnh, thông số) | SC-12 bước 1; thử gọi `/catalog/units` (403) và id chiếc ẩn (404) |
| PT-03 | CTV chỉ thấy phiếu/khách/hoa hồng **của mình**; không xác nhận phiếu | SC-12; thử đọc id của người khác ⇒ 404 |
| PT-04 | Thợ chỉ thấy phiếu sửa được giao; không giá vốn/doanh thu; thấy tiền công của mình | SC-08 |
| PT-05 | Xuất Excel/PDF tuân quyền dữ liệu và giới hạn 5 lần/giờ; ghi audit | Xuất R1/R2/R4 bằng `sales`/`owner` so cột |
| PT-06 | Truy vấn trực tiếp dưới `wf_app` không `set app.current_user_id` trả **0 dòng ở mọi bảng** `public` | Duyệt `pg_tables`, `SELECT count(*)` |
| PT-07 | Xác thực: khóa tạm 5 lần sai; refresh token dùng lại ⇒ thu hồi phiên; mật khẩu tạm chặn API; MFA owner; CSRF/Origin; mass-assignment (tự đổi vai trò, `status`, `must_change_password`, `email_verified_at`); đổi email xóa xác minh | Port bộ `auth*` của Lưu Xá + ca mới |
| PT-08 | `audit_logs`, `unit_status_history`, `unit_price_history`, `unit_movements`, `repair_status_history` bất biến | UPDATE/DELETE/TRUNCATE dưới `wf_app`, `wf_owner`, `wf_api` ⇒ lỗi |
| PT-09 | `ledger_entries`, `unit_cost_entries`, `part_stock_movements`, `sale_line_costs` bất biến; chứng từ đã xác nhận không sửa | idem + `UPDATE` cột nghiệp vụ phiếu `confirmed` ⇒ `WF-DOC-NOT-DRAFT`/lỗi trigger |
| PT-10 | Luôn còn ≥ 1 owner: không hạ quyền/khóa/xóa owner cuối | `WF-SEC-LAST-OWNER` |
| PT-11 | Hạn mức giảm giá và bán dưới giá vốn **do server/DB quyết định** (UI bị bỏ qua) | Gọi API thẳng với giá thấp ⇒ `WF-SALE-DISCOUNT-LIMIT`/`WF-SALE-BELOW-COST`; thông báo không lộ số giá vốn cho người không có `cost.view` |
| PT-12 | PII: `id_number_enc` không bao giờ xuất hiện rõ trong API/log/audit; `reveal` cần `customer.pii.view` + lý do; ghi audit; ảnh giấy tờ chỉ người có quyền | Đọc `audit_logs.before/after`; `files` quyền |

Ma trận vai trò × endpoint sinh tự động từ `permissions` + bản đồ endpoint (`api-conventions`); thiếu ô ⇒ test thất bại.

## 4. Kiểm tra cấu trúc DB (`pnpm db:audit`)

| ID | Kiểm tra |
|---|---|
| S1 | Mọi bảng `public` có `relrowsecurity` **và** `relforcerowsecurity` |
| S2 | Mọi bảng có chính sách cho mọi thao tác được `GRANT` |
| S3 | Mọi hàm `SECURITY DEFINER` có `search_path` cố định; owner `wf_definer` |
| S4 | Không hàm `app.*` cấp `EXECUTE` cho `PUBLIC` |
| S5 | Mọi FK có index |
| S6 | Chủ sở hữu bảng/hàm đúng; `wf_app` không phải owner |
| S7 | `anon`/`authenticated` không có quyền trên `public`/`app` |
| S8 | `permissions` (DB) = `PERMISSIONS` (TS); mọi quyền nhạy cảm có ≥ 1 ca PT |
| S9 | Bảng append-only có `tg_immutable` + `tg_no_truncate` |
| S10 | `wf_app` không có `UPDATE` trên `watch_units.status/cost_cycle/stock_since`, `parts.qty_on_hand`, `*.status` của chứng từ |
| S11 | Bảng nghiệp vụ có `tg_audit` (danh sách ngoại lệ có chủ đích) |
| S12 | Mọi `GRANT INSERT (cột)`/`UPDATE (cột)` có mục kiểm giá trị (trigger/CHECK) — liệt kê để rà thủ công |

## 5. Đơn vị (UT)

`UT-money` (`roundHalfUp`, `allocate`: dư 1, dư n−1, trọng số 0, một dòng, số lớn; **thuộc tính ngẫu nhiên Σ = tổng**; đối chiếu TS↔SQL) · `UT-dates` (múi giờ, ranh giới nửa đêm VN, cộng ngày/tháng, hạn bảo hành) · `UT-search` (chuẩn hóa không dấu, serial, SĐT) · `UT-discount` (tính % giảm, hạn mức) · `UT-commission` (3 chế độ) · `UT-techpay` (3 chế độ) · `UT-format` (VND, ngày) · `UT-errors` (ánh xạ lỗi DB → mã WF) · `UT-events` (handler idempotent, lùi dần).

## 6. Ma trận truy vết (nhóm FR → BR → kiểm thử → mốc)

| Nhóm | BR chính | SC | CT | PT | UAT | Mốc |
|---|---|---|---|---|---|---|
| DASH | BR-SALE-12, BR-REP-07, BR-FIN-04, BR-UNIT-04, BR-COST-06 | 10, 14 | — | 01, 05 | 05 | M8 |
| UNIT | BR-UNIT-01…10, BR-GEN-03 | 02, 06b | 09 | 02 | 01 | M1, M4 |
| PUR | BR-PUR-01…11 | 01, 11, 17 | 09, 10, 12 | 01, 12 | 02 | M4 |
| STK | BR-UNIT-03/04, BR-PART-*, BR-INV-* | 05, 07, 14 | 01, 04, 13 | — | 04 | M1, M5, M7 |
| SALE | BR-SALE-01…15, BR-RET-* | 02, 03, 04, 07, 15 | 01, 03, 07, 08 | 11 | 03 | M5 |
| COST | BR-COST-01…06, BR-PUR-05/08 | 01, 02, 08, 09, 11, 17 | — | 01 | 02, 07 | M4–M8 |
| REP | BR-REP-01…15 | 08, 09 | 04 | 04 | 06 | M6 |
| PART | BR-PART-01…06 | 08, 10(11), 14 | 04, 13 | — | 04 | M1, M4, M6 |
| CUS | BR-FIN-05, BR-SEC-03 | 04 | — | 03, 12 | 03 | M2, M5 |
| SUP | BR-FIN-06, BR-PUR-06 | 01 | 10 | — | 02 | M2, M4 |
| FIN | BR-FIN-01…13, BR-GEN-07 | 02, 04, 13, 15, 16 | 05, 06, 10 | 09 | 07 | M3 |
| RPT | BR-SEC-02, BR-COST-02 | 10 | — | 01, 05 | 07 | M8 |
| SEC | BR-SEC-01…08 | 12 | — | 01…12 | 10 | M0 |
| BAK | BR-BAK-01…03, BR-GEN-09 | — | 07 | 07 | 08, 09 | M0, M9 |
| RSV | BR-RSV-01…05 | 05 | 02, 03 | — | 03 | M5 |
| TRD | BR-TRD-01…04, BR-PUR-09/10 | 06, 06b | — | — | 03 | M5 |
| COL | BR-COM-01…04, BR-SALE-15, BR-SEC-08 | 12 | — | 02, 03 | 03 | M5 |
| PLAT | BR-GEN-04…09 | — | 07, 11 | 08 | 09, 10 | M0, M7 |

Script `check-docs` kiểm: mọi `BR-*` xuất hiện ít nhất một lần trong cột BR của `requirements` **và** trong `test-plan`/`golden-scenarios`; mọi `SC/CT/PT/UAT` được nhắc tồn tại.

## 7. Kiểm định độc lập trước go-live (M9)

Làm theo tinh thần bản kiểm định của Lưu Xá (đã tìm ra 5 lỗi nặng nhờ chạy thật):
1. **Luồng A — Tiền & sổ quỹ:** thử mọi đường "vòng" để làm mất/sai tiền (hủy rồi đổi trả, phân bổ vượt, cọc rồi hủy, offset lệch cặp, ghi quỹ ngược dấu, ghi lùi kỳ).
2. **Luồng B — Quyền & RLS:** thử leo thang đặc quyền (tự gán vai trò, ủy quyền, đổi email để chiếm tài khoản), đọc chéo dữ liệu CTV/thợ, rò giá vốn qua báo cáo/Excel/in.
3. **Luồng C — Đồng thời:** chạy CT lặp lớn, thêm tình huống ngoài danh sách; kiểm đối kháng bằng nhiều kết nối.
4. **Luồng D — Docs ↔ code:** đối chiếu BR, trạng thái, mã lỗi, quyền, cài đặt giữa docs và code/migration; liệt kê chỗ lệch.
5. **Luồng E — Vận hành:** diễn tập khôi phục, giả lập mất khóa, kiểm cron/health/cảnh báo.
Phân loại phát hiện: **S0** mọi lỗ hổng cho phép mất/sai tiền, mất kho, vượt quyền hoặc lộ dữ liệu nhạy cảm (kể cả sửa chỉ vài dòng) · S1 lỗi nghiệp vụ nặng/ làm hỏng vận hành · S2 sai lệch vừa · S3 nhỏ. **Không go-live khi còn S0/S1.** Mỗi phát hiện có tái hiện (script), bản vá bằng **migration mới** (không sửa file cũ) và **ca hồi quy** thêm vào bộ test.
Công cụ gợi ý: `/code-review` (mức cao), `/security-review`, rà thủ công RLS/`GRANT`, so sánh `db:audit`.

## 8. Mẫu báo cáo kiểm thử phát hành (`reports/test-<version>.md`, tự sinh)

```
Phiên bản: x.y.z   Ngày: yyyy-mm-dd   Commit: abc1234   Môi trường: test/staging
Tóm tắt: SC a/b · CT c/d (lặp n lần) · PT e/f · UT g/h · db:audit OK/FAIL · consistency OK/FAIL
Đột biến (CT/PT): <ca> đỏ như mong đợi / ĐÃ KHÔNG ĐỎ (lỗi test)
Lỗi đã biết: <danh sách, mức S0–S3>
Thay đổi so với bản trước: <migration, hàm đổi>
Người chạy / duyệt: …
```
