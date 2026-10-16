# Quy ước API & bản đồ endpoint

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Hợp đồng dữ liệu = schema Zod ở `src/lib/types/*` (dùng chung cho form và API); tài liệu này cố định **quy ước** và **bản đồ**.

## 1. Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Gốc | `/api/v1/<module>/…`; phiên bản đổi khi có thay đổi phá vỡ (giữ `/v1` song song khi ra `/v2`) |
| Định dạng | JSON UTF-8. Tiền: **số nguyên** VND. Ngày: `YYYY-MM-DD` (ngày VN); thời điểm: ISO 8601 UTC. Id: UUID. Trạng thái/loại: chuỗi mã (tiếng Anh), nhãn tiếng Việt do giao diện ánh xạ |
| Xác thực | Cookie `__Host-wf_at` (HttpOnly). Trừ route khai `auth:"public"`. Tài khoản mật khẩu tạm / thiếu MFA bắt buộc: 403 `WF-AUTH-MUST-CHANGE-PASSWORD`/`WF-AUTH-MFA-REQUIRED` cho mọi route ngoài `/auth/*` |
| CSRF | Ghi (`POST/PUT/PATCH/DELETE`): header `X-CSRF-Token` (double-submit) + kiểm `Origin` |
| Idempotency | `Idempotency-Key: <uuid>` bắt buộc cho thao tác xác nhận/hủy/ghi tiền/đổi trạng thái (`integrity-and-concurrency` §5) |
| Khóa lạc quan | `PATCH` nháp/danh mục: `If-Match: <version>`; lệch ⇒ 412 `WF-CONFLICT-VERSION` |
| Phân trang | `?page=1&pageSize=25` (tối đa 100) ⇒ `{ items, page, pageSize, total }`; sắp xếp `?sort=-doc_date,code`; tìm `?q=` (không dấu); lọc theo tên trường |
| Hành động | Tài nguyên + động từ rõ nghĩa: `POST /sales/{id}/confirm`, `POST /sales/{id}/void` (không dùng `PATCH status` tùy ý) |
| GET có ghi | Khai `{ writes: true }` (mặc định GET chạy READ ONLY) |
| Lỗi | RFC 9457 `application/problem+json` (dưới) |
| Giới hạn tốc độ | Theo nhóm (`security-model` §7); vượt ⇒ 429 `WF-RATE-LIMIT` + `Retry-After` |
| Quan sát | `Server-Timing` (db rounds, db ms); `X-Request-Id` (trùng `requestId` trong lỗi, 8 ký tự đầu hiện cho người dùng) |
| Quyền | `api({ perm: "sale.confirm" }, …)` kiểm sớm; DB kiểm lại. Route không khai quyền mặc định yêu cầu đăng nhập |

### 1.1 Cấu trúc lỗi

```json
{
  "type": "https://watchflow.app/errors/WF-SALE-UNIT-UNAVAILABLE",
  "title": "Đồng hồ không còn sẵn sàng bán",
  "status": 409,
  "code": "WF-SALE-UNIT-UNAVAILABLE",
  "detail": "Chiếc DH-000123 vừa được bán cho khách khác. Hãy bỏ chiếc này khỏi phiếu hoặc chọn chiếc khác.",
  "requestId": "3f9a1c2e-…",
  "errors": [{ "path": "lines[0].unitId", "message": "…" }]
}
```
`detail` luôn là tiếng Việt, hướng dẫn việc cần làm; lỗi 5xx chỉ trả câu chung + `requestId` (chi tiết kỹ thuật vào `error_events`, không lộ ra ngoài). Lỗi từ DB (`RAISE` với JSON `{code, vi}`) được ánh xạ nguyên mã `WF-*`; lỗi ràng buộc DB không có mã đi qua `humanize-error.ts`.

### 1.2 Danh mục mã lỗi (rút gọn — nguồn: `src/server/errors.ts`)

| Nhóm | Mã (HTTP) |
|---|---|
| Chung | `WF-AUTH-UNAUTHENTICATED` (401) · `WF-AUTH-FORBIDDEN` (403) · `WF-AUTH-MUST-CHANGE-PASSWORD` (403) · `WF-AUTH-MFA-REQUIRED` (403) · `WF-AUTH-LOCKED` (423) · `WF-VALIDATION` (422) · `WF-NOT-FOUND` (404) · `WF-CONFLICT-VERSION` (412) · `WF-IDEMPOTENCY-MISMATCH` (422) · `WF-RATE-LIMIT` (429) · `WF-BUSY` (409) · `WF-PERIOD-CLOSED` (409) · `WF-REASON-REQUIRED` (422) · `WF-DOC-NOT-DRAFT` (409) |
| Catalog | `WF-UNIT-SERIAL-DUPLICATE` (409) · `WF-UNIT-INVALID-TRANSITION` (409) · `WF-UNIT-PHOTO-REQUIRED` (422) · `WF-UNIT-GRADE-REQUIRED` (422) |
| Nhập hàng & giá vốn | `WF-PUR-OVERPAY` (422) · `WF-PUR-HAS-DEPENDENTS` (409) · `WF-PUR-HAS-PAYMENTS` (409) · `WF-PUR-SELLER-ID-REQUIRED` (422) · `WF-PUR-COST-ALLOCATION` (422) · `WF-COST-NOT-ADJUSTABLE` (409) |
| Bán hàng | `WF-SALE-UNIT-UNAVAILABLE` (409) · `WF-SALE-STOCK-INSUFFICIENT` (409) · `WF-SALE-DISCOUNT-LIMIT` (403) · `WF-SALE-BELOW-COST` (403) · `WF-SALE-CUSTOMER-REQUIRED` (422) · `WF-SALE-OVERPAY` (422) · `WF-SALE-TRADEIN-EXCEEDS` (422) · `WF-SALE-VOID-EXPIRED` (409) · `WF-SALE-VOID-NOT-ALLOWED` (409) |
| Giữ hàng/cọc | `WF-RSV-UNIT-HELD` (409) · `WF-RSV-DEPOSIT-TOO-LOW` (422) · `WF-RSV-NOT-ACTIVE` (409) |
| Đổi trả | `WF-RET-WINDOW-EXPIRED` (403) · `WF-RET-QTY-EXCEEDS` (422) · `WF-RET-REFUND-EXCEEDS` (422) |
| Sửa chữa | `WF-REP-INVALID-STATUS` (409) · `WF-REP-PHOTO-REQUIRED` (422) · `WF-REP-QUOTE-NOT-APPROVED` (409) · `WF-REP-PART-INSUFFICIENT` (409) · `WF-REP-LOCKED` (409) |
| Tài chính | `WF-FIN-NEGATIVE-CASH` (409) · `WF-FIN-ALLOC-EXCEEDS` (422) · `WF-FIN-CHAIN-BROKEN` (500, nghiêm trọng) · `WF-FIN-OPENING-REQUIRED` (409) · `WF-FIN-RECONCILE-REQUIRED` (409) · `WF-PERIOD-NOT-ENDED` (409) |
| Kiểm kê | `WF-INV-STOCKTAKE-CLOSED` (409) |
| Bảo mật | `WF-SEC-LAST-OWNER` (409) · `WF-SEC-PII-REASON` (422) · `WF-SEC-REAUTH` (401, cần xác thực lại) |

Thêm mã mới: thêm vào `errors.ts` (có mô tả tiếng Việt) + bảng này + test; không ném `Error` thường với câu dành cho người dùng.

## 2. Bản đồ endpoint (theo module)

Ký hiệu: **G** đọc · **P** tạo · **U** sửa nháp · **A** hành động (có `Idempotency-Key`). Cột quyền là quyền chính (kiểm thêm theo RLS).

### Auth & tài khoản (`iam`) — `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`
| Method & đường dẫn | Mục đích | Quyền |
|---|---|---|
| P `/auth/login` · P `/auth/logout` · P `/auth/refresh` · G `/auth/me` | Phiên | công khai / đã đăng nhập |
| P `/auth/change-password` · P `/auth/mfa/{setup,verify,disable}` · P `/auth/reauth` | Mật khẩu, TOTP, xác thực lại | đã đăng nhập |
| G `/auth/sessions` · A `/auth/sessions/{id}/revoke` | Phiên đăng nhập | đã đăng nhập |
| G/P/U `/users` · A `/users/{id}/{reset-password,set-status}` · U `/users/{id}/roles` | Người dùng | `user.manage` |
| G/P/U `/roles` · U `/roles/{id}/permissions` · G `/permissions` | Vai trò, quyền | `role.manage` |
| U `/users/{id}/collaborator-profile` · U `/users/{id}/technician-profile` | Hồ sơ CTV/thợ | `user.manage` |

### Nền tảng (`platform`) — `/api/v1/{settings,audit,files,notifications}`
| G/U `/settings` (U theo khóa) | `settings.view`/`settings.manage` |
| G `/audit` | `audit.view` |
| P `/files` (tải ảnh) · G `/files/{id}` (URL ký/proxy) · G `/files/{id}/thumb` | theo thực thể |
| G `/notifications` · A `/notifications/{id}/read`, `/read-all` | đã đăng nhập |
| G `/health` · G `/health?deep=1` · G `/system/status` | công khai / `system.health` |

### Catalog — `/api/v1/catalog`
| G/P/U `/brands` · G/P/U `/models` · G `/models/{id}` | `catalog.view` / `catalog.manage` |
| G `/units` (lọc trạng thái, loại, vị trí, tình trạng, `q`) · G `/units/{id}` · U `/units/{id}` (phi tài chính) | `catalog.view` |
| G `/units/collab` · G `/units/collab/{id}` | `catalog.view_collab` |
| G `/units/{id}/{history,price-history,movements,cost}` (cost cần `cost.view`) | |
| A `/units/{id}/price` (`unit.price.edit`) · A `/units/{id}/move` (`location.manage`) · A `/units/{id}/release` (`unit.release`) · A `/units/{id}/writeoff`, `/restore` (`stock.writeoff`) | |
| G `/units/lookup?code=` (mã nội bộ/serial/QR → chiếc) | `catalog.view` |
| G/P/U `/locations` | `location.manage` |
| G `/units/{id}/label` (PDF tem QR) | `catalog.view` |

### Linh kiện (`parts`) — `/api/v1/parts`
| G/P/U `/parts` · G `/parts/{id}` · G `/parts/{id}/movements` · A `/parts/{id}/adjust` · G/P/U `/part-categories` | `part.view` / `part.manage` / `part.stock.adjust` |

### Đối tác (`partners`) — `/api/v1/{customers,suppliers}`
| G/P/U `/customers` · G `/customers/{id}` (+ `/history`, `/debt`) · A `/customers/{id}/reveal-id` (lý do) · A `/customers/{id}/anonymize` · G/P/U `/customer-groups` | `customer.*` |
| G/P/U `/suppliers` · G `/suppliers/{id}` (+ `/history`, `/debt`) | `supplier.*` |
| G/P `/customers/{id}/watches` | |

### Nhập hàng (`purchasing`) — `/api/v1/purchases`
| G `/purchases` · P `/purchases` (nháp) · U `/purchases/{id}` · DELETE nháp | `purchase.view`/`create` |
| A `/purchases/{id}/confirm` · A `/purchases/{id}/void` | `purchase.confirm` / `purchase.void` |
| P `/purchases/{id}/costs` · P `/purchases/{id}/pay` (phiếu chi trả NCC) | `purchase.create` / `payment.pay` |
| A `/units/{id}/cost-adjust` | `cost.adjust` |
| G `/purchases/{id}/pdf` · G `/purchases/export` | `purchase.view` + `report.export` |

### Bán hàng (`sales`) — `/api/v1/{sales,reservations,returns,commissions,warranties}`
| G `/sales` · P `/sales` (nháp) · U `/sales/{id}` · DELETE nháp | `sale.view`/`sale.view_own`/`sale.create_draft` |
| A `/sales/{id}/confirm` · A `/sales/{id}/void` · P `/sales/{id}/payments` (thu thêm) · G `/sales/{id}/pdf` | `sale.confirm` · `sale.void` · `payment.create` |
| G `/sales/quote` (tính trước tổng, giảm giá, tiền thừa; không ghi) | `sale.create_draft` |
| G/P `/reservations` · A `/reservations/{id}/{convert,refund,forfeit}` | `reservation.manage` / `reservation.forfeit` |
| G/P `/returns` · A `/returns/{id}/confirm` · G `/returns/{id}/pdf` | `return.create` / `return.confirm` |
| G `/commissions` · A `/commissions/pay` · G `/commissions/mine` | `commission.view`/`manage` / `view_own` |
| G `/warranties` (lọc sắp hết hạn) | `sale.view` |

### Sửa chữa (`repairs`) — `/api/v1/repairs`
| G `/repairs` (lọc trạng thái, thợ, "của tôi") · P `/repairs` (nhận máy) · G `/repairs/{id}` | `repair.view`/`repair.view_assigned`/`repair.create` |
| U `/repairs/{id}` (nháp thông tin) · P/U/DELETE `/repairs/{id}/lines` | `repair.update` |
| A `/repairs/{id}/status` · A `/repairs/{id}/approve-quote` · A `/repairs/{id}/assign` | `repair.update` / `repair.approve_quote` / `repair.assign` |
| A `/repairs/{id}/lines/{lineId}/consume` (xác nhận dùng linh kiện) | `repair.update` |
| A `/repairs/{id}/complete` · A `/repairs/{id}/deliver` · A `/repairs/{id}/cancel` | `repair.update` / `repair.deliver` |
| P `/repairs/{id}/photos` · G `/repairs/{id}/pdf?type=intake\|delivery` | |
| G/P/U `/service-types` · G `/repairs/by-serial?serial=` | |
| G `/technicians/pay` · A `/technicians/pay/pay` | `techpay.view` / `payment.pay` |

### Tài chính (`finance`) — `/api/v1/finance`
| G `/accounts` · P/U `/accounts` · A `/accounts/{id}/opening` | `finance.view` / `account.manage` |
| G `/ledger?account=` · G `/ledger/verify` | `finance.view` |
| G `/payments` · P `/payments` (thu: `payment.create`; chi: `payment.pay`) · A `/payments/{id}/void` | |
| P `/payments/collect-debt` (thu nợ, phân bổ nhiều phiếu) · P `/payments/pay-supplier` | `payment.create` / `payment.pay` |
| A `/transfers` · A `/ledger/adjust` | `payment.pay` / `ledger.adjust` |
| G/P/U `/expense-categories` | `account.manage` |
| G `/periods` · A `/periods/{month}/{reconcile,close,reopen}` | `period.close`/`period.reopen` |
| G `/debts/customers` · G `/debts/suppliers` | `debt.view` / `debt.view_supplier` |
| G `/day-close?date=` | `finance.view` |

### Kiểm kê (`inventory`) — `/api/v1/stocktakes`
| G/P `/stocktakes` · P `/stocktakes/{id}/lines` · A `/stocktakes/{id}/{reconcile,cancel}` | `stocktake.manage` |

### Báo cáo (`reports`) — `/api/v1/reports`
| G `/reports/dashboard` | đã đăng nhập (khóa trả về theo quyền) |
| G `/reports/{revenue,profit,purchases,stock,aging,debts,repairs,cashflow,commission,shrinkage,warranty}` + `?format=json\|xlsx\|pdf` | theo từng báo cáo (`reports-and-dashboard`) |

### Cron & vận hành — `/api/cron/*`, `/api/v1/public/ops-heartbeat`
Chỉ gọi bởi Vercel Cron (Bearer `CRON_SECRET`) hoặc repo sao lưu (heartbeat, `OPS_HEARTBEAT_SECRET`).

## 3. Hợp đồng dữ liệu & kiểu

- Schema Zod ở `src/lib/types/<module>.ts` (request/response); hook SWR ở `src/lib/data/<module>.ts` dùng đúng kiểu đó.
- Đối tượng trả về **không bao giờ** chứa trường người gọi không có quyền: máy chủ dựng DTO từ view/hàm đã lọc quyền, không "xóa trường ở client".
- Thay đổi phá vỡ DTO ⇒ tăng phiên bản API hoặc thêm trường mới + giữ trường cũ một giai đoạn (expand/contract).
