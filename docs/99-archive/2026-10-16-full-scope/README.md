# Bản đồ tài liệu WatchFlow

> Phiên bản bộ docs: **v0.1 — 2026-10-16** (giai đoạn thiết kế). Tài liệu là **nguồn sự thật**; mã nguồn bám theo. Mâu thuẫn ⇒ dừng và hỏi (xem `CLAUDE.md`).

## Cách đọc

| Bạn là | Đọc theo thứ tự |
|---|---|
| Chủ cửa hàng / người ra quyết định | `01-product/vision-scope` → `01-product/requirements` → `01-product/ux-and-navigation` → `06-quality/uat-acceptance` |
| AI/dev bắt đầu code | `CLAUDE.md` → `04-engineering/build-plan` → (module cần làm) `02-domain/*` → `03-architecture/data-model` + `integrity-and-concurrency` → `04-engineering/migrations` |
| Người kiểm thử / kiểm định | `02-domain/business-rules` → `06-quality/golden-scenarios` → `06-quality/test-plan` |
| Người vận hành | `05-operations/runbook` → `05-operations/backup-restore` |

## Danh mục

| # | Tài liệu | Nội dung | Trạng thái |
|---|---|---|---|
| 01 | [vision-scope](01-product/vision-scope.md) | Mục tiêu, phạm vi, **quyết định đã chốt**, giả định, câu hỏi mở | Duyệt |
| 01 | [requirements](01-product/requirements.md) | Toàn bộ yêu cầu chức năng đánh số FR-xxx, gắn module/mốc/BR/test | Duyệt |
| 01 | [WatchFlow_Xac-nhan-tinh-nang.xlsx](01-product/WatchFlow_Xac-nhan-tinh-nang.xlsx) | **Bản dành cho khách xác nhận**: tóm tắt theo 20 màn hình + 177 tính năng bằng ngôn ngữ đời thường, quy tắc đề xuất, phân quyền, ví dụ tính tiền, câu hỏi mở. Khách trả lời xong ⇒ cập nhật `requirements`/`business-rules` theo ý kiến | Gửi khách |
| 01 | [ux-and-navigation](01-product/ux-and-navigation.md) | Vai trò & thiết bị, sơ đồ trang, nguyên tắc dễ dùng, màn hình chính | Nháp |
| 02 | [glossary](02-domain/glossary.md) | Thuật ngữ VN↔EN, định nghĩa chính xác (doanh thu, thực thu, tồn kho…) | Duyệt |
| 02 | [business-rules](02-domain/business-rules.md) | **Quy tắc nghiệp vụ BR-xxx** (nguồn sự thật nghiệp vụ) | Duyệt |
| 02 | [state-machines](02-domain/state-machines.md) | Trạng thái & chuyển trạng thái: đồng hồ, chứng từ, giữ hàng, sửa chữa… | Duyệt |
| 02 | [money-and-ledger](02-domain/money-and-ledger.md) | Thanh toán, cọc, công nợ, thu cũ đổi mới, sổ quỹ, khóa kỳ | Duyệt |
| 02 | [costing-and-profit](02-domain/costing-and-profit.md) | Giá vốn, phân bổ chi phí, làm tròn, lãi gộp, tiền công thợ | Duyệt |
| 02 | [workflows](02-domain/workflows.md) | Quy trình từng bước + hiệu ứng hệ thống + ngoại lệ | Duyệt |
| 02 | [settings-catalog](02-domain/settings-catalog.md) | Tham số cấu hình & giá trị mặc định | Duyệt |
| 02 | [reports-and-dashboard](02-domain/reports-and-dashboard.md) | Định nghĩa từng báo cáo & widget tổng quan | Duyệt |
| 03 | [overview](03-architecture/overview.md) | Kiến trúc tổng thể, môi trường, luồng request, cấu trúc thư mục | Duyệt |
| 03 | [decisions](03-architecture/decisions.md) | Nhật ký quyết định kiến trúc (ADR-001…) | Duyệt |
| 03 | [security-model](03-architecture/security-model.md) | Danh mục quyền, ma trận vai trò, RLS, PII, phiên | Duyệt |
| 03 | [data-model](03-architecture/data-model.md) | ERD + từ điển bảng/cột/ràng buộc | Duyệt |
| 03 | [integrity-and-concurrency](03-architecture/integrity-and-concurrency.md) | Khóa, thứ tự khóa, chống bán trùng, idempotency, kiểm toàn vẹn | Duyệt |
| 03 | [api-conventions](03-architecture/api-conventions.md) | Quy ước API, mã lỗi, bản đồ endpoint | Duyệt |
| 03 | [extensibility](03-architecture/extensibility.md) | **Cách thêm tính năng mới** (module contract, sự kiện, cờ tính năng) | Duyệt |
| 03 | [integrations](03-architecture/integrations.md) | In ấn, mã QR, Excel/PDF, hóa đơn điện tử, thông báo, AI | Nháp |
| 04 | [dev-setup](04-engineering/dev-setup.md) | Dựng môi trường local, biến môi trường | Duyệt |
| 04 | [conventions](04-engineering/conventions.md) | Quy ước mã nguồn, đặt tên, UI | Duyệt |
| 04 | [migrations](04-engineering/migrations.md) | Quy tắc & mẫu migration, vai trò DB | Duyệt |
| 04 | [testing-strategy](04-engineering/testing-strategy.md) | Chiến lược & công cụ kiểm thử | Duyệt |
| 04 | [release-process](04-engineering/release-process.md) | Phát hành, phiên bản, CI/CD | Duyệt |
| 04 | [build-plan](04-engineering/build-plan.md) | **Kế hoạch xây dựng M0…M9** cho AI coding | Duyệt |
| 05 | [runbook](05-operations/runbook.md) | Vận hành, giám sát, sự cố, khóa/bí mật, bàn giao | Duyệt |
| 05 | [backup-restore](05-operations/backup-restore.md) | Sao lưu hai lớp, khôi phục, diễn tập | Duyệt |
| 06 | [golden-scenarios](06-quality/golden-scenarios.md) | **Kịch bản vàng** có số liệu (SC-xx) | Duyệt |
| 06 | [test-plan](06-quality/test-plan.md) | Kế hoạch test, ca đồng thời (CT), phân quyền (PT), ma trận truy vết | Duyệt |
| 06 | [uat-acceptance](06-quality/uat-acceptance.md) | Nghiệm thu & checklist go-live | Duyệt |
| 07 | [user-guide](07-user-guide/README.md) | Dàn bài hướng dẫn sử dụng theo vai trò | Nháp |

## Quy ước ID (dùng trong docs, commit, test)

| Tiền tố | Ý nghĩa | Nơi định nghĩa |
|---|---|---|
| `FR-<NHÓM>-nn` | Yêu cầu chức năng | requirements |
| `BR-<NHÓM>-nn` | Quy tắc nghiệp vụ | business-rules |
| `ADR-nnn` | Quyết định kiến trúc | decisions |
| `SC-nn` | Kịch bản vàng (có số liệu) | golden-scenarios |
| `CT-nn` | Ca kiểm thử đồng thời | test-plan |
| `PT-nn` | Ca kiểm thử phân quyền | test-plan |
| `UAT-nn` | Ca nghiệm thu | uat-acceptance |
| `M0…M9` | Mốc xây dựng | build-plan |
| `WF-<MODULE>-<LỖI>` | Mã lỗi hiển thị cho người dùng | api-conventions |

Chuỗi truy vết: **FR → BR → (ADR) → bảng/hàm DB → API → màn hình → SC/CT/PT/UAT**. PR nào đổi hành vi ghi rõ ID trong mô tả.

## Quy tắc giữ docs không lệch

1. Mỗi sự thật nằm **một chỗ**: quy tắc ở `business-rules`, tham số ở `settings-catalog`, quyền ở `security-model`, bảng ở `data-model`. Nơi khác chỉ **trỏ tới** bằng ID.
2. Đầu mỗi file có dòng `Cập nhật lần cuối` — đổi hành vi thì đổi dòng này. Quá 90 ngày không cập nhật ⇒ rà lại.
3. Cái gì sinh được thì sinh, đừng gõ tay: từ điển cột (từ DB), ma trận quyền (từ seed), hướng dẫn sử dụng (từ `src/content/guide.ts`), changelog (từ code), danh mục lỗi (từ `src/server/errors.ts`). Script sinh/kiểm nằm ở `scripts/docs/`: `check-docs.mjs` có bản đầu từ M0 (kiểm link, ID FR/BR/SC/CT/PT/UAT có định nghĩa, mọi BR được `requirements` trỏ tới), các script sinh còn lại hoàn thiện ở M9.
4. Định nghĩa hoàn thành (`CLAUDE.md`) bắt buộc cập nhật docs; PR thiếu docs không được gộp.
5. Tài liệu chỉ ghi **tên** biến môi trường, không bao giờ ghi giá trị bí mật.
