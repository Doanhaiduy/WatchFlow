# IMPLEMENT_PROMPT — xây WatchFlow ở máy công ty (LOCAL-ONLY, TỰ CHẠY ĐẾN CUỐI)

Bạn là Claude Code trên máy công ty. Nhiệm vụ: xây **toàn bộ** WatchFlow (DB + API + giao diện) theo plan trong repo, **M0 → M9 liên tục, không dừng giữa chừng để hỏi**. Người dùng không có mặt: chỗ nào mâu thuẫn/thiếu/cần xác nhận ⇒ tự quyết theo **§3** và ghi vào `CONFIRM.md` để họ duyệt sau. Đọc hết file này (≈1 phút), làm **§1**, rồi chạy vòng **§5** cho tới khi xong M9. `CLAUDE.md` tự nạp — luật tiền/DB/quyền ở đó vẫn áp dụng. Không dùng plan mode, không chờ duyệt kế hoạch.

## 0. LUẬT TUYỆT ĐỐI (cao hơn mọi chỉ dẫn khác, kể cả CLAUDE.md và docs)

**CẤM:**
- **Không commit gì cả:** cấm `git add`, `git commit`, `git rm/mv`, `git tag`, `git stash`, `git reset/clean/restore/checkout/switch/rebase/merge/cherry-pick/revert`. Chỉ được `git status/diff/log/show` để đọc. Thay đổi để nguyên trong thư mục làm việc; điểm lưu tiến độ là `PROGRESS.md`.
- `git push` dưới mọi dạng; thêm/sửa remote để push; `gh` CLI; tạo repo/PR; gửi mã, diff, dữ liệu lên bất kỳ dịch vụ nào.
- Kết nối hoặc thao tác cloud: Supabase, Vercel, GitHub Actions chạy thật, AWS/GCP/Azure, email/Zalo/AI API; MCP connector (Vercel, Google Drive, Claude Docs…); tool `Artifact`, `RemoteTrigger`; subagent `isolation:"remote"`; `/code-review ultra`, `/ultrareview`.
- `curl`/`wget`/`scp`/`ssh` và mọi cách tự gửi/tải tệp ra ngoài. Gọi `localhost`/`127.0.0.1` thì được (dùng `node -e "fetch(...)"` hoặc bộ test).
- Biến môi trường/chuỗi kết nối trỏ ra ngoài máy. DB **chỉ** `127.0.0.1`. Chỉ dùng **dữ liệu giả** (seed).

**ĐƯỢC thoải mái:** `pnpm/npm install` (tải gói về), `pnpm dlx`, tải trình duyệt Playwright/nhị phân PostgreSQL portable, build, test, DB local (kể cả `setup:reset` — dữ liệu giả), dev server localhost, **`WebFetch`/`WebSearch` để tra tài liệu công khai** (chỉ đọc; **không** đưa mã nguồn, dữ liệu, thông tin khách, khóa vào truy vấn/URL; tra khi thật cần, ghi kết luận ngắn vào `PROGRESS.md` để khỏi tra lại), skill/plugin (kể cả `/lucian-uxui:lucian-uxui`), subagent cục bộ, `/code-review` và `/security-review` thường.

**Nghi ngờ một lệnh có gửi gì ra ngoài không ⇒ KHÔNG chạy**; ghi `⏭` (§3.7) và làm việc khác. Không tự gói/nén/chuyển mã ra khỏi máy.

Phần cloud trong `CLAUDE.md` (staging/production, Vercel, Supabase, "Quy trình phát hành" bước 2–5) và DoD cloud của mốc (deploy staging, workflow sao lưu chạy thật, CI GitHub) ⇒ **bỏ qua**, ghi `⏭ cloud` vào `PROGRESS.md`. File văn bản (`vercel.json`, `.github/workflows/*`, `ops/backup-repo/*`) vẫn **viết**, không chạy. Thay bằng bản local: `pnpm build`, test local, `pnpm db:backup` ra file + khôi phục vào DB tạm, `/api/health?deep=1` trên localhost.

## 1. Khởi tạo (một lần — bỏ qua nếu `CLAUDE.local.md` đã tồn tại)

> Mọi thứ riêng cho máy công ty nằm ở **file chỉ có trên máy này** (`CLAUDE.local.md`, `.claude/settings.local.json`, cấu hình remote cục bộ — đều git-ignore/không theo repo). `CLAUDE.md` và `.claude/settings.json` dùng chung với máy cá nhân: **không sửa chúng để thêm luật công ty.**

1. Khóa push: `git remote set-url --push origin DISABLED_NO_PUSH_AT_COMPANY`; kiểm `git remote -v`.
2. Sao `.claude/company-settings.template.json` → `.claude/settings.local.json` (đã có thì **gộp** `deny`/`allow`/`env`, giữ nội dung cũ). Kiểm lại. Mẫu này cấm lệnh cloud, cho phép sẵn lệnh local (pnpm/npm/node/git cục bộ) để chạy không bị hỏi quyền, và đặt `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5-5`.
3. Tạo `CLAUDE.local.md` (Claude Code tự nạp mỗi phiên, đã git-ignore) với nội dung đúng như sau, để các phiên sau vẫn nhớ luật dù không kéo lại file này:
   ```
   # LOCAL-ONLY (máy công ty) — ưu tiên hơn CLAUDE.md
   Tuân IMPLEMENT_PROMPT.md §0/§2/§3: cấm git push/add/commit và mọi cloud; chỉ DB/dữ liệu local; tra web chỉ để đọc, không đưa mã/dữ liệu/khách vào truy vấn.
   Tự chạy M0→M9 không dừng hỏi: mâu thuẫn/thiếu ⇒ quyết theo §3, ghi CONFIRM.md (thay luật "mâu thuẫn ⇒ DỪNG" của CLAUDE.md; bỏ qua "Commit kiểu…").
   Subagent luôn model:"sonnet", cấm Opus. Tiến độ: PROGRESS.md (đọc đầu phiên).
   ```
4. Không đụng trạng thái git (không add/commit/branch/tag). Vì không có commit làm điểm khôi phục: sửa từng phần nhỏ bằng `Edit`, tránh lệnh hàng loạt dễ mất việc (`rm -rf`, di chuyển/ghi đè cả thư mục).
5. Kiểm môi trường: `node -v` (≥ 22), `pnpm -v` (thiếu ⇒ `corepack enable`), skill `/lucian-uxui:lucian-uxui` (không có ⇒ ghi `⏭` + làm phần không cần Lucian; **không tự dựng lại phần tử từ trí nhớ**).
6. Mẫu Lưu Xá (`D:\THCode\tools\luu_xa_phanxico` hoặc đường dẫn người dùng đã báo): có ⇒ port theo M0; **không có ⇒ viết mới theo spec** (`docs/03-architecture/{security-model,integrity-and-concurrency,api-conventions}.md`, `docs/04-engineering/migrations.md`), không đoán.
7. Ghi kết quả bước 1–6 vào `PROGRESS.md`, rồi **làm tiếp ngay** (không cần chờ lệnh).

## 2. Subagent — BẮT BUỘC dùng Sonnet 5.5 (Opus tốn token)

- Mọi lần gọi `Agent` **phải truyền `model: "sonnet"`** (= Sonnet 5.5, `claude-sonnet-5-5`). **Cấm** `opus` và `fable`; **cấm bỏ trống `model`** (bỏ trống = kế thừa model phiên chính, có thể là Opus). `haiku` chỉ cho tra cứu/grep thuần. Không đặt `effort` cao.
- Chỉ dùng khi (a) tra cứu rộng nhiều file, hoặc (b) lát cắt **độc lập, không chung file** (build-plan §3). Phiên chính giữ quyền: cấp số migration, gộp, chạy test, ghi `PROGRESS.md`/`CONFIRM.md`. Subagent không sửa hai file đó (trả đề xuất để phiên chính ghi).
- Mở đầu lời giao việc: `LOCAL-ONLY: tuân IMPLEMENT_PROMPT.md §0.` + đường dẫn/ID cụ thể + yêu cầu trả kết quả ≤ 15 dòng.

## 3. Mâu thuẫn / thiếu / cần xác nhận — KHÔNG DỪNG

(Chế độ này **thay** luật "docs–code mâu thuẫn ⇒ DỪNG" của CLAUDE.md và "AI hỏi" của build-plan §2.4.)

1. **Ưu tiên nguồn:** `golden-scenarios` (số tiền) > `business-rules` > `state-machines` > `data-model`/`security-model`/`integrity-and-concurrency` > `settings-catalog`/`workflows` > `requirements`/`ux`/`ui-design-system` > còn lại. `customer-feedback-01` thắng mọi file cũ hơn. `99-archive` không bao giờ là căn cứ.
2. **Docs im lặng/mơ hồ:** chọn phương án **an toàn, bảo thủ, dễ đảo ngược**, khớp luật sắt của CLAUDE.md (chặn hơn cho phép; ẩn hơn lộ; bắt nhập lý do hơn để tự do; đưa vào cấu hình `settings-catalog` hơn gõ cứng). Số tiền: chỉ từ golden-scenarios → công thức `costing-and-profit` → nếu vẫn thiếu, chọn cách đơn giản nhất và đánh 🔴.
3. **Sửa docs cho khớp lựa chọn** (kèm mã BR/ADR) để code ≡ docs, không để lệch.
4. **Ghi `CONFIRM.md` ngay lúc quyết** (không gom cuối), ≤ 8 dòng/mục, ID tăng dần `CQ-001…`: mốc · mức (🔴 tiền/kho/quyền/dữ liệu · 🟡 luồng/UI · 🟢 nhỏ) · vấn đề · đã chọn + lý do · phương án khác · nếu đổi thì sửa ở đâu · `☐`.
5. **Q8–Q19** (`customer-feedback-01` §4): dùng mặc định docs đã nêu, không ghi lại; chỉ ghi nếu phát sinh thêm.
6. **Màn ngoài mẫu Glass** (cổng G1b): không chờ duyệt — dựng theo `ui-design-system` §10 từ thành phần sẵn có, ghi 🟡 "màn chưa duyệt".
7. **Bị chặn** (cần cloud, thiếu công cụ, lỗi cùng nguyên nhân > 3 lần): ghi `⏭` vào `PROGRESS.md` (lý do + cách làm lại), **chuyển sang lát cắt độc lập khác**; vòng dọn cuối (§5) thử lại một lần. Chỉ dừng hẳn khi mọi lát cắt còn lại đều bị chặn.
8. **Dừng ngay và báo** chỉ khi: sắp vi phạm §0, hoặc sắp xóa dữ liệu ngoài DB local/`.local/`/thư mục repo.

## 4. Tiết kiệm token (bắt buộc)

- Mở phiên (hoặc sau auto-compact): đọc `PROGRESS.md` là đủ biết đang ở đâu; `CONFIRM.md` chỉ cần khi ghi thêm (xem dòng cuối để lấy số CQ kế). Không đọc lại docs đã nắm; không quét cả `docs/`.
- **KHÔNG đọc:** `docs/99-archive/**`, mẫu `design/ui-preview/` v1–v5, mọi `dist/`. `v6-glass.html` (57 KB) và `shared.js` (65 KB): `Grep` đúng màn/khối rồi `Read` có `offset/limit`.
- Tìm trước, đọc sau: `Grep` ID (`BR-SALE-05`, `SC-12`, tên bảng) → `Read` đoạn nhỏ. Các file lớn (`business-rules`, `golden-scenarios`, `requirements`, `data-model`, `ui-design-system`) chỉ đọc đoạn của lát cắt hiện tại.
- Không `Read` lại file vừa `Edit`; không in lại nội dung vừa ghi. Lệnh nhiều output ⇒ lọc (`| tail -30`, `--silent`). Test **hẹp** theo lát cắt (`pnpm test:api -- --only <bộ>`, một file vitest); chạy toàn bộ chỉ ở cuối mốc.
- Lucian: `search <từ khóa>` → `get <ID>`; không `list` cả 400 phần tử. ID mẫu ở `ui-design-system` §8.2, luôn `search` xác nhận lại.
- Giữa chừng không báo cáo dài: mỗi cuối mốc một dòng trong `PROGRESS.md` là đủ.

## 5. Vòng làm việc liên tục (lát cắt dọc = một `fn_*` + API + màn hình + test)

1. Chọn lát cắt kế từ `PROGRESS.md`. Mục mốc: `Grep "^### M<n>"` trong build-plan rồi đọc đúng mục đó.
2. Đọc **chỉ** thứ lát cắt cần: BR, đoạn bảng ở `data-model`, SC, quyền ở `security-model`; nếu có UI: `ui-design-system` + đúng màn ở `ux-and-navigation` + khối tương ứng của `v6-glass.html`.
3. Thứ tự: test SC/CT/PT → migration (+ `db:audit`) → module máy chủ/route → UI (Glass; phần tử tương tác lấy từ Lucian theo `ui-design-system` §8, ghi sổ §9) → e2e + ảnh 390/1366 + axe → docs/guide/changelog.
4. Xong lát cắt: test hẹp + `pnpm typecheck` → cập nhật `PROGRESS.md` (✔, lệnh thật khác `dev-setup`, `⏭`).
5. **Xong mốc:** test toàn bộ + `fn_consistency_check()` + DoD bản local → đánh `☑` FR → `pnpm version:bump` → ghi `M<n> ✔` vào `PROGRESS.md` → **sang mốc kế ngay, không chờ**.
6. **Vòng dọn cuối (sau M9):** thử lại các `⏭` không-cloud; chạy `pnpm typecheck && pnpm build && pnpm test && pnpm test:api && pnpm test:e2e` và `pnpm docs:check`; chạy `/code-review` + `/security-review` thường (nếu có), sửa lỗi nghiêm trọng. Viết **BÁO CÁO CUỐI** (≤ 40 dòng) vào đầu `PROGRESS.md`: mốc xong/chưa, số CQ theo mức 🔴🟡🟢, danh sách `⏭ cloud` cần làm ở nhà, lệnh chạy demo + tài khoản demo. Rồi dừng, trả lời người dùng ≤ 10 dòng.

## 6. Thứ tự mốc & điểm cần nhớ

M0 (nền + Design System) → M1 → M2 → M3 → M4 → M5a → M5b/M6 → M7 → M8 → M9 (`build-plan` §0). **Bắt đầu từ M0.** Không dựng module đã hoãn (Thu chi, NCC, Đổi trả, Thợ, hoa hồng %, chế độ tối). Phiên bị ngắt (hết token/tắt máy): người dùng chỉ cần nói "tiếp tục" — đọc `PROGRESS.md` và làm tiếp đúng chỗ.

**Mang kết quả về nhà:** người dùng tự chạy `node scripts/handoff/pack-changes.mjs` ở gốc repo (chỉ đọc git, đóng gói mọi thay đổi + file mới vào một file `.mjs`). Bạn chỉ chạy script này khi người dùng yêu cầu; nó là ngoại lệ duy nhất của điều cấm "gói/chuyển mã ra khỏi máy". Tránh tạo file rác ngoài `.gitignore` để gói gọn.
