# Quy trình nghiệp vụ

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`)
> Mỗi quy trình: **ai làm · điều kiện · các bước · hiệu ứng hệ thống (kho / thanh toán / giá vốn / audit / sự kiện) · ngoại lệ**. Quy tắc chi tiết ở `business-rules`; số liệu ví dụ ở `golden-scenarios`. Giao diện từng màn: `ux-and-navigation`, phong cách: `ui-design-system`.

## W1. Nhập hàng (mua vào)

**Ai:** quản lý kho hoặc chủ (`purchase.create`, `purchase.confirm`). **Màn hình:** `/nhap-hang/moi`.

1. Chọn loại phiếu **Mua vào**; nhập **nguồn hàng** (tên người/đơn vị — chữ); ngày nhập (mặc định hôm nay).
2. Thêm dòng:
   - *Đồng hồ*: chọn **loại** (tìm theo mã/tên), nhập serial (hoặc tick "không serial"), tình trạng (mới/cũ/đã sửa; cũ ⇒ hạng + ảnh), giá nhập, vị trí lưu, trạng thái ban đầu (`in_stock`/`inspecting`). Mỗi chiếc một dòng; nút "nhân bản dòng" cho lô cùng loại.
   - *Linh kiện*: chọn linh kiện, số lượng, đơn giá.
3. Thêm **chi phí liên quan** (vận chuyển, kiểm định…) với cách phân bổ (theo giá trị / chia đều). Màn hình xem trước **giá vốn từng dòng sau phân bổ** (người có `cost.view`).
4. Lưu nháp (tự lưu liên tục) → **Xác nhận**.

**Hiệu ứng khi xác nhận** (`fn_confirm_purchase`, một transaction): tạo từng chiếc + mã nội bộ (`DH-…`); ghi `unit_cost_entries`; cộng kho linh kiện + tính lại giá bình quân; audit; sự kiện `purchase.confirmed`. **Sau đó** in tem QR cho các chiếc mới (nút "In tem"). Không ghi nhận trả tiền/công nợ (BR-PUR-06).

**Ngoại lệ:** serial trùng ⇒ chặn, gợi ý mở chiếc cũ (nhập lại: W2/BR-PUR-10); hủy phiếu: BR-PUR-07 (chỉ khi chưa có giao dịch phụ thuộc).

## W2. Thu mua từ khách / thu cũ đổi mới (phía nhập)

**Ai:** nhân viên bán hàng hoặc quản lý kho. Dùng chung màn hình nhập, loại **Thu mua từ khách** (hoặc `trade_in` tự sinh từ W4).

1. Chọn/tạo khách (người bán): họ tên, SĐT, **CCCD** (mã hóa), chụp **ảnh giấy tờ** và **ảnh máy** (bắt buộc [`purchase.require_seller_id`]).
2. Nếu máy là chiếc cửa hàng từng bán: tìm theo mã nội bộ/serial ⇒ hệ thống dùng lại bản ghi cũ, **chu kỳ giá vốn +1** (BR-PUR-10).
3. Nhập giá thu, tình trạng/hạng, vị trí, trạng thái ban đầu (thường `inspecting`).
4. Xác nhận ⇒ như W1. In **biên bản thu mua**. (Tiền trả người bán nằm ngoài hệ thống, hoặc là phần trừ trong W4.)

## W3. Bán hàng (POS)

**Ai:** nhân viên bán hàng / chủ (`sale.create_draft`, `sale.confirm`). **Màn hình:** `/ban-hang/moi` (mobile-first).

1. Tìm/quét chiếc: ô tìm thống nhất (mã nội bộ, serial, tên, thương hiệu, mã sản phẩm) hoặc nút **quét QR**. Chỉ hiện hàng **sẵn sàng bán** (chiếc `reserved` của chính khách hiện ở mục "Đang giữ cho khách này"). Có thể thêm linh kiện/phụ kiện lẻ.
2. Phiếu hiển thị **thông tin chiếc, giá bán** (giá hiệu lực điền sẵn) và — với người có `cost.view` — **giá thu** cùng lãi (BR-SALE-16). Có thể giảm theo dòng hoặc giảm tổng; hiện % giảm so với hạn mức của mình, vượt hạn mức ⇒ nút xác nhận bị khóa + thông báo (BR-SALE-03). Bán dưới giá vốn cần quyền (BR-SALE-04).
3. Chọn khách (tìm SĐT/tên, tạo nhanh) — **bắt buộc nếu còn nợ**, thu cũ đổi mới, giữ hàng.
4. **Thanh toán:** thêm nhiều dòng (tiền mặt/chuyển khoản). Nhập "khách đưa" ⇒ hiện tiền thừa. Phần chưa trả ⇒ còn nợ (đặt hạn hẹn).
5. (Tùy chọn) **thu cũ đổi mới:** nút "Thêm máy cũ của khách" mở W4.
6. **Xác nhận** ⇒ in/chia sẻ phiếu (PDF 80mm/A5).

**Hiệu ứng** (`fn_confirm_sale`, một transaction): khóa chiếc/linh kiện theo thứ tự → kiểm trạng thái → `sold`/trừ kho → chốt giá vốn → ghi thanh toán → bảo hành theo tình trạng → audit → `sale.confirmed`. Bấm đúp/mất mạng gửi lại ⇒ cùng `Idempotency-Key` ⇒ một kết quả (BR-GEN-09).

**Ngoại lệ:** chiếc vừa bị người khác bán/giữ ⇒ lỗi `WF-SALE-UNIT-UNAVAILABLE` kèm gợi ý, các dòng khác giữ nguyên để sửa lại; mất mạng khi gõ ⇒ nháp tự lưu cục bộ và đồng bộ lại khi có mạng.

**Sau bán:** *Thu thêm tiền* (W9), *bảo hành* (W6), *hủy trong cửa sổ* (BR-SALE-10), *in lại*.

## W4. Thu cũ đổi mới (trong phiếu bán)

1. Ở bước 5 của W3: nhập thông tin máy cũ như W2 (ảnh, giấy tờ người bán, giá thu).
2. Hệ thống hiển thị: **Tổng phải trả** `− Giá thu` `= Khách còn phải trả` (giá thu ≤ tổng phiếu).
3. Khi xác nhận phiếu bán, trong **cùng transaction**: tạo & xác nhận phiếu nhập `trade_in`, ghi `sale_trade_ins`, chiếc thu về vào kho (`inspecting`/`in_stock`).

Doanh thu bán vẫn theo giá đầy đủ. Khách chỉ trả phần còn lại.

## W5. Giữ hàng / đặt cọc

**Ai:** nhân viên bán hàng (`reservation.manage`). **Màn hình:** `/giu-hang`.

1. Chọn khách + chiếc `in_stock`; hạn giữ (mặc định 7 ngày); thu cọc ≥ mức tối thiểu (tiền mặt/chuyển khoản).
2. `fn_create_reservation`: chiếc → `reserved`; ghi cọc (thanh toán `deposit_receipt`); in **phiếu giữ hàng** (biên nhận cọc).
3. Khi khách quay lại: nút **Chuyển thành phiếu bán** ⇒ mở W3 với chiếc đã điền, cọc đã trừ (BR-RSV-04).
4. Nếu không mua: **Hoàn cọc** hoặc **Tịch thu cọc** (cần quyền + lý do) ⇒ chiếc về `in_stock` (BR-RSV-05).
5. Job hằng ngày đánh dấu `expired` và nhắc người phụ trách; **không** tự xử lý.

## W6. Bảo hành (thay cho đổi trả — CF-02)

**Ai:** chủ nhận máy (chỉ chủ sửa — CF-04/05); nhân viên bán hàng có thể ghi nhận yêu cầu. **Màn hình:** `/bao-hanh` (tra cứu) → `/sua-chua/moi?bao-hanh=…`.

1. Tìm bảo hành: theo mã phiếu bán, tên/SĐT khách, mã nội bộ hoặc serial. Hệ thống hiện chiếc, ngày mua, **hạn bảo hành** và trạng thái (còn hạn / hết hạn).
2. Còn hạn: nút **Nhận máy bảo hành** ⇒ tạo phiếu sửa `warranty_free` liên kết `warranty_id` (thông tin khách và máy điền sẵn). Hết hạn: vẫn nhận máy nhưng phiếu là `paid` (BR-WAR-02).
3. Xử lý như W7 (kiểm tra, linh kiện thay, hoàn thành, giao) — **không thu tiền, không doanh thu**; chi phí linh kiện vào chi phí bảo hành (BR-WAR-03).
4. Khách không muốn sửa mà muốn trả hàng/hoàn tiền: **không có trong hệ thống** (CF-02); chủ xử lý ngoài và, nếu hàng thực sự về kho, nhập lại bằng phiếu nhập `customer_buyback` (BR-PUR-10 dùng lại đúng chiếc).

## W7. Sửa chữa cho khách (`customer`)

**Ai:** chủ (`repair.create`, `repair.update`, `repair.deliver`; có thể cấp cho vai trò khác). **Màn hình:** `/sua-chua`.

1. **Nhận máy**: khách (tên + SĐT); thương hiệu/model (chọn danh mục hoặc gõ tự do), serial; **tình trạng ban đầu**; lỗi khách mô tả; cọc (tùy chọn). **Ảnh hiện trạng tùy chọn** (chụp bằng camera nếu muốn). In **phiếu nhận** (mã SC, ngày hẹn dự kiến, điều khoản).
2. **Ghi trạng thái** qua các bước (`inspecting` → `repairing` → `waiting_parts` nếu cần…): ghi nhận xét kiểm tra; thêm dòng **dịch vụ** (tiền sửa, giá thu khách) và **linh kiện** (tùy chọn; giá bán mặc định); hệ thống hiện **tổng tạm tính**. [Nếu bật `repair.require_quote_approval`: ghi "khách đã đồng ý" trước khi `repairing`.]
3. Khi dùng linh kiện: bấm **Xác nhận dùng** từng dòng (trừ kho ngay, không âm).
4. **Hoàn thành** (`completed`): khóa dòng; tổng cuối.
5. **Giao** (`delivered`): thu tiền (trừ cọc), hoặc ghi nợ (cần `repair.deliver`); in **phiếu giao trả** + bảo hành [`warranty.repair_days`]. Ghi doanh thu và bảo hành sau sửa.

**Ngoại lệ:** khách không đồng ý ⇒ `cancelled` (hoàn cọc; có thể thu phí kiểm tra bằng một dòng dịch vụ trước khi hủy); làm lại ⇒ `completed → repairing` (lý do); máy hoàn thành quá [`repair.pickup_alert_days`] ngày ⇒ nhắc.

## W8. Sửa chữa nội bộ (chuẩn bị bán)

Giống W7 nhưng: loại `internal`, chọn **chiếc** của cửa hàng (không cần khách); không cọc/giao/thu tiền. Tạo phiếu ⇒ chiếc → `in_repair`. `completed` ⇒ chiếc về `in_stock`/`inspecting`, **linh kiện đã dùng + chi phí khác vốn hóa** vào giá vốn (BR-COST-04); sự kiện `repair.completed`. Chiếc đổi `condition` thành `refurbished` nếu chọn.

## W9. Thu thêm tiền trên phiếu (thay "Thu nợ" — CF-06)

**Ai:** `payment.create` (chủ, nhân viên bán hàng). **Màn hình:** chi tiết phiếu bán/phiếu sửa; lọc "Còn nợ" ở danh sách.

1. Ở danh sách phiếu bán chọn bộ lọc **Còn nợ** (hoặc mở hồ sơ khách xem phiếu còn nợ, cũ trước).
2. Mở phiếu → **Thu thêm**: nhập số tiền (≤ còn nợ), cách thanh toán, ngày.
3. Lưu ⇒ một thanh toán gắn đúng phiếu đó (BR-PAY-04). Trả vượt ⇒ `WF-PAY-OVERPAY`. Khách trả nhiều phiếu một lần ⇒ ghi từng phiếu.

## W10. Kiểm kê

**Ai:** quản lý kho (`stocktake.manage`). **Màn hình:** `/kiem-ke`.

1. Tạo đợt: phạm vi (tất cả đồng hồ trong kho / một vị trí / linh kiện). Chiếc đang ở CTV không nằm trong phạm vi (BR-INV-01).
2. **Đếm**: đồng hồ — quét QR từng chiếc, đánh dấu "có mặt"; linh kiện — nhập số đếm. Sai vị trí ⇒ gợi ý cập nhật vị trí.
3. **Đối chiếu**: hệ thống liệt kê chênh lệch (thiếu/thừa) với số hệ thống **lúc đối chiếu**; mỗi dòng chọn lý do (mất, hỏng, nhập sai, đếm sai, tìm lại…).
4. **Chốt**: chiếc thiếu ⇒ `written_off`; chiếc "tìm lại" ⇒ `fn_restore_unit`; linh kiện lệch ⇒ movement `stocktake`. Hao hụt = giá vốn; sinh báo cáo hao hụt.

## W11. Cộng tác viên (CTV): giao hàng → bán → quyết toán (CF-03)

**Ai:** chủ (`collab.manage`), nhân viên bán hàng xác nhận đơn (`sale.confirm`), CTV. **Màn hình:** `/cong-tac-vien` (chủ), `/ctv/*` (CTV).

1. **Tạo CTV**: chủ tạo tài khoản, gán vai trò `collaborator`, ghi chú (SĐT, khu vực…). Không có % hoa hồng.
2. **Giao hàng** (`fn_confirm_assignment`): chủ chọn CTV, chọn các chiếc `in_stock`, nhập **giá thu giao CTV** từng chiếc (UI cảnh báo nếu thấp hơn giá vốn) ⇒ xác nhận: chiếc → `with_collaborator`; in/chia sẻ **phiếu giao CTV** (danh sách chiếc + giá thu).
3. **CTV bán** (điện thoại): thấy "Hàng đang giữ" (ảnh, thông số, **giá thu**; không giá vốn). Khi có người mua: tạo **đơn bán nháp** — chọn chiếc, nhập **giá bán thực**, thông tin khách (tên + SĐT). CTV tự thu tiền khách. Nhập giá thấp hơn giá thu ⇒ cảnh báo "bạn sẽ lỗ" nhưng cho phép.
4. **Xác nhận** (chủ/nhân viên): kiểm tra đơn, bấm xác nhận ⇒ `fn_confirm_sale` (đơn CTV): chiếc → `sold`; chốt giá thu, giá vốn; tạo bảo hành cho khách; **doanh thu cửa hàng = giá thu** (BR-COL-04). In phiếu bán/bảo hành cho khách (CTV đưa).
5. **Quyết toán**: CTV nộp giá thu cho chủ; chủ vào CTV → **Quyết toán**, chọn các chiếc đã bán chưa nộp, nhập cách nộp/ngày ⇒ một thanh toán `collab_settlement` = Σ giá thu (BR-COL-06). Nhầm ⇒ hủy quyết toán (owner + lý do).
6. **Thu hồi**: CTV không bán được ⇒ chủ **Thu hồi** chiếc (chọn vị trí kho, lý do) ⇒ `in_stock` (BR-COL-07). Chiếc mất/hỏng ở CTV ⇒ **Ghi mất** (chủ + lý do), xử lý bồi thường ngoài hệ thống.
7. **Thống kê**: chủ xem theo CTV, tháng/quý/năm (BR-COL-10); CTV xem của mình. Cảnh báo chiếc ở CTV quá [`collab.hold_alert_days`] ngày.

**Ngoại lệ:** hai CTV/hai người cùng giao một chiếc ⇒ chỉ một thành công (CT-06); hủy đơn bán CTV khi dòng đã quyết toán ⇒ phải hủy quyết toán trước (BR-COL-08).

## W12. Xem tiền thu cuối ngày (thay "Chốt ngày & chốt kỳ" — CF-07)

**Ai:** chủ. **Màn hình:** Báo cáo → Tiền thu (R8) hoặc thẻ trên Tổng quan.

1. Chọn ngày (mặc định hôm nay): hệ thống liệt kê thanh toán theo cách thanh toán, cọc nhận/hoàn, CTV nộp, tổng **thực thu**.
2. Đối chiếu tay với tiền mặt trong két / sao kê ngân hàng (ngoài hệ thống). Lệch không điều chỉnh trong app — ghi chú ở nhật ký nếu cần.
Không có khóa kỳ, không điều chỉnh quỹ. Chứng từ đã xác nhận vẫn bất biến (BR-GEN-02).

## W13. Quản trị người dùng & quyền

1. Chủ tạo người dùng (mật khẩu tạm, buộc đổi lần đầu), gán vai trò, hồ sơ CTV.
2. Chủ tùy chỉnh vai trò (bật/tắt quyền; hạn mức giảm giá); thay đổi có audit.
3. Quên mật khẩu: chủ đặt lại mật khẩu tạm (tùy chọn email sau). Khóa tạm tự động khi sai nhiều lần.

## W14. Sao lưu & khôi phục (vận hành)

Xem `05-operations/backup-restore`. Chủ chỉ cần: thấy trạng thái "Sao lưu gần nhất" ở **Quản trị → Hệ thống**, nhận cảnh báo khi quá hạn.
