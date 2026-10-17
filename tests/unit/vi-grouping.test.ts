import { describe, expect, it } from "vitest";
import { viGrouping } from "@/server/errors";

describe("viGrouping", () => {
  it("đổi dấu phẩy phân nhóm sang dấu chấm", () => {
    expect(viGrouping("Cọc tối thiểu 10% giá bán (550,000 ₫).")).toBe("Cọc tối thiểu 10% giá bán (550.000 ₫).");
    expect(viGrouping("Còn nợ 12,500,000 ₫")).toBe("Còn nợ 12.500.000 ₫");
  });
  it("không đụng số thập phân và số thường", () => {
    expect(viGrouping("Giảm 40.82% vượt hạn mức 5%")).toBe("Giảm 40.82% vượt hạn mức 5%");
    expect(viGrouping("Tỉ lệ 1,5 lần; mã 2026")).toBe("Tỉ lệ 1,5 lần; mã 2026");
  });
});
