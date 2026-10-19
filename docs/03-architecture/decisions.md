# Nhật ký quyết định kiến trúc (ADR)

> Cập nhật lần cuối: 2026-10-16 · Mỗi ADR: **Trạng thái** (Chấp nhận / Thay thế bởi…), **Bối cảnh → Quyết định → Hệ quả → Phương án đã cân nhắc → Xem lại khi**. Thêm ADR mới ở cuối; không xóa ADR cũ (đánh dấu "Thay thế").

| ADR | Quyết định | Trạng thái |
|---|---|---|
| 001 | Next.js + TypeScript + Tailwind trên Vercel; PostgreSQL trên Supabase | Chấp nhận |
| 002 | Supabase chỉ làm PostgreSQL + Storage; tắt Data API; không dùng Supabase Auth | Chấp nhận |
| 003 | Xác thực tự dựng, port từ Lưu Xá | Chấp nhận |
| 004 | Truy cập DB bằng `pg` qua pooler; `SET LOCAL ROLE wf_app`; ghi nghiệp vụ qua `fn_*` | Chấp nhận |
| 005 | Phân quyền theo permission; RLS; dữ liệu nhạy cảm tách bảng | Chấp nhận |
| 006 | Tiền là `bigint` VND; trạng thái/loại là `text + CHECK` | Chấp nhận |
| 007 | Khóa UUID v7 + mã nghiệp vụ có nghĩa sinh trong transaction | Chấp nhận |
| 008 | Chứng từ `draft → confirmed → voided`; bất biến; đảo thay vì xóa | Chấp nhận |
| 009 | Sổ quỹ append-only có chuỗi băm; doanh thu tính từ chứng từ | **Thay thế bởi ADR-023** (phần sổ quỹ hoãn; nguyên tắc "doanh thu từ chứng từ" giữ) |
| 010 | Giá vốn đích danh cho đồng hồ, bình quân di động cho linh kiện | Chấp nhận |
| 011 | Một cửa hàng; không `branch_id`/multi-tenant | Chấp nhận |
| 012 | Mở rộng bằng module contract + `domain_events` + cờ tính năng | Chấp nhận |
| 013 | PWA mobile-first; không ghi offline tự động; nháp + idempotency | Chấp nhận |
| 014 | Ba môi trường; migration trước code (expand/contract) | Chấp nhận |
| 015 | Sao lưu hai lớp + diễn tập | Chấp nhận |
| 016 | AI tắt mặc định, ngoài đường găng | Chấp nhận |
| 017 | Ngôn ngữ: UI/docs tiếng Việt, code tiếng Anh | Chấp nhận |
| 018 | Vùng Singapore cho cả Vercel và Supabase | Chấp nhận |
| 019 | PDF/Excel sinh phía máy chủ; in qua trình duyệt | Chấp nhận |
| 020 | Đồng hồ chỉ sinh ra từ phiếu nhập | Chấp nhận |
| 021 | Bù trừ không tiền mặt bằng cặp `payments` offset | **Thay thế bởi ADR-023** (không còn offset) |
| 022 | Thu hẹp phạm vi sau phản hồi khách vòng 1: hoãn Thu chi/quỹ, NCC/công nợ, Đổi trả, Thợ; lưu bản đầy đủ ở archive | Chấp nhận |
| 023 | Thanh toán tối giản: `payments` gắn một chứng từ, không quỹ/sổ cái/offset | Chấp nhận |
| 024 | Mô hình CTV: giao hàng + giá thu + hưởng chênh lệch (thay hoa hồng) | Chấp nhận |
| 025 | Bảo hành thay đổi trả | Chấp nhận |
| 026 | Phong cách giao diện **Glass** (v6-glass) là chuẩn; bản sáng trước, token sẵn cho bản tối | Chấp nhận |
| 027 | Thư viện phần tử **Lucian UX/UI** (skill `lucian-uxui`) cho phần tử tương tác; Glass là nguồn sự thật về diện mạo | Chấp nhận |

---

## ADR-001 — Stack
- **Bối cảnh:** Người dùng chọn Next.js + Supabase; xây bằng AI; đội vận hành không chuyên kỹ thuật.
- **Quyết định:** Next.js (App Router) + React + TypeScript strict + Tailwind; deploy Vercel; DB Supabase PostgreSQL.
- **Hệ quả:** Một mã nguồn TS cho giao diện và API; hạ tầng ít thành phần; phụ thuộc Vercel/Supabase (giảm thiểu: DB là PostgreSQL chuẩn, dump/restore được; mã Route Handlers chạy được ở Node bất kỳ).
- **Phương án khác:** NestJS riêng + worker (dự án mẫu từng thiết kế nhưng không xây — phức tạp vận hành không đáng ở quy mô này).
- **Xem lại khi:** cần worker chạy dài/SSE bền hoặc > 1 instance cần pub/sub.

## ADR-002 — Supabase chỉ là Postgres + Storage
- **Bối cảnh:** Cần RLS thật, vai trò DB tự định nghĩa, hàm `SECURITY DEFINER`, và kiểm soát hoàn toàn đường truy cập dữ liệu.
- **Quyết định:** Dùng Supabase làm PostgreSQL managed + Storage. **Tắt Data API (PostgREST)**, thu quyền `anon`/`authenticated`. Không dùng Supabase Auth, Realtime, Edge Functions.
- **Hệ quả:** Bề mặt tấn công nhỏ (chỉ ứng dụng nói chuyện với DB); phải tự lo auth (ADR-003). Không dùng `supabase-js` cho dữ liệu nghiệp vụ.
- **Xem lại khi:** cần Realtime nhiều người dùng đồng thời (khi đó thêm Realtime cho một kênh cụ thể, vẫn không mở PostgREST).

## ADR-003 — Auth tự dựng, port từ Lưu Xá
- **Bối cảnh:** Dự án mẫu có module auth đã kiểm thử (Argon2id, JWT EdDSA, refresh xoay vòng, TOTP, khóa tạm), đồng nhất với mô hình `SET LOCAL ROLE` + RLS.
- **Quyết định:** Copy `src/server/auth/*`, `http.ts`, `db.ts`, `ops.ts` từ `D:\THCode\tools\luu_xa_phanxico`, đổi tiền tố `luuxa_`→`wf_`, tên cookie, tên biến; **kèm port bộ test auth** (`scripts/test-api/auth*.mjs`).
- **Hệ quả:** Nhất quán giữa các dự án; AI sinh code ổn định theo mẫu; bạn tự chịu trách nhiệm bảo mật phần này (giảm thiểu: test + PT-07, xoay khóa định kỳ).
- **Phương án khác:** Supabase Auth (ít code hơn nhưng khác khuôn, cần ghép JWT vào RLS hoặc mở PostgREST).
- **Xem lại khi:** cần đăng nhập mạng xã hội/SSO; hoặc không còn ai bảo trì phần auth.

## ADR-004 — Truy cập DB
- **Quyết định:** `pg` Pool; kết nối bằng `wf_api` (NOINHERIT) qua pooler cổng 6543; mỗi request một transaction: `SET LOCAL ROLE wf_app` + `set_config('app.current_user_id', …, true)`. Không dùng prepared statement đặt tên (pooler transaction mode). Thao tác ghi nghiệp vụ gọi `app.fn_*`. Worker/cron dùng `ctx.dbAs('wf_worker', …)`.
- **Hệ quả:** RLS có hiệu lực thật; tương thích pooler; bắt buộc mọi truy vấn trong transaction có ngữ cảnh.
- **Xem lại khi:** chuyển DB sang nhà cung cấp khác (giữ nguyên mô hình).

## ADR-005 — Phân quyền
- **Quyết định:** Quyền = `permissions` (mã chuỗi); vai trò = tập quyền (dữ liệu); người dùng có nhiều vai trò. RLS + `has_permission`. Giá vốn/lãi/công nợ ở **bảng riêng** có RLS theo quyền. CTV dùng view hẹp.
- **Hệ quả:** Thêm vai trò không cần deploy; cần test ma trận (PT) để chống lệch.
- **Phương án khác:** Ẩn cột bằng view theo vai trò (khó vì quyền động theo người dùng); chỉ kiểm ở API (rủi ro rò khi quên kiểm).

## ADR-006 — Kiểu dữ liệu
- **Quyết định:** Tiền `bigint` VND (`_vnd`); số lượng `integer`; giá vốn bình quân `numeric(14,4)`; thời điểm `timestamptz`; ngày chứng từ `date` (VN); trạng thái `text + CHECK` (không ENUM).
- **Hệ quả:** Không lỗi số thực; đổi tập giá trị trạng thái bằng migration đơn giản.

## ADR-007 — Khóa & mã
- **Quyết định:** `id uuid` v7 (`app.uuid_v7()` do ta viết — Supabase Postgres có thể chưa có `uuidv7()` gốc); mã nghiệp vụ (`DH-000123`, `PN-2026-0001`) cấp bằng `fn_next_number` trong transaction.
- **Hệ quả:** Khóa không đoán được, sắp xếp theo thời gian; mã dễ đọc cho người; mã chứng từ không đứt khi rollback.

## ADR-008 — Vòng đời chứng từ
- **Quyết định:** `draft → confirmed → voided`; xác nhận là bất biến (trigger); sai ⇒ hủy/đổi trả/điều chỉnh; xóa cứng chỉ cho nháp/danh mục chưa dùng.
- **Hệ quả:** Có lịch sử đầy đủ (III.5); cần thiết kế "đảo" cho từng loại chứng từ.

## ADR-009 — Sổ quỹ & doanh thu
- **Quyết định:** `ledger_entries` append-only + chuỗi băm theo quỹ; mỗi `payment` thật ↔ một bút toán. Doanh thu **không** tính từ thanh toán (BR-FIN-04).
- **Hệ quả:** Vay/thu hộ/cọc/hoàn tiền không thể lẫn vào doanh thu; kiểm toàn vẹn hằng đêm.

## ADR-010 — Giá vốn
- **Quyết định:** Đồng hồ **đích danh** (`unit_cost_entries` theo chu kỳ); linh kiện **bình quân gia quyền di động**; giá vốn dòng bán được **chốt** khi bán; phân bổ chi phí theo tỷ lệ giá trị, dư gán dòng lớn nhất.
- **Phương án khác:** FIFO linh kiện (phức tạp, lợi ích nhỏ ở quy mô này).

## ADR-011 — Một cửa hàng
- **Bối cảnh:** "Mở rộng" = thêm tính năng/bảo trì, không phải thêm chi nhánh (xác nhận 2026-10-16).
- **Quyết định:** Không có `branch_id` hay `tenant_id`. Cài đặt cửa hàng là một tập `settings`.
- **Hệ quả:** RLS và truy vấn đơn giản. **Chi phí nếu sau này cần chi nhánh:** thêm cột `branch_id` + backfill + sửa mọi chính sách RLS/báo cáo — việc lớn, nên ghi rõ để quyết định có chủ đích (xem `extensibility` §6).
- **Xem lại khi:** có nhu cầu chi nhánh thật.

## ADR-012 — Cơ chế mở rộng
- **Quyết định:** (1) **Module contract** (mỗi tính năng tự mô tả bảng/hàm/quyền/cài đặt/sự kiện/màn hình/test/docs); (2) **`domain_events` outbox** ghi cùng transaction, handler đăng ký riêng; (3) **cờ tính năng** `ui.disabled_modules` + `feature.*`; (4) migration tương thích ngược; (5) API `/api/v1` có phiên bản.
- **Hệ quả:** Thêm tích hợp (hóa đơn điện tử, push, online) không sửa `fn_confirm_sale`; chỉ thêm handler.

## ADR-013 — Offline/mất mạng
- **Quyết định:** Không POS offline đầy đủ. Có: PWA cài được, shell cache, nháp tự lưu (IndexedDB), biểu ngữ mất mạng, gửi lại với `Idempotency-Key` giữ nguyên.
- **Lý do:** Ghi offline cần đồng bộ/giải quyết xung đột cho kho và tiền — rủi ro sai lệch lớn hơn lợi ích ở quy mô một cửa hàng có mạng.
- **Xem lại khi:** cửa hàng thường xuyên mất mạng thực sự.

## ADR-014 — Môi trường & phát hành
- **Quyết định:** local/staging/production; nhánh `staging`→Preview, `main`→Production; migration áp **trước** code và luôn tương thích ngược (expand/contract); `--dry-run` bắt buộc; tăng phiên bản bắt buộc (build hỏng nếu quên).

## ADR-015 — Sao lưu
- **Quyết định:** Lớp 1: sao lưu của Supabase (Pro, PITR tùy chọn). Lớp 2: `pg_dump` mã hóa hằng đêm qua repo GitHub riêng + diễn tập khôi phục; Storage sao lưu hằng tuần. RPO ≤ 24h, RTO ≤ 4h.

## ADR-016 — AI
- **Quyết định:** Tắt mặc định (`feature.ai.enabled=false`), ngoài đường găng, không quyết định tiền/kho, không nhận PII; qua cổng AI có hạn mức (xem `integrations`).

## ADR-017 — Ngôn ngữ
- **Quyết định:** UI, docs, thông báo lỗi: tiếng Việt. Tên bảng/cột/hàm/biến/route handler: tiếng Anh. Đường dẫn trang: tiếng Việt không dấu (dễ nhớ với người dùng). `glossary` là từ điển bắt buộc.

## ADR-018 — Vùng
- **Quyết định:** Vercel `regions: ["sin1"]` và Supabase `ap-southeast-1` (Singapore) — gần Việt Nam, cùng vùng ⇒ mỗi vòng DB vài ms.

## ADR-019 — In ấn & xuất file
- **Quyết định:** PDF (`pdfmake`) và Excel (`write-excel-file`) sinh **phía máy chủ** để cùng quyền và cùng số liệu; in qua hộp thoại in của trình duyệt (80mm/A5/A4).

## ADR-020 — Chiếc chỉ sinh từ phiếu nhập
- **Quyết định:** Không tạo trực tiếp bản ghi `watch_units`; chỉ `fn_confirm_purchase` sinh chiếc. "Thêm đồng hồ" = nhập nhanh 1 chiếc.
- **Lý do:** Giá vốn luôn có nguồn; tồn kho khớp công nợ; không có chiếc "mồ côi giá vốn".

## ADR-021 — Bù trừ bằng cặp payments
- **Quyết định:** Thu cũ đổi mới, chuyển cọc vào phiếu bán, tịch thu cọc dùng cặp `payments(method='offset')` vào–ra, cùng giao dịch, không bút toán quỹ.
- **Lý do:** Một nguyên liệu tiền duy nhất; công thức công nợ đồng nhất; kiểm bất biến "tổng offset vào = tổng offset ra".

---

## ADR-022 — Thu hẹp phạm vi sau phản hồi khách vòng 1
- **Bối cảnh:** Khách xem bản tóm tắt tính năng (2026-10-16) và yêu cầu bỏ: *Thu chi & quỹ tiền*, *Nhà cung cấp & công nợ*, *Việc của tôi (thợ)*, phân công thợ/nhân công; thay *Đổi trả* bằng *bảo hành*; đổi mô hình CTV (`customer-feedback-01`).
- **Quyết định:** Các phần trên chuyển sang trạng thái **Hoãn**: không xây, không còn trong `requirements`/`business-rules`/`data-model` hiện hành. Thiết kế đầy đủ *trước đợt này* được lưu nguyên ở `docs/99-archive/2026-10-16-full-scope/` (thư mục này không cập nhật nữa). Khi khách cần lại, thêm lại bằng **module mới** theo `extensibility` §7, không sửa lõi.
- **Hệ quả:** Bớt hơn nửa phần DB tài chính (quỹ, sổ cái chuỗi băm, kỳ, bù trừ); bớt module NCC, đổi trả, thợ; docs/test gọn hơn. Đánh đổi: ứng dụng **không biết số dư tiền mặt/ngân hàng, chi phí hoạt động, lãi ròng**; không có công nợ NCC.
- **Xem lại khi:** khách muốn quản lý quỹ/chi phí/lãi ròng hoặc theo dõi nợ nhà cung cấp.

## ADR-023 — Thanh toán tối giản
- **Quyết định:** Bảng `payments` (hướng, mục đích, phương thức tiền mặt/chuyển khoản, số tiền, ngày, **một** chứng từ). Không `cash_accounts`, `ledger_entries`, `payment_allocations`, bù trừ. Còn nợ tính từ dữ liệu (view `v_doc_balances`), không cache. Thu cũ đổi mới và cọc áp vào phiếu bán là *thành phần trừ* của phiếu (`sale_trade_ins`, `reservations.applied_vnd`). Nguyên tắc giữ từ ADR-009: **doanh thu tính từ chứng từ, không từ thanh toán**.
- **Lý do:** Khách không cần quỹ/số dư; gọn hơn → ít lỗi hơn; vẫn đủ trả lời "khách đã trả bao nhiêu cho phiếu nào".
- **Đường nâng cấp:** mỗi `payment` thật ⇒ một bút toán khi bật module tài chính (xem `money-and-payments` §8).

## ADR-024 — Mô hình CTV: giao hàng, giá thu, hưởng chênh lệch
- **Bối cảnh:** "CTV nhận đồng hồ từ chủ, admin báo giá gốc (giá thu), CTV bán được bao nhiêu thì ăn bấy nhiêu, không hoa hồng cố định" (CF-03).
- **Quyết định:** Phiếu giao CTV (`collaborator_assignments`) chuyển chiếc sang `with_collaborator` kèm **giá thu** bất biến. CTV tạo đơn bán nháp với giá bán thực; chủ/nhân viên xác nhận; **doanh thu cửa hàng = giá thu**, **phần CTV hưởng = giá bán − giá thu** (chỉ ở thống kê CTV). Quyết toán ghi nhận CTV nộp giá thu. Cửa hàng không thấy tiền khách trả CTV.
- **Hệ quả:** Trạng thái chiếc mới; RLS theo `held_by_collaborator_id`; báo cáo thống kê CTV; rủi ro tin cậy khai giá bán (xem `security-model` §8).
- **Phương án khác:** hoa hồng % (đã bỏ), ký gửi (CTV mang hàng của họ — ngoài phạm vi).

## ADR-025 — Bảo hành thay đổi trả
- **Quyết định:** Không có luồng trả hàng/hoàn tiền/hoàn kho. Bảo hành tự tạo khi bán và sau sửa; yêu cầu bảo hành = phiếu sửa `warranty_free` liên kết; chi phí linh kiện bảo hành giảm lãi gộp sửa chữa. Hủy phiếu bán (24 giờ) vẫn giữ để sửa nhầm nhập liệu.
- **Hệ quả:** Bỏ `returns*`, `BR-RET-*`, hoàn tiền; thời hạn bảo hành là cấu hình (khách chưa chốt).
- **Xem lại khi:** khách cần hoàn tiền/đổi hàng thật sự.

## ADR-026 — Phong cách giao diện Glass
- **Quyết định:** Khách chọn mẫu `design/ui-preview/v6-glass.html` (kính mờ, gradient sáng, dock nổi với nút "+" giữa; máy tính: sidebar đảo nổi + thanh tiện ích). Token màu/bo góc/đổ bóng/phông (Be Vietnam Pro) trong `ui-design-system`. **Chỉ bản sáng** ở giai đoạn đầu; token tổ chức sao cho thêm bản tối là thay giá trị, không viết lại component.
- **Cập nhật 2026-10-17:** thêm **chế độ tối** theo yêu cầu người dùng (Sáng mặc định / Tối / Theo hệ thống) — chỉ đổi giá trị token, không viết lại component; in luôn bản sáng. Câu "chế độ tối" trong danh mục "không xây" của CLAUDE.md đã lỗi thời (cần chủ dự án xác nhận).
- **Hệ quả:** Mọi màn hình dựng theo hệ thống này; màn chưa có trong mẫu (CTV, bảo hành, sửa chữa gọn…) thiết kế bổ sung theo cùng ngôn ngữ; các màn trong mẫu đã bị loại (Thu chi, Đổi trả…) **không dựng**.

## ADR-027 — Lucian UX/UI cho phần tử tương tác
- **Bối cảnh:** Skill `lucian-uxui` cung cấp thư viện 400+ phần tử UI tự chứa (CSS scoped `.uNNN`, JS không phụ thuộc, token `--ux-*` đã có lớp kính `--ux-glass`), hỗ trợ bàn phím/cảm ứng/giảm chuyển động.
- **Quyết định:** Khi cần một phần tử tương tác (tab phân đoạn, công tắc, nhập số tiền, ô mã 6 số, toast, trạng thái rỗng/lỗi, biểu đồ, wizard, bottom sheet…), **tìm trong thư viện trước** (`search`), lấy đúng phần tử cần (`get`), port theo `references/porting.md` và **ánh xạ token `--ux-*` sang token Glass** — không dùng bản màu gốc. Bố cục trang, dock, thẻ, thanh bên **tự dựng theo Glass**. Giữ dòng chú thích giấy phép MIT đầu mỗi tệp; ghi nhận phần tử đã dùng ở `ui-design-system` §9.
- **Hệ quả:** Giảm công dựng UI/tương tác; rủi ro bên thứ ba (mã được rà trước khi dùng, không phụ thuộc runtime ngoài, CSP không nới).
- **Xem lại khi:** thư viện đổi giấy phép/ngừng cập nhật, hoặc diện mạo phần tử khó khớp Glass.

## ADR-028 — Rút gọn về sáu việc của chủ cửa hàng (vòng 2)
- **Bối cảnh:** Sau khi dùng bản chạy (v0.15.0), chủ cửa hàng nói rõ mục đích: quản lý đồng hồ đang có; ghi lại đơn khi khách mua (*chiếc + khách + giá + ngày*); giao đồng hồ cho CTV bán (một chiếc giao nhiều CTV, ai bán trước được); quản lý đơn sửa chữa (chỉ chủ); báo cáo doanh thu/số lượng/CTV mang về theo ngày-tháng-quý-năm; CTV dùng ở mức giới hạn, không thấy doanh thu (`customer-feedback-02`, CF-10…18).
- **Quyết định:** Bỏ khỏi **giao diện và API** (giữ nguyên bảng/hàm DB — expand/contract, dữ liệu cũ vẫn đọc được): thanh toán/công nợ/QR, giảm giá & hạn mức, thu cũ đổi mới, giữ hàng/cọc, nhập nhiều dòng & chi phí nhập, linh kiện, kiểm kê, giá vốn & lãi gộp, giá thu/quyết toán CTV, màn bảo hành riêng, sửa nội bộ/cọc/linh kiện trong sửa chữa. Thêm: đơn bán gọn (`fn_record_sale`), mô hình CTV mới (ADR-029), sửa chữa gọn, 3 báo cáo.
- **Hệ quả:** Bớt ~ một nửa bề mặt API/UI và test; `sale_line_costs`/`unit_cost_entries` vẫn được ghi nội bộ để giữ bất biến I8 và dữ liệu cũ nhất quán nhưng không API nào trả ra; hàm cũ còn trong DB có thể bật lại theo `extensibility` §7. Đánh đổi: không còn theo dõi tiền/giá vốn/lãi, không còn nợ/cọc.
- **Xem lại khi:** khách cần lại theo dõi công nợ, giá vốn/lãi, hoặc giữ hàng có cọc.

## ADR-029 — Mô hình CTV: chào hàng nhiều người, ai báo bán trước được giữ
- **Bối cảnh:** "Giao thì CTV nào bán trước sẽ được trước, có thể giao một chiếc cho nhiều CTV"; "CTV bán được giá bao nhiêu thì không quan tâm"; "CTV không thấy doanh thu" (CF-10…12). Thay ADR-024.
- **Quyết định:** Giao hàng không đổi trạng thái chiếc (vẫn `in_stock`): bảng `collaborator_offers` (chiếc × CTV) và `collaborator_claims` (CTV báo "đã bán" + tên/SĐT khách, **không giá**). Mỗi chiếc tối đa **một** báo bán `pending` (unique index một phần + khóa chiếc) ⇒ ai báo trước được giữ. Chủ/nhân viên xác nhận (giá mặc định = niêm yết, sửa được) ⇒ tạo đơn bán `confirmed` có `collaborator_id`; các chào hàng khác `lost`. Chiếc rời `in_stock` bằng bất kỳ đường nào ⇒ trigger đóng chào hàng/báo bán. Vai trò CTV chỉ có `collab.view_own` và đọc qua hàm `fn_my_*`.
- **Hệ quả:** Doanh thu cửa hàng = giá chủ xác nhận; không còn giá thu/quyết toán/phần hưởng; bất biến I13–I15; test CT-14, PT-14, SC-18. Rủi ro: chủ phải tin báo bán của CTV (giảm thiểu: tên + SĐT khách bắt buộc để gọi lại, chủ xác nhận từng cái).
- **Phương án khác:** giữ chiếc cho CTV đầu tiên bấm "giữ" (cần trạng thái mới + hết hạn giữ — phức tạp hơn nhu cầu), hoa hồng % (đã bỏ từ vòng 1).
