# Phản hồi của khách — vòng 1

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (khách **chốt sơ**; chi tiết sâu hơn khách sẽ báo lại sau — mọi mục "Cần xác nhận" ở §4 giữ giả định mặc định cho tới khi khách trả lời)
> Nguồn: cột "Ý kiến nhanh" của sheet *Tóm tắt theo màn hình* trong `WatchFlow_Xac-nhan-tinh-nang.xlsx` + lựa chọn giao diện mẫu **v6-glass**.
> **Tài liệu này là nguồn gốc của đợt thay đổi phạm vi 2026-10-16.** Mâu thuẫn giữa nó và các docs khác ⇒ docs khác phải sửa theo đây. Bản thiết kế đầy đủ *trước* đợt này được giữ nguyên ở `docs/99-archive/2026-10-16-full-scope/`.

## 1. Ý kiến của khách → quyết định

| ID | Màn hình | Ý kiến nguyên văn | Quyết định |
|---|---|---|---|
| CF-01 | Bán hàng | "chủ yếu thông tin, giá thu/bán…" | Phiếu bán tập trung vào **thông tin chiếc + khách + giá thu + giá bán** (lãi = bán − thu). Gọn hơn POS phức tạp; các tính năng đã chốt trước (giảm giá theo hạn mức, thu cũ đổi mới, giữ hàng/cọc, in phiếu) **vẫn giữ** vì khách không yêu cầu bỏ. Chi tiết "giá thu" xem §3 và `glossary`. |
| CF-02 | Đổi trả | "Đổi thành bảo hành là đc (thời gian blabla)" | **Bỏ chức năng đổi trả/hoàn tiền/hoàn kho.** Thay bằng **bảo hành**: bán xong có bảo hành; khách quay lại ⇒ mở phiếu **bảo hành** (sửa miễn phí). Thời hạn bảo hành khách sẽ báo sau ⇒ giữ mặc định `settings` (mới 12 tháng, cũ/đã sửa 3 tháng, sau sửa 90 ngày). Trường hợp hủy phiếu bán nhầm trong cửa sổ 24 giờ (sửa sai nhập liệu) vẫn giữ. |
| CF-03 | Cộng tác viên | "CTV sẽ nhận đồng hồ từ chủ (sau đó admin sẽ báo giá gốc (này gọi là giá thu), rồi CTV bán đc bao nhiêu thì ăn bấy nhiêu thôi, k có hoa hồng cố định)" | **Đổi mô hình CTV**: không còn "hoa hồng %/cố định". Chủ **giao hàng cho CTV** kèm **giá thu** (giá gốc) từng chiếc; CTV bán giá bao nhiêu tùy ý, **CTV hưởng phần chênh = giá bán − giá thu**; cửa hàng nhận đúng giá thu. Chi tiết `business-rules` BR-COL-*, `money-and-payments` §6. |
| CF-04 | Sửa chữa | "k cần bắt buộc chụp ảnh hiện trạng (chỉ cần ghi trạng thái, thông tin là đc, ảnh là optional); không cần phân công thợ; k cần nhân công này nọ (chỉ có chủ mới đc sửa (chủ chính là thợ)" | Sửa chữa **gọn**: ghi thông tin máy, tình trạng, trạng thái; **ảnh tùy chọn**; **không phân công thợ**, **không tính tiền công/nhân công cho thợ**; chỉ **chủ** thao tác sửa chữa. Giữ: tiền sửa thu của khách, linh kiện dùng (tùy chọn), cọc, bảo hành, sửa cho máy của cửa hàng (vốn hóa vào giá vốn). |
| CF-05 | Việc của tôi (thợ) | "bỏ (cứ full quyền cho chủ tiệm là admin)" | **Bỏ vai trò Thợ** và màn "Việc của tôi". Chủ (admin) full quyền. |
| CF-06 | Nhà cung cấp & công nợ | "bỏ" | **Bỏ module nhà cung cấp và công nợ**: không hồ sơ NCC, không công nợ NCC, không màn/báo cáo công nợ. Nhập hàng chỉ ghi **nguồn hàng** dạng chữ. Khách còn nợ trên phiếu bán vẫn ghi được và thu thêm trực tiếp trên phiếu (xem câu hỏi Q12). |
| CF-07 | Thu chi & quỹ tiền | "bỏ" | **Bỏ module Thu chi & quỹ**: không quỹ, sổ quỹ, chuyển quỹ, phiếu chi, chi phí hoạt động, đối chiếu, khóa kỳ. App chỉ ghi **tiền khách thanh toán theo từng phiếu** (tiền mặt / chuyển khoản). Lãi chỉ tính tới **lãi gộp**; không còn "lãi ròng tạm tính". |
| CF-08 | Quản trị | "chỗ này cần thống kê doanh thu của từng cá nhân CTV theo tháng quý năm này nọ nữa nhé" | Thêm **Thống kê CTV**: theo từng CTV, theo tháng / quý / năm — số chiếc bán, doanh thu bán ra, tiền phải nộp cửa hàng (giá thu), phần CTV hưởng, đã nộp/chưa nộp. Đặt ở Quản trị (liên kết từ màn Cộng tác viên); chủ xem tất cả, CTV chỉ xem của mình. |
| CF-09 | Giao diện | "theo phong cách UI này: `design/ui-preview/v6-glass.html`" | **Chốt phong cách Glass** (kính mờ, gradient sáng, thanh dock nổi với nút "+" ở giữa). Chi tiết ở `03-architecture/ui-design-system.md`; triển khai bằng thư viện phần tử Lucian UX/UI (skill `lucian-uxui`) — xem tài liệu đó. |

Các màn hình khách **không** có ý kiến (Đăng nhập, Tổng quan, Đồng hồ, Danh mục, Linh kiện, Nhập hàng, Kiểm kê, Giữ hàng, Khách hàng, Báo cáo, Thông báo & hướng dẫn, Dùng chung) được hiểu là **chấp nhận như bản tóm tắt**, trừ phần bị ảnh hưởng gián tiếp (xem §2).

## 2. Phạm vi sau phản hồi

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Danh mục đồng hồ, chiếc, linh kiện, vị trí, tem QR | **Giữ** | + trạng thái mới `with_collaborator` ("Đang ở CTV") |
| Khách hàng (PII, lịch sử) | **Giữ** | Bỏ "công nợ" như một màn riêng |
| Nhập hàng, thu mua từ khách, tồn đầu kỳ, giá vốn, phân bổ chi phí | **Giữ** | Bỏ NCC và công nợ nhập: `supplier_id` ⇒ `source_name` (chữ) |
| Bán hàng, giảm giá hạn mức, thanh toán tiền mặt/chuyển khoản, nợ + hẹn trả, in phiếu | **Giữ (gọn)** | Thu thêm tiền ngay trên phiếu; không màn công nợ riêng |
| Giữ hàng / đặt cọc | **Giữ** | Cọc là một khoản thu theo giữ hàng; hoàn/tịch thu ghi trên chính giữ hàng |
| Thu cũ đổi mới | **Giữ** | |
| Hủy phiếu bán (24 giờ) | **Giữ** | Chỉ để sửa nhầm |
| Đổi trả, hoàn tiền, hoàn kho | **Bỏ → Hoãn** | Thay bằng bảo hành |
| Bảo hành (bán / sau sửa) | **Giữ, thành luồng chính** | Yêu cầu bảo hành = phiếu sửa miễn phí liên kết |
| Sửa chữa | **Giữ, đơn giản hóa** | Chỉ chủ; ảnh tùy chọn; không thợ/tiền công |
| Cộng tác viên | **Đổi mô hình** | Giao hàng + giá thu + hưởng chênh lệch; quyết toán giá thu; thống kê |
| Kiểm kê, cảnh báo, thông báo | **Giữ** | |
| Báo cáo | **Giữ (bớt)** | Bỏ: công nợ KH & NCC, thu chi & số dư, tiền công thợ, hoa hồng. Thêm: Thống kê CTV |
| Nhà cung cấp & công nợ | **Bỏ → Hoãn** | |
| Thu chi, quỹ, sổ quỹ chuỗi băm, đối chiếu, khóa kỳ, chi phí | **Bỏ → Hoãn** | |
| Vai trò Thợ, tiền công thợ | **Bỏ** | Vai trò còn: Chủ, Bán hàng, Kho, CTV |
| Chế độ tối | **Hoãn** | Mẫu Glass chỉ có bản sáng; token sẵn sàng để thêm sau |

"Hoãn" = không xây ở giai đoạn này; thiết kế đầy đủ còn ở kho lưu trữ; khi khách cần sẽ bật lại bằng module mới (xem `extensibility` §7).

## 3. Thuật ngữ mới / đổi nghĩa (chi tiết ở `glossary`)

- **Giá thu** — cách khách gọi *giá gốc* của một chiếc. Có hai ngữ cảnh: (a) *giá thu của cửa hàng* (giá cửa hàng mua/thu về, nay cộng chi phí phát sinh = **giá vốn** — UI gọi "Giá thu" cho người có quyền xem); (b) *giá thu giao CTV* — giá gốc chủ báo cho CTV khi giao hàng; CTV nộp lại đúng số này cho cửa hàng khi bán xong.
- **CTV** — người nhận đồng hồ từ chủ để bán, hưởng phần chênh lệch (bán − giá thu giao CTV).
- **Phiếu giao CTV** — chứng từ chủ giao một hoặc nhiều chiếc cho một CTV kèm giá thu từng chiếc.
- **Quyết toán CTV** — chủ ghi nhận CTV đã nộp giá thu của các chiếc đã bán.
- **Bảo hành** thay cho **đổi trả**.

## 4. Chỗ chúng tôi phải diễn giải — **cần khách xác nhận lại**

Khách đã nói "chốt sơ", nên các giả định dưới đây được dùng để xây tiếp; khách sửa lúc nào, docs sửa theo lúc đó.

| # | Câu hỏi cần xác nhận | Giả định đang dùng |
|---|---|---|
| Q8 | "Giá thu" chính xác là gì khi bán thường (không qua CTV)? | Là giá gốc của chiếc (giá vốn: giá mua + chi phí phát sinh). Chỉ chủ (hoặc người được cấp quyền) thấy. Phiếu bán hiển thị giá thu và giá bán cạnh nhau cho người có quyền |
| Q9 | Khi CTV bán, ai nhập và ai xác nhận? | CTV nhập giá bán thực + thông tin khách (tên, SĐT) trên điện thoại ⇒ tạo **đơn nháp**; chủ/nhân viên bán hàng **xác nhận**. CTV tự thu tiền khách; cửa hàng không theo dõi tiền CTV thu của khách |
| Q10 | CTV nộp giá thu cho cửa hàng thế nào, theo dõi ra sao? | Chủ bấm **Quyết toán** cho các chiếc CTV đã bán: ghi số tiền, tiền mặt/chuyển khoản, ngày. Không có sổ quỹ/công nợ riêng; chỉ trạng thái "đã nộp / chưa nộp" từng chiếc |
| Q11 | CTV bán thấp hơn giá thu thì sao? | Cho phép nhưng cảnh báo (CTV chịu lỗ, cửa hàng vẫn nhận đủ giá thu) |
| Q12 | Bỏ "công nợ" có nghĩa khách không được nợ nữa? | Khách vẫn **ghi nợ trên phiếu bán** (phải chọn khách có SĐT) và **thu thêm** ngay trên phiếu; chỉ bỏ màn "Công nợ" riêng, bộ lọc "còn nợ" ở danh sách phiếu bán thay thế. Nợ nhập hàng (NCC) không còn |
| Q13 | Bỏ "thu chi" có nghĩa cửa hàng không cần biết tiền mặt/ngân hàng còn bao nhiêu? | App không giữ số dư quỹ. Báo cáo "Tiền thu" hiển thị tổng tiền thu theo tiền mặt/chuyển khoản trong khoảng ngày (từ phiếu bán, sửa, cọc, quyết toán CTV). Chi phí hoạt động (thuê mặt bằng, điện nước…) không theo dõi → không có lãi ròng |
| Q14 | Nhập hàng không NCC: mua hàng thế nào ghi nhận? | Phiếu nhập ghi **nguồn hàng** (tên người/đơn vị) và giá nhập; không ghi nhận việc trả tiền cho nguồn hàng |
| Q15 | Bảo hành thay đổi trả — hạn là bao lâu? có trường hợp hoàn tiền không? | Mặc định mới 12 tháng / cũ & đã sửa 3 tháng / sau sửa 90 ngày. Hoàn tiền: không có trong app (xử lý ngoài; nếu cần sau sẽ bật lại module Đổi trả) |
| Q16 | Sửa chữa: còn cần dòng "tiền sửa" và "linh kiện"? | Giữ: một hoặc nhiều dòng **dịch vụ** (tiền sửa thu khách) + dòng **linh kiện** (tùy chọn, tự trừ kho). Bỏ nhân công tính cho thợ |
| Q17 | Nhân viên bán hàng và quản lý kho còn giữ không? | Giữ (khách chỉ bỏ vai trò thợ). Chủ chỉnh quyền từng vai trò được |
| Q18 | Chế độ tối có cần ngay? | Không (mẫu chỉ có sáng); làm sau nếu khách cần |
| Q19 | "Doanh thu của từng CTV" là số nào? | Hiển thị cả: doanh thu bán ra (Σ giá bán), phải nộp cửa hàng (Σ giá thu), phần CTV hưởng (Σ chênh lệch) |

Các câu hỏi mở từ vòng trước (Q1–Q7 trong `vision-scope`) **vẫn còn hiệu lực** ngoại trừ phần về hoa hồng/tiền công thợ (Q4) và số dư đầu kỳ quỹ (Q6 — còn lại: tồn kho đầu kỳ).

## 5. Tác động lên tài liệu

Đã cập nhật theo phản hồi này: `vision-scope`, `requirements`, `ux-and-navigation`, `glossary`, `business-rules`, `state-machines`, `money-and-payments` (đổi tên từ `money-and-ledger`), `costing-and-profit`, `workflows`, `settings-catalog`, `reports-and-dashboard`, `data-model`, `security-model`, `integrity-and-concurrency`, `api-conventions`, `decisions` (ADR-022…027), `extensibility`, `overview`, `integrations`, `ui-design-system` (mới), `build-plan`, `golden-scenarios`, `test-plan`, `testing-strategy`, `uat-acceptance`, `migrations`, `dev-setup`, `conventions`, `runbook`, `backup-restore`, `07-user-guide`, `CLAUDE.md`.

File Excel gửi khách (`WatchFlow_Xac-nhan-tinh-nang.xlsx`) **giữ nguyên làm hồ sơ** phản hồi vòng 1 (chứa ý kiến gốc của khách); không dựng lại để khỏi mất ý kiến. Nếu cần gửi khách bản cập nhật, tạo file phiên bản 1.1 mới.

## 6. Việc tiếp theo

1. Khách xác nhận lại §4 khi có thời gian (gộp với các câu hỏi Q1–Q3, Q5–Q7 ở `vision-scope`).
2. Thiết kế bổ sung theo phong cách Glass cho các màn **chưa có trong mẫu**: CTV (nhận hàng, đơn nháp, thống kê), phiếu giao CTV, bảo hành, sửa chữa gọn, Thống kê CTV (xem `ui-design-system` §7).
3. Dựng M0 (nền tảng + design system) theo `build-plan`.
