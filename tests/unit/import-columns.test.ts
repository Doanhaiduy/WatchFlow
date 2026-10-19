import { describe, expect, it } from "vitest";
import {
  CUSTOMER_COLUMNS, WATCH_COLUMNS, foldText, headerKey, normalizePhoneVN, normSerial, parseCondition, parseCsv, parseGrade,
  parseMoneyVnd, rowsFromTable, sniffFile,
} from "@/lib/import/columns";

describe("tên cột", () => {
  it("nhận tiếng Việt có/không dấu và đồng nghĩa", () => {
    expect(headerKey(CUSTOMER_COLUMNS, "Họ và tên *")).toBe("fullName");
    expect(headerKey(CUSTOMER_COLUMNS, "HO TEN")).toBe("fullName");
    expect(headerKey(CUSTOMER_COLUMNS, "Tên khách hàng")).toBe("fullName");
    expect(headerKey(CUSTOMER_COLUMNS, "SĐT")).toBe("phone");
    expect(headerKey(CUSTOMER_COLUMNS, "Điện thoại")).toBe("phone");
    expect(headerKey(CUSTOMER_COLUMNS, "Địa chỉ")).toBe("address");
    // Bản gọn (CF-13): không còn cột nhóm khách / CCCD / email
    expect(headerKey(CUSTOMER_COLUMNS, "Nhóm khách")).toBeNull();
    expect(headerKey(CUSTOMER_COLUMNS, "CCCD/CMND")).toBeNull();
    expect(headerKey(CUSTOMER_COLUMNS, "Cột lạ")).toBeNull();
  });
  it("phân biệt Hãng (thương hiệu) và Hạng (tình trạng) theo dấu", () => {
    expect(headerKey(WATCH_COLUMNS, "Hãng")).toBe("brand");
    expect(headerKey(WATCH_COLUMNS, "hang")).toBe("brand");
    expect(headerKey(WATCH_COLUMNS, "Hạng")).toBe("grade");
    expect(headerKey(WATCH_COLUMNS, "Hạng tình trạng")).toBe("grade");
    expect(headerKey(WATCH_COLUMNS, "Giá vốn (giá thu)")).toBeNull(); // bản gọn không nhập giá vốn
    expect(headerKey(WATCH_COLUMNS, "Giá niêm yết")).toBe("listPrice");
    expect(headerKey(WATCH_COLUMNS, "Vị trí kho")).toBe("location");
  });
  it("foldText bỏ dấu, đ→d", () => {
    expect(foldText("  Đồng Hồ  Cũ! ")).toBe("dong ho cu");
  });
});

describe("bảng → dòng", () => {
  it("tìm dòng tiêu đề, bỏ dòng trống và dòng [VÍ DỤ], giữ số dòng của tệp", () => {
    const t = rowsFromTable("customers", [
      ["Danh sách khách"],
      ["Họ và tên *", "SĐT", "Cột lạ", "Ghi chú"],
      ["Nguyễn A", 912334782, "x", ""],
      [],
      ["Trần B", "0900 000 002", "", "[VÍ DỤ] xóa dòng này"],
      ["Lê C", "", "", "ghi chú thật"],
    ]);
    expect(t.rows).toEqual([
      { line: 3, cells: { fullName: "Nguyễn A", phone: "912334782" } },
      { line: 6, cells: { fullName: "Lê C", note: "ghi chú thật" } },
    ]);
    expect(t.unknownHeaders).toEqual(["Cột lạ"]);
    expect(t.skippedExamples).toBe(1);
    expect(t.missingColumns).toEqual([]);
  });
  it("báo cột bắt buộc còn thiếu; không có tiêu đề ⇒ lỗi", () => {
    expect(rowsFromTable("watches", [["Hãng", "Serial", "Loại"], ["Seiko", "A1", "SRPD55"]]).missingColumns).toEqual(["Tình trạng"]);
    expect(() => rowsFromTable("customers", [["a", "b"], ["1", "2"]])).toThrow(/tiêu đề/);
  });
  it("parseCsv: BOM, chấm phẩy, ngoặc kép, xuống dòng trong ô", () => {
    expect(parseCsv('﻿Họ tên;SĐT\n"An; B";0900\r\n"x ""y"""; \n')).toEqual([["Họ tên", "SĐT"], ["An; B", "0900"], ['x "y"', " "]]);
  });
});

describe("SĐT Việt Nam", () => {
  it("chuẩn hóa các dạng", () => {
    expect(normalizePhoneVN("0912 334 782")).toEqual({ phone: "0912334782", fixed: false });
    expect(normalizePhoneVN("+84 912.334.782").phone).toBe("0912334782");
    expect(normalizePhoneVN("84912334782").phone).toBe("0912334782");
    expect(normalizePhoneVN("912334782")).toEqual({ phone: "0912334782", fixed: true });
    expect(normalizePhoneVN("(028) 3822 1234").phone).toBe("02838221234");
    expect(normalizePhoneVN("").phone).toBeNull();
  });
  it("từ chối số sai", () => {
    expect(normalizePhoneVN("12345").error).toBeTruthy();
    expect(normalizePhoneVN("+1 415 555 0100").error).toBeTruthy();
    expect(normalizePhoneVN("0912abc782").error).toBeTruthy();
    expect(normalizePhoneVN("091233478299999").error).toBeTruthy();
  });
});

describe("tiền & số", () => {
  it("nhận số nguyên đồng nhiều dạng", () => {
    expect(parseMoneyVnd("6000000").value).toBe(6_000_000);
    expect(parseMoneyVnd("6.000.000").value).toBe(6_000_000);
    expect(parseMoneyVnd("6,000,000đ").value).toBe(6_000_000);
    expect(parseMoneyVnd("6 000 000 VND").value).toBe(6_000_000);
    expect(parseMoneyVnd("6000000.0").value).toBe(6_000_000);
    expect(parseMoneyVnd("0").value).toBe(0);
    expect(parseMoneyVnd("").value).toBeNull();
  });
  it("từ chối âm, số lẻ, chữ, quá lớn", () => {
    expect(parseMoneyVnd("-100").error).toMatch(/âm/);
    expect(parseMoneyVnd("6500000.5").error).toBeTruthy();
    expect(parseMoneyVnd("12.5").error).toBeTruthy();
    expect(parseMoneyVnd("abc").error).toBeTruthy();
    expect(parseMoneyVnd("99999999999999999").error).toBeTruthy();
  });
});

describe("đồng hồ", () => {
  it("tình trạng", () => {
    expect(parseCondition("Mới")).toBe("new");
    expect(parseCondition("NEW")).toBe("new");
    expect(parseCondition("Cũ")).toBe("used");
    expect(parseCondition("Đã sửa")).toBe("refurbished");
    expect(parseCondition("Làm mới")).toBe("refurbished");
    expect(parseCondition("hỏng")).toBeNull();
  });
  it("hạng", () => {
    expect(parseGrade("a").value).toBe("A");
    expect(parseGrade("95 %").value).toBe("95%");
    expect(parseGrade("").value).toBeNull();
    expect(parseGrade("D").error).toBeTruthy();
    expect(parseGrade("120%").error).toBeTruthy();
  });
  it("serial chuẩn hóa như app.norm_serial", () => {
    expect(normSerial("imp 0001")).toBe("IMP0001");
    expect(normSerial("S5D-100.001/x_y")).toBe("S5D100001XY");
    expect(normSerial("  ")).toBeNull();
  });
});

describe("kiểm tệp (magic bytes)", () => {
  it("nhận diện", () => {
    expect(sniffFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]))).toBe("xlsx");
    expect(sniffFile(new TextEncoder().encode("a,b\n1,2"))).toBe("csv");
    expect(sniffFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe("unknown");
    expect(sniffFile(new Uint8Array([0x4d, 0x5a, 0, 0]))).toBe("unknown");
  });
});
