# Nghiệm thu (UAT) & checklist go-live

> Cập nhật lần cuối: 2026-10-18 · Trạng thái: Duyệt (viết lại theo `customer-feedback-02`: sáu việc của chủ cửa hàng — không còn giá vốn/thanh toán/nợ/cọc/linh kiện/kiểm kê) · Thay cho "V. Tiêu chí nghiệm thu" của bản yêu cầu gốc · Số liệu chuẩn: `golden-scenarios` · Kiểm thử tự động: `test-plan`

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
| **Thêm đồng hồ** (1 chiếc) kèm ảnh, giá niêm yết, vị trí | KHO | Có mã nội bộ + tem QR in được; chiếc `Sẵn sàng bán`; ảnh có ảnh thu nhỏ; **không** có ô giá nhập/giá vốn/nguồn bắt buộc |
| Thêm đồng hồ có serial đã tồn tại (cùng thương hiệu) | KHO | Chặn `WF-UNIT-SERIAL-DUPLICATE`, gợi ý mở chiếc cũ |
| Tìm "seiko 5", "SRPD55", serial, mã nội bộ, quét QR bằng camera điện thoại | BH | Ra đúng chiếc ≤ 1 giây; gõ không dấu/sai nhẹ vẫn ra |
| Đổi giá niêm yết, đặt khuyến mãi theo ngày | CH | Có lịch sử giá (cũ, mới, ai, lúc nào); BH không sửa được giá |
| Đổi vị trí; xem lịch sử trạng thái | KHO | Lịch sử đủ, không sửa/xóa được |
| Chiếc cũ không có ảnh tình trạng/hạng ⇒ thử đưa vào bán | KHO | Chặn (BR-UNIT-10) |
| Mọi vai trò xem chi tiết chiếc, danh sách, tìm kiếm | CH, BH, KHO | **Không** có giá thu/giá vốn/lãi ở bất kỳ màn nào (CF-14) |
| **Nhập Excel** (Menu): khách và đồng hồ; xem trước → chọn dòng → nhập | KHO, CH | Xem trước không ghi gì; dòng trùng/lỗi nêu lý do; không có cột giá vốn/CCCD/nhóm (BR-IMP-07) |

### UAT-02 — Giao diện thêm hàng gọn  *(FR-UNIT-01; thay "Nhập hàng & giá vốn" — CF-14)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Thêm 3 chiếc liên tiếp (nút "Thêm chiếc khác") | KHO | Mỗi lần ≤ 3 chạm tới lúc lưu; bấm đúp chỉ tạo **một** chiếc |
| Tìm menu "Nhập hàng", "Nhà cung cấp", "Linh kiện", "Kiểm kê" | CH, KHO | **Không tồn tại** (đã bỏ) |
| Sai ngày (tương lai) | KHO | Chặn `WF-DOC-FUTURE` |

### UAT-03 — Ghi đơn bán, bảo hành, in, hủy  *(SC-19, SC-15)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| **SC-19**: ghi đơn khách mới "Khách Mẫu" (0912 000 111), A 8.700.000 (bảo hành mặc định) + B 2.500.000 (bảo hành 0) | BH | Đơn `HD-…` tổng **11.200.000**; A, B `Đã bán`; bảo hành chỉ cho A (+12 tháng); không có thanh toán/nợ; bán thấp hơn niêm yết chỉ hiển thị chênh; ≤ 3 chạm từ trang chủ |
| Ghi đơn lần sau cùng SĐT | BH | Dùng lại khách cũ, không tạo trùng |
| Ghi chiếc đã bán / trùng chiếc trong đơn / ngày tương lai / thiếu khách | BH | `WF-SALE-UNIT-UNAVAILABLE` / `WF-VALIDATION` / `WF-DOC-FUTURE` / `WF-SALE-CUSTOMER-REQUIRED` |
| Hai người cùng ghi một chiếc | BH, CH | Đúng một đơn thành công (CT-01) |
| In phiếu lần 1 và lần 2 (PDF A5/80mm) | BH | Đúng nội dung + hạn bảo hành; lần 2 có "BẢN IN LẠI" |
| Tra cứu đơn theo tên không dấu, SĐT, mã đơn, serial; lọc kênh | BH | Đúng và nhanh |
| **SC-15**: hủy đơn (lý do ≥ 10 ký tự + nhập lại mật khẩu) | CH | Chiếc về `Sẵn sàng bán`, bảo hành hủy; BH không hủy được; quá 24 giờ ⇒ chặn |
| Mất mạng giữa lúc lập đơn → có mạng lại → bấm lưu 2 lần | BH | Nháp cục bộ còn nguyên; chỉ **một** đơn được tạo |
| Tìm màn thanh toán, nợ, giữ hàng, thu cũ đổi mới, giảm giá | BH, CH | **Không tồn tại** (CF-13) |

### UAT-04 — Thông báo & việc cần xử lý  *(FR-PLAT-02, FR-NAV-02)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| CTV báo "đã bán" | CTV, CH | Chuông + thông báo đẩy tới người xác nhận, mở thẳng "Báo bán chờ xác nhận"; huy hiệu số vàng; đỏ khi chờ > 1 ngày |
| Máy sửa mới nhận / quá hẹn / xong chưa lấy | CH | Huy hiệu đúng (vàng/đỏ) ở mục Sửa chữa; chỉ số lượng, không tiền |
| Vai trò kho / CTV | KHO, CTV | Không thấy huy hiệu việc bán/sửa |

### UAT-05 — Tổng quan  *(SC-10)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Làm **SC-10** (2 đơn cửa hàng + 1 đơn CTV + 1 máy sửa trong ngày) | CH | Doanh thu **16.640.000** (cửa hàng 14.700.000 + CTV 1.800.000 + sửa 140.000); 3 đơn, 3 chiếc |
| So Tổng quan với báo cáo Doanh thu / Số lượng cùng khoảng ngày | CH | Giống nhau tuyệt đối |
| BH, KHO, CTV mở Tổng quan | BH, KHO, CTV | BH: doanh thu + số chiếc; KHO: chỉ kho; CTV: không thẻ số cửa hàng |
| Đổi khoảng ngày (hôm nay/7 ngày/tháng/quý/năm); biểu đồ | CH | Cập nhật đúng; so sánh kỳ trước; dùng được trên điện thoại |

### UAT-06 — Sửa chữa (gọn) & bảo hành  *(SC-07, SC-08)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Nhận máy của khách mới (tên + SĐT bắt buộc), **không ảnh** (hợp lệ), in phiếu nhận | CH | Có mã phiếu; cùng SĐT lần sau dùng lại khách; thiếu SĐT bị chặn |
| Ghi tiến độ; thêm *Bảo dưỡng máy* (300.000) + khoản khác *Thay dây da* 200.000 | CH | Tạm tính **500.000**; khoản khác phải có nội dung |
| Sửa xong → khóa khoản → giao máy | CH | **SC-08**: doanh thu **500.000** ghi ngày giao; bảo hành 90 ngày; không có ô thu tiền/cọc/linh kiện |
| **SC-07**: nhận máy chọn bảo hành còn hạn của khách | CH | Phiếu `warranty_free`: doanh thu 0; BH không thấy danh sách bảo hành |
| Bảo hành hết hạn | CH | Chọn bảo hành bị chặn `WF-WAR-EXPIRED`; nhận máy tính phí được |
| Hủy phiếu (lý do ≥ 10 ký tự) | CH | `cancelled`, doanh thu 0 |
| BH/KHO/CTV mở màn Sửa chữa | BH, KHO, CTV | Không có quyền (không thấy màn, API 403) |
| Máy hoàn thành quá 14 ngày chưa lấy | CH | Có cảnh báo |

### UAT-07 — Báo cáo & xuất file  *(SC-10)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Báo cáo **Doanh thu** theo ngày/tháng/quý/năm | CH | Cửa hàng / CTV / sửa chữa / tổng, số đơn, số chiếc; ngày không phát sinh trống |
| Báo cáo **Số lượng đồng hồ** | CH, KHO | Đã bán theo hãng & kênh; đang có theo hãng; đang giao CTV |
| Báo cáo **Cộng tác viên** | CH | Số chiếc + doanh thu theo CTV và theo kỳ; BH/KHO/CTV ⇒ 403 |
| Xuất Excel, in | CH, BH | Số liệu Excel = màn hình; ghi audit; **không** có cột giá vốn/lãi/nợ |
| Tìm báo cáo Lợi nhuận, Tồn kho theo giá vốn, Phiếu còn nợ, Tiền thu | CH | **Không tồn tại** (CF-14) |

### UAT-08 — Điện thoại, máy tính, PWA, mất mạng, giao diện Glass  *(FR-BAK-06/07, FR-PLAT-06/07)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| Mở bằng điện thoại thật (≥ 1 iPhone/Android) và máy tính; làm lại **SC-19** và nhận máy sửa | BH, CH | Không phải kéo ngang; nút bấm đủ lớn; chữ nhập không bị phóng to |
| **So giao diện với mẫu v6-glass**: dock nổi + nút "+", tiêu đề lớn, thẻ kính, màu trạng thái; desktop: sidebar đảo nổi + thanh trên | CH | Đúng phong cách khách đã chọn; không có màn đã loại (Thu chi, Đổi trả, Thợ, NCC) |
| Cài lên màn hình chính | BH | Mở như ứng dụng, có biểu tượng đúng |
| Chụp ảnh + quét QR bằng camera (Android và iOS) | KHO | Quét được; iOS dùng được đường dự phòng |
| Ngắt mạng khi lập phiếu; có biểu ngữ "Mất kết nối" | BH | Nháp giữ; nút Xác nhận khóa tới khi có mạng; không mất dữ liệu |
| Đo tốc độ màn ghi đơn bán với 20 người đồng thời (script tải nhẹ) | KT | p95 mở màn hình bán hàng ≤ 2 giây trên 4G |
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
| Hạ quyền một người / đổi vai trò | CH | Có hiệu lực ngay; có nhật ký; mục của tính năng đã bỏ không hiện ở Vai trò & quyền |
| Thử khóa/hạ quyền chủ cuối cùng | CH | Chặn (BR-SEC-07) |
| Xem **Nhật ký** (một trang, hai mục: "Thay đổi dữ liệu" và "Truy cập & đăng nhập"): ai tạo/sửa/xác nhận/hủy | CH | Đủ, không sửa/xóa được |
| Đổi cài đặt (ngưỡng, hạn bảo hành, thông tin in phiếu) | CH | Có lịch sử thay đổi |
| Mở **Hướng dẫn sử dụng** theo vai trò; đọc "Hướng dẫn nhanh" | tất cả | Đúng vai trò, làm theo được |
| Buổi đào tạo: mỗi người **tự làm đúng** kịch bản của vai trò mình | tất cả | Danh sách đã đào tạo lưu ở `runbook` |
| Bàn giao: checklist `runbook` §7 | CH, KT | Tất cả ☑ |

### UAT-11 — Cộng tác viên: giao nhiều người → ai báo trước được → xác nhận → thống kê  *(SC-18; CT-14; PT-14; CF-10…12)*
| Bước | Người | Kết quả đúng |
|---|---|---|
| **SC-18 bước 1**: chủ giao A cho C1 **và** C2, B cho C2 (chọn nhiều chiếc × nhiều CTV) | CH | Chiếc **vẫn `Sẵn sàng bán`**; mỗi cặp một chào hàng; giao lại không nhân đôi; BH giao ⇒ chặn |
| C1, C2 đăng nhập điện thoại | CTV | C1 thấy A; C2 thấy A, B — mỗi chiếc có ảnh, thông số, **giá niêm yết**; **không** giá vốn, doanh thu, đơn bán, khách, chiếc của người khác; menu chỉ có Hàng của tôi / Báo bán của tôi / Thống kê |
| C1 bấm **Đã bán** A (tên + SĐT khách) | CTV | Báo bán chờ xác nhận; **không có ô nhập giá**; màn C2 hiện A "CTV khác đã báo bán" |
| C2 bấm **Đã bán** A | CTV | Bị chặn `WF-COL-CLAIMED` |
| C1 và C2 cùng bấm **Đã bán** B cùng lúc | CTV | Đúng một người thành công (CT-14) |
| BH ghi đơn bán A trực tiếp trong lúc có báo bán chờ | BH | Chặn `WF-SALE-UNIT-CLAIMED` |
| Chủ **Xác nhận** báo bán A (giá mặc định) | CH | Đơn **8.500.000**; A `Đã bán`; C2 thấy A biến mất; thông báo "chiếc đã có người bán" cho C2; bảo hành tạo |
| Chủ **Xác nhận** báo bán B với giá **4.500.000**; một báo bán khác bị **Từ chối** (lý do ngắn bị chặn) | CH | Doanh thu CTV **13.000.000** (2 chiếc); báo bán từ chối ⇒ chiếc mở lại cho CTV |
| CTV rút báo bán còn chờ | CTV | Về `cancelled` |
| **Thu hồi** chào hàng một CTV / tất cả; thu hồi khi có báo bán chờ | CH | Thành công / chặn `WF-COL-CLAIM-PENDING` |
| Hủy đơn A trong 24 giờ | CH | A về `Sẵn sàng bán`; báo bán `voided`; chào hàng không tự mở lại; giao lại được |
| **Thống kê** CTV theo ngày/tháng/quý/năm | CH, CTV | CH: số chiếc + doanh thu theo CTV; CTV: **chỉ số chiếc** của mình |
| Báo bán chờ > 1 ngày | CH | Nhắc trong chuông; huy hiệu đỏ |

## 4. Đối chiếu với tiêu chí nghiệm thu của bản gốc

| Tiêu chí gốc (mục V) | Ca UAT | Tự động hóa tương ứng |
|---|---|---|
| Kiểm tra nhập hàng và tính đúng giá vốn | **Bỏ** (CF-14); còn "Thêm đồng hồ" ở UAT-01/02 | CT-07, CT-09 (`m4-add-unit`) |
| Kiểm tra bán hàng, in hóa đơn và trừ kho | UAT-03 (đơn bán gọn — không thanh toán) | SC-19, CT-01, CT-07 |
| Kiểm tra đổi trả hàng và hoàn kho | **Thay bằng bảo hành** (CF-02): UAT-06 (SC-07); giao/thu hồi CTV ở UAT-11 | SC-07, SC-18, SC-15 |
| Kiểm tra tính lãi gộp và báo cáo thu chi | **Bỏ** (CF-07, CF-14): thay bằng báo cáo doanh thu/số lượng/CTV — UAT-05, UAT-07 | SC-10 |
| Kiểm tra phiếu sửa chữa, linh kiện sử dụng và tiền công | UAT-06 (không còn linh kiện, tiền công — CF-04, CF-16) | SC-08 |
| Kiểm tra phân quyền nhân viên | UAT-10, UAT-11 | PT-01…PT-14 |
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
