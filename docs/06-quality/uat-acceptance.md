# Nghiệm thu (UAT) & checklist go-live

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt (đã cập nhật theo `customer-feedback-01`) · Thay cho "V. Tiêu chí nghiệm thu" của bản yêu cầu gốc · Số liệu chuẩn: `golden-scenarios` · Kiểm thử tự động: `test-plan`

## 1. Nguyên tắc

1. **Người nghiệm thu là người dùng thật** (chủ, nhân viên bán hàng, quản lý kho, cộng tác viên) — không phải người viết code. Người kỹ thuật chỉ ngồi cạnh, không làm thay.
2. **Làm bằng số liệu vàng.** Mỗi ca UAT dùng lại một kịch bản vàng (SC-xx) với bộ tiền đề F0 trên **staging**; kết quả phải khớp từng con số trong `golden-scenarios`. Lệch một đồng = **không đạt**.
3. **Làm bằng tay, trên thiết bị thật**: điện thoại (iPhone + Android nếu có) và máy tính của cửa hàng; không chỉ trình duyệt máy dev.
4. Mỗi ca có cột **Đạt / Không đạt / Ghi chú** và chữ ký người làm. Lỗi ghi theo mức S0–S3 (`test-plan` §7). **Không go-live khi còn S0/S1.**
5. UAT chạy **sau** khi bộ kiểm thử tự động xanh và kiểm định độc lập (M9) xong. Báo cáo `reports/test-<version>.md` là đầu vào bắt buộc.

## 2. Điều kiện vào UAT

| # | Điều kiện | Kiểm bằng |
|---|---|---|
| 1 | Mốc M0…M8 đạt DoD; FR trong `requirements` đã đánh ☑ | `build-plan`, `requirements` |
| 2 | `typecheck`, `build`, `test` (đơn vị), `test:api` (SC+CT+PT), `db:audit` xanh; `fn_consistency_check()` sạch | `reports/test-<version>.md` |
| 3 | Kiểm định độc lập xong, **không còn S0/S1** | `test-plan` §7 |
| 4 | Staging chạy đúng phiên bản dự định phát hành; có dữ liệu F0 (`db/seed/golden-fixture.mjs`) | `/api/health` |
| 5 | 4 tài khoản demo đúng vai trò (owner, sales, warehouse, C1); MFA owner đã bật | Quản trị → Người dùng |
| 6 | Đồng hồ test đặt ngày cố định (`app.test_today`) cho ca phụ thuộc ngày | `testing-strategy` |
| 7 | Hướng dẫn sử dụng (dàn bài `07-user-guide`) đủ cho các luồng ở UAT | `guide.ts` |
| 8 | Khách đã xác nhận (hoặc chấp nhận bằng văn bản) các giả định Q8–Q19 | `customer-feedback-01` §4 |

## 3. Các ca nghiệm thu

Ký hiệu người làm: **CH** chủ · **BH** bán hàng · **KHO** quản lý kho · **CTV** cộng tác viên · **KT** người kỹ thuật (chỉ quan sát/hỗ trợ).

### UAT-01 — Danh mục & đồng hồ  *(FR-UNIT-*, BR-UNIT-*)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Tạo thương hiệu, loại (mã sản phẩm) | KHO | Mã sản phẩm duy nhất; trùng ⇒ báo lỗi tiếng Việt |
| Nhập nhanh một chiếc (qua phiếu nhập) kèm 3 ảnh, vị trí | KHO | Có mã nội bộ + tem QR in được; chiếc `Sẵn sàng bán`; ảnh có ảnh thu nhỏ |
| Nhập serial đã tồn tại (cùng thương hiệu) | KHO | Chặn, gợi ý mở chiếc cũ |
| Tìm "seiko 5", "SRPD55", serial, mã nội bộ, quét QR bằng camera điện thoại | BH | Ra đúng chiếc ≤ 1 giây; gõ không dấu/sai nhẹ vẫn ra |
| Đổi giá niêm yết, đặt khuyến mãi theo ngày | CH | Có lịch sử giá (cũ, mới, ai, lúc nào); BH không sửa được giá |
| Đổi vị trí; xem lịch sử trạng thái | KHO | Lịch sử đủ, không sửa/xóa được |
| Chiếc cũ không có ảnh tình trạng/hạng ⇒ thử đưa vào bán | KHO | Chặn (BR-UNIT-10) |
| BH xem chi tiết chiếc | BH | **Không** thấy tab Giá thu (giá vốn) |

### UAT-02 — Nhập hàng & giá vốn  *(SC-01, SC-11, SC-17)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Làm lại **SC-01** (3 đồng hồ + vận chuyển 120.000, nguồn hàng chữ) | KHO, CH | Giá vốn A/B/C = **6.060.000 / 1.212.000 / 4.848.000**; không có công nợ/thanh toán phiếu nhập |
| Thiếu "nguồn hàng" | KHO | Chặn |
| Thu mua từ khách (thiếu ảnh giấy tờ ⇒ chặn; đủ ⇒ in biên bản) | KHO | Đúng BR-PUR-09; CCCD hiện dạng che |
| Hủy phiếu nhập chưa phát sinh gì (SC-17a); hủy phiếu có chiếc đã bán/đã giao CTV (SC-17b/c) | CH | Ca a: về 0; ca b/c: chặn `WF-PUR-HAS-DEPENDENTS` |
| Điều chỉnh giá vốn +200.000 có lý do (SC-17d) | CH | Có bút toán điều chỉnh; KHO không có quyền |
| Xuất phiếu nhập ra PDF/Excel | KHO | Số liệu khớp màn hình; BH không xem được phiếu nhập |
| Phiếu tồn đầu kỳ (`opening`) | CH | Không tạo thanh toán; báo cáo ghi "Tồn đầu kỳ" |

### UAT-03 — Bán hàng, thanh toán, in, giữ hàng, thu cũ đổi mới  *(SC-02…06, SC-15)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| **SC-02**: bán A 8.200.000 (giảm 300.000), 5.000.000 tiền mặt + 3.200.000 chuyển khoản | BH | Lãi gộp **2.140.000** (chủ thấy; BH không thấy); A `Đã bán`; thanh toán đúng; bảo hành 12 tháng; ≤ 3 chạm từ trang chủ |
| Phiếu hiển thị **thông tin + giá thu + giá bán** (CF-01) | CH | Đúng; BH không thấy giá thu/lãi |
| In phiếu 80mm và A5; in lại | BH | Đúng nội dung; bản in lại có "BẢN IN LẠI" |
| Bán chiếc đã bán / đang giữ | BH | Chặn `WF-SALE-UNIT-UNAVAILABLE` |
| Giảm giá quá hạn mức 5% | BH | Chặn `WF-SALE-DISCOUNT-LIMIT`; CH làm được |
| **SC-03**: khách đưa 7.000.000, hàng 6.500.000 | BH | Tiền thừa **500.000**; thanh toán ghi 6.500.000 |
| **SC-04**: bán nợ, hẹn trả, **Thu thêm** trên phiếu | BH | Còn nợ **1.300.000 → 300.000**; thu vượt bị chặn; lọc "Còn nợ" ở danh sách; không có màn công nợ riêng |
| **SC-05**: giữ hàng có cọc → chuyển thành bán; hoàn cọc; tịch thu (CH) | BH, CH | Cọc không là doanh thu; BH không tịch thu được |
| **SC-06**: thu cũ đổi mới | BH | Doanh thu **20.000.000**; máy cũ `Chờ kiểm tra`, giá vốn **6.000.000**; thiếu giấy tờ người bán bị chặn |
| **SC-15**: hủy phiếu trong 24 giờ | CH | Như chưa xảy ra; BH không hủy được |
| Bán linh kiện lẻ (dây) cùng phiếu | BH | Trừ kho linh kiện; giá vốn bình quân |
| Tra cứu lịch sử hóa đơn theo khách, theo ngày | BH | Đúng và nhanh |
| Mất mạng giữa lúc lập phiếu → có mạng lại → bấm xác nhận 2 lần | BH | Nháp còn nguyên; chỉ **một** phiếu được tạo |

### UAT-04 — Kho, linh kiện, kiểm kê, thông báo  *(SC-14; FR-STK-*, FR-PART-*, FR-PLAT-02)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Nhập/điều chỉnh linh kiện (cần lý do) | KHO | Có lịch sử xuất–nhập; giá bình quân đúng (SC-11d/e) |
| **SC-14**: kiểm kê bằng quét QR; chiếc không thấy ⇒ ghi mất; linh kiện lệch | KHO | Tổn thất **3.080.000**; chốt thiếu lý do bị chặn; chiếc ở CTV không nằm trong kiểm kê kho |
| Cảnh báo linh kiện ≤ ngưỡng; hàng tồn > 90 ngày; giữ hàng quá hạn; bảo hành sắp hết; chiếc ở CTV quá hạn | KHO, CH | Chuông thông báo đúng người, có liên kết mở thẳng màn hình xử lý |
| Hàng tồn lâu có trong báo cáo R5 | CH | Đúng 123 ngày cho chiếc I |

### UAT-05 — Tổng quan & lãi gộp  *(SC-10)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Làm **SC-10** (chạy lần lượt SC-01…04) | CH | Doanh thu **16.500.000**, giá vốn **12.120.000**, lãi gộp **4.380.000**; thực thu **15.200.000**; khách còn nợ **1.300.000** |
| So Tổng quan với báo cáo R1/R2/R4/R6/R8 cùng khoảng ngày | CH | Giống nhau tuyệt đối |
| BH mở Tổng quan | BH | Thấy doanh thu, **không** thấy lãi/giá vốn |
| Đổi khoảng ngày; biểu đồ doanh thu–lãi | CH | Cập nhật đúng; dùng được trên điện thoại |

### UAT-06 — Sửa chữa (gọn) & bảo hành  *(SC-07, SC-08, SC-09)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Nhận máy **không ảnh** (hợp lệ), cọc 200.000, in phiếu nhận | CH | Có mã phiếu; chụp ảnh là tùy chọn, đã lưu thì không xóa được |
| Ghi trạng thái; thêm dịch vụ + linh kiện; xác nhận dùng | CH | Kho giảm đúng (LK-0001 10→9; LK-0002 5→4); không thể âm |
| Hoàn thành → giao → thu 700.000 | CH | **SC-08**: doanh thu **900.000**, giá vốn linh kiện **330.000**, lãi gộp sửa **570.000**; bảo hành 90 ngày |
| Chỉ thay pin — **SC-08, ca 8b** | CH | Lãi gộp sửa **125.000** |
| **SC-07**: tra bảo hành theo serial → **Nhận máy bảo hành** | CH | Phiếu `warranty_free`: doanh thu 0; chi phí bảo hành 80.000; lãi gộp bán hàng cũ không đổi; không có chức năng đổi trả |
| Bảo hành hết hạn | CH | Phiếu miễn phí bị chặn; phiếu tính phí được |
| Sửa nội bộ rồi bán — **SC-09** | CH, BH | Giá vốn **4.350.000**; lãi gộp bán **1.650.000** |
| BH/KHO/CTV mở màn Sửa chữa | BH, KHO | Không có quyền (không thấy màn); không có phân công thợ, không "Việc của tôi" |
| Máy hoàn thành quá 14 ngày chưa lấy (`repair.pickup_alert_days`) | CH | Có cảnh báo |
| Tra lịch sử sửa chữa theo serial | CH | Gộp cả máy khách và máy của cửa hàng |

### UAT-07 — Tiền thu & báo cáo & xuất file  *(SC-10, SC-13; bản gốc "báo cáo")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Xem báo cáo **Tiền thu** theo ngày 03 và 05 | CH | Ngày 03: tiền mặt 12.000.000 + chuyển khoản 3.200.000; ngày 05: 1.000.000 chuyển khoản; **không** có số dư quỹ/phiếu chi/khóa kỳ |
| **SC-13**: chạy 8 sự kiện, kiểm hằng đẳng thức sau mỗi bước | CH | Doanh thu − Thực thu = Khách nợ + CTV chưa nộp − Cọc giữ − Cọc tịch thu − Nhận trước sửa (đúng ở cả 8 bước) |
| Báo cáo R1…R12: lọc ngày, xuất Excel/PDF | CH | Số liệu Excel = màn hình; có người xuất, thời điểm |
| BH xuất báo cáo doanh thu | BH | File **không** có cột giá vốn/lãi |
| Báo cáo phiếu còn nợ (R6) | CH | Khớp SC-04 |

### UAT-08 — Điện thoại, máy tính, PWA, mất mạng, giao diện Glass  *(FR-BAK-06/07, FR-PLAT-06/07)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Mở bằng điện thoại thật (≥ 1 iPhone/Android) và máy tính; làm lại **SC-02** và nhận máy sửa | BH, CH | Không phải kéo ngang; nút bấm đủ lớn; chữ nhập không bị phóng to |
| **So giao diện với mẫu v6-glass**: dock nổi + nút "+", tiêu đề lớn, thẻ kính, màu trạng thái; desktop: sidebar đảo nổi + thanh trên | CH | Đúng phong cách khách đã chọn; không có màn đã loại (Thu chi, Đổi trả, Thợ, NCC) |
| Cài lên màn hình chính | BH | Mở như ứng dụng, có biểu tượng đúng |
| Chụp ảnh + quét QR bằng camera (Android và iOS) | KHO | Quét được; iOS dùng được đường dự phòng |
| Ngắt mạng khi lập phiếu; có biểu ngữ "Mất kết nối" | BH | Nháp giữ; nút Xác nhận khóa tới khi có mạng; không mất dữ liệu |
| Đo tốc độ POS với 20 người đồng thời (script tải nhẹ) | KT | p95 mở màn hình bán hàng ≤ 2 giây trên 4G |
| Máy yếu: dock/sheet có mượt (CPU throttle 4×) | KT | Không giật rõ rệt; có phương án khi không hỗ trợ blur |

### UAT-09 — Sao lưu, khôi phục, giám sát  *(BR-BAK-*)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Workflow sao lưu đêm chạy thành công ≥ 3 đêm liên tiếp | KT | Có bản mã hóa; nhịp tim báo về ứng dụng |
| **Diễn tập khôi phục**: dựng DB tạm từ bản sao lưu → đăng nhập → chạy `fn_consistency_check()` → so số liệu với staging | KT + CH quan sát | Số dòng khớp; sạch; **có biên bản** (`backup-restore` §6) |
| Giả lập mất bản sao lưu > 36 giờ | KT | `/api/health?deep=1` báo lỗi; chủ nhận cảnh báo |
| Mô phỏng sự cố cron | KT | `job_runs` ghi lỗi, chủ nhận thông báo |
| Chủ biết nơi xem trạng thái sao lưu và ai gọi khi sự cố | CH | Trả lời được |

### UAT-10 — Phân quyền, cài đặt, hướng dẫn & bàn giao  *(FR-SEC-*, FR-PLAT-01/05, FR-BAK-08)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Đăng nhập, đổi mật khẩu, bật TOTP, đăng xuất; sai mật khẩu 5 lần | tất cả | Khóa tạm 15 phút; TOTP bắt buộc với CH |
| Lần lượt mỗi vai trò thử mở màn hình/URL/API **không có quyền** (script PT + thao tác tay) | tất cả | Bị chặn bằng 403/ẩn menu; **giá vốn, giá thu, lãi không lộ** ở UI, báo cáo, Excel, in |
| Đổi hạn mức giảm giá của vai trò BH; hạ quyền một người | CH | Có hiệu lực ngay; có nhật ký |
| Thử khóa/hạ quyền chủ cuối cùng | CH | Chặn (BR-SEC-07) |
| Xem Nhật ký hoạt động: ai tạo/sửa/xác nhận/hủy | CH | Đủ, không sửa/xóa được |
| Đổi cài đặt (ngưỡng, hạn bảo hành, thông tin in phiếu) | CH | Có lịch sử thay đổi |
| Mở **Hướng dẫn sử dụng** theo vai trò; đọc "Hướng dẫn nhanh" | tất cả | Đúng vai trò, làm theo được |
| Buổi đào tạo: mỗi người **tự làm đúng** kịch bản của vai trò mình | tất cả | Danh sách đã đào tạo lưu ở `runbook` |
| Bàn giao: checklist `runbook` §7 | CH, KT | Tất cả ☑ |

### UAT-11 — Cộng tác viên: giao hàng → bán → quyết toán → thống kê  *(SC-12, SC-16; CF-03/08)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| **SC-12 bước 1**: chủ giao A/B/C cho C1 với giá thu 7.000.000 / 1.500.000 / 5.500.000, in phiếu giao | CH | A/B/C `Đang ở CTV`; vẫn tính tồn kho; doanh thu 0 |
| C1 đăng nhập điện thoại | CTV | Chỉ thấy 3 chiếc với **giá thu**; không giá vốn; không chiếc/khách của người khác; không xác nhận được đơn |
| C1 tạo khách + đơn bán A giá 8.200.000; BH xác nhận | CTV, BH | Doanh thu cửa hàng 7.000.000; lãi gộp **940.000**; phần C1 hưởng **1.200.000**; bảo hành cho khách |
| C1 bán C giá 5.200.000 (dưới giá thu) | CTV, BH | Có cảnh báo; cho phép; phần C1 hưởng **−300.000**; lãi cửa hàng **652.000** |
| **Quyết toán** dòng A (7.000.000 chuyển khoản) | CH | Thực thu +7.000.000; quyết toán lại bị chặn |
| **Thu hồi** B về kho | CH | B `Sẵn sàng bán`, giá vốn không đổi; thu hồi chiếc đã bán bị chặn |
| **Thống kê CTV** tháng 11 | CH, CTV | Số chiếc 2; bán ra **13.400.000**; phải nộp **12.500.000**; hưởng **900.000**; đã nộp 7.000.000; chưa nộp 5.500.000 (CH xem tất cả; CTV chỉ của mình); lọc tháng/quý/năm |
| **SC-16**: hủy đơn CTV (chưa quyết toán) và hủy quyết toán | CH | Chiếc về `Đang ở CTV`; hủy khi đã quyết toán bị chặn tới khi hủy quyết toán |
| Cảnh báo chiếc ở CTV quá 30 ngày | CH | Có thông báo |

## 4. Đối chiếu với tiêu chí nghiệm thu của bản gốc

| Tiêu chí gốc (mục V) | Ca UAT | Tự động hóa tương ứng |
|---|---|---|
| Kiểm tra nhập hàng và tính đúng giá vốn | UAT-02 | SC-01, SC-11, SC-17 |
| Kiểm tra bán hàng, thanh toán, in hóa đơn và trừ kho | UAT-03 | SC-02, SC-03, SC-04, CT-01, CT-07 |
| Kiểm tra đổi trả hàng và hoàn kho | **Thay bằng bảo hành** (CF-02): UAT-06 (SC-07); hoàn kho = thu hồi CTV (UAT-11) | SC-07, SC-12, SC-15 |
| Kiểm tra tính lãi gộp và báo cáo thu chi | UAT-05, UAT-07 (báo cáo Tiền thu; thu chi/quỹ đã bỏ — CF-07) | SC-10, SC-13 |
| Kiểm tra phiếu sửa chữa, linh kiện sử dụng và tiền công | UAT-06 (không còn tiền công thợ — CF-04) | SC-08, SC-09, CT-04 |
| Kiểm tra phân quyền nhân viên | UAT-10, UAT-11 | PT-01…PT-12 |
| Kiểm tra sao lưu và khôi phục dữ liệu | UAT-09 | Q7 |
| Kiểm tra sử dụng trên máy tính và điện thoại | UAT-08 | e2e 390/1366 |

## 5. Tiêu chí đạt

- **Mọi** UAT-01…11 đạt; **không** còn lỗi S0/S1; lỗi S2 có kế hoạch sửa kèm ngày; S3 ghi vào danh sách tồn.
- Mọi con số trong cột "Kết quả đúng" trùng khít `golden-scenarios`.
- Sau UAT: `fn_consistency_check()` sạch trên staging.
- Biên bản UAT (mẫu §7) có đủ chữ ký người làm từng vai trò và chủ cửa hàng.

## 6. Checklist go-live

### 6.1 Trước ngày go-live
| ☐ | Việc | Ghi chú |
|---|---|---|
| ☐ | UAT-01…11 đạt, biên bản ký | §5 |
| ☐ | Câu hỏi mở đã có câu trả lời hoặc quyết định chấp nhận rủi ro bằng văn bản | Q1 (hóa đơn/thuế), Q2 (bảo hành), Q3 (hạn mức giảm giá), Q5–Q7 (`vision-scope` §7) và Q8–Q19 (`customer-feedback-01` §4) |
| ☐ | Production: Supabase Pro + Vercel Pro, vùng Singapore, **Data API đã tắt**, biến môi trường đủ, **khóa mới riêng cho production** | `runbook` §8 |
| ☐ | Migration đã áp lên production (dry-run trước); **không** chạy seed demo trên production | `release-process` |
| ☐ | Tài khoản thật: chủ có MFA, mã khôi phục đã cất; nhân viên/CTV có tài khoản và đổi mật khẩu tạm | |
| ☐ | Hồ sơ CTV (nếu dùng), hạn mức giảm giá, thông tin in phiếu, cài đặt bảo hành đã nhập | `runbook` §8 |
| ☐ | **Tồn đầu kỳ** nhập bằng phiếu `opening` từ kiểm kê vật lý; đối chiếu số lượng và giá trị với kiểm kê | Biên bản đối chiếu |
| ☐ | Sao lưu production chạy ≥ 1 đêm; diễn tập khôi phục có biên bản | UAT-09 |
| ☐ | Hai monitor uptime; email cảnh báo đến đúng người | |
| ☐ | Bàn giao quyền sở hữu tài khoản/tên miền/mã nguồn; ≥ 2 người có thể khôi phục | `runbook` §7 |
| ☐ | Đào tạo xong cho từng vai trò; hướng dẫn nhanh đã in dán quầy | |
| ☐ | Sổ phần tử Lucian (`ui-design-system` §9) đủ và đã rà | |
| ☐ | Phiên bản đã tăng, changelog đã viết | |

### 6.2 Ngày go-live
1. Sao lưu thủ công production ngay trước khi nhập dữ liệu thật.
2. Chốt kiểm kê vật lý → nhập tồn đầu kỳ → đối chiếu → khóa việc nhập `opening` (thu hồi quyền `purchase.confirm` loại `opening` nếu muốn).
3. Làm **một giao dịch thật nhỏ** cho mỗi luồng (nhập 1 chiếc, bán 1 chiếc, nhận 1 máy sửa, giao 1 chiếc cho CTV) có chủ đứng cạnh; chạy `fn_consistency_check()`.
4. Mở cho nhân viên dùng. Người kỹ thuật túc trực.

### 6.3 Giai đoạn theo dõi sát (2 tuần đầu)
- Mỗi cuối ngày: chủ xem báo cáo **Tiền thu** và đối chiếu tay với tiền mặt/sao kê (ngoài hệ thống); xem phiếu còn nợ và hàng ở CTV.
- **Chạy song song sổ cũ** (sổ tay/Excel) tối thiểu 1–2 tuần cho doanh thu, tồn kho; so sánh mỗi ngày. Chỉ ngừng sổ cũ khi số liệu khớp liên tục 7 ngày.
- Mỗi sáng xem `/quan-tri` → Hệ thống (lỗi, cron, sao lưu); thu thập phản hồi người dùng; sửa lỗi nhỏ theo `release-process`.
- Cuối tuần 2: họp rà soát, cập nhật hướng dẫn và danh sách lỗi tồn.

### 6.4 Tiêu chí dừng / quay lại
Quay về sổ cũ tạm thời và dừng nhập dữ liệu mới nếu: lệch kho không giải thích được, `fn_consistency_check()` báo vi phạm, lộ dữ liệu nhạy cảm, hoặc hệ thống không truy cập được > 2 giờ trong giờ mở cửa. Khi đó: giữ nguyên dữ liệu, sao lưu, mở biên bản sự cố (`runbook` §9), sửa, rồi chạy lại các ca UAT liên quan trước khi tiếp tục.

## 7. Mẫu biên bản UAT

```
Phiên bản: x.y.z     Môi trường: staging     Ngày: yyyy-mm-dd
Thiết bị: <điện thoại/hệ điều hành>, <máy tính/trình duyệt>

Ca     | Người làm | Kết quả (Đạt/Không đạt) | Lỗi (ID, mức S0–S3) | Ghi chú
UAT-01 |           |                         |                     |
...
UAT-11 |           |                         |                     |

Tổng kết: ___/11 đạt · S0: _ · S1: _ · S2: _ · S3: _
Kết luận: [ ] Đủ điều kiện go-live   [ ] Chưa đủ — việc cần làm: ...
Chữ ký: Chủ cửa hàng ........  Người kỹ thuật ........  Đại diện từng vai trò ........
```
