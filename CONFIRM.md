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
