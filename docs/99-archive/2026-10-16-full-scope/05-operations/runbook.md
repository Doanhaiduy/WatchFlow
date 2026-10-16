# Sổ tay vận hành

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (điền địa chỉ/ID thật khi dựng môi trường) · Mẫu: `VAN_HANH.md` của Lưu Xá · Đối tượng: chủ cửa hàng + người kỹ thuật phụ trách

## 1. Địa chỉ & thành phần (điền khi dựng)

| Môi trường | Địa chỉ | Supabase (project ref) | Nhánh |
|---|---|---|---|
| staging | `https://<…>.vercel.app` | `<ref-staging>` | `staging` |
| production | `https://<tên-miền>` | `<ref-production>` | `main` |

Thành phần: Vercel (Pro; Functions `sin1`; Cron), Supabase (PostgreSQL + Storage, Singapore; Pro), GitHub (repo ứng dụng **private** + repo sao lưu **private** riêng), tên miền, (tùy chọn) UptimeRobot/Better Stack, Resend/Zalo/AI nếu bật sau này.

## 2. Giám sát

- **Sống/sẵn sàng:** `GET /api/health` ⇒ 200 khi DB trả lời, 503 khi DB lỗi. **Sâu:** `GET /api/health?deep=1` ⇒ thêm 503 khi cron sáng/tối quá 30 giờ chưa chạy xong không lỗi, hoặc nhịp tim sao lưu quá 36 giờ. Đặt **hai** monitor (UptimeRobot/Better Stack, chu kỳ 5–15 phút, báo email/Telegram): một cho `/api/health`, một cho `/api/health?deep=1`.
- **Trong ứng dụng (Quản trị → Hệ thống & sao lưu):** lượt chạy tác vụ nền (`job_runs`, từng bước), nhật ký lỗi gộp (`error_events`), trạng thái "Sao lưu gần nhất", kết quả kiểm chuỗi sổ quỹ & kiểm bất biến (`fn_consistency_check`), dung lượng DB/Storage, biến môi trường thiếu. Dải cảnh báo đỏ dưới thanh tiêu đề khi cron/sao lưu có vấn đề; chủ nhận thông báo ngay khi cron lỗi hoặc **chuỗi sổ quỹ lệch (sự cố nghiêm trọng)**.
- **Mã lỗi:** người dùng thấy "(mã lỗi: xxxxxxxx)" = 8 ký tự đầu `requestId` ⇒ tra ở nhật ký lỗi hoặc log Vercel.
- **Tốc độ:** header `Server-Timing` (DevTools → Network → Timing); Vercel Speed Insights.
- **Cron:** `overview` §7. Chạy thử/tra cứu ở Quản trị → Hệ thống.

## 3. Lịch việc định kỳ

| Tần suất | Ai | Việc |
|---|---|---|
| Hằng ngày | Chủ/thu ngân | **Chốt ngày** (đối chiếu tiền mặt thực tế); xem "Việc cần xử lý" trên tổng quan |
| Hằng ngày | Hệ thống | Cron sáng/tối; sao lưu đêm; kiểm chuỗi sổ quỹ |
| Hằng tuần | Chủ | Xem báo cáo công nợ quá hạn, hàng tồn lâu, giữ hàng quá hạn; kiểm "Sao lưu gần nhất" |
| Hằng tháng | Chủ | Đối chiếu từng quỹ → **khóa kỳ**; xem báo cáo thu chi/lãi gộp; kiểm kê linh kiện nhanh |
| Hằng quý | Kỹ thuật + chủ | **Diễn tập khôi phục** vào DB tạm (có biên bản); rà quyền người dùng (ai còn cần?); cập nhật phụ thuộc |
| 6–12 tháng | Kỹ thuật | Xoay khóa (mục 5); rà tài khoản không dùng; xem lại chi phí hạ tầng |
| Khi nhân sự đổi | Chủ | Khóa tài khoản người nghỉ **ngay**; thu hồi phiên; đổi mật khẩu dùng chung (nếu có) |

## 4. Sự cố thường gặp

| Triệu chứng | Kiểm tra / xử lý |
|---|---|
| Không đăng nhập được, "phiên hết hạn" liên tục | Có đổi `AUTH_JWT_*` giữa hai lần deploy? Cookie Secure khi chạy http (`COOKIE_SECURE`)? Đồng hồ máy khách lệch? |
| Tài khoản bị khóa | Khóa tạm 15 phút sau 5 lần sai; chủ có thể đặt lại mật khẩu tạm (Quản trị → Người dùng) |
| Mất thiết bị TOTP của chủ | Dùng mã khôi phục; nếu mất cả hai: người kỹ thuật tắt MFA qua script `scripts/env/reset-mfa.mjs` (cần `MIGRATE_DATABASE_URL`, ghi audit) rồi chủ bật lại |
| 503 ở `/api/health` | Supabase tạm ngưng/hết kết nối (xem Dashboard); `DATABASE_URL` phải dùng pooler cổng 6543; kiểm hạn mức gói |
| Trang chậm bất thường | Server-Timing: nhiều vòng DB? Truy vấn thiếu index? Vùng Vercel khác vùng Supabase? |
| "Không bán được chiếc này" | Trạng thái chiếc (đang giữ/đã bán/chờ kiểm tra/đang sửa)? Xem lịch sử trạng thái chiếc |
| Lệch tiền quỹ so với thực tế | Chốt ngày → điều chỉnh quỹ có lý do; nếu `fn_consistency_check` báo lệch ⇒ **dừng ghi tiền**, liên hệ kỹ thuật (không sửa tay SQL) |
| Cảnh báo "Chuỗi sổ quỹ lệch" | **Sự cố nghiêm trọng**: khóa tạm các thao tác ghi quỹ (cờ `ui.disabled_modules`), sao lưu ngay, điều tra bằng `fn_verify_ledger_chain(account)`; khôi phục từ bản sao lưu gần nhất nếu bị can thiệp |
| Ảnh không hiện | Bucket/chính sách Storage, URL ký hết hạn, `SUPABASE_*` đúng chưa? |
| Cron "đỏ" trong Vercel | Quản trị → Hệ thống xem bước lỗi; thiếu `CRON_SECRET` ⇒ 503; chạy lại bước |
| Sao lưu không chạy | Repo sao lưu: workflow đỏ? Secret hết hạn? Repo bị chuyển công khai (workflow tự dừng)? Xem `backup-restore` |
| Lỗi sau khi deploy | Vercel "Promote previous deployment"; kiểm migration đã áp trước code; xem `release-process` §3 rollback |
| Camera không bật (quét QR) | Cần HTTPS/quyền camera của trình duyệt; iOS Safari dùng thư viện dự phòng; có ô nhập tay |

## 5. Khóa & bí mật

| Biến / bí mật | Dùng cho | Đổi thì… | Xoay vòng |
|---|---|---|---|
| `AUTH_JWT_*` | Ký phiên | Mọi người đăng nhập lại | 6–12 tháng, chọn giờ ít người dùng; deploy lại |
| `PII_KEY_V1`, `PII_BIDX_KEY` | Mã hóa CCCD / chỉ mục băm | **Dữ liệu mã hóa cũ không đọc được** — chỉ đổi theo quy trình mã hóa lại có phiên bản khóa | Không xoay thường; **sao lưu khóa an toàn** |
| `CRON_SECRET` | Bearer cho cron | Đổi cả trên Vercel, deploy lại | 6–12 tháng |
| `DATABASE_URL` (mật khẩu `wf_api`) | Ứng dụng nối DB | Đổi ở DB rồi Vercel, deploy lại | 6–12 tháng |
| `MIGRATE_DATABASE_URL` | Migrate/backup trên máy dev | Chỉ máy dev, **không lên Vercel** | Khi nhân sự đổi |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage từ máy chủ | Tạo lại ở Supabase rồi cập nhật Vercel | 12 tháng / khi nghi lộ |
| `OPS_HEARTBEAT_SECRET` | Repo sao lưu báo "đã sao lưu" | Đổi đồng thời secret cùng tên ở repo sao lưu | 12 tháng |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` (repo sao lưu) | Sao lưu / mã hóa | **Mất passphrase = mất cả sao lưu** | Cất ở trình quản lý mật khẩu; không xoay trừ khi nghi lộ |
| Tài khoản Vercel/Supabase/GitHub/tên miền | Sở hữu hạ tầng | — | Bật 2FA; ≥ 2 người có quyền sở hữu (chủ + 1 người tin cậy) |

- Sinh bộ khóa mới: `pnpm env:keys` (chỉ in màn hình). **Mỗi môi trường một bộ riêng.**
- Biến *Sensitive* trên Vercel không đọc lại được: giữ bản gốc ở trình quản lý mật khẩu.
- **Nghi lộ khóa:** (1) xoay khóa đó ngay; (2) nếu là `DATABASE_URL`/`MIGRATE_*`: đổi mật khẩu DB; (3) xem `audit_logs`/`error_events` trong khoảng nghi vấn; (4) nếu từng vào git: coi như đã lộ, xoay, và (nếu repo từng công khai) coi dữ liệu có thể đã lộ.
- Không bao giờ dán khóa vào chat/ảnh chụp/issue.

## 6. Dữ liệu cá nhân & quyền riêng tư

- Dữ liệu khách (tên, SĐT, địa chỉ, CCCD người bán) chỉ dùng cho nghiệp vụ cửa hàng; CCCD mã hóa; xem đầy đủ phải nêu lý do (audit).
- **Yêu cầu của khách** (xem/xóa dữ liệu): `fn_anonymize_customer` (ẩn danh, giữ giao dịch tài chính); ghi nhận yêu cầu và kết quả trong ghi chú. Thông tin pháp lý về bảo vệ dữ liệu cá nhân (vd. Nghị định 13/2023/NĐ-CP) do chủ/ tư vấn pháp lý xác nhận.
- Thời hạn lưu: chứng từ tài chính giữ theo quy định kế toán/thuế (chủ xác nhận với kế toán); ảnh giấy tờ người bán giữ theo chính sách cửa hàng (đề xuất ≥ thời hạn bảo hành + 1 năm).
- Không gửi PII cho dịch vụ ngoài (kể cả AI) trừ khi có ADR và đồng ý.

## 7. Bàn giao & quyền sở hữu (FR-BAK-08)

☐ Tài khoản Vercel, Supabase, GitHub (2 repo), tên miền, UptimeRobot **đứng tên chủ cửa hàng/pháp nhân**; người phát triển chỉ được mời (quyền tối thiểu).
☐ Danh sách bí mật và nơi cất (trình quản lý mật khẩu của chủ) — kiểm tra truy cập được.
☐ ≥ 2 người có khả năng khôi phục (đã đọc `backup-restore`, đã diễn tập).
☐ Chủ nắm: đăng nhập MFA, chốt ngày, khóa kỳ, đọc báo cáo, nơi xem sao lưu, ai gọi khi sự cố.
☐ Mã nguồn (repo) + docs + `changelog` + hướng dẫn sử dụng; giấy phép/quyền sở hữu mã nguồn ghi rõ bằng văn bản.
☐ Dữ liệu xuất được: Excel từng báo cáo + `pnpm db:backup` (dump) — chủ biết cách yêu cầu.
☐ Buổi đào tạo theo vai trò (bán hàng, kho, thợ, CTV, chủ) + tài liệu `07-user-guide`.

## 8. Việc cần làm tay (cập nhật khi làm)

> Đánh `[x]` khi xong. Việc ở đây là thao tác trên Vercel/Supabase/GitHub/dịch vụ ngoài mà AI không tự làm.

- [ ] Tạo dự án Supabase staging + production (Singapore); **tắt Data API**; bật gói Pro cho production; bật backup ngày/PITR theo nhu cầu.
- [ ] Tạo project Vercel (Pro, vùng `sin1`), kết nối repo; đặt biến môi trường Production/Preview; bật Web Analytics + Speed Insights.
- [ ] Repo sao lưu riêng tư + secrets (`BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, `OPS_HEARTBEAT_SECRET`); chạy workflow lần đầu + diễn tập khôi phục.
- [ ] Hai monitor uptime (`/api/health`, `/api/health?deep=1`).
- [ ] Đăng ký/trỏ tên miền; đặt `NEXT_PUBLIC_APP_URL`.
- [ ] Bật GitHub secret scanning + push protection; branch protection.
- [ ] Tạo chủ cửa hàng đầu tiên + bật TOTP; cất mã khôi phục.
- [ ] Nhập `finance.books_start_date`, quỹ + số dư đầu kỳ, hạng mục, vai trò/hạn mức giảm giá, hồ sơ thợ/CTV, thông tin cửa hàng in phiếu.
- [ ] Xác nhận với kế toán: hóa đơn điện tử/thuế (`vision-scope` Q1).
- [ ] Chạy UAT, ký nghiệm thu, đào tạo.

## 9. Quản lý thay đổi

Mọi thay đổi vào production đi qua `release-process`. Thay đổi cấu hình trên Vercel/Supabase (biến, domain, tắt/bật bảo mật) ghi lại ở mục 8 hoặc sổ nhật ký vận hành (ngày, người, lý do). Sự cố nghiêm trọng: viết biên bản ngắn (chuyện gì, tác động, nguyên nhân, đã làm gì, phòng ngừa) lưu ở `docs/05-operations/incidents/`.
