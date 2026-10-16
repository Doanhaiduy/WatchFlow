# Nghiệm thu (UAT) & checklist go-live

> Cập nhật lần cuối: 2026-10-16 · Trạng thái: Duyệt · Thay cho "V. Tiêu chí nghiệm thu" của bản yêu cầu gốc · Số liệu chuẩn: `golden-scenarios` · Kiểm thử tự động: `test-plan`

## 1. Nguyên tắc

1. **Người nghiệm thu là người dùng thật** (chủ, nhân viên bán hàng, quản lý kho, thợ, CTV) — không phải người viết code. Người kỹ thuật chỉ ngồi cạnh, không làm thay.
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
| 5 | 5 tài khoản demo đúng vai trò (owner, sales, warehouse, T1/T2, C1); MFA owner đã bật | Quản trị → Người dùng |
| 6 | Đồng hồ test đặt ngày cố định (`app.test_today`) cho ca phụ thuộc ngày | `testing-strategy` |
| 7 | Hướng dẫn sử dụng (dàn bài `07-user-guide`) đủ cho các luồng ở UAT | `guide.ts` |

## 3. Các ca nghiệm thu

Ký hiệu người làm: **CH** chủ · **BH** bán hàng · **KHO** quản lý kho · **TH** thợ · **CTV** cộng tác viên · **KT** người kỹ thuật (chỉ quan sát/hỗ trợ).

### UAT-01 — Danh mục & đồng hồ  *(FR-UNIT-*, BR-UNIT-*; bản gốc "quản lý đồng hồ")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Tạo thương hiệu, loại (mã sản phẩm) | KHO | Mã sản phẩm duy nhất; trùng ⇒ báo lỗi tiếng Việt |
| Nhập nhanh một chiếc (qua phiếu nhập) kèm 3 ảnh, vị trí | KHO | Có mã nội bộ + tem QR in được; chiếc `Sẵn sàng bán`; ảnh có ảnh thu nhỏ |
| Nhập serial đã tồn tại (cùng thương hiệu) | KHO | Chặn, gợi ý mở chiếc cũ |
| Tìm "seiko 5", "SRPD55", serial, mã nội bộ, quét QR bằng camera điện thoại | BH | Ra đúng chiếc ≤ 1 giây; gõ không dấu/sai nhẹ vẫn ra |
| Đổi giá niêm yết, đặt khuyến mãi theo ngày | CH | Có lịch sử giá (cũ, mới, ai, lúc nào); BH không sửa được giá |
| Đổi vị trí; xem lịch sử trạng thái | KHO | Lịch sử đủ, không sửa/xóa được |
| Chiếc cũ không có ảnh tình trạng/hạng ⇒ thử đưa vào bán | KHO | Chặn (BR-UNIT-10) |
| CTV đăng nhập | CTV | Chỉ thấy chiếc `Sẵn sàng bán` được đánh dấu cho CTV; thấy giá bán, **không** giá vốn/NCC |

### UAT-02 — Nhập hàng & giá vốn  *(SC-01, SC-11, SC-17; bản gốc "nhập hàng và tính đúng giá vốn")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Làm lại **SC-01** (3 đồng hồ + vận chuyển 120.000, trả NCC 5.000.000) | KHO, CH | Giá vốn A/B/C = **6.060.000 / 1.212.000 / 4.848.000**; công nợ NCC **7.120.000**; quỹ tiền mặt **15.000.000** |
| Trả NCC 8.000.000 (vượt dư nợ) | CH | Chặn `WF-PUR-OVERPAY` |
| Thu mua từ khách (thiếu ảnh giấy tờ ⇒ chặn; đủ ⇒ in biên bản) | KHO | Đúng BR-PUR-09; CCCD hiện dạng che |
| Hủy phiếu nhập chưa phát sinh gì (SC-17a); hủy phiếu có chiếc đã bán (SC-17c) | CH | Ca a: về 0; ca c: chặn `WF-PUR-HAS-DEPENDENTS` |
| Điều chỉnh giá vốn +200.000 có lý do (SC-17d) | CH | Có bút toán điều chỉnh; KHO không có quyền |
| Xuất phiếu nhập ra PDF/Excel | KHO | Số liệu khớp màn hình; BH không xem được phiếu nhập |
| Phiếu tồn đầu kỳ (`opening`) | CH | Không tạo công nợ/tiền; báo cáo ghi "Tồn đầu kỳ" |

### UAT-03 — Bán hàng, thanh toán, in, đổi trả  *(SC-02…07, SC-15; bản gốc "bán hàng, thanh toán, in hóa đơn, trừ kho" + "đổi trả và hoàn kho")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| **SC-02**: bán A 8.200.000 (giảm 300.000), 5.000.000 tiền mặt + 3.200.000 chuyển khoản | BH | Lãi gộp **2.140.000**; A `Đã bán`; quỹ đúng; bảo hành 12 tháng; ≤ 3 chạm từ trang chủ |
| In phiếu 80mm và A5; in lại | BH | Đúng nội dung; bản in lại có "BẢN IN LẠI" |
| Bán chiếc đã bán / đang giữ | BH | Chặn `WF-SALE-UNIT-UNAVAILABLE` |
| Giảm giá quá hạn mức 5% | BH | Chặn `WF-SALE-DISCOUNT-LIMIT`; CH làm được |
| **SC-03**: khách đưa 7.000.000, hàng 6.500.000 | BH | Tiền thừa **500.000**, sổ quỹ chỉ ghi 6.500.000 |
| **SC-04**: bán nợ, hẹn trả, thu nợ chuyển khoản | BH | Nợ **1.300.000 → 300.000**; thu vượt dư nợ bị chặn |
| **SC-05**: giữ hàng có cọc → chuyển thành bán; hoàn cọc; tịch thu (CH) | BH, CH | Cọc không là doanh thu; BH không tịch thu được |
| **SC-06**: thu cũ đổi mới | BH | Doanh thu **20.000.000**; máy cũ `Chờ kiểm tra`, giá vốn **6.000.000**; thiếu giấy tờ người bán bị chặn |
| **SC-07**: đổi trả trong 7 ngày, hoàn tiền | BH, CH | Kho/quỹ/doanh thu đảo đúng ngày đổi trả; quá 7 ngày chỉ CH (override) |
| **SC-15**: hủy phiếu trong 24 giờ | CH | Như chưa xảy ra; BH không hủy được |
| Bán linh kiện lẻ (dây) cùng phiếu | BH | Trừ kho linh kiện; giá vốn bình quân |
| Tra cứu lịch sử hóa đơn theo khách, theo ngày | BH | Đúng và nhanh |
| Mất mạng giữa lúc lập phiếu → có mạng lại → bấm xác nhận 2 lần | BH | Nháp còn nguyên; chỉ **một** phiếu được tạo |

### UAT-04 — Kho, linh kiện, kiểm kê, thông báo  *(SC-14; FR-STK-*, FR-PART-*, FR-PLAT-02)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Nhập/điều chỉnh linh kiện (cần lý do) | KHO | Có lịch sử xuất–nhập; giá bình quân đúng (SC-11d/e) |
| **SC-14**: kiểm kê bằng quét QR; chiếc không thấy ⇒ ghi mất; linh kiện lệch | KHO | Tổn thất **3.080.000**; chốt thiếu lý do bị chặn |
| Cảnh báo linh kiện ≤ ngưỡng; hàng tồn > 90 ngày; giữ hàng quá hạn | KHO, CH | Chuông thông báo đúng người, có liên kết mở thẳng màn hình xử lý |
| Hàng tồn lâu có trong báo cáo R5 | CH | Đúng 123 ngày cho chiếc I |

### UAT-05 — Tổng quan & lãi gộp  *(SC-10; bản gốc "tính lãi gộp")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Làm **SC-10** (chạy lần lượt SC-01…04) | CH | Doanh thu **16.500.000**, giá vốn **12.120.000**, lãi gộp **4.380.000**; thực thu **15.200.000**; công nợ khách **1.300.000** |
| So Tổng quan với báo cáo R1/R2/R4/R6/R8 cùng khoảng ngày | CH | Giống nhau tuyệt đối |
| BH mở Tổng quan | BH | Thấy doanh thu, **không** thấy lãi/giá vốn/công nợ NCC |
| Đổi khoảng ngày; biểu đồ doanh thu–lãi | CH | Cập nhật đúng; dùng được trên điện thoại |

### UAT-06 — Sửa chữa, linh kiện, tiền công thợ  *(SC-08, SC-09; bản gốc "phiếu sửa chữa, linh kiện sử dụng và tiền công")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Nhận máy (thiếu ảnh bị chặn), cọc 200.000, in phiếu nhận | BH | Có mã phiếu, ảnh hiện trạng không xóa được |
| Giao việc; thợ kiểm tra, thêm nhân công + linh kiện, báo giá; ghi khách đồng ý | CH, TH, BH | Chưa ghi đồng ý ⇒ không chuyển `Đang sửa` |
| Thợ **xác nhận dùng** linh kiện | TH | Kho giảm đúng (LK-0001 10→9; LK-0002 5→4); không thể âm |
| Hoàn thành → giao → thu 700.000 | BH | **SC-08**: doanh thu **900.000**, giá vốn linh kiện **330.000**, tiền công T1 **120.000**, lãi gộp sửa **450.000**; bảo hành 90 ngày |
| Thợ T2 (`fixed_per_service`) — **SC-08, ca 8b** | TH | Tiền công **50.000**; lãi gộp **75.000** |
| Bảo hành miễn phí — **SC-08, ca 8c** | BH | Doanh thu 0; ghi chi phí bảo hành 80.000 |
| Sửa nội bộ rồi bán — **SC-09** | CH, BH | Giá vốn **4.350.000**; lãi gộp bán **1.650.000** |
| Thợ T1 mở phiếu không giao cho mình / mở giá vốn | TH | Không thấy (404/403); chỉ thấy tiền công **của mình** |
| Máy hoàn thành quá 14 ngày chưa lấy (`repair.pickup_alert_days`) | BH | Có cảnh báo |
| Tra lịch sử sửa chữa theo serial | BH | Gộp cả máy khách và máy của cửa hàng |

### UAT-07 — Thu chi, công nợ, báo cáo & xuất file  *(SC-10, SC-13, SC-16; bản gốc "báo cáo thu chi")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Ghi phiếu chi (điện, vận chuyển…), thu khác, chuyển quỹ | CH | Số dư đúng; quỹ không âm (chặn nếu âm) |
| **SC-13**: vay 50.000.000, thu hộ | CH | Doanh thu và thực thu bán/sửa vẫn **0**; hiển thị riêng "Vay/thu hộ" |
| **SC-16**: kiểm đếm tiền mặt, điều chỉnh lệch 50.000, đối chiếu, **khóa kỳ**, thử ghi vào kỳ đã khóa, mở lại | CH | Cuối kỳ **41.150.000**; ghi vào kỳ khóa bị chặn; mở kỳ có lý do và audit |
| Hủy phiếu thu/chi | CH | Có bút toán đảo, không xóa |
| Báo cáo R1…R12: lọc ngày, xuất Excel/PDF | CH | Số liệu Excel = màn hình; có người xuất, thời điểm |
| BH xuất báo cáo doanh thu | BH | File **không** có cột giá vốn/lãi |
| Báo cáo công nợ khách và NCC | CH | Khớp SC-04/SC-01 |

### UAT-08 — Điện thoại, máy tính, PWA, mất mạng  *(bản gốc "sử dụng trên máy tính và điện thoại"; FR-BAK-06/07, FR-PLAT-06)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Mở bằng điện thoại thật (≥ 1 iPhone/Android) và máy tính; làm lại **SC-02** và nhận máy sửa | BH | Không phải kéo ngang; nút bấm đủ lớn; chữ nhập không bị phóng to |
| Cài lên màn hình chính | BH | Mở như ứng dụng, có biểu tượng đúng |
| Chụp ảnh + quét QR bằng camera (Android và iOS) | KHO | Quét được; iOS dùng được đường dự phòng |
| Chế độ sáng/tối | BH | Đọc rõ cả hai |
| Ngắt mạng khi lập phiếu; có biểu ngữ "Mất kết nối" | BH | Nháp giữ; nút Xác nhận khóa tới khi có mạng; không mất dữ liệu |
| Đo tốc độ POS với 20 người đồng thời (script tải nhẹ) | KT | p95 mở màn hình bán hàng ≤ 2 giây trên 4G |

### UAT-09 — Sao lưu, khôi phục, giám sát  *(BR-BAK-*; bản gốc "sao lưu và khôi phục")*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Workflow sao lưu đêm chạy thành công ≥ 3 đêm liên tiếp | KT | Có bản mã hóa; nhịp tim báo về ứng dụng |
| **Diễn tập khôi phục**: dựng DB tạm từ bản sao lưu → đăng nhập → chạy `fn_consistency_check()` → so số liệu với staging | KT + CH quan sát | Số dòng/số dư khớp; sạch; **có biên bản** (`backup-restore` §6) |
| Giả lập mất bản sao lưu > 36 giờ | KT | `/api/health?deep=1` báo lỗi; chủ nhận cảnh báo |
| Mô phỏng sự cố cron | KT | `job_runs` ghi lỗi, chủ nhận thông báo |
| Chủ biết nơi xem trạng thái sao lưu và ai gọi khi sự cố | CH | Trả lời được |

### UAT-10 — Phân quyền, cài đặt, hướng dẫn & bàn giao  *(bản gốc "kiểm tra phân quyền nhân viên"; FR-SEC-*, FR-PLAT-01/05, FR-BAK-08)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Đăng nhập, đổi mật khẩu, bật TOTP, đăng xuất; sai mật khẩu 5 lần | tất cả | Khóa tạm 15 phút; TOTP bắt buộc với CH |
| Lần lượt mỗi vai trò thử mở màn hình/URL/API **không có quyền** (script PT + thao tác tay) | tất cả | Bị chặn bằng 403/ẩn menu; **giá vốn, lãi, công nợ không lộ** ở UI, báo cáo, Excel, in |
| CTV: không thấy khách/đơn của người khác; chỉ thấy hoa hồng của mình (**SC-12**) | CTV | Hoa hồng **428.000**; xác nhận đơn bị chặn |
| Đổi hạn mức giảm giá của vai trò BH; hạ quyền một người | CH | Có hiệu lực ngay; có nhật ký |
| Thử khóa/hạ quyền chủ cuối cùng | CH | Chặn (BR-SEC-07) |
| Xem Nhật ký hoạt động: ai tạo/sửa/xác nhận/hủy | CH | Đủ, không sửa/xóa được |
| Đổi cài đặt (ngưỡng, hạn đổi trả, thông tin in phiếu) | CH | Có lịch sử thay đổi |
| Mở **Hướng dẫn sử dụng** theo vai trò; đọc "Hướng dẫn nhanh" | tất cả | Đúng vai trò, làm theo được |
| Buổi đào tạo: mỗi người **tự làm đúng** kịch bản của vai trò mình | tất cả | Danh sách đã đào tạo lưu ở `runbook` |
| Bàn giao: checklist `runbook` §7 | CH, KT | Tất cả ☑ |

## 4. Đối chiếu với tiêu chí nghiệm thu của bản gốc

| Tiêu chí gốc (mục V) | Ca UAT | Tự động hóa tương ứng |
|---|---|---|
| Kiểm tra nhập hàng và tính đúng giá vốn | UAT-02 | SC-01, SC-11, SC-17 |
| Kiểm tra bán hàng, thanh toán, in hóa đơn và trừ kho | UAT-03 | SC-02, SC-03, SC-04, CT-01, CT-07 |
| Kiểm tra đổi trả hàng và hoàn kho | UAT-03 | SC-07, SC-15, CT-08 |
| Kiểm tra tính lãi gộp và báo cáo thu chi | UAT-05, UAT-07 | SC-10, SC-13, SC-16 |
| Kiểm tra phiếu sửa chữa, linh kiện sử dụng và tiền công | UAT-06 | SC-08, SC-09, CT-04 |
| Kiểm tra phân quyền nhân viên | UAT-10 | PT-01…PT-12 |
| Kiểm tra sao lưu và khôi phục dữ liệu | UAT-09 | Q7 |
| Kiểm tra sử dụng trên máy tính và điện thoại | UAT-08 | e2e 390px |

## 5. Tiêu chí đạt

- **Mọi** UAT-01…10 đạt; **không** còn lỗi S0/S1; lỗi S2 có kế hoạch sửa kèm ngày; S3 ghi vào danh sách tồn.
- Mọi con số trong cột "Kết quả đúng" trùng khít `golden-scenarios`.
- Sau UAT: `fn_consistency_check()` sạch trên staging.
- Biên bản UAT (mẫu §7) có đủ chữ ký người làm từng vai trò và chủ cửa hàng.

## 6. Checklist go-live

### 6.1 Trước ngày go-live
| ☐ | Việc | Ghi chú |
|---|---|---|
| ☐ | UAT-01…10 đạt, biên bản ký | §5 |
| ☐ | Câu hỏi mở Q1…Q7 (`vision-scope` §7) đã có câu trả lời hoặc quyết định chấp nhận rủi ro bằng văn bản | Đặc biệt Q1 (hóa đơn/thuế), Q2 (đổi trả), Q3 (hạn mức giảm giá) |
| ☐ | Production: Supabase Pro + Vercel Pro, vùng Singapore, **Data API đã tắt**, biến môi trường đủ, **khóa mới riêng cho production** | `runbook` §8 |
| ☐ | Migration đã áp lên production (dry-run trước); **không** chạy seed demo trên production | `release-process` |
| ☐ | Tài khoản thật: chủ có MFA, mã khôi phục đã cất; nhân viên có tài khoản và đổi mật khẩu tạm | |
| ☐ | Quỹ + số dư đầu kỳ, `finance.books_start_date`, hạng mục, hạn mức giảm giá, hồ sơ thợ/CTV, thông tin in phiếu đã nhập | `runbook` §8 |
| ☐ | **Tồn đầu kỳ** nhập bằng phiếu `opening` từ kiểm kê vật lý; đối chiếu số lượng và giá trị với sổ/kiểm kê | Biên bản đối chiếu |
| ☐ | Sao lưu production chạy ≥ 1 đêm; diễn tập khôi phục production-like đã có biên bản | UAT-09 |
| ☐ | Hai monitor uptime; email cảnh báo đến đúng người | |
| ☐ | Bàn giao quyền sở hữu tài khoản/tên miền/mã nguồn; ≥ 2 người có thể khôi phục | `runbook` §7 |
| ☐ | Đào tạo xong cho từng vai trò; hướng dẫn nhanh đã in dán quầy | |
| ☐ | Phiên bản đã tăng, changelog đã viết | |

### 6.2 Ngày go-live
1. Sao lưu thủ công production ngay trước khi nhập dữ liệu thật.
2. Chốt kiểm kê vật lý → nhập tồn đầu kỳ → đối chiếu → khóa việc nhập `opening` (thu hồi quyền `purchase.confirm` loại `opening` nếu muốn).
3. Làm **một giao dịch thật nhỏ** cho mỗi luồng (nhập 1 chiếc, bán 1 chiếc, nhận 1 máy sửa) có chủ đứng cạnh; chạy `fn_consistency_check()`.
4. Mở cho nhân viên dùng. Người kỹ thuật túc trực.

### 6.3 Giai đoạn theo dõi sát (2 tuần đầu)
- Mỗi cuối ngày: **chốt ngày** (đối chiếu tiền mặt/ngân hàng với thực tế), chủ xem báo cáo ngày; lệch ⇒ điều chỉnh có lý do và ghi nhận nguyên nhân.
- **Chạy song song sổ cũ** (sổ tay/Excel) tối thiểu 1–2 tuần cho doanh thu, thu chi, tồn kho; so sánh mỗi ngày. Chỉ ngừng sổ cũ khi số liệu khớp liên tục 7 ngày.
- Mỗi sáng xem `/quan-tri` → Hệ thống (lỗi, cron, sao lưu); thu thập phản hồi người dùng; sửa lỗi nhỏ theo `release-process`.
- Cuối tuần 2: họp rà soát, cập nhật hướng dẫn và danh sách lỗi tồn.

### 6.4 Tiêu chí dừng / quay lại
Quay về sổ cũ tạm thời và dừng nhập dữ liệu mới nếu: lệch quỹ/kho không giải thích được, `fn_consistency_check()` báo vi phạm, lộ dữ liệu nhạy cảm, hoặc hệ thống không truy cập được > 2 giờ trong giờ mở cửa. Khi đó: giữ nguyên dữ liệu, sao lưu, mở biên bản sự cố (`runbook` §9), sửa, rồi chạy lại các ca UAT liên quan trước khi tiếp tục.

## 7. Mẫu biên bản UAT

```
Phiên bản: x.y.z     Môi trường: staging     Ngày: yyyy-mm-dd
Thiết bị: <điện thoại/hệ điều hành>, <máy tính/trình duyệt>

Ca     | Người làm | Kết quả (Đạt/Không đạt) | Lỗi (ID, mức S0–S3) | Ghi chú
UAT-01 |           |                         |                     |
...
UAT-10 |           |                         |                     |

Tổng kết: ___/10 đạt · S0: _ · S1: _ · S2: _ · S3: _
Kết luận: [ ] Đủ điều kiện go-live   [ ] Chưa đủ — việc cần làm: ...
Chữ ký: Chủ cửa hàng ........  Người kỹ thuật ........  Đại diện từng vai trò ........
```
