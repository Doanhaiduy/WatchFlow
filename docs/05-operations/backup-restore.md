# Sao lưu & khôi phục

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · FR-BAK-01/02 · BR-BAK-01…03 · ADR-015 · Mẫu: `ops/backup-repo/*` và `VAN_HANH.md` §3 của Lưu Xá

## 1. Mục tiêu

| Chỉ tiêu | Giá trị |
|---|---|
| **RPO** (mất dữ liệu tối đa) | ≤ 24 giờ (sao lưu đêm). Có PITR của Supabase ⇒ tới phút |
| **RTO** (thời gian khôi phục) | ≤ 4 giờ cho khôi phục toàn bộ vào dự án mới |
| Giữ lại | Sao lưu ngày 90 ngày; bản **tuần** giữ dài hạn; bản trước mỗi migration production giữ ≥ 30 ngày |
| Bảo mật | Mã hóa AES-256 (gpg) trước khi rời máy; repo sao lưu **private**; passphrase ở trình quản lý mật khẩu |

## 2. Hai lớp (không phụ thuộc một nhà cung cấp)

| Lớp | Cơ chế | Ghi chú |
|---|---|---|
| **1. Của nhà cung cấp DB** | Supabase Pro: sao lưu hằng ngày; **PITR** (add-on) nếu cần phút/giây | Bật ở Dashboard → Database → Backups. Không thay thế lớp 2 (cùng tài khoản/nhà cung cấp) |
| **2. Độc lập** | GitHub Actions trong **repo riêng tư**: `pg_dump` bằng tài khoản chỉ đọc `wf_backup` → mã hóa → Artifacts + bản tuần → diễn tập khôi phục → nhịp tim về ứng dụng | Chạy mỗi ngày khoảng 02:17 giờ VN |
| **3. Tệp (Storage)** | `scripts/ops/storage-backup.mjs` (workflow tuần) tải ảnh/giấy tờ về, mã hóa, lưu Artifacts/`weekly/` | `pg_dump` **không** gồm Storage |
| Thủ công | `pnpm db:backup -- --env production --with-storage` | **Trước mỗi lần áp migration lên production**, và khi cần |
| Khóa | `PII_*`, `AUTH_JWT_*`, mật khẩu DB lưu ở trình quản lý mật khẩu (không nằm trong dump) | Thiếu `PII_*` ⇒ CCCD trong bản sao lưu **không giải mã được** |

## 3. Tài khoản chỉ đọc cho sao lưu

`wf_backup`: `LOGIN`, **`BYPASSRLS`** (vì mọi bảng đã `FORCE ROW LEVEL SECURITY` — `pg_dump` bằng vai trò thường sẽ lỗi/thiếu dòng), chỉ `SELECT` trên mọi bảng + sequence và `USAGE` trên schema; **không** quyền ghi/DDL. Tạo bằng `node scripts/ops/create-backup-role.mjs --env production [--rotate]` (ghi chuỗi kết nối vào `backup/backup-db-url-production.txt`, git-ignore), rồi `gh secret set BACKUP_DATABASE_URL --repo <org>/watchflow-backups`. Kết nối qua pooler **cổng 5432** (session mode, cần cho `pg_dump`). Kiểm tra: kết nối thử bằng tài khoản này, `INSERT` phải lỗi.

> Kiểm tra sớm (M0) rằng Supabase cho phép tạo vai trò `BYPASSRLS`; nếu không, phương án: chạy `pg_dump` bằng tài khoản chủ trong workflow (bí mật hơn) hoặc dùng `COPY` qua hàm `SECURITY DEFINER` xuất bảng — ghi lại quyết định vào ADR.

## 4. Workflow sao lưu (repo riêng `watchflow-backups`)

Mẫu ở `ops/backup-repo/` (port từ Lưu Xá):

1. **Điều kiện an toàn:** workflow tự dừng nếu repo sao lưu bị chuyển **công khai**.
2. `pg_dump -Fc` DB production bằng `BACKUP_DATABASE_URL` (không sở hữu, không ACL, kèm schema `public`+`app`).
3. Mã hóa: `gpg --symmetric --cipher-algo AES256` với `BACKUP_PASSPHRASE` ⇒ `watchflow-<yyyymmdd-hhmm>.dump.gpg`.
4. Tải lên **Artifacts 90 ngày**; Chủ nhật lưu thêm vào thư mục `weekly/` (giữ lâu dài).
5. **Diễn tập khôi phục tự động:** dựng PostgreSQL tạm (service container), tạo các vai trò `wf_*`, `pg_restore`, rồi đối chiếu: số dòng một số bảng chính, `app_migrations` khớp, **chạy `app.fn_consistency_check()` và `app.fn_verify_ledger_chain()`** — kết quả phải sạch.
6. Gọi `POST /api/v1/public/ops-heartbeat` (Bearer `OPS_HEARTBEAT_SECRET`) báo "đã sao lưu lúc …, kích thước …" ⇒ ứng dụng cập nhật "Sao lưu gần nhất".
7. Bất kỳ bước lỗi ⇒ lần chạy **đỏ** + GitHub gửi email; ứng dụng cảnh báo nếu quá `backup.heartbeat_max_hours` (36 giờ).

Secrets repo sao lưu: `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, `OPS_HEARTBEAT_URL`, `OPS_HEARTBEAT_SECRET`, (cho workflow Storage) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 5. Khôi phục

### 5.1 Khôi phục toàn bộ vào dự án mới (thảm họa)
1. Tạo dự án Supabase mới (cùng vùng Singapore); lấy chuỗi chủ DB.
2. Tạo vai trò & extension: chạy phần đầu của `bundle.mjs` (hoặc migration 0001) **trước** khi restore (dump không gồm vai trò cụm).
3. Giải mã: `gpg --decrypt watchflow-….dump.gpg > restore.dump` (passphrase).
4. `pg_restore --clean --if-exists --no-owner --role=wf_owner -d "<chuỗi chủ DB>" restore.dump`.
5. Đặt lại mật khẩu vai trò `wf_api`; kiểm `app_migrations`; nếu có migration mới hơn bản dump, chạy `pnpm db:migrate:<env>`.
6. Khôi phục Storage từ bản tuần (script `storage-restore.mjs`); kiểm `files` khớp tệp.
7. Cập nhật `DATABASE_URL`/`SUPABASE_*` trên Vercel (khóa `PII_*`/`AUTH_JWT_*` **giữ nguyên**), deploy lại.
8. Kiểm: `/api/health?deep=1`; đăng nhập chủ; `fn_consistency_check()` sạch; so tổng tồn kho và doanh thu/thực thu với báo cáo gần nhất trước sự cố.
9. Thông báo người dùng khoảng dữ liệu có thể mất (từ thời điểm bản sao lưu đến sự cố) và nhập bù từ chứng từ giấy.

### 5.2 Khôi phục một phần (xóa nhầm / sửa nhầm)
Ứng dụng không xóa dữ liệu đã xác nhận nên hiếm khi cần. Nếu cần: khôi phục bản sao lưu vào DB tạm, trích bảng/dòng cần, **chỉ chèn lại bằng migration data/`fn_*` có audit** (không sửa tay SQL trên production). Với Supabase PITR: khôi phục sang dự án mới tại thời điểm trước sự cố rồi trích dữ liệu.

### 5.3 Khôi phục Storage
Từ bản tuần: tải lại ảnh theo `files.path`; ảnh `intake`/`evidence`/`id_document` ưu tiên. Ảnh thiếu vẫn giữ metadata (`files`) nên hiển thị "tệp không còn" thay vì lỗi.

## 6. Diễn tập khôi phục

- **Trước go-live** và **mỗi quý** (BR-BAK-03), do người kỹ thuật + chủ.
- Quy trình: chọn một bản sao lưu bất kỳ (kể cả cũ) → dựng DB tạm (staging mới hoặc local) theo §5.1 → đăng nhập, mở 3 màn hình (phiếu bán gần nhất, tồn kho, báo cáo Tiền thu) → `fn_consistency_check()` → so số liệu với báo cáo cùng thời điểm.
- **Biên bản** (lưu `docs/05-operations/drills/<yyyy-mm-dd>.md`): bản sao lưu dùng · thời gian khôi phục (RTO thực) · kết quả kiểm · vấn đề phát hiện · hành động khắc phục · người thực hiện/ký.
- Diễn tập thất bại là **sự cố mức cao**: sửa quy trình/khóa trước khi tiếp tục.

## 7. Trước khi áp migration production

1. `pnpm db:backup -- --env production --with-storage` (hoặc kích hoạt workflow thủ công) và **xác nhận tệp mở được** (giải mã thử).
2. Ghi vào nhật ký vận hành: tên bản sao lưu + migration sắp áp.
3. Giữ bản này ≥ 30 ngày.

## 8. Rủi ro & lưu ý

- Dump chứa dữ liệu cá nhân: **luôn mã hóa**, không để trên máy cá nhân lâu, không đưa lên git/Vercel/artifact công khai.
- `pg_dump` chạy qua pooler **5432**; nếu DB lớn lên (nghìn MB) kiểm thời gian chạy workflow (giới hạn GitHub) và cân nhắc nén/tách bảng.
- Mất `BACKUP_PASSPHRASE` hoặc `PII_*` = mất khả năng dùng bản sao lưu/đọc CCCD ⇒ giữ bản sao ở **hai nơi** (trình quản lý mật khẩu của chủ + người tin cậy).
- Sao lưu **chưa** là khôi phục: chỉ tin khi đã diễn tập.
