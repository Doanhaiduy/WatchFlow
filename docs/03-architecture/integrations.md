# Tích hợp & dịch vụ phụ trợ

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Nháp (chi tiết chốt khi tới mốc liên quan)

## 1. In ấn & PDF

- **Phía máy chủ**: `pdfmake` dựng PDF từ DTO đã lọc quyền; font hỗ trợ tiếng Việt (Be Vietnam Pro hoặc Roboto, nhúng vào bundle). Mẫu ở `src/server/pdf/<mẫu>.ts`.
- **Mẫu phiếu** (`ux-and-navigation` §7): phiếu bán (80mm & A5), giữ hàng, nhập (A4), biên bản thu mua (A4), nhận sửa/giao trả (80mm & A5), tem QR (50×30mm), báo cáo (A4).
- Phiếu có: tên/địa chỉ/SĐT cửa hàng, logo (tùy chọn), mã phiếu + mã vạch/QR của mã phiếu, người lập, điều khoản (`store.warranty_terms`/`store.repair_terms`), chân phiếu.
- **In lại** thêm dòng "BẢN IN LẠI" và ghi audit (BR-SALE-11).
- Trình duyệt mở PDF và gọi hộp thoại in; với máy in nhiệt 80mm người dùng chọn "không lề, khổ 80mm" (hướng dẫn trong `user-guide`). Không cần driver/ứng dụng đặc biệt.

## 2. Mã QR & quét mã

- **Nội dung QR chiếc**: chỉ `asset_code` (vd. `DH-000123`) — dán được vào mọi ô tìm kiếm, không lộ URL/dữ liệu. Ô tìm kiếm thống nhất nhận dạng mã nội bộ trước mọi thứ.
- Sinh: thư viện `qrcode` (SVG/PNG) → PDF tem. Tem gồm QR + mã + tên ngắn + giá (tùy chọn, chủ bật).
- **Quét**: `BarcodeDetector` (Chrome/Android) hoặc `@zxing/browser` dự phòng (iOS Safari); cần HTTPS và quyền camera (`Permissions-Policy` cho phép camera ở trang quét). Có ô nhập tay dự phòng khi không có camera.
- Dùng được máy quét mã vạch USB/Bluetooth kiểu "bàn phím" (gõ mã + Enter vào ô tìm kiếm) mà không cần mã riêng.

## 3. Xuất Excel/PDF báo cáo

`write-excel-file` (Node) cho `.xlsx`; mỗi báo cáo = hàm `rpt_*` + định nghĩa cột; hàng đầu có khoảng thời gian, người xuất, thời điểm; tổng cuối. Xuất vẫn tuân quyền dữ liệu (BR-SEC-02) và giới hạn 5 lần/giờ/người; ghi audit `report.export`.

## 4. Hóa đơn điện tử (điểm cắm — chưa làm)

Phạm vi hiện tại: **phiếu bán hàng nội bộ**. Khi cần hóa đơn điện tử (câu hỏi Q1 `vision-scope`):
- Thêm module `einvoice`: bảng `external_invoices` (một phiếu bán ↔ một hóa đơn điện tử), handler `sale.confirmed` gửi tới nhà cung cấp (MISA/Viettel/VNPT… qua API của họ), nhận kết quả (mã tra cứu, số hóa đơn), trạng thái `pending/issued/failed/cancelled`; `sale.voided` ⇒ hủy/điều chỉnh hóa đơn theo quy định. Đơn CTV: hóa đơn thuộc về bên bán thực tế — cần kế toán xác nhận (Q1).
- Thông tin bổ sung cần thu thập: mã số thuế/địa chỉ khách (tùy trường hợp), thuế suất theo mặt hàng — thêm cột tùy chọn (expand), không đổi cách tính giá nội bộ.
- Mọi chi tiết pháp lý (đối tượng bắt buộc, thời điểm lập, hóa đơn từ máy tính tiền…) **phải do kế toán/thuế xác nhận** — tài liệu này không khẳng định.

## 5. Thông báo

- **Hiện tại**: thông báo trong ứng dụng (`notifications`), sinh bởi cron và handler sự kiện; chuông + danh sách; lọc theo quyền người nhận.
- **Loại**: giữ hàng sắp/quá hạn · khách hẹn trả đến hạn · đơn nháp của CTV chờ xác nhận · chiếc ở CTV quá hạn · linh kiện sắp hết · hàng tồn lâu · bảo hành sắp hết · máy sửa xong chưa lấy · cảnh báo sao lưu · lỗi cron · vi phạm bất biến (`fn_consistency_check`, nghiêm trọng).
- **Đã có (FR-PUSH-04)**: Web Push/VAPID tới thiết bị của chính người nhận — `notifications` (INSERT) → trigger `app.tg_notification_push` → `push_outbox` → `src/server/push.ts` (`web-push`; gửi ngoài transaction; thử lại ≤ 5 lần giãn 2^n phút; 404/410 ⇒ `disabled_at`; giờ yên tĩnh lùi `next_attempt_at`). Gọi sau mỗi request ghi (`kickOutbox`) và sau job cron. Thiếu `VAPID_*` ⇒ tắt êm. Test dùng bộ gửi giả `WF_PUSH_FAKE=1` (+ `WF_PUSH_FAKE_FILE`), không bao giờ bật ở production/Vercel. **Gửi thật tới Google FCM/Mozilla/Apple chỉ chạy được ở môi trường có mạng ra ngoài — ⏭ cloud** (`runbook` §8). Email (Resend), Zalo vẫn là "sau này".
- **Sau này**: email (Resend), Zalo — thêm handler + hàng đợi theo mẫu push ở trên; người dùng chọn kênh.

## 6. Ngân hàng / mã thanh toán (tùy chọn, COULD)

- **VietQR cho khách chuyển khoản**: sinh mã QR thanh toán theo chuẩn từ số tài khoản + số tiền + nội dung (`HD-2026-0001`) hiển thị trên màn thanh toán — chỉ hiển thị, **không** tự ghi nhận đã thu. (Số tài khoản của cửa hàng là cấu hình in/hiển thị, không phải "quỹ" trong app.)
- **Webhook biến động số dư** (SePay/Casso): route công khai lưu giao dịch (idempotent theo mã tham chiếu), màn hình "Giao dịch chưa khớp" gợi ý phiếu; người dùng bấm *Ghi thanh toán* (gọi `fn_record_payment`). Không bao giờ tự ghi.

## 7. AI (tắt mặc định, ngoài đường găng)

**Nguyên tắc:** AI chỉ gợi ý nội dung/phát hiện bất thường; **không** quyết định tiền, kho, giá vốn, quyền; **không** nhận PII (CCCD, SĐT, tên khách…) — ẩn danh hóa trước khi gửi; kết quả luôn là *đề xuất* để người xác nhận.

| Tác vụ ứng viên | Giá trị | Ưu tiên | Ghi chú |
|---|---|---|---|
| Soạn mô tả/tiêu đề đăng bán từ thông số chiếc | Vừa | COULD | Dữ liệu sản phẩm, không PII |
| Trích xuất dòng phiếu nhập từ ảnh hóa đơn NCC (OCR → nháp để người sửa) | Cao khi nhập lô lớn | COULD | Luôn ra **nháp**, không tự xác nhận |
| Cảnh báo bất thường (giảm giá lớn, giá vốn lệch, hủy nhiều, CTV khai giá bán thấp bất thường) | Cao | SHOULD — **làm bằng luật SQL trước**, AI sau | Báo cáo "Điểm đáng chú ý" cho chủ |
| Tìm kiếm ngôn ngữ tự nhiên → bộ lọc ("Seiko tự động dưới 5 triệu") | Vừa | COULD | Chuyển câu thành tham số lọc có kiểm; **không** text-to-SQL |
| Soạn tin nhắc nợ / nhắc bảo hành (không chứa số liệu nhạy cảm ngoài cần thiết) | Thấp | WON'T-NOW | |
| Nhận diện đồng hồ giả/thật qua ảnh | Rủi ro cao | **WON'T** | Không đưa ra kết luận thật/giả bằng AI |

**Kiến trúc khi làm:** cổng AI trong monolith (`src/server/ai/*`), công tắc tổng `feature.ai.enabled`, bảng `ai_task_types` (mỗi tác vụ bật riêng), hạn mức theo giờ/người và ngân sách tháng, cache, ghi `ai_jobs` (không lưu prompt chứa PII), kill switch. Hai hướng thực hiện (quyết định khi tới mốc): (a) **port** cổng AI của Lưu Xá (Groq → Cloudflare → Gemini, có sẵn ẩn danh hóa & test với máy chủ giả); (b) dùng **Vercel AI SDK + AI Gateway** với chuỗi `"provider/model"` và dự phòng. Test AI luôn chạy với máy chủ giả loopback (`AI_OFFLINE=1`), không gọi dịch vụ thật.

## 8. Dịch vụ ngoài & dữ liệu rời hệ thống

Mặc định ứng dụng **không gọi dịch vụ ngoài nào** ngoài Supabase (DB/Storage) và (tùy chọn) GitHub Actions cho sao lưu. Mọi tích hợp mới phải: (1) khai báo ở bảng này; (2) có công tắc cấu hình; (3) không gửi PII/giá vốn trừ khi bắt buộc và đã có ADR; (4) có máy chủ giả để test.
