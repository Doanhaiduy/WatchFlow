import { describe, expect, it } from "vitest";
import { VN_BANKS, bankByBin, buildTransferContent, buildVietQrPayload, canBuildVietQr, crc16ccitt, stripDiacritics, transferContent } from "@/lib/vietqr";

/** Bóc chuỗi EMVCo thành các trường cấp 1 (id → giá trị); kiểm độ dài từng trường khớp đúng. */
function parseTlv(s: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    expect(Number.isInteger(len)).toBe(true);
    const val = s.slice(i + 4, i + 4 + len);
    expect(val.length).toBe(len); // độ dài khai báo = độ dài thật
    out.push([id, val]);
    i += 4 + len;
  }
  expect(i).toBe(s.length);
  return out;
}

describe("crc16ccitt", () => {
  it("vector chuẩn CRC-16/CCITT-FALSE: '123456789' ⇒ 0x29B1", () => {
    expect(crc16ccitt("123456789")).toBe(0x29b1);
  });
  it("chuỗi rỗng ⇒ giá trị khởi tạo 0xFFFF", () => {
    expect(crc16ccitt("")).toBe(0xffff);
  });
});

describe("buildVietQrPayload", () => {
  const base = { bankBin: "970436", accountNo: "0123456789" };

  it("QR động: có số tiền ⇒ trường 01 = 12; có 54, 58=VN, 53=704, 62.08 = nội dung", () => {
    const p = buildVietQrPayload({ ...base, amountVnd: 1_500_000, content: "HD-2026-0001" });
    const f = new Map(parseTlv(p));
    expect(f.get("00")).toBe("01");
    expect(f.get("01")).toBe("12");
    expect(f.get("53")).toBe("704");
    expect(f.get("54")).toBe("1500000");
    expect(f.get("58")).toBe("VN");
    expect(parseTlv(f.get("62")!)).toEqual([["08", "HD-2026-0001"]]);
    const napas = new Map(parseTlv(f.get("38")!));
    expect(napas.get("00")).toBe("A000000727");
    expect(napas.get("02")).toBe("QRIBFTTA");
    expect(parseTlv(napas.get("01")!)).toEqual([["00", "970436"], ["01", "0123456789"]]);
  });

  it("QR tĩnh: không số tiền ⇒ 01 = 11 và không có trường 54", () => {
    const f = new Map(parseTlv(buildVietQrPayload(base)));
    expect(f.get("01")).toBe("11");
    expect(f.has("54")).toBe(false);
    expect(f.has("62")).toBe(false);
  });

  it("CRC (trường 63) đúng: tính lại trên toàn chuỗi tới hết '6304' khớp 4 ký tự cuối, in HOA, đủ 4 ký tự", () => {
    for (const amount of [1, 50_000, 12_345_678, null]) {
      const p = buildVietQrPayload({ ...base, amountVnd: amount, content: "Cọc giữ hàng" });
      const tail = p.slice(-8);
      expect(tail.startsWith("6304")).toBe(true);
      const crc = p.slice(-4);
      expect(crc).toMatch(/^[0-9A-F]{4}$/);
      expect(crc16ccitt(p.slice(0, -4)).toString(16).toUpperCase().padStart(4, "0")).toBe(crc);
    }
  });

  it("nội dung tiếng Việt được bỏ dấu, IN HOA, bỏ ký tự lạ, tối đa 25 ký tự", () => {
    const p = buildVietQrPayload({ ...base, amountVnd: 1000, content: "Thanh toán đơn hàng Đồng Hồ Ánh Dương số 1" });
    const f = new Map(parseTlv(p));
    const content = parseTlv(f.get("62")!)[0]![1];
    expect(content).toBe("THANH TOAN DON HANG DONG");
    expect(content.length).toBeLessThanOrEqual(25);
    expect(content).toMatch(/^[A-Z0-9 -]+$/);
  });

  it("số tiền lẻ được làm tròn về đồng nguyên; số tiền ≤ 0 ⇒ QR tĩnh", () => {
    expect(new Map(parseTlv(buildVietQrPayload({ ...base, amountVnd: 100000.4 }))).get("54")).toBe("100000");
    expect(new Map(parseTlv(buildVietQrPayload({ ...base, amountVnd: 0 }))).get("01")).toBe("11");
  });

  it("khoảng trắng trong số tài khoản bị bỏ; thiếu BIN/STK hoặc sai định dạng ⇒ ném lỗi", () => {
    const f = new Map(parseTlv(buildVietQrPayload({ bankBin: "970436", accountNo: "0123 4567 89" })));
    expect(parseTlv(new Map(parseTlv(f.get("38")!)).get("01")!)[1]).toEqual(["01", "0123456789"]);
    expect(() => buildVietQrPayload({ bankBin: "", accountNo: "0123456789" })).toThrow();
    expect(() => buildVietQrPayload({ bankBin: "97043", accountNo: "0123456789" })).toThrow();
    expect(() => buildVietQrPayload({ bankBin: "970436", accountNo: "12" })).toThrow();
  });
});

describe("canBuildVietQr", () => {
  it("cần BIN 6 chữ số và STK 4–19 ký tự chữ-số", () => {
    expect(canBuildVietQr("970436", "0123456789")).toBe(true);
    expect(canBuildVietQr("970436", "")).toBe(false);
    expect(canBuildVietQr(null, "0123456789")).toBe(false);
    expect(canBuildVietQr("97043x", "0123456789")).toBe(false);
    expect(canBuildVietQr("970436", "0123-456789")).toBe(false);
  });
});

describe("tiếng Việt không dấu", () => {
  it("stripDiacritics xử lý cả Đ/đ", () => {
    expect(stripDiacritics("Đặng Thị Ánh Nguyệt")).toBe("Dang Thi Anh Nguyet");
    expect(stripDiacritics("đồng hồ")).toBe("dong ho");
  });
  it("transferContent: IN HOA, bỏ ký tự đặc biệt, gộp khoảng trắng, cắt ≤ max", () => {
    expect(transferContent("  Thu cọc #12 (Đồng hồ) ")).toBe("THU COC 12 DONG HO");
    expect(transferContent("a".repeat(40)).length).toBe(25);
    expect(transferContent("HD-2026-0001")).toBe("HD-2026-0001");
  });
});

describe("buildTransferContent (mẫu cài đặt)", () => {
  it("mẫu rỗng hoặc chỉ {code} ⇒ mã phiếu", () => {
    expect(buildTransferContent("", "HD-2026-0001")).toBe("HD-2026-0001");
    expect(buildTransferContent("{code}", "HD-2026-0001")).toBe("HD-2026-0001");
    expect(buildTransferContent(null, "SC-2026-0012")).toBe("SC-2026-0012");
  });
  it("mẫu có chữ tiếng Việt ⇒ bỏ dấu, ghép mã phiếu", () => {
    expect(buildTransferContent("Thanh toán {code}", "HD-2026-0001")).toBe("THANH TOAN HD-2026-0001");
  });
  it("quá 25 ký tự ⇒ cắt phần mẫu, giữ nguyên mã phiếu", () => {
    const r = buildTransferContent("Cửa hàng đồng hồ Ánh Dương {code}", "HD-2026-0001");
    expect(r.length).toBeLessThanOrEqual(25);
    expect(r.endsWith("HD-2026-0001")).toBe(true);
  });
});

describe("danh sách ngân hàng", () => {
  it("BIN 6 số, không trùng; tra theo BIN", () => {
    const bins = VN_BANKS.map((b) => b.bin);
    expect(new Set(bins).size).toBe(bins.length);
    for (const b of bins) expect(b).toMatch(/^\d{6}$/);
    expect(bankByBin("970436")?.name).toBe("Vietcombank");
    expect(bankByBin("000000")).toBeNull();
    expect(bankByBin(null)).toBeNull();
  });
});
