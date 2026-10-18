import { describe, expect, it } from "vitest";
import { bucketKeys, deltaPct, fillSeries, previousRange, previousSpan } from "@/lib/series";

describe("bucketKeys", () => {
  it("mỗi ngày, gồm cả hai đầu, qua ranh giới tháng", () => {
    expect(bucketKeys("2026-10-30", "2026-11-02", "day")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
  it("mỗi tháng = ngày 1, qua ranh giới năm", () => {
    expect(bucketKeys("2026-11-15", "2027-02-03", "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"]);
  });
  it("giữ tối đa `limit` mốc cuối", () => {
    const k = bucketKeys("2026-01-01", "2026-12-31", "day", 10);
    expect(k).toHaveLength(10);
    expect(k.at(-1)).toBe("2026-12-31");
  });
});

describe("fillSeries", () => {
  const zero = { revenue: 0, invoiceCount: 0 };
  it("điền ngày trống bằng 0, giữ nguyên ngày có số, đúng thứ tự", () => {
    const rows = [{ period: "2026-10-12", revenue: 5, invoiceCount: 1 }, { period: "2026-10-15", revenue: 9, invoiceCount: 2 }];
    const out = fillSeries(rows, "2026-10-11", "2026-10-16", "day", zero);
    expect(out.map((r) => r.period)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(out.map((r) => r.revenue)).toEqual([0, 5, 0, 0, 9, 0]);
  });
  it("một ngày duy nhất có số ⇒ vẫn ra đủ 7 điểm (biểu đồ không bị ẩn)", () => {
    const out = fillSeries([{ period: "2026-10-17", revenue: 17_900_000, invoiceCount: 4 }], "2026-10-11", "2026-10-17", "day", zero);
    expect(out).toHaveLength(7);
    expect(out.at(-1)!.revenue).toBe(17_900_000);
  });
  it("khóa kỳ có thể kèm giờ/ký tự thừa phía sau ngày", () => {
    const out = fillSeries([{ period: "2026-10-12T00:00:00.000Z", revenue: 5, invoiceCount: 1 }], "2026-10-12", "2026-10-13", "day", zero);
    expect(out.map((r) => r.revenue)).toEqual([5, 0]);
  });
  it("theo tháng", () => {
    const out = fillSeries([{ period: "2026-08-01", revenue: 7, invoiceCount: 1 }], "2026-07-20", "2026-10-17", "month", zero);
    expect(out.map((r) => r.period)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(out.map((r) => r.revenue)).toEqual([0, 7, 0, 0]);
  });
  it("không làm mất dòng nằm ngoài khoảng", () => {
    const out = fillSeries([{ period: "2026-09-01", revenue: 3, invoiceCount: 1 }], "2026-10-01", "2026-10-02", "day", zero);
    expect(out[0]).toMatchObject({ period: "2026-09-01", revenue: 3 });
    expect(out).toHaveLength(3);
  });
});

describe("previousRange", () => {
  it("hôm nay → hôm qua; 7 ngày → 7 ngày liền trước", () => {
    expect(previousRange("today", "2026-10-17", "2026-10-17")).toEqual(["2026-10-16", "2026-10-16"]);
    expect(previousRange("7d", "2026-10-11", "2026-10-17")).toEqual(["2026-10-04", "2026-10-10"]);
  });
  it("tháng/quý/năm → cùng khoảng của kỳ trước (kẹp cuối tháng)", () => {
    expect(previousRange("month", "2026-10-01", "2026-10-17")).toEqual(["2026-09-01", "2026-09-17"]);
    expect(previousRange("month", "2026-03-01", "2026-03-31")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(previousRange("quarter", "2026-10-01", "2026-10-17")).toEqual(["2026-07-01", "2026-07-17"]);
    expect(previousRange("year", "2026-01-01", "2026-10-17")).toEqual(["2025-01-01", "2025-10-17"]);
  });
});

describe("previousSpan", () => {
  it("khoảng liền trước, cùng số ngày", () => {
    expect(previousSpan("2026-10-10", "2026-10-16")).toEqual(["2026-10-03", "2026-10-09"]);
    expect(previousSpan("2026-10-17", "2026-10-17")).toEqual(["2026-10-16", "2026-10-16"]);
  });
});

describe("deltaPct", () => {
  it("% thay đổi, làm tròn 1 chữ số", () => {
    expect(deltaPct(110, 100)).toBe(10);
    expect(deltaPct(90, 100)).toBe(-10);
    expect(deltaPct(118_400_000, 109_500_000)).toBe(8.1);
  });
  it("không so được khi thiếu số hoặc kỳ trước = 0", () => {
    expect(deltaPct(5, 0)).toBeNull();
    expect(deltaPct(undefined, 5)).toBeNull();
    expect(deltaPct(5, undefined)).toBeNull();
  });
});
