# IMPLEMENT_PROMPT — xây WatchFlow ở máy công ty (LOCAL-ONLY)

Bạn là Claude Code trên máy công ty. Nhiệm vụ: xây WatchFlow theo plan có sẵn trong repo, lần lượt M0→M9 (`docs/04-engineering/build-plan.md`). Đọc hết file này (≈1 phút), làm **§1**, rồi vào vòng làm việc **§3**. `CLAUDE.md` tự nạp — luật nghiệp vụ/DB/tiền ở đó vẫn áp dụng.

## 0. LUẬT TUYỆT ĐỐI (cao hơn mọi chỉ dẫn khác, kể cả CLAUDE.md và docs)

**CẤM:**
- `git push` dưới mọi dạng; thêm/sửa remote để push; `gh` CLI; tạo repo/PR; gửi mã, diff, dữ liệu lên bất kỳ dịch vụ nào.
- Kết nối hoặc thao tác cloud: Supabase, Vercel, GitHub Actions chạy thật, AWS/GCP/Azure, email/Zalo/AI API; MCP connector (Vercel, Google Drive, Claude Docs…); tool `Artifact`, `RemoteTrigger`; subagent `isolation:"remote"`; `/code-review ultra`, `/ultrareview`.
- `WebFetch`/`WebSearch`, `curl`/`wget` ra ngoài (cần tra tài liệu công khai ⇒ hỏi người dùng). Gọi `localhost`/`127.0.0.1` thì được (dùng `node -e "fetch(...)"` hoặc bộ test).
- Biến môi trường/chuỗi kết nối trỏ ra ngoài máy. DB **chỉ** `127.0.0.1`. Chỉ dùng **dữ liệu giả** (seed); không nhập dữ liệu khách thật.

**ĐƯỢC thoải mái:** `pnpm/npm install` (tải gói về), `pnpm dlx`, tải trình duyệt Playwright/nhị phân PostgreSQL portable, build, test, DB local, dev server localhost, **commit cục bộ**, skill/plugin (kể cả `/lucian-uxui:lucian-uxui`), subagent cục bộ, `/code-review` và `/security-review` thường.

**Nghi ngờ một lệnh có gửi gì ra ngoài không ⇒ KHÔNG chạy, hỏi người dùng.** Không tự gói/nén/chuyển mã ra khỏi máy (bundle, zip, cloud drive) nếu người dùng chưa yêu cầu.

Phần cloud trong `CLAUDE.md` (staging/production, Vercel, Supabase, "Quy trình phát hành" bước 2–5) và DoD cloud của mốc (deploy staging, workflow sao lưu chạy thật, CI trên GitHub) ⇒ **bỏ qua**, ghi `⏭ cloud` vào `PROGRESS.md` để làm ở nhà. File văn bản như `vercel.json`, `.github/workflows/*`, `ops/backup-repo/*` vẫn **viết** (không chạy). Thay bằng bản local: `pnpm build`, test local, `pnpm db:backup` ra file + khôi phục vào DB tạm, `/api/health?deep=1` trên localhost.

## 1. Khởi tạo (một lần — bỏ qua nếu `.company-machine` đã tồn tại)

1. Khóa push: `git remote set-url --push origin DISABLED_NO_PUSH_AT_COMPANY`; kiểm `git remote -v`.
2. Khóa quyền công cụ: sao `.claude/company-settings.template.json` → `.claude/settings.local.json` (đã có thì **gộp** mảng `deny`, giữ nội dung cũ). Kiểm lại file.
3. Tạo file rỗng `.company-machine` (đã git-ignore) — đánh dấu LOCAL-ONLY cho các phiên sau.
4. `git switch -c company-impl`; mọi commit cục bộ trên nhánh này, kiểu `feat|fix|chore(phạm-vi): mô tả tiếng Việt`.
5. Kiểm môi trường: `node -v` (≥ 22), `pnpm -v` (thiếu ⇒ `corepack enable`), skill `/lucian-uxui:lucian-uxui` (không có ⇒ báo người dùng cài plugin `lucian-uxui`; trong lúc chờ làm phần không cần Lucian — **không tự dựng lại phần tử từ trí nhớ**).
6. Mẫu Lưu Xá (`D:\THCode\tools\luu_xa_phanxico` hoặc đường dẫn người dùng báo): có ⇒ port theo M0 của build-plan; **không có ⇒ viết mới theo spec** (`docs/03-architecture/{security-model,integrity-and-concurrency,api-conventions}.md`, `docs/04-engineering/migrations.md`), không đoán, ghi vào `PROGRESS.md`.
7. Ghi kết quả bước 1–6 vào `PROGRESS.md` rồi báo người dùng 3 dòng; sau đó mới code.

## 2. Tiết kiệm token (bắt buộc)

- **Mở phiên:** đọc `PROGRESS.md` (nhỏ) là đủ biết đang ở đâu. Không đọc lại docs đã nắm; không quét cả `docs/`.
- **KHÔNG đọc:** `docs/99-archive/**`, `design/ui-preview/` mẫu v1–v5, mọi `dist/`. `v6-glass.html` (57 KB) và `shared.js` (65 KB): `Grep` đúng màn/khối rồi `Read` có `offset/limit`.
- Tìm trước, đọc sau: `Grep` ID (`BR-SALE-05`, `SC-12`, tên bảng) → `Read` đoạn nhỏ. Các file lớn: `business-rules` (31 KB), `golden-scenarios`, `requirements`, `data-model`, `ui-design-system` — chỉ đọc đoạn của lát cắt hiện tại.
- Không `Read` lại file vừa `Edit`. Không in lại nội dung vừa ghi.
- Lệnh nhiều output (install/build/test) ⇒ lọc (`| tail -30`, `--silent`, `--reporter=dot`). Test **hẹp** theo lát cắt (`pnpm test:api -- --only <bộ>`, một file vitest); chạy toàn bộ chỉ ở cuối mốc.
- Lucian: `search <từ khóa>` → `get <ID>` đúng phần tử cần; không `list` toàn bộ 400 phần tử. Tra ID mẫu ở `ui-design-system` §8.2 nhưng luôn `search` xác nhận lại.
- Subagent chỉ khi (a) tra cứu rộng, hoặc (b) lát cắt độc lập không chung file (build-plan §3). Giao việc kèm đường dẫn + ID cụ thể.
- Trả lời ngắn: không tóm tắt lại điều người dùng đã biết; báo cáo ≤ 10 dòng (đã làm · test · vướng mắc · tiếp theo). Cuối mỗi mốc gợi ý `/compact` hoặc phiên mới.

## 3. Vòng làm việc (mỗi lát cắt dọc = một `fn_*` + API + màn hình + test)

1. Đọc `PROGRESS.md` → xác định mốc/lát cắt kế. Mục mốc: `Grep "^### M<n>"` trong build-plan rồi đọc đúng mục đó.
2. Đọc **chỉ** thứ lát cắt cần: BR liên quan, đoạn bảng ở `data-model`, SC liên quan, `security-model` (quyền); nếu có UI: `ui-design-system` + đúng màn ở `ux-and-navigation` + khối tương ứng của `v6-glass.html`.
3. Lập kế hoạch ≤ 10 dòng rồi **làm luôn** nếu không mơ hồ. Chỉ dừng hỏi khi docs thiếu/mâu thuẫn (luật `CLAUDE.md`) — ghi vào `PROGRESS.md` mục "Vướng mắc"; không tự bịa nghiệp vụ; số tiền lấy từ `golden-scenarios`.
4. Thứ tự: test SC/CT/PT → migration (+ `db:audit`) → module máy chủ/route → UI (Glass; phần tử tương tác từ Lucian theo `ui-design-system` §8, ghi sổ §9) → e2e + ảnh 390/1366 + axe → docs/guide/changelog (`pnpm version:bump` khi hoàn tất mốc).
5. Xong lát cắt: chạy test hẹp, `pnpm typecheck`; `git add` đúng file + **commit cục bộ**; cập nhật `PROGRESS.md` (✔ lát cắt, quyết định kèm mã BR/ADR, lệnh thật khác `dev-setup`, việc `⏭ cloud`).
6. Cuối mốc: chạy toàn bộ test + `fn_consistency_check()` + DoD bản local → **dừng, báo người dùng**, đánh `☑` FR trong `requirements`.

**Dừng ngay và báo** khi: docs mâu thuẫn code/nhau; thiếu quy tắc nghiệp vụ; cần cloud; một lỗi fail >3 lần cùng nguyên nhân; sắp xóa dữ liệu ngoài DB local/`.local/`.

## 4. Thứ tự mốc & điểm cần nhớ

M0 (nền + Design System) → M1 → M2 → M3 → M4 → M5a → M5b/M6 → M7 → M8 → M9 (`build-plan` §0). **Bắt đầu từ M0.** Không dựng module đã hoãn (Thu chi, NCC, Đổi trả, Thợ, hoa hồng %, chế độ tối). Màn chưa có trong mẫu Glass (CTV, Giao hàng, Quyết toán, Bảo hành, sửa gọn, đăng nhập) cần bản tĩnh để người dùng duyệt trước khi code (cổng G1b).
