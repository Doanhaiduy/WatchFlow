# Quy ước API & bản đồ endpoint

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-02` — bản đồ endpoint **§2.0 là hiện hành**, các mục sau đó đánh dấu ⏸ là đóng băng/đã gỡ) · Hợp đồng dữ liệu = schema Zod ở `src/lib/types/*` (dùng chung cho form và API); tài liệu này cố định **quy ước** và **bản đồ**.

## 1. Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Gốc | `/api/v1/<module>/…`; phiên bản đổi khi có thay đổi phá vỡ (giữ `/v1` song song khi ra `/v2`) |
| Định dạng | JSON UTF-8. Tiền: **số nguyên** VND. Ngày: `YYYY-MM-DD` (ngày VN); thời điểm: ISO 8601 UTC. Id: UUID. Trạng thái/loại: chuỗi mã (tiếng Anh), nhãn tiếng Việt do giao diện ánh xạ |
| Xác thực | Cookie `__Host-wf_at` (HttpOnly). Trừ route khai `auth:"public"`. Tài khoản mật khẩu tạm / thiếu MFA bắt buộc: 403 `WF-AUTH-MUST-CHANGE-PASSWORD`/`WF-AUTH-MFA-REQUIRED` cho mọi route ngoài `/auth/*` |
| CSRF | Ghi (`POST/PUT/PATCH/DELETE`): header `X-CSRF-Token` (double-submit) + kiểm `Origin` |
| Idempotency | `Idempotency-Key: <uuid>` bắt buộc cho thao tác xác nhận/hủy/ghi thanh toán/đổi trạng thái (`integrity-and-concurrency` §5) |
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
| Thông báo đẩy | `WF-PUSH-DISABLED` (503, thiếu khóa VAPID) · `WF-PUSH-NO-DEVICE` (409, chưa có thiết bị bật khi "Gửi thử") — API `/api/v1/me/push-config` (GET, PUT), `/api/v1/me/push-subscriptions` (POST, DELETE), `/api/v1/me/push-subscriptions/test` (POST) |
| Chung | `WF-AUTH-UNAUTHENTICATED` (401) · `WF-AUTH-FORBIDDEN` (403) · `WF-AUTH-MUST-CHANGE-PASSWORD` (403) · `WF-AUTH-MFA-REQUIRED` (403) · `WF-AUTH-LOCKED` (423) · `WF-VALIDATION` (422) · `WF-NOT-FOUND` (404) · `WF-CONFLICT-VERSION` (412) · `WF-IDEMPOTENCY-MISMATCH` (422) · `WF-RATE-LIMIT` (429) · `WF-BUSY` (409) · `WF-REASON-REQUIRED` (422) · `WF-DOC-NOT-DRAFT` (409) · `WF-DOC-BACKDATE` (422) |
| Catalog | `WF-UNIT-SERIAL-DUPLICATE` (409) · `WF-UNIT-INVALID-TRANSITION` (409) · `WF-UNIT-PHOTO-REQUIRED` (422) · `WF-UNIT-GRADE-REQUIRED` (422) |
| Nhập hàng & giá vốn ⏸ (chỉ `WF-PUR-HAS-DEPENDENTS`, `WF-UNIT-SERIAL-DUPLICATE` còn gặp qua "Thêm đồng hồ") | `WF-PUR-HAS-DEPENDENTS` (409) · `WF-PUR-SELLER-ID-REQUIRED` (422) · `WF-PUR-COST-ALLOCATION` (422) · `WF-COST-NOT-ADJUSTABLE` (409) |
| Bán hàng (gọn) | `WF-SALE-UNIT-UNAVAILABLE` (409) · `WF-SALE-UNIT-CLAIMED` (409, chiếc có CTV báo bán chờ xác nhận) · `WF-SALE-CUSTOMER-REQUIRED` (422) · `WF-SALE-VOID-EXPIRED` (409) · `WF-SALE-VOID-NOT-ALLOWED` (409) |
| Bán hàng ⏸ | `WF-SALE-UNIT-UNAVAILABLE` (409) · `WF-SALE-STOCK-INSUFFICIENT` (409) · `WF-SALE-DISCOUNT-LIMIT` (403) · `WF-SALE-BELOW-COST` (403) · `WF-SALE-CUSTOMER-REQUIRED` (422) · `WF-SALE-TRADEIN-EXCEEDS` (422) · `WF-SALE-VOID-EXPIRED` (409) · `WF-SALE-VOID-NOT-ALLOWED` (409) |
| Thanh toán ⏸ | `WF-PAY-OVERPAY` (422) · `WF-PAY-DOC-INVALID` (422) · `WF-PAY-VOIDED` (409) |
| Giữ hàng/cọc ⏸ | `WF-RSV-UNIT-HELD` (409) · `WF-RSV-DEPOSIT-TOO-LOW` (422) · `WF-RSV-NOT-ACTIVE` (409) · `WF-RSV-SETTLE-MISMATCH` (422) |
| Bảo hành | `WF-WAR-NOT-FOUND` (404) · `WF-WAR-EXPIRED` (409 — chỉ khi cố mở phiếu `warranty_free` quá hạn) |
| Cộng tác viên (mới) | `WF-COL-UNIT-NOT-OFFERABLE` (409, chiếc không ở "Sẵn sàng bán") · `WF-COL-NO-OFFER` (409, chiếc không giao cho bạn / đã bán) · `WF-COL-UNIT-GONE` (409) · `WF-COL-CLAIMED` (409, CTV khác báo bán trước) · `WF-COL-CLAIMED-SELF` (409, bạn đã báo rồi) · `WF-COL-CLAIM-PENDING` (409, đang có báo bán chờ ⇒ không thu hồi) · `WF-COL-CLAIM-DECIDED` (409, báo bán đã xử lý) |
| Cộng tác viên ⏸ | `WF-COL-UNIT-NOT-HELD` (409) · `WF-COL-UNIT-ASSIGNED` (409) · `WF-COL-PRICE-REQUIRED` (422) · `WF-COL-ALREADY-SETTLED` (409) · `WF-COL-HAS-SOLD` (409) · `WF-COL-NOT-OWN` (403) |
| Sửa chữa | `WF-REP-INVALID-STATUS` (409) · `WF-REP-QUOTE-NOT-APPROVED` (409) · `WF-REP-PART-INSUFFICIENT` (409) · `WF-REP-LOCKED` (409) |
| Kiểm kê | `WF-INV-STOCKTAKE-CLOSED` (409) |
| Bảo mật | `WF-SEC-LAST-OWNER` (409) · `WF-SEC-PII-REASON` (422) · `WF-SEC-REAUTH` (401, cần xác thực lại) |

**Bổ sung khi triển khai (2026-10-17):** `WF-AUTH-INVALID` (401, sai email/mật khẩu — header `X-Attempts-Left` khi còn ≤ 3) · `WF-AUTH-CSRF` (403) · `WF-AUTH-MFA-INVALID` (401) · `WF-IDEMPOTENCY-REQUIRED` (428) · `WF-CONFLICT` (409, trùng/tham chiếu) · `WF-DOC-FUTURE` (422) · `WF-IMMUTABLE` (409, dữ liệu chỉ đổi qua nghiệp vụ) · `WF-USER-EMAIL-DUPLICATE` (409) · `WF-PASSWORD-WEAK` (422) · `WF-FILE-INVALID` (422) · `WF-FILE-TOO-LARGE` (413) · `WF-CUS-PHONE-DUPLICATE` (409, gửi lại `force=true` để vẫn tạo) · `WF-INTERNAL` (500).

Thêm mã mới: thêm vào `errors.ts` (có mô tả tiếng Việt) + bảng này + test; không ném `Error` thường với câu dành cho người dùng. Mã đã hoãn (`WF-FIN-*`, `WF-RET-*`, `WF-PERIOD-*`, `WF-PUR-OVERPAY/HAS-PAYMENTS`, `WF-REP-PHOTO-REQUIRED`) ở archive.

## 2. Bản đồ endpoint (theo module)

Ký hiệu: **G** đọc · **P** tạo · **U** sửa · **A** hành động (có `Idempotency-Key`). Cột quyền là quyền chính (kiểm thêm theo RLS).

### 2.0 Hiện hành (customer-feedback-02) — tóm tắt endpoint của sáu việc

| Việc | Endpoint | Quyền |
|---|---|---|
| Kho đồng hồ | G/U `/catalog/units`, `/catalog/units/{id}` · A `…/{price,move,release,writeoff,restore,identity}` · G `…/{history,label}` · G `/catalog/units/lookup?code=` · G/P/U `/catalog/{brands,models,locations}` · **P `/purchases/quick`** ("Thêm đồng hồ", `Idempotency-Key` bắt buộc) | `catalog.*`, `unit.*`, `purchase.create` |
| Ghi đơn bán | **G/P `/sales`** (`P`: `{customerId \| customer:{fullName,phone?}, docDate?, note?, lines:[{unitId, price, warrantyMonths?}]}` ⇒ `{id,code,grandTotal,units}`; `G`: `q`, `status`, `channel=shop\|collab`, `from`, `to`) · G `/sales/{id}` · A `/sales/{id}/void` (lý do + reauth) · A `/sales/{id}/print` | `sale.view` · `sale.confirm` · `sale.void` |
| Khách | G/P `/customers`, G/U `/customers/{id}`, G/P `/customers/{id}/watches` | `customer.*` |
| Giao CTV (chủ) | **G/P `/collab/offers`** (`P`: `{unitIds, collaboratorIds, note?}`) · **A `/collab/offers/withdraw`** (`{unitId, collaboratorId?}`) · **G `/collab/claims?status=pending\|decided\|all`** · **A `/collab/claims/{id}/confirm`** (`{price?, docDate?, warrantyMonths?}`) · **A `/collab/claims/{id}/reject`** (`{reason}`) · G `/collaborators` · G/U `/collaborators/{id}` (hồ sơ) · G `/reports/collaborators` | `collab.view`/`collab.manage`/`sale.confirm` |
| CTV (giới hạn) | **G `/collab/me/units`** · **G/P `/collab/me/claims`** (`P`: `{unitId, customerName, customerPhone, note?}`) · **A `/collab/me/claims/{id}/cancel`** · **G `/collab/me/stats?period=day\|month\|quarter\|year`** (chỉ số chiếc) | `collab.view_own` |
| Sửa chữa (chủ) | G/P `/repairs` (`P`: `{customerId \| customer:{fullName,phone}, customerWatchId?, brandText?, modelText?, serialNo?, intakeCondition?, complaint, expectedDate?, warrantyId?}`) · G/U `/repairs/{id}` · P `/repairs/{id}/lines` · U/DELETE `/repairs/{id}/lines/{lineId}` · A `/repairs/{id}/{status,complete,deliver,cancel}` · G `/warranties?customerId=` (bảo hành còn hạn để chọn khi nhận máy) · G `/service-types` · ảnh nhận máy: P `/files` (`entityTable=repair_orders`) | `repair.*` |
| Báo cáo | G `/reports/dashboard` · **G `/reports/{revenue,units,collab}?from&to&group=day\|month\|quarter\|year&format=json\|xlsx`** | theo từng báo cáo |
| Nhập Excel | P `/import/{customers,watches}/{preview,commit}` · G `/import/{kind}/template` | xem §Nhập Excel |
| Khác | G `/store-info` (thông tin cửa hàng để in) · G `/search?q=` · G `/me/badges` · G/A `/notifications` | đã đăng nhập |

**Đã gỡ (trả 404):** `/purchases` (danh sách/nháp/xác nhận/hủy/xuất), `/purchases/sources`, `/parts*`, `/part-categories`, `/stocktakes*`, `/reservations*`, `/payments*`, `/sales/{id}/{confirm,payments,pdf}`, `/sales/quote`, `/assignments*`, `/settlements*`, `/collaborators/{id}/{assignments,settlements,return}`, `/catalog/units/{id}/{cost,cost-adjust}`, `/customers/{id}/{reveal-id,anonymize}`, `/technicians`, `/warranties/{id}/open-repair`, `/collab/me/sales`, và các báo cáo `profit, purchases, moves, stock, aging, open-balances, repairs, collections, shrinkage, warranty`.

Các mục dưới đây là bản đồ **vòng 1** (đã triển khai M0–M8) — chỉ còn đúng với những endpoint nêu ở bảng trên; phần còn lại ⏸ đóng băng/đã gỡ.

### Auth & tài khoản (`iam`) — `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`
| Method & đường dẫn | Mục đích | Quyền |
|---|---|---|
| P `/auth/login` · P `/auth/logout` · P `/auth/refresh` · G `/auth/me` | Phiên | công khai / đã đăng nhập |
| P `/auth/change-password` · P `/auth/mfa/{setup,verify,disable}` · P `/auth/reauth` | Mật khẩu, TOTP, xác thực lại | đã đăng nhập |
| G `/auth/sessions` · A `/auth/sessions/{id}/revoke` | Phiên đăng nhập | đã đăng nhập |
| P `/auth/mfa/verify` nhận thêm `trustDevice?: boolean` (chỉ hiệu lực khi 2FA đã bật từ trước và `security.trusted_device_days > 0`) ⇒ phản hồi `{ok, recoveryCodes, trusted}` + `Set-Cookie` thiết bị tin cậy (`__Secure-wf_td`, HttpOnly, SameSite=Strict, Path=/api/v1/auth, token 256-bit); P `/auth/login` phản hồi thêm `trustedDevice` (true ⇒ đã bỏ bước mã nhờ cookie, `mfaPending=false`) | Tin cậy thiết bị (BR-SEC-10) | đã đăng nhập / công khai |
| G `/auth/trusted-devices` (`{days, items:[{id,label,createdAt,lastUsedAt,expiresAt,current}]}` — không lộ token/băm) · D `/auth/trusted-devices` (quên tất cả + gỡ cookie) · D `/auth/trusted-devices/{id}` (bỏ một thiết bị; 404 nếu không phải của mình/đã thu hồi) | Thiết bị tin cậy của **chính mình** | đã đăng nhập |
| G/P/U `/users` · A `/users/{id}/{reset-password,set-status}` · U `/users/{id}/roles` | Người dùng | `user.manage` |
| G/P/U `/roles` · U `/roles/{id}/permissions` · G `/permissions` | Vai trò, quyền | `role.manage` |
| U `/users/{id}/collaborator-profile` | Hồ sơ CTV (SĐT, khu vực, ghi chú) | `collab.manage` |

### Nền tảng (`platform`) — `/api/v1/{settings,audit,files,notifications}`
| G/U `/settings` (U theo khóa) | `settings.view`/`settings.manage` |
|---|---|
| G `/audit` | `audit.view` |
| G `/activity` (nhật ký hoạt động cấp request; lọc `userId`, `from`/`to` (YYYY-MM-DD, giờ VN), `result=ok\|error`, `area`, `q`, `sensitive=1`, con trỏ `before`, `limit` ≤ 100 ⇒ `{items, next}`) · G `/activity/logins` (lịch sử đăng nhập = `audit_logs auth.*`, cùng bộ lọc) · G `/activity/users` (người có hoạt động trong khoảng ngày, cho ô lọc) | `audit.view` (BR-SEC-11) |
| P `/files` (tải ảnh; multipart `file`,`kind`,`entityTable?`,`entityId?`,`exifDate?` — ngày chụp EXIF do trình duyệt đọc trước khi nén, dạng `YYYY:MM:DD HH:MM:SS`, chỉ dùng khi ảnh gửi lên không còn EXIF) · G `/files/{id}` (URL ký/proxy) · G `/files/{id}/thumb` | theo thực thể |
| G `/notifications` · A `/notifications/{id}/read`, `/read-all` | đã đăng nhập |
| G `/health` · G `/health?deep=1` · G `/system/status` · G `/system/storage` (dung lượng kho, BR-BAK-04) | công khai / `system.health` |

### Catalog — `/api/v1/catalog`
| G/P/U `/brands` · G/P/U `/models` · G `/models/{id}` | `catalog.view` / `catalog.manage` |
|---|---|
| G `/units` (lọc trạng thái, loại, vị trí, tình trạng, `q`) · G `/units/{id}` · U `/units/{id}` (phi tài chính) | `catalog.view` |
| G `/units/{id}/{history,price-history,movements,cost}` (cost cần `cost.view`) | |
| A `/units/{id}/price` (`unit.price.edit`) · A `/units/{id}/move` (`location.manage`) · A `/units/{id}/release` (`unit.release`) · A `/units/{id}/writeoff`, `/restore` (`stock.writeoff`) | |
| G `/units/lookup?code=` (mã nội bộ/serial/QR → chiếc) | `catalog.view` |
| G/P/U `/locations` | `location.manage` |
| G `/units/{id}/label` (PDF tem QR) | `catalog.view` |

### Linh kiện (`parts`) — `/api/v1/parts`
| G/P/U `/parts` · G `/parts/{id}` · G `/parts/{id}/movements` · A `/parts/{id}/adjust` · G/P/U `/part-categories` | `part.view` / `part.manage` / `part.stock.adjust` |
|---|---|

### Đối tác (`partners`) — `/api/v1/customers`
| G/P/U `/customers` · G `/customers/{id}` (+ `/history`) · A `/customers/{id}/reveal-id` (lý do) · A `/customers/{id}/anonymize` · G/P/U `/customer-groups` | `customer.*` |
|---|---|
| G/P `/customers/{id}/watches` | |

### Nhập hàng (`purchasing`) — `/api/v1/purchases`
| G `/purchases` · P `/purchases` (nháp) · U `/purchases/{id}` · DELETE nháp | `purchase.view`/`create` |
|---|---|
| A `/purchases/{id}/confirm` · A `/purchases/{id}/void` | `purchase.confirm` / `purchase.void` |
| P `/purchases/{id}/costs` | `purchase.create` |
| A `/units/{id}/cost-adjust` | `cost.adjust` |
| G `/purchases/{id}/pdf` · G `/purchases/export` | `purchase.view` + `report.export` |

### Bán hàng (`sales`) — `/api/v1/{sales,reservations,warranties}`
| G `/sales` (lọc `?due=true` = còn nợ) · P `/sales` (nháp) · U `/sales/{id}` · DELETE nháp | `sale.view`/`sale.view_own`/`sale.create_draft` |
|---|---|
| A `/sales/{id}/confirm` · A `/sales/{id}/void` · G `/sales/{id}/pdf` | `sale.confirm` · `sale.void` |
| G `/sales/quote` (tính trước tổng, giảm giá, tiền thừa, giá thu/lãi nếu có quyền; không ghi) | `sale.create_draft` |
| G/P `/reservations` · A `/reservations/{id}/{convert,refund,forfeit}` | `reservation.manage` / `reservation.forfeit` |
| G `/warranties` (lọc sắp hết hạn, tra theo phiếu/khách/serial) · G `/warranties/{id}` | `warranty.view` |

### Thanh toán (`payments`) — `/api/v1/payments`
| G `/payments` (lọc phiếu, ngày, phương thức) · P `/sales/{id}/payments` (thu thêm) · P `/repairs/{id}/payments` · A `/payments/{id}/void` | `payment.create` / `payment.void` |
|---|---|
| G `/documents/{type}/{id}/balance` (phải thu, đã trả, còn nợ) | theo chứng từ |

### Cộng tác viên (`sales` — phần CTV) — `/api/v1/collaborators`
| G `/collaborators` · U `/collaborators/{id}` (hồ sơ) | `collab.view` / `collab.manage` |
|---|---|
| G/P `/collaborators/{id}/assignments` · A `/assignments/{id}/{confirm,void}` | `collab.manage` |
| A `/collaborators/{id}/return` (thu hồi chiếc) | `collab.manage` |
| G/P `/collaborators/{id}/settlements` · A `/settlements/{id}/void` | `collab.manage` |
| G `/collab/me/units` (hàng đang giữ + giá thu) · G `/collab/me/sales` · P `/collab/me/sales` (đơn nháp) · G `/collab/me/stats` | `collab.view_own` |
| G `/reports/collaborators?period=month\|quarter\|year&collaborator=` | `collab.view`; `collab.view_own` (chỉ của mình) |

### Sửa chữa (`repairs`) — `/api/v1/repairs`
| G `/repairs` (lọc trạng thái) · P `/repairs` (nhận máy) · G `/repairs/{id}` | `repair.view`/`repair.create` |
|---|---|
| U `/repairs/{id}` (nháp thông tin) · P/U/DELETE `/repairs/{id}/lines` | `repair.update` |
| A `/repairs/{id}/status` · A `/repairs/{id}/approve-quote` (nếu bật) | `repair.update` |
| A `/repairs/{id}/lines/{lineId}/consume` (xác nhận dùng linh kiện) | `repair.update` |
| A `/repairs/{id}/complete` · A `/repairs/{id}/deliver` · A `/repairs/{id}/cancel` | `repair.update` / `repair.deliver` |
| P `/repairs/{id}/photos` (tùy chọn) · G `/repairs/{id}/pdf?type=intake\|delivery` | |
| P `/warranties/{id}/open-repair` (nhận máy bảo hành → tạo phiếu `warranty_free`) | `repair.create` |
| G/P/U `/service-types` · G `/repairs/by-serial?serial=` | |

### Kiểm kê (`inventory`) — `/api/v1/stocktakes`
| G/P `/stocktakes` · P `/stocktakes/{id}/lines` · A `/stocktakes/{id}/{reconcile,cancel}` | `stocktake.manage` |
|---|---|

### Báo cáo (`reports`) — `/api/v1/reports`
| G `/reports/dashboard` | đã đăng nhập (khóa trả về theo quyền) |
|---|---|
| G `/reports/{revenue,profit,purchases,stock,aging,open-balances,repairs,collections,collaborators,shrinkage,warranty}` + `?format=json\|xlsx\|pdf` | theo từng báo cáo (`reports-and-dashboard`) |

### Cron & vận hành — `/api/cron/*`, `/api/v1/public/ops-heartbeat`
Chỉ gọi bởi Vercel Cron (Bearer `CRON_SECRET`) hoặc repo sao lưu (heartbeat, `OPS_HEARTBEAT_SECRET`).

### Báo lỗi trình duyệt — `POST /api/v1/public/client-error` (công khai)
Body `{kind: boundary|global|window|promise, message≤500, digest?, path?≤300, stack?≤2000, version?≤32}` ⇒ `200 {ok:true}`. Kiểm `Origin` cùng nguồn (khác ⇒ 403 `WF-AUTH-CSRF`), sai kiểu/quá dài ⇒ 422 `WF-VALIDATION`, vượt 30/phút/IP-băm hoặc 600/giờ toàn hệ thống ⇒ 429 `WF-RATE-LIMIT`. Ghi `error_events` (`source=client`); chi tiết `security-model` §7. Phía trình duyệt: lỗi mạng/hết giờ khi gọi API ⇒ `ApiClientError(0, "WF-NETWORK", câu dễ hiểu)` (`src/lib/humanize-error.ts`; không phải mã do máy chủ trả); 5xx không có `detail` ⇒ câu theo mã HTTP.

### Bổ sung khi triển khai (2026-10-17)
| Endpoint | Mục đích | Quyền |
|---|---|---|
| P `/purchases/quick` | Nhập nhanh một chiếc (tạo + xác nhận cùng giao dịch) | `purchase.create` (+ `purchase.confirm` để xác nhận) |
| G `/purchases/sources` | Gợi ý "Nguồn hàng" cho `Combobox`: tên nguồn đã dùng (RLS theo người gọi, gộp hoa/thường/dấu, mới nhất trước, tối đa 200; chỉ tên + số phiếu + ngày) | `purchase.create` hoặc `purchase.view` |
| A `/catalog/units/{id}/identity` · A `/catalog/units/{id}/cost-adjust` | Sửa loại/serial (BR-UNIT-06) · điều chỉnh giá vốn | `catalog.manage` · `cost.adjust` |
| A `/sales/{id}/print` | Ghi lần in; `reprint` từ lần 2 | `sale.view`/`sale.view_own` |
| A `/reservations/{id}/cancel` (`mode=refund|forfeit`) · A `/reservations/{id}/convert` | Hủy giữ · tạo phiếu bán nháp từ giữ hàng | `reservation.manage` (+`forfeit`) · `sale.create_draft` |
| P `/collab/me/sales` · G `/collab/me/{units,sales,stats}` | Màn CTV | `collab.view_own` |
| P `/collaborators/{id}/assignments` · A `/assignments/{id}/void` · A `/collaborators/{id}/return` · G/P `/collaborators/{id}/settlements` · A `/settlements/{id}/void` | Giao/thu hồi/quyết toán | `collab.manage` |
| A `/repairs/{id}/lines/{lineId}/{consume,unconsume}` · A `/repairs/{id}/approve-quote` | Dùng/bỏ dùng linh kiện · khách đồng ý báo giá | `repair.update` |
| P `/stocktakes/{id}/lines` (mã/serial hoặc linh kiện + số đếm) | Ghi đếm | `stocktake.manage` |
| G `/reports/{code}?from&to&group&days&format=json|xlsx` (`revenue, profit, moves, stock, aging, open-balances, repairs, collections, shrinkage, warranty`) | R1–R11; Excel cần `report.export`, 5 lần/giờ, audit | theo hàm `rpt_*` |
| G `/files/{id}`, `/files/{id}/thumb` | Proxy tệp (không lộ URL Storage) | theo RLS `files` |

### Tìm nhanh & điều hướng — `/api/v1/search`, `/api/v1/me/badges`, `/api/v1/system/status?summary=1` (FR-NAV-01…03)
| Endpoint | Mục đích | Quyền / lưu ý |
|---|---|---|
| G `/search?q=` (2–60 ký tự, sau khi cắt khoảng trắng; ngắn/dài ⇒ 422 `WF-VALIDATION`) | Bảng lệnh Ctrl+K: gộp theo nhóm `units` (mã nội bộ, serial, tên/loại/thương hiệu), `customers` (tên, mã, SĐT), `sales`/`repairs`/`purchases`/`reservations` (theo mã phiếu), `parts`. Mỗi nhóm ≤ 5 dòng; `exactUnitId` ≠ null khi gõ đúng mã nội bộ/serial (client nhảy thẳng) | Mỗi nhóm CHỈ có khi người gọi có quyền xem (`catalog.view`/`collab.view_own`, `customer.view`/`view_own`, `sale.view`/`view_own`, `repair.view`, `purchase.view`, `reservation.manage`, `part.view`); không có quyền ⇒ khóa nhóm **vắng mặt**. Chạy dưới `wf_app` (RLS: CTV chỉ thấy chiếc đang giữ, khách của mình). Không trả giá vốn/giá; SĐT khách chỉ `phoneTail` (3 số cuối). Tìm không dấu: `search_text` + `pg_trgm`; ký tự `% _` bị thoát |
| G `/me/badges` | Huy hiệu số việc: `{items:[{key,navId,label,count,overdue}], total, overdue}`; `navId` = id mục điều hướng (`nav.ts`). Đỏ khi `overdue > 0`, vàng khi chỉ `count` | Chỉ đếm loại việc mà người gọi có quyền (đơn CTV chờ xác nhận `sale.confirm`; khách đến hạn trả `debt.view`; giữ hàng sắp/quá hạn `reservation.manage`; máy mới/quá hẹn/xong chưa lấy `repair.view`; linh kiện sắp hết `part.view`; chiếc ở CTV quá hạn `collab.view`; bảo hành sắp hết `warranty.view`; kiểm kê đang mở `stocktake.manage`; CTV: đơn của mình chờ xác nhận `collab.view_own`). Chỉ số lượng, không tiền |
| G `/system/status?summary=1` | Dải cảnh báo vận hành: `{level: ok\|warn\|error, issues:[{key,level,title}], checkedAt}` — cron quá hạn (>36 giờ)/lỗi/kẹt, sao lưu lỗi/quá hạn (`backup.heartbeat_max_hours`), lỗi hệ thống mới 24 giờ, dung lượng kho ảnh. Không trả chi tiết lỗi | **Chỉ `system.health`** (≠ `system.backup`; thiếu ⇒ 403 `WF-AUTH-FORBIDDEN`). Không có `summary` ⇒ bản đầy đủ như cũ (`system.health` hoặc `system.backup`) |

### Nhập Excel hàng loạt — `/api/v1/import/{kind}` (`kind` = `customers` | `watches` | `parts`)
Trình duyệt đọc tệp, máy chủ **không** nhận tệp (BR-IMP-01). Thân: `{ rows: [{ line, cells: { <khóa cột>: "<chuỗi>" } }] (1–300), options?, include?: number[] }`. Cần **đủ** quyền của loại đó (`src/lib/import/perms.ts`); thiếu ⇒ 403; `kind` lạ ⇒ 404; >300 dòng/thân sai ⇒ 422. Không thêm mã lỗi mới (dùng WF-VALIDATION, WF-UNIT-SERIAL-DUPLICATE… của hàm nhập).

| Endpoint | Mục đích | Ghi chú |
|---|---|---|
| P `/import/{kind}/preview` | Xem trước từng dòng: `status` ok/warning/error/duplicate + `messages` + `include` mặc định; `notices` chung | **Không ghi gì**; `options` (đồng hồ): `createMissingModels`, `defaultLocationId` |
| P `/import/{kind}/commit` | Ghi các dòng `include` (mặc định: ok + warning); kiểm tra lại từng ô | **Bắt buộc `Idempotency-Key`**; khách: điểm lưu từng dòng; đồng hồ/linh kiện: MỘT phiếu `opening` + `fn_confirm_purchase`; trả `{ receipt, items[{line,id,code,href}], failed, skipped }` |
| G `/import/{kind}/template` | Tệp mẫu .xlsx (Dữ liệu / Hướng dẫn / Danh mục) | Cần quyền nhập loại đó |

## 3. Hợp đồng dữ liệu & kiểu

- Schema Zod ở `src/lib/types/<module>.ts` (request/response); hook SWR ở `src/lib/data/<module>.ts` dùng đúng kiểu đó.
- Đối tượng trả về **không bao giờ** chứa trường người gọi không có quyền: máy chủ dựng DTO từ view/hàm đã lọc quyền, không "xóa trường ở client". DTO dành cho CTV là kiểu riêng (không có trường giá vốn/lãi/khách người khác).
- Thay đổi phá vỡ DTO ⇒ tăng phiên bản API hoặc thêm trường mới + giữ trường cũ một giai đoạn (expand/contract).
