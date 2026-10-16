# Quy trình nghiệp vụ

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt
> Mỗi quy trình: **ai làm · điều kiện · các bước · hiệu ứng hệ thống (kho / tiền / giá vốn / audit / sự kiện) · ngoại lệ**. Quy tắc chi tiết ở `business-rules`; số liệu ví dụ ở `golden-scenarios`.

## W1. Nhập hàng từ nhà cung cấp

**Ai:** quản lý kho (`purchase.create`, `purchase.confirm`). **Màn hình:** `/nhap-hang/moi`.

1. Chọn loại phiếu **Nhà cung cấp**, chọn NCC (hoặc tạo nhanh), ngày nhập (mặc định hôm nay).
2. Thêm dòng:
   - *Đồng hồ*: chọn **loại** (tìm theo mã/tên), nhập serial (hoặc tick "không serial"), tình trạng (mới/cũ/đã sửa; cũ ⇒ hạng + ảnh), giá nhập, vị trí lưu, trạng thái ban đầu (`in_stock`/`inspecting`). Mỗi chiếc một dòng; nút "nhân bản dòng" cho lô cùng loại.
   - *Linh kiện*: chọn linh kiện, số lượng, đơn giá.
3. Thêm **chi phí liên quan** (vận chuyển, kiểm định…) với cách phân bổ (theo giá trị / chia đều). Màn hình xem trước **giá vốn từng dòng sau phân bổ** (người có `cost.view`).
4. Lưu nháp (tự lưu liên tục) → **Xác nhận**.
5. Thanh toán (tùy chọn): ghi phiếu chi trả NCC ngay (tiền mặt/chuyển khoản/nhiều lần); phần còn lại là công nợ.

**Hiệu ứng khi xác nhận** (`fn_confirm_purchase`, một transaction): tạo từng chiếc + mã nội bộ (`DH-…`); ghi `unit_cost_entries`; cộng kho linh kiện + tính lại giá bình quân; tạo công nợ NCC; ghi payments (nếu có) + sổ quỹ; audit; sự kiện `purchase.confirmed`. **Sau đó** in tem QR cho các chiếc mới (nút "In tem").

**Ngoại lệ:** serial trùng ⇒ chặn, gợi ý mở chiếc cũ (nhập lại: W2/BR-PUR-10); trả vượt dư nợ ⇒ chặn; kỳ khóa ⇒ chặn ngày; hủy phiếu: BR-PUR-07 (chỉ khi chưa có giao dịch phụ thuộc).

## W2. Thu mua từ khách / thu cũ đổi mới (phía nhập)

**Ai:** nhân viên bán hàng hoặc quản lý kho. Dùng chung màn hình nhập, loại **Thu mua từ khách** (hoặc `trade_in` tự sinh từ W4).

1. Chọn/tạo khách (người bán): họ tên, SĐT, **CCCD** (mã hóa), chụp **ảnh giấy tờ** và **ảnh máy** (bắt buộc [`purchase.require_seller_id`]).
2. Nếu máy là chiếc cửa hàng từng bán: tìm theo mã nội bộ/serial ⇒ hệ thống dùng lại bản ghi cũ, **chu kỳ giá vốn +1** (BR-PUR-10).
3. Nhập giá thu, tình trạng/hạng, vị trí, trạng thái ban đầu (thường `inspecting`).
4. Xác nhận ⇒ như W1; thanh toán cho người bán bằng phiếu chi thật (tiền mặt/chuyển khoản) hoặc bù trừ (W4). In **biên bản thu mua**.

## W3. Bán hàng (POS)

**Ai:** nhân viên bán hàng (`sale.create_draft`, `sale.confirm`). **Màn hình:** `/ban-hang/moi` (mobile-first).

1. Tìm/quét chiếc: ô tìm thống nhất (mã nội bộ, serial, tên, thương hiệu, mã sản phẩm) hoặc nút **quét QR**. Chỉ hiện hàng **sẵn sàng bán** (chiếc `reserved` của chính khách hiện ở mục "Đang giữ cho khách này"). Có thể thêm linh kiện/phụ kiện lẻ.
2. Giá tự điền = giá hiệu lực; có thể giảm theo dòng hoặc giảm tổng. Hiện % giảm so với hạn mức của mình; vượt hạn mức ⇒ nút xác nhận bị khóa + thông báo (BR-SALE-03). Bán dưới giá vốn ⇒ cần quyền (BR-SALE-04).
3. Chọn khách (tìm SĐT/tên, tạo nhanh) — **bắt buộc nếu còn nợ**, thu cũ đổi mới, giữ hàng.
4. **Thanh toán:** thêm nhiều dòng (tiền mặt/chuyển khoản, chọn quỹ). Nhập "khách đưa" ⇒ hiện tiền thừa. Phần chưa trả ⇒ nợ (đặt hạn hẹn).
5. (Tùy chọn) **thu cũ đổi mới:** nút "Thêm máy cũ của khách" mở W4.
6. **Xác nhận** ⇒ in/chia sẻ phiếu (PDF 80mm/A5).

**Hiệu ứng** (`fn_confirm_sale`, một transaction): khóa chiếc/linh kiện theo thứ tự → kiểm trạng thái → `sold`/trừ kho → chốt giá vốn → payments + sổ quỹ → hoa hồng CTV (nếu có) → bảo hành theo tình trạng → audit → `sale.confirmed`. Bấm đúp/mất mạng gửi lại ⇒ cùng `Idempotency-Key` ⇒ một kết quả (BR-GEN-09).

**Ngoại lệ:** chiếc vừa bị người khác bán/giữ ⇒ lỗi `WF-SALE-UNIT-UNAVAILABLE` kèm gợi ý, các dòng khác giữ nguyên để sửa lại; mất mạng khi gõ ⇒ nháp tự lưu cục bộ và đồng bộ lại khi có mạng; kỳ khóa ⇒ chặn.

**Sau bán:** *Thu thêm tiền* (W9), *đổi trả* (W6), *hủy trong cửa sổ* (BR-SALE-10), *in lại*.

## W4. Thu cũ đổi mới (trong phiếu bán)

1. Ở bước 5 của W3: nhập thông tin máy cũ như W2 (ảnh, giấy tờ người bán, giá thu).
2. Hệ thống hiển thị: **Tổng phải trả** `− Giá thu` `= Khách còn phải trả` (giá thu ≤ tổng phiếu).
3. Khi xác nhận phiếu bán, trong **cùng transaction**: tạo & xác nhận phiếu nhập `trade_in`, cặp bù trừ (BR-TRD-02), chiếc thu về vào kho (`inspecting`/`in_stock`).

Doanh thu bán vẫn theo giá đầy đủ. Quỹ chỉ nhận phần khách trả thêm.

## W5. Giữ hàng / đặt cọc

**Ai:** nhân viên bán hàng (`reservation.manage`). **Màn hình:** `/giu-hang`.

1. Chọn khách + chiếc `in_stock`; hạn giữ (mặc định 7 ngày); thu cọc ≥ mức tối thiểu (tiền mặt/chuyển khoản).
2. `fn_create_reservation`: chiếc → `reserved`; ghi cọc (payment `deposit_receipt` + sổ quỹ); in **phiếu giữ hàng** (biên nhận cọc).
3. Khi khách quay lại: nút **Chuyển thành phiếu bán** ⇒ mở W3 với chiếc đã điền, cọc đã trừ (BR-RSV-04).
4. Nếu không mua: **Hoàn cọc** hoặc **Tịch thu cọc** (cần quyền + lý do) ⇒ chiếc về `in_stock` (BR-RSV-05).
5. Job hằng ngày đánh dấu `expired` và nhắc người phụ trách; **không** tự xử lý.

## W6. Đổi trả

**Ai:** nhân viên tạo (`return.create`), chủ/quản lý xác nhận (`return.confirm`). **Màn hình:** `/doi-tra/moi?hoa-don=…`.

1. Tìm phiếu bán (theo mã phiếu/khách/serial). Kiểm tra hạn đổi trả (quá hạn cần `return.override`).
2. Chọn các dòng trả, lý do, **tình trạng nhận lại** (nguyên vẹn/cần kiểm tra), phí khấu trừ (nếu có), cách hoàn tiền (tiền mặt/chuyển khoản; tối đa theo BR-RET-05).
3. Xác nhận `fn_confirm_return`: chiếc → `inspecting` (hoặc `in_stock` nếu có `unit.release`); linh kiện về kho theo giá vốn gốc; doanh thu & giá vốn đảo theo **ngày đổi trả**; phiếu chi hoàn tiền + sổ quỹ; hủy hoa hồng/bảo hành; audit; `return.confirmed`.
4. Đổi sang hàng khác ⇒ sau khi xác nhận mở W3 liên kết ("đổi hàng").

## W7. Sửa chữa cho khách (`customer`)

**Ai:** nhân viên nhận (`repair.create`), thợ (`repair.update`), nhân viên giao (`repair.deliver`). **Màn hình:** `/sua-chua`.

1. **Nhận máy**: khách (tên + SĐT); thương hiệu/model (chọn danh mục hoặc gõ tự do), serial; **tình trạng ban đầu** + **ảnh hiện trạng** (chụp bằng camera, ≥ 1); lỗi khách mô tả; cọc (tùy chọn). In **phiếu nhận** (có mã SC, ngày hẹn dự kiến, điều khoản).
2. **Kiểm tra** (`inspecting`): thợ ghi nhận xét; thêm dòng *nhân công* (loại việc, giá) và *linh kiện* (chọn linh kiện + số lượng, giá bán mặc định); hệ thống hiện **báo giá**.
3. **Khách đồng ý** báo giá: nhân viên bấm "Khách đã đồng ý" (kênh: tại quầy/điện thoại/Zalo) ⇒ `repairing`.
4. **Sửa**: có thể sang `waiting_parts`. Khi dùng linh kiện: bấm **Xác nhận dùng** từng dòng (trừ kho ngay, không âm).
5. **Hoàn thành** (`completed`): khóa dòng; tổng cuối; thợ xác nhận.
6. **Giao** (`delivered`): thu tiền (trừ cọc), hoặc ghi nợ (cần quyền); in **phiếu giao trả** + bảo hành [`warranty.repair_days`]. Ghi doanh thu, tiền công thợ (chốt), bảo hành.

**Ngoại lệ:** khách không đồng ý ⇒ `cancelled` (hoàn cọc; có thể thu phí kiểm tra bằng một dòng nhân công trước khi hủy); làm lại ⇒ `completed → repairing` (lý do); máy hoàn thành quá [`repair.pickup_alert_days`] ngày ⇒ nhắc.

**Bảo hành sau sửa:** khách quay lại trong hạn ⇒ tạo phiếu `warranty_free` liên kết `warranty_id`; không doanh thu; chi phí vào chi phí bảo hành.

## W8. Sửa chữa nội bộ (chuẩn bị bán)

Giống W7 nhưng: loại `internal`, chọn **chiếc** của cửa hàng (không cần khách); không cọc/giao/thu tiền. Tạo phiếu ⇒ chiếc → `in_repair`. `completed` ⇒ chiếc về `in_stock`/`inspecting`, **chi phí linh kiện + công vốn hóa** vào giá vốn (BR-COST-04); sự kiện `repair.completed`. Chiếc đổi `condition` thành `refurbished` nếu chọn.

## W9. Thu nợ / thanh toán thêm

**Ai:** `payment.create`. **Màn hình:** `/cong-no` (khách), hoặc nút trên phiếu.

1. Chọn khách (hoặc phiếu): hiện danh sách phiếu còn nợ (cũ trước).
2. Nhập số tiền, quỹ, phương thức; mặc định phân bổ **cũ trước**, sửa tay được; tổng phân bổ ≤ số tiền.
3. Lưu ⇒ phiếu thu + allocations + sổ quỹ. Hoa hồng CTV của phiếu chuyển `payable` khi thu đủ (BR-COM-02).
Tương tự với **trả nợ NCC** (`/nha-cung-cap/<id>` → "Trả tiền").

## W10. Kiểm kê

**Ai:** quản lý kho (`stocktake.manage`). **Màn hình:** `/kiem-ke`.

1. Tạo đợt: phạm vi (tất cả đồng hồ / một vị trí / linh kiện).
2. **Đếm**: đồng hồ — quét QR từng chiếc, đánh dấu "có mặt"; linh kiện — nhập số đếm. Sai vị trí ⇒ gợi ý cập nhật vị trí.
3. **Đối chiếu**: hệ thống liệt kê chênh lệch (thiếu/thừa) với số hệ thống **lúc đối chiếu**; mỗi dòng chọn lý do (mất, hỏng, nhập sai, đếm sai, tìm lại…).
4. **Chốt**: chiếc thiếu ⇒ `written_off`; chiếc "tìm lại" ⇒ `fn_restore_unit`; linh kiện lệch ⇒ movement `stocktake`. Hao hụt = giá vốn; sinh báo cáo hao hụt.

## W11. Cộng tác viên (CTV)

1. Chủ tạo tài khoản CTV, gán vai trò `collaborator`, nhập hồ sơ hoa hồng (BR-COM-01).
2. Chủ chọn chiếc nào CTV thấy (`collab_visible`).
3. CTV đăng nhập điện thoại: danh sách hàng (ảnh, thông số, **giá bán**), tạo **đơn nháp** cho khách của mình (khách tạo kèm do CTV; CTV chỉ thấy khách mình tạo).
4. Nhân viên bán hàng thấy đơn nháp CTV trong hàng đợi, liên hệ khách, **xác nhận** (W3) — hoa hồng chốt lúc này.
5. Khi thu đủ ⇒ hoa hồng `payable` ⇒ chủ chi trả (phiếu chi, có thể gộp nhiều dòng). Đổi trả/hủy ⇒ hủy hoa hồng (clawback nếu đã chi).

## W12. Chốt ngày & chốt kỳ

**Hằng ngày (chủ/thu ngân):**
1. Trang **Chốt ngày** (`/thu-chi/chot-ngay`): doanh thu, thực thu theo quỹ, thực chi, số dư dự kiến mỗi quỹ.
2. Nhập số tiền mặt kiểm đếm thực tế ⇒ nếu lệch, tạo điều chỉnh quỹ có lý do (BR-FIN-12).

**Hằng tháng (chủ):**
1. Đối chiếu từng quỹ (BR-FIN-09), xem báo cáo thu chi/lãi gộp/tồn kho.
2. **Khóa kỳ** (`period.close`) ⇒ chứng từ trong kỳ bất biến. Cần sửa ⇒ `period.reopen` + lý do.

## W13. Quản trị người dùng & quyền

1. Chủ tạo người dùng (mật khẩu tạm, buộc đổi lần đầu), gán vai trò, hồ sơ CTV/thợ.
2. Chủ tùy chỉnh vai trò (bật/tắt quyền; hạn mức giảm giá); thay đổi có audit.
3. Quên mật khẩu: chủ đặt lại mật khẩu tạm (tùy chọn email sau). Khóa tạm tự động khi sai nhiều lần.

## W14. Sao lưu & khôi phục (vận hành)

Xem `05-operations/backup-restore`. Chủ chỉ cần: thấy trạng thái "Sao lưu gần nhất" ở **Quản trị → Hệ thống**, nhận cảnh báo khi quá hạn.
