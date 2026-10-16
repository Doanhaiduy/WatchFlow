# Tầm nhìn & phạm vi

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã qua phiên xác nhận với chủ dự án)

## 1. Mục tiêu

Một web app duy nhất để cửa hàng đồng hồ vận hành toàn bộ vòng đời hàng hóa và tiền:

**nhập hàng/thu mua → nhập kho theo từng chiếc → (sửa chữa chuẩn bị bán) → giữ hàng/cọc → bán & thu tiền → đổi trả → bảo hành** — đồng thời có **sửa chữa cho khách**, **linh kiện**, **thu chi/công nợ**, và **giá vốn/lãi gộp chính xác**.

Yêu cầu chung (từ bản yêu cầu gốc): dùng được trên máy tính, điện thoại, máy tính bảng · giao diện tiếng Việt, dễ dùng · dữ liệu tập trung, truy cập online · tài khoản & phân quyền · sao lưu & khôi phục.

**Tiêu chí thành công** (đo được):
1. Mọi con số tiền/kho/giá vốn khớp các **kịch bản vàng** (`06-quality/golden-scenarios`) và qua bộ test đồng thời.
2. Một đồng hồ **không thể bán hai lần**; kho và tiền **không bao giờ lệch nhau**.
3. Người không có quyền **không lấy được** giá vốn/lợi nhuận/công nợ qua bất kỳ đường nào (UI, API, báo cáo, Excel, in).
4. Nhân viên mới dùng được bán hàng/nhận sửa chữa sau hướng dẫn ngắn; hành động hay dùng ≤ 3 chạm trên điện thoại.
5. Khôi phục được từ bản sao lưu trong buổi diễn tập (đã làm thật trước go-live).

## 2. Người dùng

| Vai trò mặc định | Làm gì | Thiết bị chính |
|---|---|---|
| Chủ cửa hàng (`owner`) | Mọi thứ; xem giá vốn, lãi, công nợ; duyệt, khóa kỳ | Điện thoại + máy tính |
| Nhân viên bán hàng (`sales`) | Tra cứu, bán, thu tiền, giữ hàng, nhận máy sửa | Điện thoại / máy tính quầy |
| Quản lý kho (`warehouse`) | Nhập hàng, vị trí, kiểm kê, linh kiện | Điện thoại + máy tính |
| Thợ sửa chữa (`technician`) | Việc được giao, ghi kiểm tra/linh kiện/trạng thái | Điện thoại/tablet tại bàn thợ |
| Cộng tác viên (`collaborator`, CTV) | **Bán hộ ăn hoa hồng**: xem hàng được phép + giá bán, lập đơn nháp cho khách của mình, xem hoa hồng | Điện thoại |

Vai trò là **dữ liệu** (bảng `roles` + `role_permissions`), chủ cửa hàng chỉnh được; 5 vai trò trên là bản dựng sẵn.

## 3. Phạm vi

### Trong phạm vi (xây đủ, không cắt MVP)
14 nhóm chức năng gốc (xem `requirements`) cộng các bổ sung đã chốt: **giữ hàng/đặt cọc**, **thu cũ đổi mới**, **trả nhiều đợt/hẹn nợ + nhắc nợ**, **cộng tác viên hưởng hoa hồng**, **bảo hành** (bán/sau sửa), **tiền công thợ theo từng thợ**, **tem QR + quét mã bằng camera**, **thông báo trong ứng dụng**, **PWA cài lên màn hình điện thoại**.

### Ngoài phạm vi (ghi rõ để không đoán)
- Kế toán đầy đủ (sổ sách thuế, bảng cân đối, tờ khai) và lương nhân viên (payroll).
- Hàng **ký gửi** (CTV mang hàng của họ gửi bán) — mô hình sở hữu khác; xem `extensibility` để biết cách thêm.
- Nhiều chi nhánh / nhiều cửa hàng (multi-tenant) và kênh bán online (Shopee/Facebook/website) — chưa cần; kiến trúc module + `domain_events` cho phép thêm sau (`extensibility`).
- POS **offline hoàn toàn** (ghi khi mất mạng rồi đồng bộ). Mức hỗ trợ: tự lưu nháp + gửi lại an toàn (ADR-013).
- Hóa đơn điện tử hợp lệ thuế: chỉ có **phiếu bán hàng nội bộ** + điểm cắm tích hợp (`integrations`).
- Trả góp có lãi suất, thanh toán thẻ tích hợp, CRM marketing, ứng dụng native.
- Thông báo đẩy (push) và email: để sau (nền móng có sẵn qua `domain_events`).
- AI: tắt mặc định, ngoài đường găng (`integrations` §AI).

## 4. Nguyên tắc sản phẩm

1. **Đúng trước, nhanh sau.** Tiền và kho là hai thứ không được sai; mọi thao tác ghi là giao dịch nguyên tử.
2. **Dễ dùng thực sự.** Ít màn hình, ít chữ, giá trị mặc định thông minh, tìm kiếm tức thì, quét mã bằng camera; lỗi nói bằng tiếng Việt dễ hiểu kèm cách xử lý.
3. **Bất biến sau xác nhận.** Không xóa; sai thì hủy/đảo/điều chỉnh có lý do và có nhật ký.
4. **Phân quyền ở tầng dữ liệu.** Ẩn trên giao diện chỉ là phần thưởng thêm.
5. **Tách bạch khái niệm tiền.** Doanh thu ≠ thực thu ≠ lợi nhuận ≠ cọc ≠ khoản vay/thu hộ.
6. **Mở rộng bằng module.** Thêm tính năng không đụng lõi giao dịch (`extensibility`).
7. **Docs là nguồn sự thật.** Test chạy từ ví dụ số trong docs.

## 5. Quyết định đã chốt (phiên xác nhận 2026-10-16)

| # | Câu hỏi | Quyết định | Hệ quả |
|---|---|---|---|
| 1 | Cộng tác viên là ai? | **Bán hộ ăn hoa hồng** | Hàng vẫn của shop; CTV chỉ thấy hàng được phép + giá bán, không thấy giá vốn/khách người khác; CTV lập **đơn nháp**, nhân viên xác nhận (BR-SALE-15, BR-COM-*) |
| 2 | "Mở rộng" nghĩa là gì? | **Thêm tính năng mới dễ dàng & bảo trì dễ** (không phải thêm chi nhánh) | Modular monolith + module contract + `domain_events` + cờ tính năng (`extensibility`); **không** có `branch_id`/multi-tenant (ADR-011) |
| 3 | Hóa đơn bán hàng | **Phiếu bán hàng nội bộ** | In phiếu 80mm/A5; điểm cắm hóa đơn điện tử để sau; câu hỏi thuế để kế toán xác nhận (mục 7) |
| 4 | Nghiệp vụ bán thực dùng | **Đặt cọc/giữ hàng · Thu cũ đổi mới · Trả nhiều đợt/hẹn nợ** | Có `reservations`, trade-in qua phiếu nhập `trade_in`, hạn trả + nhắc nợ. **Không** có luồng "giảm giá vượt ngưỡng chờ duyệt": giảm giá bị chặn theo hạn mức % của vai trò (BR-SALE-03) |
| 5 | Thiết bị | **Điện thoại + máy tính, chỉ trình duyệt** | In qua PDF/in trình duyệt, tem QR in PDF; quét mã bằng camera (có dự phòng cho iOS) |
| 6 | Xác thực | **Port auth từ Lưu Xá** | Argon2id + JWT 15' + refresh xoay vòng + TOTP; không dùng Supabase Auth (ADR-003) |
| 7 | Tiền công thợ | **Tùy thợ (kết hợp)** | Mỗi thợ có `pay_mode`: `percent` / `fixed_per_service` / `salary` (BR-REP-08) |
| 8 | Dữ liệu & quy mô | **Bắt đầu mới, quy mô nhỏ** | Không cần công cụ import; tồn đầu kỳ nhập bằng phiếu nhập loại `opening`; số dư đầu kỳ quỹ nhập một lần |

## 6. Giả định mặc định (chưa hỏi — đổi được bằng cấu hình, xem `settings-catalog`)

- Một cửa hàng, một múi giờ `Asia/Ho_Chi_Minh`, tiền VND, giá niêm yết đã gồm mọi thuế (không tách VAT trong phiếu).
- Đổi trả trong **7 ngày**; hủy phiếu bán (như chưa xảy ra) trong **24 giờ** và chưa khóa kỳ; giữ hàng tối đa **7 ngày**, cọc tối thiểu **10%** giá niêm yết.
- Bảo hành cửa hàng: mới 12 tháng, cũ/đã sửa 3 tháng; sau sửa chữa 90 ngày.
- Hàng tồn lâu: quá **90 ngày**.
- Thu mua từ khách **bắt buộc** lưu thông tin người bán (họ tên, SĐT, CCCD mã hóa, ảnh giấy tờ).
- Hoa hồng CTV trả khi phiếu **thu đủ tiền**.
- Chỉ phương thức: tiền mặt, chuyển khoản (+ "bù trừ" nội bộ không tiền mặt cho thu cũ đổi mới/cọc).

## 7. Câu hỏi mở cần xác nhận **trước go-live** (không chặn việc xây)

| # | Câu hỏi | Ai trả lời | Ảnh hưởng |
|---|---|---|---|
| Q1 | Cửa hàng là hộ kinh doanh hay công ty? Có bắt buộc xuất hóa đơn điện tử/lập hóa đơn từ máy tính tiền theo quy định hiện hành không? | Kế toán/thuế | Có thì cần tích hợp nhà cung cấp hóa đơn điện tử (mở rộng, không sửa lõi) |
| Q2 | Chính sách đổi trả đồng hồ cũ (số ngày, điều kiện, phí khấu trừ)? | Chủ cửa hàng | Giá trị cấu hình `sales.return_window_days` theo tình trạng |
| Q3 | Mức giảm giá tối đa từng vai trò? | Chủ cửa hàng | `roles.max_discount_pct` |
| Q4 | Tỷ lệ/ cách tính hoa hồng từng CTV, tiền công từng thợ? | Chủ cửa hàng | Hồ sơ CTV/thợ |
| Q5 | Danh mục thương hiệu, loại việc sửa, hạng mục chi phí ban đầu? | Chủ cửa hàng | Dữ liệu danh mục (nhập khi triển khai) |
| Q6 | Số dư đầu kỳ tiền mặt/ngân hàng và tồn kho đầu kỳ (giá vốn từng chiếc)? | Chủ cửa hàng | Phiếu nhập `opening` + số dư đầu kỳ quỹ |
| Q7 | Tên miền, tài khoản Vercel/Supabase/GitHub đứng tên ai? | Chủ cửa hàng | Quyền sở hữu & bàn giao (`runbook` §Bàn giao) |

## 8. Rủi ro chính & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Lệch kho/tiền do race condition | Hàm `fn_*` nguyên tử + khóa theo thứ tự + ràng buộc unique một phần + bộ test đồng thời CT-xx chạy trên mỗi lần phát hành |
| Lộ giá vốn/lợi nhuận cho người không có quyền | Dữ liệu nhạy cảm tách bảng + RLS; bộ test phân quyền PT-xx quét mọi endpoint/báo cáo |
| Mất dữ liệu | Sao lưu hai lớp + diễn tập khôi phục có biên bản; cảnh báo khi bản sao lưu quá 36 giờ |
| Mất khóa mã hóa PII | Giữ khóa ở trình quản lý mật khẩu; quy trình ở `runbook` §Khóa |
| Docs lệch code | Quy tắc "một sự thật một chỗ", `Cập nhật lần cuối`, DoD bắt buộc cập nhật docs, sinh tài liệu tự động |
| Phạm vi lớn | Xây theo mốc M0…M9 có tiêu chí vào/ra; mỗi mốc dùng được và kiểm thử xong rồi mới sang mốc sau |
| Quy định thuế thay đổi | Phiếu nội bộ + điểm cắm; kế toán xác nhận Q1 |

## 9. Ràng buộc nội bộ thay cho mục IV "yêu cầu đối với đơn vị phát triển" của bản gốc

Tự xây nên mục IV (báo giá, nhà thầu) được thay bằng ràng buộc sau:
- **Chi phí hạ tầng tham khảo** (kiểm tra lại giá hiện hành): Supabase Pro khoảng 25 USD/tháng, Vercel Pro khoảng 20 USD/thành viên/tháng, tên miền ~1 USD/tháng → khoảng 50 USD/tháng (~1,3 triệu đ) cho một cửa hàng nhỏ; lưu trữ ảnh và sao lưu GitHub Actions nằm trong hạn mức miễn phí ở quy mô nhỏ.
- **Quyền sở hữu**: mã nguồn, dữ liệu, tài khoản Vercel/Supabase/GitHub/tên miền đứng tên chủ cửa hàng (hoặc pháp nhân), người phát triển chỉ được mời vào. Dữ liệu xuất được bất cứ lúc nào (Excel + bản dump).
- **Bàn giao**: `README` + `docs/` + `runbook` + hướng dẫn sử dụng theo vai trò + buổi đào tạo; danh sách bí mật & nơi cất (`runbook`).
- **Nâng cấp khi mở rộng**: quy trình thêm module (`extensibility`), migration tương thích ngược, phiên bản API `/api/v1`.
