// UT-money — costing-and-profit §5, SC-11 (a,b,c,f,g,h) + thuộc tính ngẫu nhiên Σ = tổng.
import { describe, expect, it } from "vitest";
import { allocate, formatVnd, parseVnd, roundHalfUp } from "@/lib/money";

describe("allocate (SC-11)", () => {
  it("a: 1.000.000 by_value cho 3 dòng bằng nhau ⇒ dư 1 vào dòng đầu", () => {
    expect(allocate(1_000_000, [3_000_000, 3_000_000, 3_000_000])).toEqual([333_334, 333_333, 333_333]);
  });
  it("b: 100.000 by_value 1tr/2tr/3tr ⇒ dư 1 vào dòng lớn nhất", () => {
    expect(allocate(100_000, [1_000_000, 2_000_000, 3_000_000])).toEqual([16_666, 33_333, 50_001]);
  });
  it("c: 100.000 equal, dư vào dòng giá trị lớn nhất", () => {
    expect(allocate(100_000, [1_000_000, 2_000_000, 3_000_000], { method: "equal" })).toEqual([33_333, 33_333, 33_334]);
  });
  it("f: giảm giá tổng 100.000 cho 3tr/1tr", () => {
    expect(allocate(100_000, [3_000_000, 1_000_000])).toEqual([75_000, 25_000]);
  });
  it("g: 100.001 cho 3 dòng 1tr ⇒ dư 2 dồn một dòng (dòng đầu)", () => {
    expect(allocate(100_001, [1_000_000, 1_000_000, 1_000_000])).toEqual([33_335, 33_333, 33_333]);
  });
  it("h: tổng 0, một dòng, trọng số 0, số rất lớn", () => {
    expect(allocate(0, [5, 7])).toEqual([0, 0]);
    expect(allocate(123_456, [999])).toEqual([123_456]);
    expect(allocate(10, [0, 0, 0])).toEqual([4, 3, 3]);
    const big = 2 ** 52;
    const r = allocate(big, [big, big - 1, 3]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(big);
  });
  it("dư n−1 đồng", () => {
    const r = allocate(5, [1, 1, 1, 1, 1, 1]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(5);
    expect(r[0]).toBe(5);
  });
  it("thuộc tính: Σ phân bổ = tổng với 2000 bộ ngẫu nhiên", () => {
    let seed = 42;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
    for (let k = 0; k < 2000; k++) {
      const n = 1 + rnd(8);
      const w = Array.from({ length: n }, () => rnd(50_000_000));
      const total = rnd(10_000_000);
      const r = allocate(total, w, { method: rnd(2) ? "equal" : "by_value" });
      expect(r.reduce((a, b) => a + b, 0)).toBe(total);
      r.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
    }
  });
  it("từ chối số thực / âm", () => {
    expect(() => allocate(1.5, [1])).toThrow();
    expect(() => allocate(-1, [1])).toThrow();
    expect(() => allocate(10, [-1, 2])).toThrow();
  });
});

describe("roundHalfUp", () => {
  it("SC-11 d: 2 × 10.571,4286 = 21.142,8572 ⇒ 21.143", () => {
    expect(roundHalfUp("21142.8572")).toBe(21_143);
  });
  it("nửa lên", () => {
    expect(roundHalfUp("10.5")).toBe(11);
    expect(roundHalfUp("10.4999")).toBe(10);
    expect(roundHalfUp(170000)).toBe(170_000);
  });
});

describe("định dạng tiền", () => {
  it("formatVnd", () => {
    expect(formatVnd(8_200_000)).toBe("8.200.000 ₫");
    expect(formatVnd(0)).toBe("0 ₫");
    expect(formatVnd(null)).toBe("—");
  });
  it("parseVnd", () => {
    expect(parseVnd("8.200.000")).toBe(8_200_000);
    expect(parseVnd("8 200 000 ₫")).toBe(8_200_000);
    expect(parseVnd("")).toBeNull();
    expect(parseVnd("12a")).toBeNaN();
  });
});
