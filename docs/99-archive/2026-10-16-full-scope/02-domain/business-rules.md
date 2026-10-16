# Quy tắc nghiệp vụ (BR)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · **Đây là nguồn sự thật nghiệp vụ.** Code và test bám theo; mâu thuẫn ⇒ sửa ở đây trước.
> Cột **Thực thi**: `DB` ràng buộc/trigger · `FN` hàm `app.fn_*` · `API` lớp API · `UI` giao diện (chỉ là phần thưởng, không bao giờ là chốt chặn duy nhất). Tham số trong `[ ]` là khóa cấu hình ở `settings-catalog`.

## GEN — Quy tắc chung

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-GEN-01 | Tiền là **số nguyên VND** (`bigint`). Cấm số thực cho tiền. Giá vốn bình quân linh kiện lưu `numeric(14,4)`, khi chốt vào dòng chứng từ thì **làm tròn nửa lên về đồng**. | DB, `lib/money.ts` | UT-money, SC-11 |
| BR-GEN-02 | Chứng từ (phiếu nhập, phiếu bán, đổi trả, phiếu sửa, giữ hàng, kiểm kê, phiếu thu/chi) có vòng đời `draft → confirmed → voided`. Nháp sửa/xóa tự do (người tạo hoặc có quyền). **Đã xác nhận ⇒ bất biến.** Mọi hiệu ứng của lúc xác nhận (kho, tiền, giá vốn, trạng thái, audit, sự kiện) nằm trong **một transaction**: cùng thành công hoặc cùng thất bại. | DB trigger, FN | CT-07, SC-* |
| BR-GEN-03 | Không xóa vĩnh viễn dữ liệu đã xác nhận hoặc đã phát sinh giao dịch. Xóa cứng chỉ với nháp và danh mục chưa được tham chiếu; còn lại dùng `is_active=false`, hủy hoặc đảo. FK dùng `RESTRICT`. | DB | PT-09 |
| BR-GEN-04 | Mọi xác nhận/hủy/đảo/điều chỉnh/đổi quyền/đổi cài đặt/xem PII ghi `audit_logs` (ai, lúc nào, trước/sau, lý do). Audit **append-only**. | DB trigger `tg_audit`, FN | PT-08 |
| BR-GEN-05 | Hủy, đảo, điều chỉnh, tịch thu, ghi đè hạn mức… **bắt buộc lý do ≥ 10 ký tự**. | FN (CHECK) | UAT |
| BR-GEN-06 | Mã chứng từ cấp tự động từ `number_sequences` **trong cùng transaction** (không trùng, không đứt khi rollback); không tái sử dụng mã đã hủy. | FN `fn_next_number` | CT-11 |
| BR-GEN-07 | Kỳ tài chính theo tháng. **Kỳ đã khóa**: không tạo/hủy/sửa chứng từ hay phiếu thu/chi có ngày trong kỳ. Mở lại cần `period.reopen` + lý do, có audit. **Chỉ khóa được kỳ đã kết thúc** (`app.today_vn()` > ngày cuối tháng; DB test cho phép đặt đồng hồ giả qua cấu hình phiên `app.test_today`, bị bỏ qua ở production) và yêu cầu đã đối chiếu quỹ (BR-FIN-09). | FN | SC-16, CT-06 |
| BR-GEN-08 | Lưu thời điểm ở UTC; **ngày chứng từ** là ngày theo giờ VN (`Asia/Ho_Chi_Minh`). Không cho ngày tương lai (trừ hạn hẹn trả/giữ hàng); ngày lùi chỉ trong kỳ đang mở. | FN, API | UT-dates |
| BR-GEN-09 | Mọi POST ghi quan trọng nhận `Idempotency-Key`; cùng khóa ⇒ trả đúng kết quả cũ, không tạo bản ghi thứ hai. | API + `idempotency_keys` | CT-07 |

## UNIT — Đồng hồ (từng chiếc)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-UNIT-01 | Mỗi chiếc có `asset_code` duy nhất, sinh khi xác nhận phiếu nhập, **bất biến, không tái sử dụng**. Mã sản phẩm của loại (`watch_models.code`) duy nhất. | DB UNIQUE, FN | UAT-01 |
| BR-UNIT-02 | Serial (nếu có) được chuẩn hóa `serial_norm` (bỏ khoảng trắng/gạch, chữ hoa) và **duy nhất theo (brand_id, serial_norm)** trên các chiếc chưa `cancelled`. Hàng không có serial phải tick "không có serial" lúc nhập. Trùng serial ⇒ chặn kèm gợi ý mở chiếc cũ (nhập lại: BR-PUR-10). | DB partial UNIQUE | CT-09 |
| BR-UNIT-03 | Mỗi chiếc ở **đúng một** `status` tại một thời điểm. Trạng thái chỉ đổi qua `fn_*` theo ma trận ở `state-machines`; app role không có quyền UPDATE cột `status`. Mỗi lần đổi ghi `unit_status_history` (từ, đến, ai, lúc nào, lý do, chứng từ nguồn). | DB (GRANT, trigger), FN | CT-01 |
| BR-UNIT-04 | **Tồn kho** = `in_stock` + `reserved` + `in_repair` + `inspecting`. **Có thể bán** = `in_stock`. Giá trị tồn = Σ giá vốn các chiếc tồn kho. | View `v_stock_units` | SC-10 |
| BR-UNIT-05 | Đổi giá niêm yết/khuyến mãi ghi `unit_price_history` (cũ, mới, ai, lý do). Giá hiệu lực = khuyến mãi nếu hôm nay trong `[promo_from, promo_to]`, không thì niêm yết. Sửa giá cần `unit.price.edit`. | FN, DB | UAT-01 |
| BR-UNIT-06 | Sửa thương hiệu/model/serial của chiếc **đã bán** chỉ với `catalog.manage` + lý do, có audit (để sửa lỗi đánh máy). | FN | PT-08 |
| BR-UNIT-07 | Chiếc đã phát sinh giao dịch không xóa; dùng `written_off` (mất/thanh lý) hoặc `cancelled` (nhập nhầm do hủy phiếu nhập). | DB | UAT-01 |
| BR-UNIT-08 | Chiếc `in_stock`/`reserved`/`inspecting` luôn có vị trí lưu kho. Đổi vị trí ghi `unit_movements`. | DB CHECK, FN | UAT-01 |
| BR-UNIT-09 | Ảnh: chỉ JPEG/PNG/WebP/HEIC (kiểm magic bytes), ≤ 10 MB; **xóa EXIF GPS**; sinh ảnh thu nhỏ; lưu SHA-256. Ảnh loại `intake`/`evidence` (nhận máy, giấy tờ người bán) **không xóa được** sau khi lưu. | API, DB | UAT-01 |
| BR-UNIT-10 | Hàng `used`/`refurbished` bắt buộc có `condition_grade` (A/B/C hoặc % mới) và ≥ 1 ảnh tình trạng trước khi chuyển `in_stock`. | FN | UAT-01 |

## PUR — Nhập hàng

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-PUR-01 | Phiếu nhập có 4 loại: `supplier`, `customer_buyback`, `trade_in`, `opening`. `supplier` bắt buộc NCC; `customer_buyback`/`trade_in` bắt buộc thông tin người bán (BR-PUR-09). | DB CHECK | SC-01 |
| BR-PUR-02 | Dòng **đồng hồ**: đúng 1 chiếc/dòng (loại + serial hoặc "không serial" + tình trạng + giá nhập). Dòng **linh kiện**: số lượng > 0. Giá nhập ≥ 0. | DB CHECK | SC-01 |
| BR-PUR-03 | Tổng tiền nhập = Σ (giá × SL) các dòng + Σ chi phí liên quan. Chi phí liên quan (vận chuyển, kiểm định, sửa chữa trước nhập…) được **phân bổ vào giá vốn** (BR-PUR-05). | FN | SC-01 |
| BR-PUR-04 | **Xác nhận phiếu nhập** (một transaction): sinh từng chiếc + `asset_code`; ghi `unit_cost_entries`; cộng kho linh kiện & cập nhật giá bình quân; đặt trạng thái ban đầu (`in_stock` hoặc `inspecting` theo dòng); tạo công nợ NCC; audit; sự kiện `purchase.confirmed`. | FN `fn_confirm_purchase` | SC-01 |
| BR-PUR-05 | Phân bổ chi phí liên quan theo **tỷ lệ giá trị dòng** (mặc định) hoặc chia đều; làm tròn xuống từng dòng, **phần dư gán dòng có giá trị lớn nhất (hòa ⇒ dòng đầu)** để tổng khớp tuyệt đối. | FN, `lib/money.ts` | SC-01, SC-11 |
| BR-PUR-06 | Thanh toán phiếu nhập bằng phiếu chi phân bổ vào phiếu; **không trả vượt dư nợ**. Công nợ NCC của phiếu = tổng phiếu − đã trả (kể cả bù trừ). | FN | SC-01, CT-10 |
| BR-PUR-07 | **Hủy** phiếu nhập đã xác nhận chỉ khi mọi chiếc/linh kiện từ phiếu **chưa phát sinh giao dịch khác** (chưa giữ/bán/sửa/xuất/kiểm kê). Hiệu ứng: chiếc → `cancelled`, đảo kho linh kiện (không âm; hoàn `avg` theo `prev_qty/prev_avg`), đảo bút toán giá vốn. Phiếu đã có thanh toán ⇒ phải hủy các phiếu chi trước (`WF-PUR-HAS-PAYMENTS`); đã có giao dịch phụ thuộc ⇒ `WF-PUR-HAS-DEPENDENTS`. | FN `fn_void_purchase` | SC-17, CT-12 |
| BR-PUR-08 | **Điều chỉnh giá vốn** sau xác nhận bằng bút toán `adjustment` (±) ở `unit_cost_entries`, cần `cost.adjust` + lý do; **chỉ cho chiếc còn trong kho** (tồn kho theo BR-UNIT-04), áp cho chu kỳ hiện hành; chiếc **đã bán** không điều chỉnh được (`WF-COST-NOT-ADJUSTABLE`) và giá vốn đã chốt không bị hồi tố — chênh lệch phát sinh sau bán ghi bằng phiếu chi/điều chỉnh quỹ có lý do. | FN | SC-17 |
| BR-PUR-09 | Thu mua từ khách / thu cũ đổi mới [`purchase.require_seller_id`]: bắt buộc họ tên, SĐT, CCCD (mã hóa), **ảnh giấy tờ ≥ 1**, ảnh máy ≥ 1; in biên bản thu mua. | FN, API | SC-06 |
| BR-PUR-10 | Nhập lại chiếc đã từng bán (khách bán lại/thu cũ đổi mới đúng chiếc shop từng bán): **dùng lại bản ghi chiếc cũ** (tìm theo mã nội bộ/serial), tăng `cost_cycle`, giá vốn tính lại từ giá nhập mới. | FN | SC-06 |
| BR-PUR-11 | Phiếu `opening` (tồn đầu kỳ): không tạo công nợ/tiền; giá vốn = giá trị khai báo; chỉ `owner`/`purchase.confirm`; ghi nhãn "Tồn đầu kỳ" ở báo cáo. | FN | UAT-02 |

## PART — Linh kiện

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-PART-01 | Tồn linh kiện `qty_on_hand` = Σ `part_stock_movements`, **không bao giờ âm** (CHECK + khóa dòng linh kiện khi trừ). | DB, FN | CT-04 |
| BR-PART-02 | Giá vốn linh kiện = **bình quân gia quyền di động**. Nhập: tính lại. Xuất: dùng bình quân tại thời điểm xuất và **chốt (snapshot)** vào dòng sử dụng/bán. | FN | SC-11 |
| BR-PART-03 | Linh kiện cho sửa chữa trừ kho **khi "xác nhận dùng"** (không phải lúc thêm dòng nháp); bỏ dòng đã xác nhận ⇒ hoàn kho (`repair_return`). | FN | SC-08, CT-04 |
| BR-PART-04 | Cảnh báo khi `qty_on_hand ≤ reorder_level` (ngưỡng theo từng linh kiện). | Job, view | SC-14 |
| BR-PART-05 | Điều chỉnh tồn bắt buộc lý do + quyền `part.stock.adjust`; luôn tạo movement, không sửa trực tiếp `qty_on_hand`. | FN | SC-14 |
| BR-PART-06 | Tương thích (thương hiệu/model) chỉ để gợi ý, **không chặn** dùng. | UI | — |

## SALE — Bán hàng

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-SALE-01 | Phiếu bán **nháp không giữ hàng**. Kiểm tra và khóa hàng xảy ra lúc xác nhận. | FN | CT-01 |
| BR-SALE-02 | **Không bán chiếc đã bán/đang giữ cho người khác.** Chỉ bán chiếc `in_stock`, hoặc `reserved` bởi chính giữ hàng của phiếu này. Bảo vệ 3 lớp: khóa dòng chiếc (`FOR UPDATE`) + kiểm trạng thái + unique một phần "một dòng bán hiệu lực/chiếc". | FN, DB | CT-01, CT-03 |
| BR-SALE-03 | Giảm giá: `% = (Σ niêm yết hiệu lực − Σ giá bán thực) / Σ niêm yết hiệu lực`. Phải ≤ `roles.max_discount_pct` của người xác nhận (lấy mức cao nhất trong các vai trò). Vượt ⇒ chặn (không có luồng chờ duyệt; chủ cửa hàng mặc định không giới hạn). | FN | PT-11 |
| BR-SALE-04 | Bán dưới giá vốn cần `sale.below_cost`. Kiểm ở server; người không có `cost.view` chỉ nhận thông báo "vượt quyền, liên hệ quản lý" (không lộ số). | FN | PT-11 |
| BR-SALE-05 | `grand_total = Σ line_total` (đã gồm phân bổ giảm giá tổng, BR-SALE-13). **Thu cũ đổi mới là phương thức thanh toán, không phải giảm giá**: doanh thu vẫn theo giá bán đầy đủ. Dư nợ `due = net_total − paid_net` (công thức ở `money-and-ledger` §3; `paid_net` đã gồm cọc chuyển vào và bù trừ thu cũ đổi mới). | FN, view | SC-06 |
| BR-SALE-06 | Thanh toán lúc xác nhận: tiền mặt / chuyển khoản / kết hợp nhiều dòng; tổng ≤ `grand_total`. `cash_tendered` (khách đưa) chỉ lưu để in; tiền thừa = đưa − phần tiền mặt, **không ghi sổ quỹ**. | FN | SC-03 |
| BR-SALE-07 | Còn nợ (`due_total > 0`) ⇒ bắt buộc chọn khách hàng cụ thể (có SĐT) [`sales.allow_walkin_debt`=false]; có thể đặt `due_date` để nhắc. | FN | SC-04 |
| BR-SALE-08 | **Xác nhận phiếu bán** (một transaction): khóa chiếc/linh kiện → đổi trạng thái/trừ kho → chốt giá vốn (`sale_line_costs`) → ghi thanh toán + bút toán quỹ → hoa hồng → bảo hành → audit → sự kiện `sale.confirmed`. Lỗi ở bất kỳ bước ⇒ rollback toàn bộ. | FN `fn_confirm_sale` | SC-02, CT-01 |
| BR-SALE-09 | Phiếu đã xác nhận **không sửa**. Sai ⇒ hủy (BR-SALE-10) hoặc đổi trả (BR-RET). | DB trigger | PT-09 |
| BR-SALE-10 | **Hủy** phiếu bán: trong [`sales.void_window_hours`] kể từ lúc xác nhận, kỳ chưa khóa, có `sale.void` + lý do, và phiếu **chưa có đổi trả / chưa dùng cọc**. Hiệu ứng "như chưa xảy ra": hàng về trạng thái trước, đảo thanh toán & bút toán quỹ, hủy hoa hồng & bảo hành. Quá hạn ⇒ dùng đổi trả. | FN `fn_void_sale` | SC-15 |
| BR-SALE-11 | Phiếu in có mã, người bán, bảo hành; in lại ghi "BẢN IN LẠI" và audit. | API | UAT-03 |
| BR-SALE-12 | **Doanh thu** được ghi nhận theo **ngày xác nhận phiếu**. | Báo cáo | SC-10 |
| BR-SALE-13 | Giảm giá tổng phiếu được phân bổ vào các dòng theo tỷ lệ giá trị với quy tắc làm tròn của BR-PUR-05. | FN, `lib/money.ts` | SC-11 |
| BR-SALE-14 | Dòng linh kiện bán lẻ: số lượng ≤ tồn; giá vốn = bình quân tại thời điểm (chốt). | FN | SC-10 |
| BR-SALE-15 | Phiếu do **CTV** tạo là `draft` cho đến khi nhân viên có `sale.confirm` xác nhận; CTV chỉ thấy phiếu của mình. | RLS, FN | PT-03 |

## RSV — Giữ hàng / đặt cọc

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-RSV-01 | Giữ hàng chuyển chiếc `in_stock → reserved`. Tối đa **một** giữ hàng còn hiệu lực (`active`/`expired`) trên mỗi chiếc. | DB partial UNIQUE, FN | CT-02 |
| BR-RSV-02 | Cọc ≥ [`reservation.min_deposit_pct`]% giá niêm yết hiệu lực; hạn giữ mặc định [`reservation.hold_days`] ngày. Quá hạn ⇒ trạng thái `expired` + nhắc; chiếc **vẫn `reserved`** cho tới khi người có quyền xử lý — hệ thống không tự hoàn/tịch thu. | FN, Job | SC-05 |
| BR-RSV-03 | Tiền cọc là **khoản nhận trước (phải trả khách)**, không phải doanh thu. | `money-and-ledger` | SC-05 |
| BR-RSV-04 | **Chuyển thành bán**: cọc được chuyển vào phiếu bán bằng cặp bù trừ; chiếc `reserved → sold`. | FN | SC-05 |
| BR-RSV-05 | **Hủy giữ**: (a) hoàn cọc bằng phiếu chi thật, hoặc (b) tịch thu ⇒ ghi "thu nhập khác" (cần `reservation.forfeit` + lý do). Chiếc về `in_stock`. | FN | SC-05 |

## TRD — Thu cũ đổi mới

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-TRD-01 | Thu cũ đổi mới tạo phiếu nhập `trade_in` **trong cùng transaction** xác nhận phiếu bán; chiếc thu về vào `in_stock` hoặc `inspecting` (chọn). | FN | SC-06 |
| BR-TRD-02 | Giá thu (credit) trừ vào số phải trả bằng cặp bù trừ; **không phải giảm giá**. `credit ≤ grand_total` của phiếu bán. | FN | SC-06 |
| BR-TRD-03 | Giá vốn chiếc thu về = giá thu (+ chi phí phát sinh sau). Công nợ NCC của phiếu `trade_in` = 0 (đã bù trừ). | FN | SC-06 |
| BR-TRD-04 | Áp BR-PUR-09 (giấy tờ người bán) và BR-PUR-10 (nếu đúng chiếc shop từng bán). | FN | SC-06 |

## RET — Đổi trả

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-RET-01 | Đổi trả trong [`sales.return_window_days`] ngày kể từ ngày phiếu bán; quá hạn cần `return.override` + lý do. | FN | SC-07 |
| BR-RET-02 | Trả theo dòng: đồng hồ = 1; linh kiện ≤ đã bán − đã trả. | FN | SC-07 |
| BR-RET-03 | Hoàn kho: chiếc → `inspecting` (mặc định) hoặc `in_stock` nếu người có `unit.release` xác nhận nguyên vẹn; linh kiện cộng kho theo **giá vốn gốc đã chốt**. | FN | SC-07 |
| BR-RET-04 | Doanh thu và giá vốn **đảo theo ngày đổi trả** (không sửa quá khứ). Phí khấu trừ (nếu có) là thu nhập khác. | FN, báo cáo | SC-07 |
| BR-RET-05 | Hoàn tiền tối đa = số **đã thu thực** của phiếu − giá trị còn lại của phiếu sau đổi trả; nếu phiếu còn nợ thì trước hết giảm nợ. Hoàn vượt cần quyền. | FN | SC-07 |
| BR-RET-06 | Đổi hàng = đổi trả + phiếu bán mới (có tham chiếu). | UI, FN | UAT-03 |
| BR-RET-07 | Đổi trả hủy hoa hồng CTV của dòng đó (clawback nếu đã chi) và hủy bảo hành của dòng. | FN | SC-12 |

## COST — Giá vốn

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-COST-01 | Giá vốn chiếc = Σ `unit_cost_entries` của **chu kỳ hiện hành** (mua + chi phí nhập phân bổ + linh kiện/công sửa nội bộ + điều chỉnh). Đồng hồ: giá vốn **đích danh**. | View | SC-01, SC-09 |
| BR-COST-02 | Khi xác nhận bán, giá vốn được **chốt** vào `sale_line_costs` và không đổi hồi tố. Lãi gộp dòng = `line_total − cost`. | FN | SC-02 |
| BR-COST-03 | Chi phí phát sinh **sau khi bán** (bảo hành) **không** vào giá vốn hàng đã bán; tính vào lãi gộp sửa chữa (âm) / báo cáo bảo hành. | FN | SC-08 |
| BR-COST-04 | Sửa chữa **nội bộ**: chi phí linh kiện (bình quân tại lúc dùng) và công **vốn hóa** vào giá vốn chiếc khi phiếu sửa `completed`, không phải lúc thêm dòng. | FN | SC-09 |
| BR-COST-05 | Điều chỉnh giá vốn **append-only** (không sửa/xóa bút toán cũ), có lý do và quyền `cost.adjust`. | DB, FN | SC-17 |
| BR-COST-06 | Giá vốn chỉ trả về cho người có `cost.view`; lợi nhuận cho `profit.view` — ở tầng RLS/hàm, **mọi đường** (API, báo cáo, Excel, PDF, in). | RLS | PT-01, PT-05 |

## REP — Sửa chữa

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-REP-01 | Hai loại: `customer` (máy của khách → **doanh thu dịch vụ**) và `internal` (máy của cửa hàng → **vốn hóa vào giá vốn**, không doanh thu). Chế độ tính phí: `paid` hoặc `warranty_free`. | DB CHECK | SC-08, SC-09 |
| BR-REP-02 | Phiếu nhận bắt buộc: khách (tên + SĐT), thương hiệu/model, serial (hoặc "không serial"), tình trạng ban đầu, mô tả lỗi của khách, **≥ 1 ảnh hiện trạng**. | FN | SC-08 |
| BR-REP-03 | Trạng thái và chuyển đổi theo `state-machines`: `received → inspecting → repairing ⇄ waiting_parts → completed → delivered`; `cancelled` được phép trước `completed`. | FN | SC-08 |
| BR-REP-04 | Báo giá = các dòng nhân công/linh kiện; [`repair.require_quote_approval`] khách đồng ý (ghi người, lúc, kênh) trước khi `repairing`. | FN | SC-08 |
| BR-REP-05 | Cọc sửa chữa là khoản đã thu cho phiếu; trừ vào tổng khi giao; hủy phiếu ⇒ hoàn cọc bằng phiếu chi thật. | FN | SC-08 |
| BR-REP-06 | Linh kiện trừ kho khi xác nhận dùng (BR-PART-03); không cho âm. | FN | CT-04 |
| BR-REP-07 | Khóa dòng khi `completed`. **Doanh thu sửa chữa ghi nhận lúc `delivered`**. Giao máy khi đã thu đủ, hoặc ghi nợ cho khách xác định (cần quyền). | FN | SC-08 |
| BR-REP-08 | **Tiền công thợ** theo cấu hình từng thợ: `percent` (% doanh thu nhân công), `fixed_per_service` (mức cố định theo loại việc), `salary` (không chia theo ca, chỉ ghi nhận số ca). Tính lúc `delivered`, chốt vào `repair_tech_pay`. | FN | SC-08 |
| BR-REP-09 | **Lãi gộp sửa chữa = doanh thu − giá vốn linh kiện đã dùng − tiền công thợ theo ca** (− chi phí bảo hành). Linh kiện chỉ ghi ở dòng sửa chữa; nhân công (doanh thu) tách khỏi tiền công thợ (chi phí) ⇒ không tính trùng (III.4). | Báo cáo | SC-08 |
| BR-REP-10 | Bảo hành sau sửa: [`warranty.repair_days`] ngày kể từ `delivered`. Yêu cầu bảo hành = phiếu sửa mới `warranty_free` liên kết `warranty_id`. | FN | SC-08 |
| BR-REP-11 | Sửa nội bộ: tạo phiếu ⇒ chiếc `in_stock → in_repair`; `completed` ⇒ về `in_stock`/`inspecting`, chi phí vốn hóa (BR-COST-04). | FN | SC-09 |
| BR-REP-12 | Cảnh báo máy `completed` chưa `delivered` quá [`repair.pickup_alert_days`] ngày. | Job | UAT-06 |
| BR-REP-13 | Lịch sử sửa chữa tra theo serial, hợp nhất máy khách (`customer_watches`) và máy của shop (`watch_units`). | View | UAT-06 |
| BR-REP-14 | Ảnh hiện trạng khi nhận **bất biến**, có SHA-256. | DB | UAT-06 |
| BR-REP-15 | Hủy phiếu (trước `completed`): hoàn linh kiện đã trừ, hoàn cọc, chiếc nội bộ về trạng thái cũ. | FN | UAT-06 |

## FIN — Thu chi, quỹ, công nợ

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-FIN-01 | Mỗi **dòng tiền thật** = một `payment` đã ghi (`posted`) ⇒ đúng **một** bút toán sổ quỹ (trừ `method='offset'`). Ghi cả hai trong một transaction. | FN `fn_post_payment` | SC-02, CT-05 |
| BR-FIN-02 | Sổ quỹ **append-only** (UPDATE/DELETE/TRUNCATE bị chặn); mỗi bút toán lưu `balance_after`, `prev_hash`, `hash` (chuỗi băm theo từng quỹ); sai ⇒ bút toán đảo. Job hằng đêm kiểm chuỗi. | DB trigger | PT-09, SC-16 |
| BR-FIN-03 | Số dư quỹ không âm [`finance.allow_negative_cash`=false, đặt theo từng quỹ]; kiểm trong khi đã khóa dòng quỹ. | FN | CT-05 |
| BR-FIN-04 | **Doanh thu không bao giờ tính từ thanh toán/sổ quỹ.** Mục đích của phiếu thu (`purpose`) quyết định cách tính: khoản vay, thu hộ, cọc chưa chuyển, hoàn tiền **không phải doanh thu**. | Báo cáo | SC-13 |
| BR-FIN-05 | **Công nợ khách** = Σ dư nợ phiếu bán đã xác nhận + phiếu sửa đã giao (chỉ phần dương). Hiển thị riêng "cọc đang giữ". | View | SC-04 |
| BR-FIN-06 | **Công nợ NCC** = Σ dư nợ phiếu nhập đã xác nhận (trừ `opening`, `trade_in` đã bù trừ). | View | SC-01 |
| BR-FIN-07 | Thu nợ/trả nợ phân bổ vào các phiếu theo lựa chọn; mặc định phiếu **cũ trước**. Tổng phân bổ ≤ số tiền phiếu thu; mỗi phiếu không bị phân bổ vượt dư nợ. | FN | SC-04, CT-10 |
| BR-FIN-08 | Chuyển quỹ nội bộ tạo hai bút toán (ra–vào) cùng `transfer_id`; không là thu hay chi. | FN | SC-16 |
| BR-FIN-09 | Đối chiếu kỳ: `số dư đầu kỳ + thu − chi = số dư cuối kỳ` tính từ bút toán và so với số dư thực nhập; lệch ⇒ điều chỉnh có lý do (BR-FIN-12) trước khi khóa kỳ. | FN | SC-16 |
| BR-FIN-10 | Hủy phiếu thu/chi = **bút toán đảo**, cần `payment.void` + lý do, kỳ chưa khóa; allocations của phiếu bị đảo cùng lúc. | FN | SC-15 |
| BR-FIN-11 | Phiếu chi có `expense_category` (cờ `is_operating`). Tiền trả nhập hàng/linh kiện đi qua phiếu nhập — **không nhập lại** như chi phí. | FN | SC-01 |
| BR-FIN-12 | Điều chỉnh quỹ (lệch kiểm quỹ) bằng bút toán `adjustment` thu/chi, `ledger.adjust`, lý do ≥ 10 ký tự, không âm quỹ. | FN | SC-16 |
| BR-FIN-13 | Số dư đầu kỳ của quỹ nhập **một lần** trước bút toán đầu tiên của quỹ đó. | FN | UAT-02 |

## INV — Kiểm kê

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-INV-01 | Đợt kiểm kê có phạm vi (tất cả/vị trí/linh kiện), trạng thái `open → reconciled/cancelled`. Số hệ thống được lấy **tại lúc đối chiếu**; khuyến nghị không giao dịch trong lúc đếm. | FN | SC-14 |
| BR-INV-02 | Mọi chênh lệch bắt buộc lý do. Chiếc không tìm thấy ⇒ `written_off` (hao hụt = giá vốn). Linh kiện lệch ⇒ movement `stocktake` × giá bình quân. | FN | SC-14 |
| BR-INV-03 | Điều chỉnh tồn luôn qua movement/chuyển trạng thái, không sửa số trực tiếp. | DB, FN | SC-14 |
| BR-INV-04 | **Hàng tồn lâu** = chiếc `in_stock` có `hôm nay − stock_since > [inventory.aging_days]`; `stock_since` = ngày vào `in_stock` gần nhất. | View | SC-14 |

## COM — Hoa hồng cộng tác viên

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-COM-01 | Hoa hồng tính theo hồ sơ CTV: `percent_of_price` (% giá bán dòng), `percent_of_profit` (% lãi gộp dòng), `fixed_per_unit` (số tiền cố định/chiếc). **Chốt (snapshot) khi xác nhận bán.** | FN | SC-12 |
| BR-COM-02 | Hoa hồng ở trạng thái `pending → payable` khi phiếu bán **thu đủ** [`commission.pay_when`='fully_paid']; chi trả bằng phiếu chi `purpose='commission_payout'`. | FN | SC-12 |
| BR-COM-03 | Hủy/đổi trả ⇒ hoa hồng `voided`; nếu đã chi ⇒ sinh dòng **clawback** (âm) trừ vào kỳ chi sau. | FN | SC-12 |
| BR-COM-04 | CTV chỉ thấy **số tiền hoa hồng** của mình, không thấy giá vốn/lãi dù cơ sở tính là lãi. | RLS | PT-03 |

## SEC — Bảo mật

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-SEC-01 | Phân quyền theo **permission**, không theo tên vai trò. Người dùng có thể có nhiều vai trò (quyền = hợp). | RLS, API | PT-01…04 |
| BR-SEC-02 | Giá vốn, lợi nhuận, công nợ, tiền công thợ, hoa hồng của người khác nằm ở bảng/hàm có RLS theo quyền; báo cáo, xuất file, in dùng **cùng** lớp quyền. | RLS, FN | PT-01, PT-05 |
| BR-SEC-03 | PII (CCCD) mã hóa AES-256-GCM tầng ứng dụng + chỉ mục băm để tìm; xem đầy đủ cần `customer.pii.view` + nêu lý do + audit. Không log PII. | API | PT-12 |
| BR-SEC-04 | Mật khẩu băm Argon2id; khóa tạm [`security.lockout_minutes`] phút sau [`security.max_failed_logins`] lần sai; đổi mật khẩu thu hồi các phiên khác; MFA (TOTP) bắt buộc cho vai trò trong [`security.mfa_required_roles`]. | `server/auth` | PT-07 |
| BR-SEC-05 | Không ai (kể cả chủ) sửa/xóa `audit_logs`, `ledger_entries`, `unit_status_history`, `unit_cost_entries` qua ứng dụng. | DB | PT-08, PT-09 |
| BR-SEC-06 | Đăng xuất thu hồi phiên và refresh token; token đã xoay bị dùng lại ⇒ thu hồi cả phiên. | `server/auth` | PT-07 |
| BR-SEC-07 | Luôn còn ≥ 1 chủ cửa hàng hoạt động; không tự hạ quyền/khóa chính mình nếu là chủ cuối cùng. | FN | PT-10 |
| BR-SEC-08 | **CTV**: chỉ thấy chiếc `in_stock` có `collab_visible` (ảnh, thông số, **giá hiệu lực**), chỉ thấy phiếu/khách do mình tạo, chỉ thấy hoa hồng của mình. | RLS | PT-02, PT-03 |

## BAK — Sao lưu

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-BAK-01 | Sao lưu DB hằng đêm (mã hóa, giữ ≥ 90 ngày + bản tuần dài hạn); ảnh Storage sao lưu hằng tuần. RPO ≤ 24 giờ, RTO ≤ 4 giờ. | CI backup | UAT-09 |
| BR-BAK-02 | Cảnh báo cho chủ khi bản sao lưu cũ hơn [`backup.heartbeat_max_hours`] giờ. | `/api/health?deep=1`, job | UAT-09 |
| BR-BAK-03 | Diễn tập khôi phục vào DB tạm **trước go-live và mỗi quý**, có biên bản. | Quy trình | UAT-09 |
