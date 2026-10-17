import { describe, expect, it } from "vitest";
import { foldVi } from "@/lib/text";

describe("foldVi (tìm kiếm không dấu cho Select)", () => {
  it("bỏ dấu, đ→d, chữ thường", () => {
    expect(foldVi("Đồng hồ Đà Lạt")).toBe("dong ho da lat");
    expect(foldVi("Thương hiệu")).toBe("thuong hieu");
  });
  it("khớp theo chuỗi con không dấu", () => {
    expect(foldVi("Quản lý kho").includes(foldVi("quan ly"))).toBe(true);
  });
});
