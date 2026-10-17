# watchflow-backups (repo RIÊNG TƯ)

Sao copy thư mục này thành một repo GitHub **private** riêng (`<org>/watchflow-backups`). Workflow `backup.yml` chạy mỗi ngày ~02:17 giờ VN:
`pg_dump` bằng tài khoản chỉ đọc `wf_backup` → mã hóa AES-256 → Artifacts (giữ 90 ngày) + bản tuần → diễn tập khôi phục vào PostgreSQL tạm →
gọi nhịp tim `POST /api/v1/public/ops-heartbeat` về ứng dụng. Chi tiết: `docs/05-operations/backup-restore.md`.

Secrets cần đặt: `BACKUP_DATABASE_URL` (pooler cổng 5432, vai trò `wf_backup`), `BACKUP_PASSPHRASE`, `OPS_HEARTBEAT_URL`, `OPS_HEARTBEAT_SECRET`,
(workflow Storage) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Tệp mã hóa dùng định dạng của `scripts/db/backup.mjs` (`WFBK1`, AES-256-GCM, khóa scrypt) — giải mã: `node scripts/db/backup.mjs --decrypt <tệp> --out restore.dump`.
