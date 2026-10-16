# Tầm nhìn & phạm vi

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo phản hồi khách vòng 1 — `customer-feedback-01`; khách chốt sơ, chi tiết sâu sẽ báo lại)

## 1. Mục tiêu

Một web app duy nhất để cửa hàng đồng hồ vận hành vòng đời hàng hóa:

**nhập hàng/thu mua → nhập kho theo từng chiếc → (sửa chữa chuẩn bị bán) → giữ hàng/cọc → bán & thu tiền (hoặc giao cộng tác viên bán) → bảo hành** — đồng thời có **sửa chữa cho khách**, **linh kiện**, và **giá vốn/lãi gộp chính xác**.

Yêu cầu chung (từ bản yêu cầu gốc): dùng được trên máy tính, điện thoại, máy tính bảng · giao diện tiếng Việt, dễ dùng · dữ liệu tập trung, truy cập online · tài khoản & phân quyền · sao lưu & khôi phục.

**Tiêu chí thành công** (đo được):
1. Mọi con số tiền/kho/giá vốn khớp các **kịch bản vàng** (`06-quality/golden-scenarios`) và qua bộ test đồng thời.
2. Một đồng hồ **không thể bán hai lần**; kho và thanh toán **không bao giờ lệch nhau**.
3. Người không có quyền **không lấy được** giá vốn/lợi nhuận/giá thu qua bất kỳ đường nào (UI, API, báo cáo, Excel, in).
4. Nhân viên mới dùng được bán hàng/nhận sửa chữa sau hướng dẫn ngắn; hành động hay dùng ≤ 3 chạm trên điện thoại.
5. Khôi phục được từ bản sao lưu trong buổi diễn tập (đã làm thật trước go-live).
6. Giao diện đúng phong cách **Glass** khách đã chọn (`ui-design-system`).

## 2. Người dùng

| Vai trò mặc định | Làm gì | Thiết bị chính |
|---|---|---|
| Chủ cửa hàng (`owner`, admin) | Mọi thứ; xem giá vốn/giá thu, lãi; giao hàng/quyết toán CTV; **chủ cũng là người sửa chữa** | Điện thoại + máy tính |
| Nhân viên bán hàng (`sales`) | Tra cứu, bán, thu thêm tiền, giữ hàng, xác nhận đơn CTV, tra bảo hành | Điện thoại / máy tính quầy |
| Quản lý kho (`warehouse`) | Nhập hàng, vị trí, kiểm kê, linh kiện | Điện thoại + máy tính |
| Cộng tác viên (`collaborator`, CTV) | **Nhận hàng từ chủ với giá thu, bán, hưởng phần chênh lệch**: xem hàng đang giữ, lập đơn cho khách của mình, xem thống kê của mình | Điện thoại |

Vai trò là **dữ liệu** (bảng `roles` + `role_permissions`), chủ cửa hàng chỉnh được; 4 vai trò trên là bản dựng sẵn. **Không còn vai trò Thợ** (CF-05).

## 3. Phạm vi

### Trong phạm vi
Danh mục đồng hồ/chiếc/linh kiện/vị trí, tem QR + quét camera · nhập hàng, thu mua từ khách, tồn đầu kỳ, giá vốn & phân bổ chi phí · bán hàng (thông tin + giá thu + giá bán), giảm giá theo hạn mức, thanh toán tiền mặt/chuyển khoản, nợ + thu thêm trên phiếu, in phiếu · **giữ hàng/đặt cọc** · **thu cũ đổi mới** · **bảo hành** (bán/sau sửa) · **sửa chữa gọn (chỉ chủ)** · **cộng tác viên: giao hàng – giá thu – hưởng chênh lệch – quyết toán – thống kê** · khách hàng · kiểm kê · báo cáo & Excel/PDF · tài khoản/phân quyền/nhật ký · sao lưu & khôi phục · thông báo trong ứng dụng · PWA.

### Ngoài phạm vi (ghi rõ để không đoán)
- **Đã bỏ theo phản hồi khách (hoãn, thiết kế còn trong archive):** Thu chi & quỹ tiền (quỹ, sổ quỹ, phiếu chi, đối chiếu, khóa kỳ, lãi ròng) · Nhà cung cấp & công nợ NCC · Đổi trả/hoàn tiền · Vai trò Thợ, phân công thợ, tiền công thợ · Hoa hồng % cho CTV.
- Kế toán đầy đủ (sổ sách thuế, bảng cân đối, tờ khai) và lương nhân viên (payroll).
- Hàng **ký gửi** (CTV mang hàng của họ gửi bán) — mô hình sở hữu khác (`extensibility` §5).
- Nhiều chi nhánh / nhiều cửa hàng và kênh bán online — chưa cần; kiến trúc module + `domain_events` cho phép thêm sau.
- POS **offline hoàn toàn**. Mức hỗ trợ: tự lưu nháp + gửi lại an toàn (ADR-013).
- Hóa đơn điện tử hợp lệ thuế: chỉ có **phiếu bán hàng nội bộ** + điểm cắm tích hợp (`integrations`).
- Trả góp có lãi suất, thanh toán thẻ tích hợp, CRM marketing, ứng dụng native.
- Thông báo đẩy (push)/email: để sau. **Chế độ tối:** hoãn (mẫu Glass chỉ có bản sáng).
- AI: tắt mặc định, ngoài đường găng (`integrations` §AI).

## 4. Nguyên tắc sản phẩm

1. **Đúng trước, nhanh sau.** Kho và thanh toán không được sai; mọi thao tác ghi là giao dịch nguyên tử.
2. **Dễ dùng thực sự.** Ít màn hình, ít chữ, giá trị mặc định thông minh, tìm kiếm tức thì, quét mã bằng camera; lỗi nói bằng tiếng Việt dễ hiểu kèm cách xử lý.
3. **Bất biến sau xác nhận.** Không xóa; sai thì hủy/điều chỉnh có lý do và có nhật ký.
4. **Phân quyền ở tầng dữ liệu.** Ẩn trên giao diện chỉ là phần thưởng thêm.
5. **Tách bạch khái niệm tiền.** Doanh thu ≠ thực thu ≠ cọc ≠ phần CTV hưởng ≠ lãi.
6. **Mở rộng bằng module.** Thêm hoặc **bật lại** tính năng không đụng lõi giao dịch (`extensibility`).
7. **Docs là nguồn sự thật.** Test chạy từ ví dụ số trong docs.
8. **Giao diện nhất quán Glass.** Một hệ token, một bộ thành phần; phần tử tương tác ưu tiên từ thư viện Lucian đã ánh xạ token.

## 5. Quyết định đã chốt

### 5.1 Phiên xác nhận lần 1 (2026-10-16)

| # | Câu hỏi | Quyết định | Hệ quả |
|---|---|---|---|
| 1 | Cộng tác viên là ai? | ~~Bán hộ ăn hoa hồng~~ → **đổi ở vòng 1 (CF-03)**, xem 5.2 | |
| 2 | "Mở rộng" nghĩa là gì? | **Thêm tính năng mới dễ dàng & bảo trì dễ** (không phải thêm chi nhánh) | Modular monolith + module contract + `domain_events` + cờ tính năng (`extensibility`); **không** có `branch_id`/multi-tenant (ADR-011) |
| 3 | Hóa đơn bán hàng | **Phiếu bán hàng nội bộ** | In phiếu 80mm/A5; điểm cắm hóa đơn điện tử để sau |
| 4 | Nghiệp vụ bán thực dùng | **Đặt cọc/giữ hàng · Thu cũ đổi mới · Trả nhiều đợt/hẹn nợ** | `reservations`, trade-in qua phiếu nhập `trade_in`, nợ + thu thêm trên phiếu. Giảm giá bị chặn theo hạn mức % của vai trò (BR-SALE-03) |
| 5 | Thiết bị | **Điện thoại + máy tính, chỉ trình duyệt** | In qua PDF/in trình duyệt; quét mã bằng camera (có dự phòng iOS) |
| 6 | Xác thực | **Port auth từ Lưu Xá** | Argon2id + JWT 15' + refresh xoay vòng + TOTP; không Supabase Auth (ADR-003) |
| 7 | Tiền công thợ | ~~Tùy thợ~~ → **bỏ ở vòng 1 (CF-04/05)** | |
| 8 | Dữ liệu & quy mô | **Bắt đầu mới, quy mô nhỏ** | Không cần công cụ import; tồn đầu kỳ nhập bằng phiếu nhập `opening` |

### 5.2 Phản hồi khách vòng 1 (2026-10-16) — chi tiết ở `customer-feedback-01`

| # | Quyết định | Hệ quả |
|---|---|---|
| CF-03 | **CTV nhận hàng từ chủ, chủ báo giá thu, CTV bán bao nhiêu ăn chênh lệch** | Trạng thái chiếc `with_collaborator`; phiếu giao CTV; quyết toán; thống kê CTV (ADR-024) |
| CF-02 | **Đổi trả → bảo hành** | Bỏ `returns`; bảo hành là luồng chính (ADR-025) |
| CF-04/05 | **Sửa chữa gọn, chỉ chủ; bỏ thợ/tiền công/phân công; ảnh tùy chọn** | Bỏ `technician_*`, `repair_tech_pay` |
| CF-06 | **Bỏ NCC & công nợ** | Nhập hàng ghi nguồn hàng chữ; "Thu thêm" trên phiếu thay màn công nợ |
| CF-07 | **Bỏ Thu chi & quỹ** | Thanh toán tối giản (ADR-023); không số dư, không lãi ròng |
| CF-08 | **Thống kê doanh thu từng CTV theo tháng/quý/năm** | Báo cáo R9 |
| CF-09 | **Giao diện Glass (v6-glass)** | `ui-design-system`, ADR-026/027 |

## 6. Giả định mặc định (đổi được bằng cấu hình, xem `settings-catalog`)

- Một cửa hàng, một múi giờ `Asia/Ho_Chi_Minh`, tiền VND, giá niêm yết đã gồm mọi thuế (không tách VAT trong phiếu).
- Hủy phiếu bán (như chưa xảy ra) trong **24 giờ**; giữ hàng tối đa **7 ngày**, cọc tối thiểu **10%** giá niêm yết.
- Bảo hành cửa hàng: mới 12 tháng, cũ/đã sửa 3 tháng; sau sửa chữa 90 ngày (**khách chưa chốt thời hạn** — CF-02).
- Hàng tồn lâu: quá **90 ngày**.
- Thu mua từ khách **bắt buộc** lưu thông tin người bán (họ tên, SĐT, CCCD mã hóa, ảnh giấy tờ).
- Chỉ phương thức thanh toán: tiền mặt, chuyển khoản.
- Giảm giá tối đa: chủ không giới hạn, nhân viên bán hàng 5%.

## 7. Câu hỏi mở cần xác nhận **trước go-live** (không chặn việc xây)

| # | Câu hỏi | Ai trả lời | Ảnh hưởng |
|---|---|---|---|
| Q1 | Cửa hàng là hộ kinh doanh hay công ty? Có bắt buộc xuất hóa đơn điện tử theo quy định hiện hành không? | Kế toán/thuế | Có thì cần tích hợp nhà cung cấp hóa đơn điện tử (mở rộng, không sửa lõi); đơn CTV: hóa đơn thuộc bên bán thực |
| Q2 | Thời hạn & điều kiện **bảo hành** (thay đổi trả): mới/cũ/sau sửa? | Chủ cửa hàng | `warranty.*` |
| Q3 | Mức giảm giá tối đa từng vai trò? | Chủ cửa hàng | `roles.max_discount_pct` |
| Q5 | Danh mục thương hiệu, loại việc sửa, loại linh kiện ban đầu? | Chủ cửa hàng | Dữ liệu danh mục (nhập khi triển khai) |
| Q6 | Tồn kho đầu kỳ (giá vốn từng chiếc)? | Chủ cửa hàng | Phiếu nhập `opening` |
| Q7 | Tên miền, tài khoản Vercel/Supabase/GitHub đứng tên ai? | Chủ cửa hàng | Quyền sở hữu & bàn giao (`runbook` §Bàn giao) |
| Q8–Q19 | Các điểm chúng tôi diễn giải sau phản hồi vòng 1 (giá thu, quyết toán CTV, bỏ công nợ/thu chi, bảo hành…) | Chủ cửa hàng | `customer-feedback-01` §4 |

(Q4 — hoa hồng/tiền công — và phần số dư quỹ của Q6 không còn do đã bỏ.)

## 8. Rủi ro chính & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Lệch kho/thanh toán do race condition | Hàm `fn_*` nguyên tử + khóa theo thứ tự + ràng buộc unique một phần + bộ test đồng thời CT-xx chạy trên mỗi lần phát hành |
| Lộ giá vốn/giá thu/lợi nhuận cho người không có quyền | Dữ liệu nhạy cảm tách bảng + RLS; bộ test phân quyền PT-xx quét mọi endpoint/báo cáo |
| CTV khai giá bán thấp hơn thực tế để giữ chênh lệch | Chủ xác nhận từng đơn; báo cáo bất thường theo CTV; rủi ro tin cậy ghi rõ (`security-model` §8) |
| Mất dữ liệu | Sao lưu hai lớp + diễn tập khôi phục có biên bản; cảnh báo khi bản sao lưu quá 36 giờ |
| Mất khóa mã hóa PII | Giữ khóa ở trình quản lý mật khẩu; quy trình ở `runbook` §Khóa |
| Docs lệch code | Quy tắc "một sự thật một chỗ", `Cập nhật lần cuối`, DoD bắt buộc cập nhật docs, `check-docs` |
| Phạm vi lớn / đổi hướng giữa chừng | Xây theo mốc M0…M9 có tiêu chí vào/ra; bản thiết kế đầy đủ lưu ở archive; module hoãn bật lại theo `extensibility` §7 |
| Giao diện lệch mẫu khách đã chốt | Đặc tả `ui-design-system` + cổng thiết kế màn mới (`build-plan`) + ảnh chụp so với mẫu |
| Phần tử UI bên thứ ba (Lucian) | Rà mã trước khi dùng, port theo hướng dẫn, ghi sổ, không nới CSP |
| Quy định thuế thay đổi | Phiếu nội bộ + điểm cắm; kế toán xác nhận Q1 |

## 9. Ràng buộc nội bộ thay cho mục IV "yêu cầu đối với đơn vị phát triển" của bản gốc

Tự xây nên mục IV (báo giá, nhà thầu) được thay bằng ràng buộc sau:
- **Chi phí hạ tầng tham khảo** (kiểm tra lại giá hiện hành): Supabase Pro khoảng 25 USD/tháng, Vercel Pro khoảng 20 USD/thành viên/tháng, tên miền ~1 USD/tháng → khoảng 50 USD/tháng (~1,3 triệu đ) cho một cửa hàng nhỏ; lưu trữ ảnh và sao lưu GitHub Actions nằm trong hạn mức miễn phí ở quy mô nhỏ.
- **Quyền sở hữu**: mã nguồn, dữ liệu, tài khoản Vercel/Supabase/GitHub/tên miền đứng tên chủ cửa hàng (hoặc pháp nhân), người phát triển chỉ được mời vào. Dữ liệu xuất được bất cứ lúc nào (Excel + bản dump).
- **Bàn giao**: `README` + `docs/` + `runbook` + hướng dẫn sử dụng theo vai trò + buổi đào tạo; danh sách bí mật & nơi cất (`runbook`).
- **Nâng cấp khi mở rộng**: quy trình thêm/bật module (`extensibility`), migration tương thích ngược, phiên bản API `/api/v1`.
- **Thư viện bên thứ ba**: phần tử giao diện từ Lucian UX/UI (MIT) — giữ chú thích giấy phép, ghi sổ ở `ui-design-system` §9.
