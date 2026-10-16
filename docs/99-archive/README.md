# Lưu trữ thiết kế

> **Không cập nhật thư mục này.** Chỉ đọc để tham chiếu.

## `2026-10-16-full-scope/`

Bản sao nguyên văn toàn bộ `docs/` và `CLAUDE.md` **trước** khi áp dụng phản hồi khách vòng 1 (`docs/01-product/customer-feedback-01.md`). Nó chứa thiết kế đầy đủ của các phần khách đã bỏ/hoãn:

| Phần | Nơi xem trong bản lưu trữ |
|---|---|
| Thu chi & quỹ: quỹ, sổ quỹ chuỗi băm, bù trừ, đối chiếu, khóa kỳ | `02-domain/money-and-ledger.md`, `03-architecture/data-model.md` §11, `integrity-and-concurrency.md` |
| Nhà cung cấp & công nợ NCC | `data-model.md` §7–§8, `business-rules.md` (FIN-06, PUR-06) |
| Đổi trả & hoàn tiền | `business-rules.md` (RET), `workflows.md` W6, `golden-scenarios.md` SC-07 |
| Thợ, phân công, tiền công thợ | `business-rules.md` (REP-08), `costing-and-profit.md` §7.2, `workflows.md` W7 |
| Hoa hồng cộng tác viên (%/cố định) | `business-rules.md` (COM), `golden-scenarios.md` SC-12 |
| Chế độ sáng/tối | `01-product/ux-and-navigation.md` |

**Khi nào dùng:** khách yêu cầu bật lại một module đã hoãn → làm theo `docs/03-architecture/extensibility.md` §7: lấy thiết kế ở đây làm gốc, **viết lại** FR/BR/state/data-model/golden-scenarios trong docs hiện hành, rồi mới code. Đừng sao chép nguyên vì ID/tên có thể lệch với docs hiện hành.
