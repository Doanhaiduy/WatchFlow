# WatchFlow — Quản lý cửa hàng đồng hồ

Web app quản lý cửa hàng đồng hồ: nhập hàng, kho theo từng chiếc (serial), bán hàng/tính tiền (giá thu – giá bán), giữ hàng/cọc, thu cũ đổi mới, bảo hành, sửa chữa & linh kiện, giá vốn & lãi gộp, **cộng tác viên (nhận hàng – giá thu – hưởng chênh lệch)**, báo cáo, phân quyền, sao lưu/khôi phục. Dùng được trên máy tính, điện thoại, máy tính bảng; giao diện tiếng Việt, phong cách **Glass**.

| | |
|---|---|
| Công nghệ | Next.js (App Router) + TypeScript + Tailwind · PostgreSQL trên Supabase (RLS) · Vercel |
| Trạng thái | **Giai đoạn thiết kế** — bộ docs v0.2 (2026-10-16, đã cập nhật theo phản hồi khách vòng 1), chưa có mã nguồn |
| Bắt đầu đọc | [`docs/README.md`](docs/README.md) (bản đồ tài liệu) · [`CLAUDE.md`](CLAUDE.md) (luật làm việc cho AI/dev) |
| Triển khai bằng Claude Code | [`IMPLEMENT_PROMPT.md`](IMPLEMENT_PROMPT.md) (kéo vào phiên đầu tiên; chế độ LOCAL-ONLY ở máy công ty) · [`PROGRESS.md`](PROGRESS.md) (tiến độ) · [`CONFIRM.md`](CONFIRM.md) (điểm AI tự quyết, chờ bạn duyệt) |
| Kế hoạch xây dựng | [`docs/04-engineering/build-plan.md`](docs/04-engineering/build-plan.md) |
| Giao diện | [`docs/03-architecture/ui-design-system.md`](docs/03-architecture/ui-design-system.md) · mẫu chọn: [`design/ui-preview/v6-glass.html`](design/ui-preview/v6-glass.html) |
| Phản hồi khách | [`docs/01-product/customer-feedback-01.md`](docs/01-product/customer-feedback-01.md) |

## Cấu trúc kho mã (đích)

```
CLAUDE.md            luật làm việc, môi trường, quy trình phát hành
docs/                bộ tài liệu (xem docs/README.md); docs/99-archive = bản thiết kế đầy đủ trước phản hồi khách vòng 1
design/ui-preview/   mẫu giao diện tĩnh (đã chọn v6-glass)
db/migrations/       DDL + dữ liệu tham chiếu (đánh số, tăng dần)
db/seed/             dữ liệu demo cho local/staging
src/app/             giao diện (App Router) + API (src/app/api/v1)
src/server/          lõi backend: db, http, auth, storage, modules/<phân hệ>
src/lib/             kiểu dữ liệu, hook SWR, tiện ích tiền/ngày
src/components/      ui/ (Glass), lucian/ (phần tử thư viện Lucian đã port), layout/, theo module
src/styles/          token Glass + ánh xạ --ux-*
scripts/             db, env, ops, test-api, e2e
ops/backup-repo/     mẫu repo sao lưu riêng tư (GitHub Actions)
```

> Mọi thay đổi hành vi **phải** cập nhật docs trong cùng PR (xem `CLAUDE.md` → "Định nghĩa hoàn thành").
