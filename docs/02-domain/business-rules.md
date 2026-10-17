# Quy tắc nghiệp vụ (BR)

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`) · **Đây là nguồn sự thật nghiệp vụ.** Code và test bám theo; mâu thuẫn ⇒ sửa ở đây trước.
> Cột **Thực thi**: `DB` ràng buộc/trigger · `FN` hàm `app.fn_*` · `API` lớp API · `UI` giao diện (chỉ là phần thưởng, không bao giờ là chốt chặn duy nhất). Tham số trong `[ ]` là khóa cấu hình ở `settings-catalog`.
> Quy tắc đã **hoãn/bỏ** (tài chính-quỹ, NCC, đổi trả, tiền công thợ, hoa hồng) liệt kê ở §Hoãn cuối file; nội dung đầy đủ ở `docs/99-archive/2026-10-16-full-scope/`.

## GEN — Quy tắc chung

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-GEN-01 | Tiền là **số nguyên VND** (`bigint`). Cấm số thực cho tiền. Giá vốn bình quân linh kiện lưu `numeric(14,4)`, khi chốt vào dòng chứng từ thì **làm tròn nửa lên về đồng**. | DB, `lib/money.ts` | UT-money, SC-11 |
| BR-GEN-02 | Chứng từ (phiếu nhập, phiếu bán, phiếu sửa, giữ hàng, phiếu giao CTV, quyết toán CTV, kiểm kê) có vòng đời `draft → confirmed → voided`. Nháp sửa/xóa tự do (người tạo hoặc có quyền). **Đã xác nhận ⇒ bất biến.** Mọi hiệu ứng của lúc xác nhận (kho, thanh toán, giá vốn, trạng thái, audit, sự kiện) nằm trong **một transaction**: cùng thành công hoặc cùng thất bại. | DB trigger, FN | CT-07, SC-* |
| BR-GEN-03 | Không xóa vĩnh viễn dữ liệu đã xác nhận hoặc đã phát sinh giao dịch. Xóa cứng chỉ với nháp và danh mục chưa được tham chiếu; còn lại dùng `is_active=false` hoặc hủy. FK dùng `RESTRICT`. | DB | PT-09 |
| BR-GEN-04 | Mọi xác nhận/hủy/điều chỉnh/đổi quyền/đổi cài đặt/xem PII ghi `audit_logs` (ai, lúc nào, trước/sau, lý do). Audit **append-only**. | DB trigger `tg_audit`, FN | PT-08 |
| BR-GEN-05 | Hủy, điều chỉnh, tịch thu, thu hồi, ghi mất, ghi đè hạn mức… **bắt buộc lý do ≥ 10 ký tự**. | FN (CHECK) | UAT |
| BR-GEN-06 | Mã chứng từ cấp tự động từ `number_sequences` **trong cùng transaction** (không trùng, không đứt khi rollback); không tái sử dụng mã đã hủy. | FN `fn_next_number` | CT-11 |
| BR-GEN-08 | Lưu thời điểm ở UTC; **ngày chứng từ** là ngày theo giờ VN (`Asia/Ho_Chi_Minh`). Không cho ngày tương lai (trừ hạn hẹn trả/giữ hàng); ngày lùi tối đa [`doc.max_backdate_days`] ngày — lùi hơn cần `doc.backdate` + lý do. (Không còn khóa kỳ — CF-07.) | FN, API | UT-dates |
| BR-GEN-09 | Mọi POST ghi quan trọng nhận `Idempotency-Key`; cùng khóa ⇒ trả đúng kết quả cũ, không tạo bản ghi thứ hai. | API + `idempotency_keys` | CT-07 |

## UNIT — Đồng hồ (từng chiếc)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-UNIT-01 | Mỗi chiếc có `asset_code` duy nhất, sinh khi xác nhận phiếu nhập, **bất biến, không tái sử dụng**. Mã sản phẩm của loại (`watch_models.code`) duy nhất. | DB UNIQUE, FN | UAT-01 |
| BR-UNIT-02 | Serial (nếu có) được chuẩn hóa `serial_norm` (bỏ khoảng trắng/gạch, chữ hoa) và **duy nhất theo (brand_id, serial_norm)** trên các chiếc chưa `cancelled`. Hàng không có serial phải tick "không có serial" lúc nhập. Trùng serial ⇒ chặn kèm gợi ý mở chiếc cũ (nhập lại: BR-PUR-10). | DB partial UNIQUE | CT-09 |
| BR-UNIT-03 | Mỗi chiếc ở **đúng một** `status` tại một thời điểm. Trạng thái chỉ đổi qua `fn_*` theo ma trận ở `state-machines`; app role không có quyền UPDATE cột `status`. Mỗi lần đổi ghi `unit_status_history` (từ, đến, ai, lúc nào, lý do, chứng từ nguồn). | DB (GRANT, trigger), FN | CT-01 |
| BR-UNIT-04 | **Tồn kho** = `in_stock` + `reserved` + `with_collaborator` + `in_repair` + `inspecting`. **Cửa hàng có thể bán** = `in_stock`. Giá trị tồn = Σ giá vốn các chiếc tồn kho (hiển thị riêng phần "đang ở CTV"). | View `v_stock_units` | SC-10 |
| BR-UNIT-05 | Đổi giá niêm yết/khuyến mãi ghi `unit_price_history` (cũ, mới, ai, lý do). Giá hiệu lực = khuyến mãi nếu hôm nay trong `[promo_from, promo_to]`, không thì niêm yết. Sửa giá cần `unit.price.edit`. | FN, DB | UAT-01 |
| BR-UNIT-06 | Sửa thương hiệu/model/serial của chiếc **đã bán** chỉ với `catalog.manage` + lý do, có audit (để sửa lỗi đánh máy). | FN | PT-08 |
| BR-UNIT-07 | Chiếc đã phát sinh giao dịch không xóa; dùng `written_off` (mất/thanh lý) hoặc `cancelled` (nhập nhầm do hủy phiếu nhập). | DB | UAT-01 |
| BR-UNIT-08 | Chiếc `in_stock`/`reserved`/`inspecting` luôn có vị trí lưu kho. Chiếc `with_collaborator` không có vị trí kho (vị trí = đang ở CTV). Đổi vị trí ghi `unit_movements`. | DB CHECK, FN | UAT-01 |
| BR-UNIT-09 | Ảnh: chỉ JPEG/PNG/WebP/HEIC (kiểm magic bytes), ≤ 10 MB; **xóa EXIF GPS**; sinh ảnh thu nhỏ; lưu SHA-256. Ảnh loại `intake`/`evidence` (nhận máy, giấy tờ người bán) **không xóa được** sau khi lưu. | API, DB | UAT-01 |
| BR-UNIT-10 | Hàng `used`/`refurbished` bắt buộc có `condition_grade` (A/B/C hoặc % mới) và ≥ 1 ảnh tình trạng trước khi chuyển `in_stock`. | FN | UAT-01 |

## PUR — Nhập hàng

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-PUR-01 | Phiếu nhập có 4 loại: `purchase` (mua vào), `customer_buyback`, `trade_in`, `opening`. `purchase` bắt buộc **nguồn hàng** (`source_name`, chữ); `customer_buyback`/`trade_in` bắt buộc thông tin người bán (BR-PUR-09). Không có nhà cung cấp (CF-06). | DB CHECK | SC-01 |
| BR-PUR-02 | Dòng **đồng hồ**: đúng 1 chiếc/dòng (loại + serial hoặc "không serial" + tình trạng + giá nhập). Dòng **linh kiện**: số lượng > 0. Giá nhập ≥ 0. | DB CHECK | SC-01 |
| BR-PUR-03 | Tổng tiền nhập = Σ (giá × SL) các dòng + Σ chi phí liên quan. Chi phí liên quan (vận chuyển, kiểm định, sửa chữa trước nhập…) được **phân bổ vào giá vốn** (BR-PUR-05). | FN | SC-01 |
| BR-PUR-04 | **Xác nhận phiếu nhập** (một transaction): sinh từng chiếc + `asset_code`; ghi `unit_cost_entries`; cộng kho linh kiện & cập nhật giá bình quân; đặt trạng thái ban đầu (`in_stock` hoặc `inspecting` theo dòng); audit; sự kiện `purchase.confirmed`. | FN `fn_confirm_purchase` | SC-01 |
| BR-PUR-05 | Phân bổ chi phí liên quan theo **tỷ lệ giá trị dòng** (mặc định) hoặc chia đều; làm tròn xuống từng dòng, **phần dư gán dòng có giá trị lớn nhất (hòa ⇒ dòng đầu)** để tổng khớp tuyệt đối. | FN, `lib/money.ts` | SC-01, SC-11 |
| BR-PUR-06 | Phiếu nhập **không theo dõi trả tiền/công nợ** (CF-06/07): chỉ ghi giá nhập; có ô ghi chú thanh toán tùy chọn (chữ). | FN | SC-01 |
| BR-PUR-07 | **Hủy** phiếu nhập đã xác nhận chỉ khi mọi chiếc/linh kiện từ phiếu **chưa phát sinh giao dịch khác** (chưa giữ/bán/giao CTV/sửa/xuất/kiểm kê). Hiệu ứng: chiếc → `cancelled`, đảo kho linh kiện (không âm; hoàn `avg` theo `prev_qty/prev_avg`), đảo bút toán giá vốn. Có giao dịch phụ thuộc ⇒ `WF-PUR-HAS-DEPENDENTS`. | FN `fn_void_purchase` | SC-17, CT-12 |
| BR-PUR-08 | **Điều chỉnh giá vốn** sau xác nhận bằng bút toán `adjustment` (±) ở `unit_cost_entries`, cần `cost.adjust` + lý do; **chỉ cho chiếc còn trong kho** (tồn kho theo BR-UNIT-04), áp cho chu kỳ hiện hành; chiếc **đã bán** không điều chỉnh được (`WF-COST-NOT-ADJUSTABLE`) và giá vốn đã chốt không bị hồi tố. | FN | SC-17 |
| BR-PUR-09 | Thu mua từ khách / thu cũ đổi mới [`purchase.require_seller_id`]: bắt buộc họ tên, SĐT, CCCD (mã hóa), **ảnh giấy tờ ≥ 1**, ảnh máy ≥ 1; in biên bản thu mua. | FN, API | SC-06 |
| BR-PUR-10 | Nhập lại chiếc đã từng bán (khách bán lại/thu cũ đổi mới đúng chiếc shop từng bán): **dùng lại bản ghi chiếc cũ** (tìm theo mã nội bộ/serial), tăng `cost_cycle`, giá vốn tính lại từ giá nhập mới. | FN | SC-06 |
| BR-PUR-11 | Phiếu `opening` (tồn đầu kỳ): giá vốn = giá trị khai báo; chỉ `owner`/`purchase.confirm`; ghi nhãn "Tồn đầu kỳ" ở báo cáo. | FN | UAT-02 |

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
| BR-SALE-02 | **Không bán chiếc đã bán/đang giữ cho người khác.** Cửa hàng chỉ bán chiếc `in_stock`, hoặc `reserved` bởi chính giữ hàng của phiếu này; CTV chỉ bán chiếc `with_collaborator` được giao cho **chính CTV đó**. Bảo vệ 3 lớp: khóa dòng chiếc (`FOR UPDATE`) + kiểm trạng thái + unique một phần "một dòng bán hiệu lực/chiếc". | FN, DB | CT-01, CT-03 |
| BR-SALE-03 | Giảm giá: `% = (Σ niêm yết hiệu lực − Σ giá bán thực) / Σ niêm yết hiệu lực`. Phải ≤ `roles.max_discount_pct` của người xác nhận (lấy mức cao nhất trong các vai trò). Vượt ⇒ chặn (không có luồng chờ duyệt; chủ mặc định không giới hạn). Không áp cho đơn CTV (CTV tự định giá bán). | FN | PT-11 |
| BR-SALE-04 | Bán dưới giá vốn cần `sale.below_cost`. Kiểm ở server; người không có `cost.view` chỉ nhận thông báo "vượt quyền, liên hệ quản lý" (không lộ số). Không áp cho đơn CTV (xem BR-COL-04). | FN | PT-11 |
| BR-SALE-05 | `grand_total = Σ line_total` (đã gồm phân bổ giảm giá tổng, BR-SALE-13). **Thu cũ đổi mới là một cách thanh toán, không phải giảm giá**: doanh thu vẫn theo giá bán đầy đủ. Dư nợ theo `money-and-payments` §3. | FN, view | SC-06 |
| BR-SALE-06 | Thanh toán lúc xác nhận: tiền mặt / chuyển khoản / kết hợp nhiều dòng; tổng ≤ `grand_total`. `cash_tendered` (khách đưa) chỉ lưu để in; tiền thừa = đưa − phần tiền mặt, **không ghi nhận như thanh toán**. | FN | SC-03 |
| BR-SALE-07 | Còn nợ (`due > 0`) ⇒ bắt buộc chọn khách hàng cụ thể (có SĐT) [`sales.allow_walkin_debt`=false]; có thể đặt `due_date` để nhắc. Thu thêm ngay trên phiếu (BR-PAY-04). | FN | SC-04 |
| BR-SALE-08 | **Xác nhận phiếu bán** (một transaction): khóa chiếc/linh kiện → đổi trạng thái/trừ kho → chốt giá vốn (`sale_line_costs`) → ghi thanh toán → bảo hành → (đơn CTV: chốt giá thu) → audit → sự kiện `sale.confirmed`. Lỗi ở bất kỳ bước ⇒ rollback toàn bộ. | FN `fn_confirm_sale` | SC-02, CT-01 |
| BR-SALE-09 | Phiếu đã xác nhận **không sửa**. Sai nhập liệu ⇒ hủy (BR-SALE-10). Khách trả hàng/đổi hàng: **không xử lý trong hệ thống** (đổi trả bị thay bằng bảo hành — CF-02). | DB trigger | PT-09 |
| BR-SALE-10 | **Hủy** phiếu bán: trong [`sales.void_window_hours`] kể từ lúc xác nhận, có `sale.void` + lý do, và phiếu **chưa dùng cọc từ giữ hàng** (đã dùng ⇒ `WF-SALE-VOID-NOT-ALLOWED`) và (đơn CTV) dòng chưa quyết toán. Hiệu ứng "như chưa xảy ra": chiếc về trạng thái trước (`in_stock`, hoặc `with_collaborator` nếu đơn CTV), trả linh kiện về kho, hủy các thanh toán của phiếu, hủy bảo hành, hủy chiếc thu cũ đổi mới nếu chưa phát sinh giao dịch khác. | FN `fn_void_sale` | SC-15, SC-16, CT-08 |
| BR-SALE-11 | Phiếu in có mã, người bán, bảo hành; in lại ghi "BẢN IN LẠI" và audit. | API | UAT-03 |
| BR-SALE-12 | **Doanh thu** được ghi nhận theo **ngày xác nhận phiếu**. | Báo cáo | SC-10 |
| BR-SALE-13 | Giảm giá tổng phiếu được phân bổ vào các dòng theo tỷ lệ giá trị với quy tắc làm tròn của BR-PUR-05. | FN, `lib/money.ts` | SC-11 |
| BR-SALE-14 | Dòng linh kiện bán lẻ: số lượng ≤ tồn; giá vốn = bình quân tại thời điểm (chốt). | FN | SC-10 |
| BR-SALE-15 | Phiếu do **CTV** tạo là `draft` cho đến khi người có `sale.confirm` xác nhận; CTV chỉ thấy phiếu của mình (BR-COL-03). | RLS, FN | PT-03 |
| BR-SALE-16 | Người có `cost.view` thấy trên phiếu bán **giá thu (giá vốn)** và **lãi** cạnh giá bán; người khác không thấy (CF-01). | RLS, FN | PT-01 |

## RSV — Giữ hàng / đặt cọc

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-RSV-01 | Giữ hàng chuyển chiếc `in_stock → reserved`. Tối đa **một** giữ hàng còn hiệu lực (`active`/`expired`) trên mỗi chiếc. | DB partial UNIQUE, FN | CT-02 |
| BR-RSV-02 | Cọc ≥ [`reservation.min_deposit_pct`]% giá niêm yết hiệu lực; hạn giữ mặc định [`reservation.hold_days`] ngày (tối đa [`reservation.max_hold_days`]). Quá hạn ⇒ trạng thái `expired` + nhắc; chiếc **vẫn `reserved`** cho tới khi người có quyền xử lý — hệ thống không tự hoàn/tịch thu. | FN, Job | SC-05 |
| BR-RSV-03 | Tiền cọc là **khoản nhận trước (phải trả khách)**, không phải doanh thu. | `money-and-payments` | SC-05 |
| BR-RSV-04 | **Chuyển thành bán**: cọc được trừ vào phiếu bán (ghi `reservations.applied_vnd`, không phát sinh thanh toán mới); chiếc `reserved → sold`. | FN | SC-05 |
| BR-RSV-05 | **Hủy giữ**: (a) hoàn cọc bằng thanh toán chiều `out` (`deposit_refund`), hoặc (b) tịch thu ⇒ ghi `forfeited_vnd` ("thu nhập khác"; cần `reservation.forfeit` + lý do). Chiếc về `in_stock`. Luôn có `cọc đã thu = applied + refunded + forfeited` khi đóng giữ hàng. | FN | SC-05 |

## TRD — Thu cũ đổi mới

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-TRD-01 | Thu cũ đổi mới tạo phiếu nhập `trade_in` **trong cùng transaction** xác nhận phiếu bán; chiếc thu về vào `in_stock` hoặc `inspecting` (chọn). | FN | SC-06 |
| BR-TRD-02 | Giá thu (credit) trừ vào số phải trả (bản ghi `sale_trade_ins.credit_vnd`); **không phải giảm giá**. `credit ≤ grand_total` của phiếu bán. | FN | SC-06 |
| BR-TRD-03 | Giá vốn chiếc thu về = giá thu (+ chi phí phát sinh sau). | FN | SC-06 |
| BR-TRD-04 | Áp BR-PUR-09 (giấy tờ người bán) và BR-PUR-10 (nếu đúng chiếc shop từng bán). | FN | SC-06 |

## WAR — Bảo hành (thay cho đổi trả — CF-02)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-WAR-01 | Bảo hành `sale` tự tạo cho mỗi dòng **đồng hồ** khi xác nhận phiếu bán; thời hạn theo tình trạng chiếc [`warranty.shop_months.new/used/refurbished`], tính từ ngày phiếu. Bảo hành `repair` tự tạo khi giao phiếu sửa `customer` tính phí, [`warranty.repair_days`] ngày từ ngày giao. | FN | SC-02, SC-08 |
| BR-WAR-02 | **Yêu cầu bảo hành** = phiếu sửa `warranty_free` liên kết `warranty_id`; chỉ khi bảo hành còn `active` (đủ hạn). Hết hạn ⇒ vẫn nhận máy nhưng phiếu phải `paid`. | FN | SC-07 |
| BR-WAR-03 | Phiếu `warranty_free` **không có doanh thu**; chi phí linh kiện tính vào **chi phí bảo hành** (giảm lãi gộp sửa chữa), không vào giá vốn hàng đã bán (BR-COST-03). | FN, báo cáo | SC-07 |
| BR-WAR-04 | Job hằng ngày đánh `expired` khi quá hạn và nhắc trước [`warranty.expiry_alert_days`] ngày. | Job | UAT-04 |
| BR-WAR-05 | Hủy phiếu bán ⇒ bảo hành của phiếu `voided`. | FN | SC-15 |
| BR-WAR-06 | Bảo hành của **hãng** (nếu có) chỉ ghi hạn trên chiếc; không tạo phiếu. | UI | UAT-01 |

## COST — Giá vốn

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-COST-01 | Giá vốn chiếc = Σ `unit_cost_entries` của **chu kỳ hiện hành** (mua + chi phí nhập phân bổ + linh kiện/chi phí sửa nội bộ + điều chỉnh). Đồng hồ: giá vốn **đích danh**. | View | SC-01, SC-09 |
| BR-COST-02 | Khi xác nhận bán, giá vốn được **chốt** vào `sale_line_costs` và không đổi hồi tố. Lãi gộp dòng = doanh thu dòng − giá vốn (dòng CTV: giá thu − giá vốn). | FN | SC-02, SC-12 |
| BR-COST-03 | Chi phí phát sinh **sau khi bán** (bảo hành) **không** vào giá vốn hàng đã bán; tính vào chi phí bảo hành của lãi gộp sửa chữa. | FN | SC-07 |
| BR-COST-04 | Sửa chữa **nội bộ**: chi phí linh kiện (bình quân tại lúc dùng) và chi phí khác **vốn hóa** vào giá vốn chiếc khi phiếu sửa `completed`, không phải lúc thêm dòng. | FN | SC-09 |
| BR-COST-05 | Điều chỉnh giá vốn **append-only** (không sửa/xóa bút toán cũ), có lý do và quyền `cost.adjust`. | DB, FN | SC-17 |
| BR-COST-06 | Giá vốn chỉ trả về cho người có `cost.view`; lợi nhuận cho `profit.view` — ở tầng RLS/hàm, **mọi đường** (API, báo cáo, Excel, PDF, in). | RLS | PT-01, PT-05 |
| BR-COST-07 | **Giá thu giao CTV không phải giá vốn.** Giá vốn chiếc không đổi khi giao CTV; chênh `giá thu giao CTV − giá vốn` là lãi gộp của cửa hàng khi CTV bán. | FN | SC-12 |

## REP — Sửa chữa (chỉ chủ — CF-04/05)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-REP-01 | Hai loại: `customer` (máy của khách → **doanh thu dịch vụ**) và `internal` (máy của cửa hàng → **vốn hóa vào giá vốn**, không doanh thu). Chế độ tính phí: `paid` hoặc `warranty_free`. | DB CHECK | SC-08, SC-09 |
| BR-REP-02 | Phiếu nhận `customer` bắt buộc: khách (tên + SĐT), thương hiệu/model (chữ hoặc chọn), serial (hoặc "không serial"), tình trạng ban đầu, mô tả lỗi của khách. **Ảnh hiện trạng tùy chọn** [`repair.require_intake_photo`=false]. | FN | SC-08 |
| BR-REP-03 | Trạng thái: `received → inspecting → repairing ⇄ waiting_parts → completed → delivered`; `cancelled` được phép trước `completed`. Cho phép nhảy bước tiến (ghi trạng thái là chính); `completed → repairing` cần lý do. | FN | SC-08 |
| BR-REP-04 | Báo giá = các dòng dịch vụ/linh kiện; [`repair.require_quote_approval`] (mặc định **tắt**) khách đồng ý (ghi người, lúc, kênh) trước khi `repairing`. | FN | SC-08 |
| BR-REP-05 | Cọc sửa chữa là thanh toán `in` gắn phiếu sửa; trừ vào tổng khi giao; hủy phiếu ⇒ hoàn cọc bằng thanh toán `out` (`repair_deposit_refund`). | FN | SC-08 |
| BR-REP-06 | Linh kiện trừ kho khi xác nhận dùng (BR-PART-03); không cho âm. | FN | CT-04 |
| BR-REP-07 | Khóa dòng khi `completed`. **Doanh thu sửa chữa ghi nhận lúc `delivered`**. Giao máy khi đã thu đủ, hoặc ghi nợ cho khách xác định (cần `repair.deliver`). | FN | SC-08 |
| BR-REP-09 | **Lãi gộp sửa chữa = doanh thu − giá vốn linh kiện đã dùng** (− chi phí bảo hành). Không có tiền công thợ (CF-04). Linh kiện chỉ ghi ở dòng sửa chữa ⇒ không tính trùng. | Báo cáo | SC-08 |
| BR-REP-11 | Sửa nội bộ: tạo phiếu ⇒ chiếc `in_stock → in_repair`; `completed` ⇒ về `in_stock`/`inspecting`, chi phí vốn hóa (BR-COST-04). | FN | SC-09 |
| BR-REP-12 | Cảnh báo máy `completed` chưa `delivered` quá [`repair.pickup_alert_days`] ngày. | Job | UAT-06 |
| BR-REP-13 | Lịch sử sửa chữa tra theo serial, hợp nhất máy khách (`customer_watches`) và máy của shop (`watch_units`). | View | UAT-06 |
| BR-REP-14 | Ảnh hiện trạng (nếu có) **bất biến**, có SHA-256. | DB | UAT-06 |
| BR-REP-15 | Hủy phiếu (trước `completed`): hoàn linh kiện đã trừ, hoàn cọc, chiếc nội bộ về trạng thái cũ. | FN | UAT-06 |
| BR-REP-16 | Không có phân công thợ: thao tác phiếu sửa theo quyền `repair.*` (mặc định chỉ **chủ**; chủ có thể cấp cho vai trò khác). | RLS, FN | PT-04 |

## PAY — Thanh toán tối giản (thay cho nhóm FIN — CF-06/07)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-PAY-01 | Mỗi lần khách trả tiền (hoặc hoàn cọc) = một `payment` `posted` gắn **đúng một** chứng từ (phiếu bán, phiếu sửa, giữ hàng, quyết toán CTV), `method` ∈ {tiền mặt, chuyển khoản}. Không có quỹ, số dư, sổ quỹ. | FN `fn_record_payment` | SC-02 |
| BR-PAY-02 | **Doanh thu không bao giờ tính từ thanh toán.** Doanh thu tính từ chứng từ (phiếu bán đã xác nhận, phiếu sửa đã giao). Thanh toán chỉ cho biết khách đã trả bao nhiêu; cọc chưa chuyển không phải doanh thu. | Báo cáo | SC-13 |
| BR-PAY-03 | **Còn nợ** của phiếu = phải thu − Σ thanh toán `in` + Σ hoàn `out` − cọc đã trừ − thu cũ đổi mới (chỉ tính phần dương). Không trả vượt: tổng thanh toán `in` ≤ phải thu (`WF-PAY-OVERPAY`). Tính từ dữ liệu (view), **không cache** trong chứng từ. | View, FN | SC-04, CT-05 |
| BR-PAY-04 | **Thu thêm** trên phiếu còn nợ: thêm một thanh toán `in` vào đúng phiếu đó (không phân bổ nhiều phiếu, không màn công nợ riêng). | FN | SC-04, CT-05 |
| BR-PAY-05 | Thanh toán **bất biến** (không sửa số tiền/phiếu). Sai ⇒ hủy (`payment.void` + lý do) rồi ghi lại. Hủy phiếu bán tự động hủy các thanh toán của phiếu (BR-SALE-10). | FN, DB | PT-09, SC-15 |
| BR-PAY-06 | Cọc giữ hàng: thanh toán `in` (`deposit_receipt`) gắn giữ hàng; **cọc đang giữ** = đã thu − hoàn − đã trừ vào phiếu bán − tịch thu. | View | SC-05 |
| BR-PAY-07 | Ứng dụng **không giữ số dư tiền mặt/ngân hàng**. "Thực thu" = Σ thanh toán `in` − Σ hoàn `out` trong khoảng ngày, tách theo cách thanh toán. | Báo cáo | SC-10 |

## INV — Kiểm kê

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-INV-01 | Đợt kiểm kê có phạm vi (tất cả/vị trí/linh kiện), trạng thái `open → reconciled/cancelled`. Số hệ thống được lấy **tại lúc đối chiếu**; khuyến nghị không giao dịch trong lúc đếm. Chiếc `with_collaborator` không nằm trong kiểm kê kho (kiểm ở màn CTV). | FN | SC-14 |
| BR-INV-02 | Mọi chênh lệch bắt buộc lý do. Chiếc không tìm thấy ⇒ `written_off` (hao hụt = giá vốn). Linh kiện lệch ⇒ movement `stocktake` × giá bình quân. | FN | SC-14 |
| BR-INV-03 | Điều chỉnh tồn luôn qua movement/chuyển trạng thái, không sửa số trực tiếp. | DB, FN | SC-14 |
| BR-INV-04 | **Hàng tồn lâu** = chiếc `in_stock` có `hôm nay − stock_since > [inventory.aging_days]`; `stock_since` = ngày vào `in_stock` gần nhất. | View | SC-14 |

## COL — Cộng tác viên: nhận hàng – giá thu – hưởng chênh lệch (CF-03)

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-COL-01 | Chủ **giao hàng** cho CTV bằng phiếu giao: chọn chiếc `in_stock`, nhập **giá thu giao CTV** từng chiếc (≥ 0). Xác nhận ⇒ chiếc `with_collaborator`; mỗi chiếc thuộc tối đa **một** phiếu giao còn hiệu lực (unique một phần). | FN `fn_confirm_assignment` | SC-12, CT-06 |
| BR-COL-02 | Giá thu giao CTV **không đổi** sau xác nhận (muốn đổi ⇒ thu hồi rồi giao lại). CTV thấy giá thu của chiếc mình giữ; **không** thấy giá vốn. | DB trigger, RLS | PT-02 |
| BR-COL-03 | CTV bán: tạo **đơn bán nháp** từ chiếc đang giữ, nhập **giá bán thực** + khách (tên + SĐT, để tạo bảo hành). Chỉ người có `sale.confirm` xác nhận. Xác nhận ⇒ chiếc `sold`, chốt `base_price_snapshot` = giá thu. | FN | SC-12, PT-03 |
| BR-COL-04 | Dòng bán của CTV: **doanh thu cửa hàng = giá thu**, giá vốn = giá vốn chiếc, **lãi gộp cửa hàng = giá thu − giá vốn**; **phần CTV hưởng = giá bán − giá thu** (âm nếu CTV bán dưới giá thu: cho phép, UI cảnh báo). Hạn mức giảm giá và "bán dưới giá vốn" không áp cho đơn CTV. | FN, báo cáo | SC-12 |
| BR-COL-05 | Cửa hàng **không theo dõi tiền khách trả cho CTV** (CTV tự thu). Đơn CTV không có thanh toán của khách; nghĩa vụ của CTV với cửa hàng = Σ giá thu các dòng đã bán chưa quyết toán. | FN | SC-12 |
| BR-COL-06 | **Quyết toán**: chủ chọn các dòng CTV đã bán chưa quyết toán, nhập cách nộp (tiền mặt/chuyển khoản) và ngày ⇒ tạo `collaborator_settlements` + một thanh toán `in` (`collab_settlement`) = Σ giá thu; mỗi dòng chỉ quyết toán **một lần**. | FN `fn_settle_collaborator` | SC-12, CT-10 |
| BR-COL-07 | **Thu hồi**: chiếc `with_collaborator` chưa bán ⇒ về `in_stock` (vị trí bắt buộc), lý do; không đụng giá vốn. | FN `fn_return_from_collaborator` | SC-12 |
| BR-COL-08 | Hủy quyết toán (owner + lý do) cho phép hủy phiếu bán CTV sau đó; hủy phiếu bán CTV trong cửa sổ ⇒ chiếc về `with_collaborator` (không về kho), bảo hành `voided`. | FN | SC-16, CT-08 |
| BR-COL-09 | CTV chỉ thấy: chiếc đang giữ + giá thu, đơn bán và khách do mình tạo, quyết toán và thống kê **của mình**. | RLS | PT-02, PT-03 |
| BR-COL-10 | **Thống kê CTV** theo tháng/quý/năm (ngày xác nhận phiếu): số chiếc bán, doanh thu bán ra (Σ giá bán), phải nộp (Σ giá thu), phần CTV hưởng, đã/chưa quyết toán. Chủ xem tất cả; CTV xem của mình. | Báo cáo `rpt_collaborator` | SC-12 |
| BR-COL-11 | Hàng ở CTV vẫn là tồn kho cửa hàng (BR-UNIT-04); cảnh báo chiếc ở CTV quá [`collab.hold_alert_days`] ngày. | View, Job | SC-12 |

## SEC — Bảo mật

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-SEC-01 | Phân quyền theo **permission**, không theo tên vai trò. Người dùng có thể có nhiều vai trò (quyền = hợp). Vai trò dựng sẵn: chủ cửa hàng, nhân viên bán hàng, quản lý kho, cộng tác viên (không còn thợ). | RLS, API | PT-01…04 |
| BR-SEC-02 | Giá vốn, lợi nhuận, giá thu của chiếc, thống kê CTV của người khác nằm ở bảng/hàm có RLS theo quyền; báo cáo, xuất file, in dùng **cùng** lớp quyền. | RLS, FN | PT-01, PT-05 |
| BR-SEC-03 | PII (CCCD) mã hóa AES-256-GCM tầng ứng dụng + chỉ mục băm để tìm; xem đầy đủ cần `customer.pii.view` + nêu lý do + audit. Không log PII. | API | PT-12 |
| BR-SEC-04 | Mật khẩu băm Argon2id; khóa tạm [`security.lockout_minutes`] phút sau [`security.max_failed_logins`] lần sai; đổi mật khẩu thu hồi các phiên khác; MFA (TOTP) bắt buộc cho vai trò trong [`security.mfa_required_roles`]. | `server/auth` | PT-07 |
| BR-SEC-05 | Không ai (kể cả chủ) sửa/xóa `audit_logs`, `unit_status_history`, `unit_cost_entries`, `part_stock_movements` qua ứng dụng. | DB | PT-08, PT-09 |
| BR-SEC-06 | Đăng xuất thu hồi phiên và refresh token; token đã xoay bị dùng lại ⇒ thu hồi cả phiên. | `server/auth` | PT-07 |
| BR-SEC-07 | Luôn còn ≥ 1 chủ cửa hàng hoạt động; không tự hạ quyền/khóa chính mình nếu là chủ cuối cùng. | FN | PT-10 |
| BR-SEC-08 | Xem BR-COL-09: phạm vi dữ liệu của CTV. | RLS | PT-02, PT-03 |
| BR-SEC-10 | **Tin cậy thiết bị 2FA:** người dùng tick "Tin cậy thiết bị này" ở bước nhập mã ⇒ lần đăng nhập sau trên đúng trình duyệt đó trong [`security.trusted_device_days`] ngày (0 = tắt) **chỉ bỏ bước mã 6 số — mật khẩu luôn phải đúng**; xác thực lại (thao tác nhạy cảm) vẫn cần mã. Token ngẫu nhiên 256-bit trong cookie httpOnly, DB chỉ giữ SHA-256, gắn một tài khoản, hạn cố định, trùng nhãn thiết bị. Tự thu hồi khi đổi/đặt lại mật khẩu, khóa tài khoản, tắt 2FA; người dùng tự "quên" thiết bị. | `server/auth` + trigger `users` | m11-trusted-device (PT) |
| BR-SEC-11 | **Nhật ký hoạt động:** mọi thao tác ghi qua API (kể cả lỗi/bị từ chối) và các lần đọc nhạy cảm (xuất Excel, in, xem giá vốn, xem báo cáo, xem CCCD, xem nhật ký) được ghi "ai–làm gì–kết quả–từ máy nào" **sau** phản hồi, không nội dung/query/PII (route mẫu), chỉ `audit.view` đọc, append-only, giữ [`activity.retention_days`] ngày (sàn 30) rồi dọn qua hàm có kiểm. | `server/activity` + DB | m11-activity (PT) |
| BR-SEC-09 | Tệp đã xóa phải bị **xóa thật** khỏi kho lưu trữ: ảnh giấy tờ (`id_document`) — kể cả khi ẩn danh khách (gắn khách, phiếu thu mua, phiếu bán) — ngay lượt tác vụ nền kế tiếp; ảnh thường sau [`storage.purge_after_days`] ngày. Tệp bất biến (`is_immutable`: nhận máy/chứng từ) **không bao giờ** tự bị xóa. Chỉ chốt `purged_at` sau khi kho xác nhận; đã xóa thật thì không khôi phục. | `files` trigger + `fn_storage_*` + job | PT-13 |

## BAK — Sao lưu

| ID | Quy tắc | Thực thi | Test |
|---|---|---|---|
| BR-BAK-01 | Sao lưu DB hằng đêm (mã hóa, giữ ≥ 90 ngày + bản tuần dài hạn); ảnh Storage sao lưu hằng tuần. RPO ≤ 24 giờ, RTO ≤ 4 giờ. | CI backup | UAT-09 |
| BR-BAK-02 | Cảnh báo cho chủ khi bản sao lưu cũ hơn [`backup.heartbeat_max_hours`] giờ. | `/api/health?deep=1`, job | UAT-09 |
| BR-BAK-03 | Diễn tập khôi phục vào DB tạm **trước go-live và mỗi quý**, có biên bản. | Quy trình | UAT-09 |
| BR-BAK-04 | Theo dõi dung lượng kho lưu trữ: tổng theo bucket, tăng trưởng/ngày, ước tính ngày đầy so với [`storage.quota_mb`]; vượt [`storage.warn_percent`]/[`storage.critical_percent`] ⇒ thông báo cho người có `system.health` (mỗi mức một lần/tuần). | job + Quản trị → Hệ thống | PT-13 |

## IMP — Nhập Excel hàng loạt (khách, đồng hồ tồn đầu kỳ, linh kiện)

| ID | Quy tắc | Thực thi | Kiểm thử |
|---|---|---|---|
| BR-IMP-01 | Tệp .xlsx/.csv (≤ 5 MB, kiểm đuôi **và** magic bytes) được **đọc ở trình duyệt**; máy chủ chỉ nhận JSON ≤ 300 dòng (mỗi ô ≤ 2000 ký tự) và **kiểm tra lại từng ô** khi ghi (không tin kết quả xem trước). Quá 300 dòng/thân sai ⇒ 422. | `src/lib/import/*`, `src/server/import.ts` | UT-import, m11-import |
| BR-IMP-02 | **Xem trước** (dry-run) không ghi gì: mỗi dòng hợp lệ / cảnh báo / lỗi kèm lý do / **trùng**; người dùng chọn dòng nào nhập (dòng trùng mặc định bỏ qua, dòng lỗi không bao giờ nhập). Ghi cần `Idempotency-Key` (bấm đúp không nhập hai lần). | API `/import/{kind}/preview` · `/commit` | m11-import |
| BR-IMP-03 | **Khách:** trùng SĐT (chuẩn hóa như `app.norm_phone`) hoặc số giấy tờ (chỉ mục băm) với khách có sẵn/trong tệp ⇒ "trùng". SĐT Việt Nam chuẩn hóa về 10 số bắt đầu 0. CCCD mã hóa AES-256-GCM đúng như tạo khách (BR-SEC-03), **không bao giờ** hiện lại trong xem trước/kết quả/audit. Mỗi dòng ghi trong điểm lưu riêng. | `commitCustomers` | m11-import, PT-12 |
| BR-IMP-04 | **Đồng hồ tồn đầu kỳ:** toàn bộ dòng hợp lệ ghi bằng **MỘT phiếu nhập `opening`** (nháp → `fn_confirm_purchase`, BR-PUR-04/11) trong một transaction ⇒ giá vốn = cột "Giá vốn (giá thu)", kho/audit nhất quán; không chèn thẳng bảng chiếc. Loại khớp theo mã hoặc tên (kèm hãng); chưa có loại ⇒ lỗi chỉ cách tạo, hoặc (tùy chọn, cần `catalog.manage`) tự tạo hãng/loại. Serial trùng (cùng hãng trong kho, hoặc trong tệp), giá âm/không nguyên, thiếu giá/tình trạng/vị trí ⇒ lỗi. Hàng **Cũ/Đã sửa luôn vào "Chờ kiểm tra"** (BR-UNIT-10: sẵn sàng bán cần hạng + ảnh); hàng Mới vào "Sẵn sàng bán". | `commitWatches` | m11-import, SC-01 |
| BR-IMP-05 | **Linh kiện:** mã/tên/danh mục (danh mục phải có sẵn)/đơn vị/tồn đầu/giá vốn/ngưỡng cảnh báo. Linh kiện mới tạo (cần `part.manage`); tồn đầu > 0 ghi bằng một phiếu `opening` (giá vốn bình quân theo BR-PART/costing §4). Mã đã có ⇒ "trùng", mặc định bỏ qua; nếu người dùng chọn nhập thì **cộng** số lượng vào tồn. | `commitParts` | m11-import, SC-11 |
| BR-IMP-06 | Quyền (cần đủ): khách `customer.create`; đồng hồ `purchase.create` + `purchase.confirm` + `catalog.view`; linh kiện `purchase.create` + `purchase.confirm` + `part.view` (+ `part.manage` cho mã mới). Mỗi lần nhập ghi **một** dòng audit tổng hợp `import.{kind}` (số đếm + mã phiếu, không dữ liệu cá nhân) qua `app.fn_audit_import`. | `src/lib/import/perms.ts`, 0019 | m11-import |

## Hoãn / thay thế (không còn trong phạm vi xây)

| Quy tắc cũ | Số phận | Lý do |
|---|---|---|
| BR-GEN-07 (khóa kỳ) | Hoãn | CF-07 bỏ thu chi/quỹ/kỳ |
| BR-PUR-06 (trả tiền phiếu nhập, công nợ NCC) | Thay bằng BR-PUR-06 mới (không theo dõi) | CF-06 |
| BR-RET-01…07 (đổi trả) | Hoãn | CF-02; thay bằng BR-WAR-* |
| BR-REP-08, một phần BR-REP-09/10 (tiền công thợ, bảo hành sau sửa) | Hoãn / chuyển sang BR-WAR | CF-04/05 |
| BR-FIN-01 | → BR-PAY-01 | |
| BR-FIN-02, 03, 08, 09, 11, 12, 13 (sổ quỹ, số dư, chuyển quỹ, đối chiếu, chi phí, điều chỉnh quỹ, số dư đầu kỳ) | Hoãn | CF-07 |
| BR-FIN-04 (doanh thu không từ thanh toán) | → BR-PAY-02 | |
| BR-FIN-05 (công nợ khách) | → BR-PAY-03 | |
| BR-FIN-06 (công nợ NCC) | Hoãn | CF-06 |
| BR-FIN-07 (thu nợ phân bổ) | → BR-PAY-04 (đơn giản) | |
| BR-FIN-10 (hủy phiếu thu/chi) | → BR-PAY-05 | |
| BR-COM-01…04 (hoa hồng) | Thay bằng BR-COL-01…11 | CF-03 |
| BR-SEC-05 (phần `ledger_entries`) | Rút gọn | CF-07 |
