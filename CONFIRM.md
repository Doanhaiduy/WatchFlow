# CONFIRM — các điểm AI tự quyết, chờ người dùng xác nhận

> Do AI ghi khi triển khai ở máy công ty (`IMPLEMENT_PROMPT.md` §3). **Chỉ thêm cuối file**, ID tăng dần. Người dùng duyệt: đổi `☐` → `☑` (đồng ý) hoặc `✎` (muốn đổi, ghi hướng đổi dưới mục). Sau đó ở nhà nhờ Claude áp dụng các mục `✎` (mỗi mục có chỗ cần sửa).
> Mức: 🔴 tiền/kho/quyền/dữ liệu (duyệt trước) · 🟡 luồng/giao diện · 🟢 nhỏ. Q8–Q19 gốc ở `docs/01-product/customer-feedback-01.md` §4 (không ghi lại ở đây).

### Mẫu mục
```
### CQ-000 · M? · 🔴|🟡|🟢 · mâu thuẫn|thiếu|giả định
**Vấn đề:** … (kèm mã BR/FR/SC)
**Đã chọn:** … — lý do …
**Khác:** …
**Nếu đổi, sửa:** file / hàm / migration …
**Trạng thái:** ☐
```

---

### CQ-001 · M0 · 🔴 · thiếu
**Vấn đề:** security-model §2 không nói `wf_definer` vượt RLS thế nào; mọi bảng `FORCE RLS` + policy chỉ cho `wf_app` ⇒ hàm `SECURITY DEFINER` (owner `wf_definer`) sẽ thấy 0 dòng.
**Đã chọn:** `wf_definer` = `NOLOGIN BYPASSRLS`; mọi `fn_*` tự kiểm quyền trong thân (`app.require_permission`). Không ai đăng nhập được bằng `wf_definer`.
**Khác:** thêm policy `TO wf_definer USING (true)` cho từng bảng (dài, dễ quên khi thêm bảng).
**Nếu đổi, sửa:** `db/migrations/0001_foundation.sql` (migration mới `ALTER ROLE wf_definer NOBYPASSRLS` + policy từng bảng), `security-model` §2.
**Trạng thái:** ☐

### CQ-002 · M0 · 🔴 · thiếu
**Vấn đề:** Sửa quyền vai trò có thể khiến chủ tự khóa mình (BR-SEC-07 chỉ nói "≥ 1 owner").
**Đã chọn:** vai trò `owner` luôn giữ `user.manage` + `role.manage`; không tắt được vai trò `owner` (`fn_set_role_permissions`, `fn_upsert_role` ném `WF-SEC-LAST-OWNER`). Ngoài ra trigger hoãn `tg_ensure_owner` chặn khóa/hạ owner cuối.
**Khác:** cho phép bỏ tùy ý, chỉ cảnh báo.
**Nếu đổi, sửa:** `db/migrations/0003_platform.sql` → migration mới thay `app.fn_set_role_permissions`.
**Trạng thái:** ☐

### CQ-003 · M0 · 🟢 · giả định
**Vấn đề:** dev-setup nói PostgreSQL portable qua `embedded-postgres`; bản npm hiện tại là beta (18.4.0-beta) và máy đã cài PostgreSQL 17/18.
**Đã chọn:** `scripts/db/pg.mjs` dùng nhị phân `PG_BIN` → `C:\Program Files\PostgreSQL\<mới nhất>\bin` → PATH; cụm riêng `.local/pgdata`, cổng 54329, chỉ nghe 127.0.0.1, mật khẩu chủ DB sinh ngẫu nhiên ở `.local/pg-superuser.txt`.
**Khác:** cài `embedded-postgres` (tải nhị phân) khi máy không có PostgreSQL.
**Nếu đổi, sửa:** `scripts/db/pg.mjs` hàm `pgBin`; `docs/04-engineering/dev-setup.md` §1.
**Trạng thái:** ☐

### CQ-004 · M0 · 🟡 · giả định
**Vấn đề:** security-model §7 "auth 10/15 phút theo IP và theo tài khoản; mặc định 300/phút/người" — cửa hàng thường dùng chung một IP (wifi), đếm cả lần đăng nhập đúng sẽ tự khóa nhân viên; đếm 300/phút bằng DB thì mỗi request thêm một lượt ghi.
**Đã chọn:** đăng nhập chỉ đếm lần **sai** (IP + tài khoản, lưu DB `rate_limit_hits`); MFA/xác thực lại đếm theo tài khoản; giới hạn chung 300/phút/người đếm **trong bộ nhớ** từng instance; xuất file/tải ảnh đếm DB.
**Khác:** đếm mọi lần đăng nhập; đếm chung bằng DB.
**Nếu đổi, sửa:** `src/app/api/v1/auth/login/route.ts`, `src/server/ratelimit.ts`.
**Trạng thái:** ☐

### CQ-005 · M0 · 🟡 · giả định
**Vấn đề:** "dùng lại refresh token đã xoay ⇒ thu hồi cả phiên" làm hai tab cùng làm mới gần như đồng thời bị đăng xuất oan.
**Đã chọn:** cửa sổ ân hạn 10 giây: token vừa xoay < 10 giây được dùng lại ⇒ trả 401 nhưng KHÔNG thu hồi phiên (tab kia đã có cookie mới); quá 10 giây ⇒ thu hồi cả phiên + audit mức cao.
**Khác:** không ân hạn (an toàn hơn, dễ đăng xuất oan).
**Nếu đổi, sửa:** `src/server/auth/service.ts` hằng `REFRESH_GRACE_MS`.
**Trạng thái:** ☐

### CQ-006 · M1 · 🟢 · giả định
**Vấn đề:** build-plan M1 "tem QR PDF" — sinh PDF tiếng Việt ở máy chủ cần nhúng phông TTF (thêm thư viện + tệp phông).
**Đã chọn:** API `/catalog/units/{id}/label` trả SVG QR (mã nội bộ) + thông tin; trang `/units/[id]/label` dựng tem khổ nhỏ và in/lưu PDF bằng hộp in của trình duyệt (`@page` kích thước tem).
**Khác:** sinh PDF máy chủ (pdf-lib + phông Be Vietnam Pro TTF).
**Nếu đổi, sửa:** `src/app/api/v1/catalog/units/[id]/label/route.ts` + thêm route PDF.
**Trạng thái:** ☐

### CQ-007 · M2 · 🔴 · mâu thuẫn
**Vấn đề:** `audit_logs` append-only (BR-GEN-04) lưu trước/sau ⇒ giữ mãi tên/SĐT/địa chỉ khách, trái với ẩn danh khách (security-model §6 "xóa PII, giữ giao dịch").
**Đã chọn:** `tg_audit` với bảng `customers` chỉ ghi **tên cột đã đổi** (giá trị = `***`) cho full_name/phone/email/address/note; cột bí mật (CCCD, mật khẩu, TOTP) luôn che ở mọi bảng. Xem lịch sử sửa khách vẫn biết ai sửa trường nào, lúc nào.
**Khác:** ghi đủ giá trị (mất khả năng ẩn danh thật); mã hóa giá trị trong audit bằng khóa riêng có thể hủy.
**Nếu đổi, sửa:** `db/migrations/0005a_audit_mask_pii.sql` → migration mới thay `app.tg_audit`.
**Trạng thái:** ☐

### CQ-008 · M4 · 🔴 · mâu thuẫn (số tiền)
**Vấn đề:** golden-scenarios F0 ghi tồn linh kiện "tổng 3.500.000" nhưng chi tiết từng linh kiện cộng lại = 10×80.000 + 5×250.000 + 20×35.000 = **2.750.000** (SC-01, SC-10 dùng 3.500.000).
**Đã chọn:** tin số chi tiết từng dòng (đầu vào cụ thể) ⇒ sửa F0/SC-01/SC-10 thành **2.750.000**. Seed demo & fixture test dùng đúng 3 linh kiện F0.
**Khác:** giữ 3.500.000 và đổi một giá bình quân/số lượng (không biết đổi dòng nào).
**Nếu đổi, sửa:** `docs/06-quality/golden-scenarios.md` dòng F0/SC-01/SC-10, `db/seed/02_catalog.mjs` (PARTS), test SC-10.
**Trạng thái:** ☐

### CQ-009 · M5a · 🔴 · thiếu (quyền)
**Vấn đề:** Thu cũ đổi mới do nhân viên bán hàng xác nhận phải sinh phiếu nhập `trade_in` (BR-TRD-01) — nhưng vai trò `sales` không có `purchase.confirm`/`purchase.void`.
**Đã chọn:** `fn_confirm_purchase`/`fn_void_purchase` bỏ qua kiểm quyền `purchase.*` CHỈ khi được `fn_confirm_sale`/`fn_void_sale` gọi nội bộ (cờ phiên gắn đúng id phiếu + phiếu là `trade_in`; wf_app không tạo được phiếu `trade_in`). Quyền thực tế = `sale.confirm`/`sale.void`.
**Khác:** cấp `purchase.confirm` cho sales (rộng hơn — sales nhập được mọi hàng).
**Nếu đổi, sửa:** `db/migrations/0008a_trade_in_internal.sql` → migration mới.
**Trạng thái:** ☐

### CQ-010 · M5a · 🟡 · mâu thuẫn nhỏ
**Vấn đề:** BR-SALE-16 "người có `cost.view` thấy giá thu và **lãi**" vs BR-COST-06 "lợi nhuận cho `profit.view`".
**Đã chọn:** giá vốn dòng hiện với `cost.view`; **lãi gộp** chỉ khi có cả `profit.view` (ẩn hơn lộ). Mặc định chỉ chủ có cả hai, nên với vai trò dựng sẵn kết quả như nhau.
**Khác:** cho `cost.view` thấy lãi.
**Nếu đổi, sửa:** `src/server/sales.ts` hàm `getSale` (điều kiện `perms.profit`).
**Trạng thái:** ☐

### CQ-011 · M0–M6 · 🟡 · màn chưa duyệt (cổng G1b)
**Vấn đề:** build-plan yêu cầu bản tĩnh Glass được khách duyệt trước khi code các màn chưa có trong mẫu: Đăng nhập/2FA/Đổi mật khẩu, Phiếu bán gọn (POS), Bảo hành, màn CTV, Giao hàng/Quyết toán/Thống kê CTV, Sửa chữa gọn.
**Đã chọn:** dựng thẳng theo `ui-design-system` §10 từ thành phần Glass sẵn có (IMPLEMENT_PROMPT §3.6), không chờ duyệt. Có thể xem ở môi trường local để duyệt sau.
**Khác:** dừng các màn này chờ khách duyệt bản tĩnh.
**Nếu đổi, sửa:** các trang tương ứng trong `src/app/(app)/…` theo góp ý.
**Trạng thái:** ☐

### CQ-012 · M6 · 🟢 · mâu thuẫn nhỏ (thiết kế bảng)
**Vấn đề:** data-model: `repair_line_costs.repair_line_id` là PK và bảng append-only — nhưng "bỏ dùng linh kiện"/"làm lại"/hủy phiếu phải đảo giá vốn đã chốt (BR-REP-15, state-machines §4).
**Đã chọn:** `repair_line_costs` có `id` riêng, nhiều bút toán/dòng (`use` dương, `reversal` âm, `other` = chi phí khác sửa nội bộ); giá vốn dòng = Σ. Vẫn append-only. Phiếu sửa nội bộ kết thúc ở `completed` (không "giao").
**Khác:** cấm bỏ dùng linh kiện sau khi đã xác nhận.
**Nếu đổi, sửa:** `db/migrations/0009_repairs.sql` (+0009a), `data-model` §10.
**Trạng thái:** ☐

### CQ-013 · M7 · 🔴 · mâu thuẫn (quyền)
**Vấn đề:** SC-14 cho `warehouse` "đối chiếu & chốt" kiểm kê có chiếc mất ⇒ `written_off`, nhưng state-machines §1 yêu cầu `stock.writeoff` cho mọi đường → `written_off` (kể cả `fn_reconcile_stocktake`) và vai trò kho không có quyền này.
**Đã chọn:** kho mở/đếm/chốt được; nếu đợt chốt có chiếc mất thì cần `stock.writeoff` (chủ) — kho gặp `WF-AUTH-FORBIDDEN`; lệch linh kiện thì kho tự chốt được (ẩn/chặn hơn cho phép).
**Khác:** cho `stocktake.manage` tự ghi mất chiếc khi chốt kiểm kê.
**Nếu đổi, sửa:** `db/migrations/0010_inventory_alerts.sql` → migration mới bỏ kiểm `stock.writeoff` trong `fn_reconcile_stocktake`; cập nhật state-machines §1.
**Trạng thái:** ☐

### CQ-014 · M8 · 🟢 · giả định
**Vấn đề:** reports-and-dashboard §1.6 nêu xuất Excel bằng `write-excel-file` và PDF bằng `pdfmake`.
**Đã chọn:** Excel bằng `exceljs` (đã dùng cho phiếu nhập; một thư viện cho mọi bảng), PDF = trang in của trình duyệt (như tem QR, CQ-006) dùng cùng dữ liệu API đã lọc quyền; xuất file cần `report.export`, giới hạn 5 lần/giờ, ghi audit `report.exported`.
**Khác:** thêm `pdfmake` + phông TTF tiếng Việt để sinh PDF máy chủ.
**Nếu đổi, sửa:** `src/server/reports.ts`, `src/app/api/v1/reports/[code]/route.ts`.
**Cập nhật 2026-10-17 (đối ứng Lưu Xá):** đã thêm `pdfmake` + phông Be Vietnam Pro (chép từ mẫu Lưu Xá, không tải Internet) để tải PDF vector cho phiếu bán, phiếu sửa, phiếu bảo hành — dựng ở trình duyệt từ dữ liệu API đã lọc quyền; báo cáo vẫn Excel + trang in.
**Trạng thái:** ☐

### CQ-015 · M9 · 🔴 · thiếu sót (bảo mật quyền quản trị)
**Vấn đề:** Đối chiếu với mẫu Lưu Xá: tài liệu chỉ nói "giữ ít nhất một owner" (PT-10) — không nói người có `user.manage`/`role.manage` nhưng không phải owner có được tự gán `owner`, sửa tài khoản owner hay thêm quyền vào vai trò mình đang giữ (tự nâng quyền).
**Đã chọn:** chặn (migration 0013/0013a): chỉ owner thao tác trên tài khoản/vai trò owner và cài đặt `security.*`; không ai tự đổi vai trò/khóa/đặt lại mật khẩu chính mình; không sửa vai trò mình đang giữ (trừ owner). Người không phải owner chỉ cấp được quyền mình có (trần cấp quyền, 0013c — /code-review phát hiện đường tạo vai trò mới + tài khoản bù nhìn). Kèm: phiên có hạn tuyệt đối, refresh trong ân hạn không xóa cookie, đếm sai MFA nguyên tử, che PII người bán trong nhật ký, thu EXECUTE pgcrypto. Giữ thông báo "khóa tạm"/"còn N lần thử" theo api-conventions (chấp nhận lộ email tồn tại — rủi ro thấp, cửa hàng nhỏ).
**Khác:** cho người quản lý có `user.manage` toàn quyền như owner.
**Nếu đổi, sửa:** migration mới thay `app.guard_user_target`/`app.guard_role_target`; `tests/api/m9-hardening.test.mjs`.
**Trạng thái:** ☐

### CQ-016 · UI · 🟡 · thay đổi phạm vi (theo yêu cầu người dùng 2026-10-17)
**Vấn đề:** `customer-feedback-01` Q18 + ADR-026 hoãn chế độ tối ("làm sau nếu khách cần"); `CLAUDE.md` liệt kê "chế độ tối" trong mục KHÔNG xây. Người dùng yêu cầu trực tiếp: làm cả sáng lẫn tối, bỏ select/ô ngày/hộp thoại mặc định của trình duyệt.
**Đã chọn:** thêm bản tối bằng khối `[data-theme="dark"]` cùng tên token (`tokens.css`), mặc định **Sáng**, người dùng chọn Sáng / Tối / Theo hệ thống (lưu trên thiết bị). Select và chọn ngày dựng riêng theo Glass (điện thoại mở bottom sheet). Gỡ được: bỏ khối token tối + nút chọn là về như cũ.
**Khác:** giữ chỉ bản sáng như mẫu khách duyệt.
**Nếu đổi, sửa:** `src/styles/tokens.css` (khối tối), nút chọn giao diện, `ui-design-system` §3.
**Trạng thái:** ☐

### CQ-017 · M9 · 🟡 · giả định (lưu trữ & PII — đối ứng Lưu Xá)
**Vấn đề:** Tài liệu không nói khi nào xóa thật tệp đã xóa mềm (`files.is_deleted`) — trước đây tệp ở lại kho mãi, kể cả ảnh CCCD của khách đã ẩn danh; `fn_anonymize_customer` còn bỏ sót CCCD gắn ở phiếu thu mua/phiếu bán.
**Đã chọn:** (0014) ảnh giấy tờ (`id_document`) xóa thật ở lượt job hằng ngày kế tiếp; ảnh thường sau `storage.purge_after_days` = 7 ngày; tệp bất biến (chứng từ đã xác nhận) không tự xóa; ẩn danh khách xóa cả CCCD ở phiếu thu mua/phiếu bán. Theo dõi dung lượng với hạn mức `storage.quota_mb` = 1024 (Supabase Free), cảnh báo 80% / 95%. Log lỗi trình duyệt vào `error_events` (không PII, 30 lần/phút/IP).
**Khác:** giữ tệp đã xóa lâu hơn (ví dụ 30 ngày) để khôi phục khi xóa nhầm; hoặc hạn mức theo gói Supabase Pro (100 GB).
**Nếu đổi, sửa:** cài đặt `storage.*` (Quản trị → Cài đặt), `db/migrations/0014_storage_purge.sql`.
**Trạng thái:** ☐

### CQ-018 · M9 · 🔴 · giả định (bảo mật — đối ứng Lưu Xá)
**Vấn đề:** Tài liệu bắt buộc 2FA cho chủ mỗi lần đăng nhập; mẫu Lưu Xá có "Tin cậy thiết bị này 30 ngày".
**Đã chọn:** cho phép tích "Tin cậy thiết bị này" ở bước 2FA: lần sau trên thiết bị đó chỉ cần mật khẩu (luôn phải đúng); token 256-bit cookie httpOnly SameSite=Strict, DB chỉ giữ SHA-256; hết hạn cố định `security.trusted_device_days` = 30 (0 = tắt, chỉ chủ đổi); tự thu hồi khi đổi/đặt lại mật khẩu, khóa tài khoản, tắt 2FA; "Quên các thiết bị" ở Tài khoản. Xác thực lại cho thao tác nhạy cảm VẪN cần mã 2FA. Rủi ro: ai có cả mật khẩu và máy đã tin cậy vào được trong 30 ngày.
**Khác:** đặt mặc định 0 (tắt) cho tới khi khách đồng ý.
**Nếu đổi, sửa:** cài đặt `security.trusted_device_days`; `db/migrations/0021a_trusted_devices.sql`, `src/server/auth/*`.
**Trạng thái:** ☐

### CQ-019 · M9 · 🟡 · giả định (đối ứng Lưu Xá — nhật ký, thông báo, thanh toán, nhập Excel)
**Vấn đề:** Các tính năng mới lấy từ Lưu Xá cần vài lựa chọn tài liệu chưa nói.
**Đã chọn:** (1) Nhật ký hoạt động giữ `activity.retention_days` = 180 ngày (sàn 30), ghi sau khi trả phản hồi (máy chủ tắt đột ngột có thể mất một lô); trang Tổng quan không ghi. (2) `GET /api/v1/store-info` cho MỌI người đã đăng nhập (kể cả CTV) đọc tên/địa chỉ cửa hàng + số tài khoản nhận tiền để hiện VietQR và in phiếu. (3) VietQR chỉ hiển thị, không tự ghi tiền (BR-PAY-02); phiếu chưa có mã dùng nội dung tạm (vd. "BAN HANG 1A2B3C"). (4) Nhập Excel khách cần `customer.create` + `customer.view` (CTV không nhập hàng loạt); đồng hồ/linh kiện qua một phiếu `opening`, hàng cũ vào "Chờ kiểm tra". (5) Web Push: gửi thật ⏭ cloud (cần khóa VAPID mỗi môi trường); local chỉ thử bằng bộ gửi giả.
**Khác:** retention dài/ngắn hơn; ẩn số tài khoản với CTV; cho CTV nhập Excel khách.
**Nếu đổi, sửa:** cài đặt `activity.*`; `src/app/api/v1/store-info`; `src/lib/import/perms.ts`.
**Trạng thái:** ☐
