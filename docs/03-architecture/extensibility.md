# Mở rộng & bảo trì: cách thêm tính năng mới

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · ADR-011, ADR-012
> "Mở rộng" ở đây = **thêm tính năng mới dễ dàng và bảo trì dễ**. Mục tiêu: thêm một tính năng mà **không phải sửa các hàm giao dịch lõi** (`fn_confirm_sale`, `fn_record_payment`…) và không làm hỏng quy tắc tiền/kho.

## 1. Bản đồ module

| Module | Sở hữu bảng | Phụ thuộc (chỉ qua hàm/sự kiện/view) |
|---|---|---|
| `platform` | settings, audit_logs, number_sequences, files, domain_events, notifications, job_runs, error_events, rate_limit_hits, idempotency_keys | — |
| `iam` | users, roles, permissions, role_permissions, user_roles, auth_*, user_mfa, collaborator_profiles | platform |
| `catalog` | brands, watch_models, storage_locations, watch_units, unit_* | platform, iam |
| `parts` | part_categories, parts, part_costs, part_compatibility, part_stock_movements | platform, catalog (tham chiếu thương hiệu/loại) |
| `partners` | customers, customer_groups, customer_watches | platform, iam |
| `payments` | payments (+ view `v_doc_balances`) | platform, iam |
| `purchasing` | purchase_receipts, purchase_lines, purchase_costs | catalog, parts, partners |
| `sales` | reservations, sales, sale_lines, sale_line_costs, sale_trade_ins, warranties, collaborator_assignments(+lines), collaborator_settlements | catalog, parts, partners, payments, purchasing (trade-in), iam |
| `repairs` | service_types, repair_orders, repair_lines, repair_line_costs, repair_status_history | catalog, parts, partners, payments, sales (bảo hành) |
| `inventory` | stocktakes, stocktake_lines | catalog, parts |
| `reports` | (chỉ view/hàm `rpt_*`) | đọc mọi module qua view |

**Quy tắc ranh giới:**
1. Module chỉ **ghi** vào bảng của chính nó. Ghi vào bảng của module khác chỉ qua **hàm công khai của module đó** (`fn_*`) — ví dụ `sales` gọi `fn_confirm_purchase` để tạo phiếu `trade_in`, gọi `fn_record_payment` để ghi thanh toán.
2. Module khác **đọc** qua view/hàm công khai, không `JOIN` tùy tiện vào bảng nội bộ nhạy cảm.
3. Phụ thuộc đi một chiều như bảng trên (không vòng). `reports` chỉ đọc.
4. Mã máy chủ: `src/server/modules/<module>.ts`; route: `src/app/api/v1/<module>/…`; hook: `src/lib/data/<module>.ts`; kiểu: `src/lib/types/<module>.ts`; UI: `src/components/<module>/`, `src/app/(app)/<route>/`.

## 2. Hợp đồng module (mỗi module/tính năng khai đủ)

| Mục | Nơi khai | Ví dụ (module `warranty-claims` giả định) |
|---|---|---|
| Bảng + RLS + grant + audit | `db/migrations/NNNN_*.sql` | `claims`, chính sách theo `claim.view` |
| Hàm `fn_*` nguyên tử | cùng migration | `fn_open_claim`, `fn_close_claim` |
| Quyền | migration seed + `src/lib/permissions.ts` + `security-model` | `claim.view`, `claim.manage` |
| Cài đặt | `settings-catalog` + migration seed | `claim.sla_days` |
| Sự kiện phát ra | `data-model` §16 | `claim.opened` |
| Endpoint | `api-conventions` bản đồ | `/api/v1/claims/*` |
| Màn hình + điều hướng | `ux-and-navigation` + `src/components/layout/nav.ts` (đăng ký mục: đường dẫn, nhãn, biểu tượng, quyền, thứ tự) | `/bao-hanh-yeu-cau` |
| Widget dashboard / báo cáo | `reports-and-dashboard` + đăng ký widget/báo cáo (khóa, quyền) | thẻ "Yêu cầu bảo hành mở" |
| Bước cron (nếu cần) | `src/server/cron/steps/<module>.ts` | nhắc quá hạn |
| Loại thông báo | `notifications` | `claim.overdue` |
| Hướng dẫn sử dụng | `src/content/guide.ts` | mục "Xử lý yêu cầu bảo hành" |
| Test | `scripts/test-api/<module>-*.mjs` (+ CT/PT nếu động tới tiền/kho/quyền) | |
| Cờ tính năng | `ui.disabled_modules` | ẩn/bảo trì được |

## 3. Quy trình thêm tính năng (checklist 10 bước)

1. **Viết ngắn trước**: thêm FR vào `requirements`, BR vào `business-rules`, trạng thái vào `state-machines` (nếu có), mục `data-model`; nếu đụng tiền/kho thì thêm kịch bản vàng `SC-xx` có số.
2. Xác định module sở hữu và phụ thuộc (đúng bảng §1); **không** tạo phụ thuộc vòng.
3. Viết migration (bảng mới đủ RLS/grant/audit/index; hàm `fn_*` nguyên tử; seed quyền/cài đặt) — tương thích ngược.
4. Viết test DB/tích hợp **trước hoặc cùng lúc** (`SC-xx`, và `CT-xx`/`PT-xx` nếu cần).
5. Máy chủ: module `.ts` bọc `fn_*`; route Handlers; Zod; mã lỗi `WF-*` mới.
6. Giao diện: hook SWR, màn hình theo `ux-and-navigation`; đăng ký điều hướng/widget theo quyền.
7. Phát sự kiện `domain_events` ở cuối `fn_*` nếu module khác có thể quan tâm.
8. Cập nhật `docs` (đã làm ở bước 1) + `src/content/guide.ts` + `changelog`.
9. Chạy: `typecheck`, `build`, `test:api` (đầy đủ nếu đụng lõi), `fn_consistency_check()` sạch.
10. Phát hành theo `release-process` (staging → production, migration trước code).

## 4. `domain_events` — cách tích hợp mà không sửa lõi

Bảng outbox `domain_events`. Mọi `fn_*` lõi gọi `app.fn_emit_event(type, payload)` **trong cùng transaction** (nên "đã xác nhận bán" ⇔ "có sự kiện", không bao giờ lệch).

**Xử lý:** `dispatchEvents()` (`src/server/events.ts`) — chạy nền ngay sau mỗi thao tác ghi (`inBackground`) và bởi cron mỗi 10 phút. Lấy sự kiện chưa xử lý bằng `FOR UPDATE SKIP LOCKED`, gọi các handler đã đăng ký cho `type`, đánh dấu `processed_at`; lỗi ⇒ `attempts+1` với lùi dần, quá 10 lần ⇒ `error_events`.

**Đăng ký handler:**
```ts
// src/server/events/handlers/index.ts
export const handlers: Record<string, EventHandler[]> = {
  "part.low_stock": [notifyWarehouse],
  "warranty.expiring": [notifyOwnerAndSales],
  // thêm tích hợp mới = thêm một dòng + một file handler
  // "sale.confirmed": [issueEInvoice],   // hóa đơn điện tử (tương lai)
};
```
Handler phải **idempotent** (sự kiện có thể giao 2 lần) và không được làm thay đổi tiền/kho trực tiếp (nếu cần, gọi `fn_*` công khai với `Idempotency-Key` = `event:<id>`).

## 5. Các điểm cắm đã dành sẵn (ví dụ thêm không đụng lõi)

| Tính năng tương lai | Cách thêm | Đụng lõi? |
|---|---|---|
| **Hóa đơn điện tử** | Bảng `external_invoices(sale_id, provider, external_id, status, payload)`; handler cho `sale.confirmed`/`sale.voided`; trang quản lý trạng thái; cài đặt nhà cung cấp | Không |
| **Thông báo đẩy / email / Zalo** | Handler cho `notifications.created`/sự kiện nghiệp vụ; bảng `notification_outbox` + worker (mẫu Lưu Xá `outbox.ts`) | Không |
| **Webhook ngân hàng** (SePay/Casso) | Route công khai lưu giao dịch (idempotent theo mã), màn hình "Giao dịch chưa khớp" → người dùng bấm *Ghi thanh toán* gọi `fn_record_payment` | Không (mẫu có sẵn ở Lưu Xá) |
| **Kênh bán online** | Bảng `channels` + cột `sales.channel_id` nullable (expand), đồng bộ tồn qua sự kiện; trang web công khai đọc view `v_units_public` | Thêm cột tùy chọn |
| **Ký gửi** | Cột `watch_units.owner_type` (`shop\|consigned`), `consignor_id`; chiếc ký gửi **không** vào giá trị tồn; công nợ chủ hàng khi bán | Có — đổi định nghĩa tồn kho/COGS ⇒ cần ADR + SC mới |
| **Nhiều chi nhánh** | `branch_id` ở kho/giao dịch + RLS theo chi nhánh + chuyển kho | Có — lớn (ADR-011) |
| **AI** | Cổng AI + tác vụ (xem `integrations`) | Không |
| **Báo cáo mới** | Hàm `rpt_*` + đăng ký báo cáo + quyền | Không |
| **Trường tùy biến** | `watch_models.specs jsonb` đã có; thêm thuộc tính mới không cần migration | Không |
| **Thanh toán thẻ/ví** | Thêm giá trị `payments.method` (expand) | Thêm giá trị CHECK |

## 5.1 Quy tắc "có đụng lõi" (cần cẩn trọng gấp đôi)

Thay đổi nào chạm một trong: định nghĩa **tồn kho**, **doanh thu**, **giá vốn**, **trạng thái chiếc**, công thức **còn nợ**, **thanh toán** ⇒ bắt buộc: ADR mới (hoặc cập nhật ADR), cập nhật `glossary`/`business-rules`/`money-and-payments`/`costing`, kịch bản vàng mới, bộ CT/`fn_consistency_check` mở rộng, và review thủ công trước khi phát hành.

## 6. Bảo trì dài hạn

- **Migration tương thích ngược** (expand/contract): thêm cột/bảng/hàm trước → deploy code dùng nó → (giai đoạn sau) bỏ cái cũ. Không đổi tên/xóa cột trong cùng bản phát hành với code dùng nó.
- **Không sửa migration đã áp**; không dùng `DROP … CASCADE` trong migration thường.
- **Phụ thuộc thư viện**: khóa phiên bản (`pnpm-lock.yaml`), cập nhật định kỳ mỗi quý theo kênh riêng (không gộp với tính năng), chạy full test.
- **Tài liệu sống**: DoD bắt buộc cập nhật docs; script `check-docs` (M9) kiểm link, ID tồn tại (FR/BR/SC), `Cập nhật lần cuối` quá 90 ngày.
- **Chủ sở hữu module**: ghi tên người phụ trách ở đầu mỗi `src/server/modules/<module>.ts` (khi có nhiều người).
- **Chi phí dữ liệu lớn**: audit lớn dần — kế hoạch lưu trữ: sau 24 tháng chuyển bản sao `audit_logs` cũ ra tệp nén (giữ bản gốc trong DB cho tới khi quyết định), chứng từ cũ chỉ đọc.

## 7. Bật lại module đã hoãn (sau phản hồi vòng 1)

Các module sau **không xây** ở giai đoạn này (`customer-feedback-01`). Thiết kế đầy đủ ở `docs/99-archive/2026-10-16-full-scope/`. Khi khách cần, thêm lại như **module mới** theo hợp đồng §2 và quy trình §3 — không sửa `fn_confirm_sale` hay `fn_record_payment`, chỉ thêm bảng/hàm/handler:

| Module hoãn | Cách bật lại | Đụng lõi? | Việc cần lưu ý |
|---|---|---|---|
| **Thu chi & quỹ** (`finance`) | Bảng `cash_accounts`, `ledger_entries` (chuỗi băm), `account_transfers`, `expense_categories`, `financial_periods`; handler cho `payment.posted`/`payment.voided` tạo bút toán; backfill: mỗi `payments` `posted` cũ ⇒ một bút toán; số dư đầu kỳ nhập một lần | Không — thêm handler; khóa kỳ cần thêm kiểm tra vào các `fn_*` ghi (mở rộng) | Quyết định ngày bắt đầu sổ; `fn_consistency_check` thêm I-ledger |
| **Nhà cung cấp & công nợ** (`suppliers`) | Bảng `suppliers`; cột `purchase_receipts.supplier_id` nullable (expand) + thanh toán `out` cho phiếu nhập; báo cáo công nợ NCC | Thêm cột tùy chọn | Cần module `finance` nếu muốn trả tiền qua quỹ |
| **Đổi trả** (`returns`) | Bảng `returns`, `return_lines`, `return_line_costs`; `fn_confirm_return` đảo doanh thu/giá vốn theo ngày trả; hoàn tiền = payment `out`; trạng thái chiếc `sold → inspecting` | Có — thêm đường chuyển trạng thái, đổi định nghĩa "đã bán" (trừ đã trả) ⇒ cần ADR + SC mới | Thời hạn trả/điều kiện khách chốt |
| **Thợ & tiền công** (`technicians`) | Hồ sơ thợ (`pay_mode`), phân công `repair_orders.assigned_technician_id`, `repair_tech_pay`; vai trò `technician` | Không (thêm cột/bảng) | Cần mô hình tiền công khách chốt |
| **Hoa hồng %** | Không còn dùng (đã thay bằng mô hình giá thu); nếu cần thêm kiểu CTV khác ⇒ thêm `collaborator_profiles.mode` | Không | |
| **Chế độ tối** | Thêm bộ token tối trong `ui-design-system` §3, công tắc ở Cài đặt | Không | Cần thiết kế/duyệt màu |

Quy tắc chung khi bật lại: bắt đầu bằng **viết lại docs** (FR/BR/state/data-model/golden-scenarios) bằng cách lấy bản trong archive làm gốc, rồi mới code; cập nhật `docs/README` và đánh dấu mốc mới ở `build-plan`.
