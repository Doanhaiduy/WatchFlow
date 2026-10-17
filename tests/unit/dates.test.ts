// UT-dates — BR-GEN-08: ngày chứng từ theo giờ VN, không dùng new Date("YYYY-MM-DD") để cộng trừ.
import { describe, expect, it } from "vitest";
import { addDays, addMonths, checkDocDate, diffDays, formatDateVn, isIsoDate, todayVn } from "@/lib/dates";

describe("dates", () => {
  it("todayVn: 17:30 UTC = 00:30 hôm sau ở VN", () => {
    expect(todayVn(new Date("2026-10-16T17:30:00Z"))).toBe("2026-10-17");
    expect(todayVn(new Date("2026-10-16T16:59:59Z"))).toBe("2026-10-16");
  });
  it("addDays qua tháng/năm, năm nhuận", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("addMonths kẹp cuối tháng", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-16", 12)).toBe("2027-10-16");
    expect(addMonths("2026-10-16", 3)).toBe("2027-01-16");
  });
  it("diffDays", () => {
    expect(diffDays("2026-10-01", "2026-10-16")).toBe(15);
  });
  it("isIsoDate", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-16")).toBe(true);
  });
  it("checkDocDate (BR-GEN-08)", () => {
    expect(checkDocDate("2026-10-17", "2026-10-16", 7, false)).toBe("future");
    expect(checkDocDate("2026-10-09", "2026-10-16", 7, false)).toBe("ok");
    expect(checkDocDate("2026-10-08", "2026-10-16", 7, false)).toBe("backdate");
    expect(checkDocDate("2026-10-08", "2026-10-16", 7, true)).toBe("ok");
  });
  it("formatDateVn", () => {
    expect(formatDateVn("2026-10-16")).toBe("16/10/2026");
  });
});
