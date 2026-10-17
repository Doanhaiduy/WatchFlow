import { describe, expect, it } from "vitest";
import { completionTail, filterSuggestions, foldMap, matchLabel, splitByRanges } from "@/lib/suggest";

const items = [
  { value: "1", label: "Anh Hùng — Chợ Lớn" },
  { value: "2", label: "Cửa hàng Hồng Hạnh" },
  { value: "3", label: "Đồng hồ Đà Nẵng", sublabel: "nhập lô 10/2026" },
  { value: "4", label: "Khách bán lại", keywords: "thu mua" },
];

describe("lọc gợi ý không dấu", () => {
  it("q rỗng ⇒ trả đầu danh sách theo giới hạn, không tô đậm", () => {
    const r = filterSuggestions(items, "  ", 2);
    expect(r.map((x) => x.item.value)).toEqual(["1", "2"]);
    expect(r[0]!.ranges).toEqual([]);
  });
  it("gõ không dấu vẫn khớp chữ có dấu, đầu chuỗi xếp trước đầu từ trước chứa", () => {
    const r = filterSuggestions(items, "ho");
    // "Hồng Hạnh", "Đồng hồ" (đầu từ, hạng 1); "Chợ" chứa "ho" giữa từ (hạng 2)
    expect(r.map((x) => x.item.value)).toEqual(["2", "3", "1"]);
    expect(r[0]!.rank).toBe(1);
  });
  it("khớp đầu chuỗi có hạng 0 và khoảng tô đậm theo chuỗi gốc", () => {
    const r = filterSuggestions(items, "anh h");
    expect(r[0]!.item.value).toBe("1");
    expect(r[0]!.rank).toBe(0);
    expect(splitByRanges(r[0]!.item.label, r[0]!.ranges)).toEqual([["Anh H", true], ["ùng — Chợ Lớn", false]]);
  });
  it("đ ≡ d; khớp qua chữ phụ/từ khóa ở hạng 3, không tô đậm", () => {
    expect(filterSuggestions(items, "dong ho")[0]!.item.value).toBe("3");
    const k = filterSuggestions(items, "thu mua");
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ rank: 3, ranges: [] });
    expect(filterSuggestions(items, "2026")[0]!.item.value).toBe("3");
  });
  it("không khớp ⇒ rỗng; giữ thứ tự gốc trong cùng hạng", () => {
    expect(filterSuggestions(items, "zzz")).toEqual([]);
    const same = [{ value: "a", label: "Kho B" }, { value: "b", label: "Kho A" }];
    expect(filterSuggestions(same, "kho").map((x) => x.item.value)).toEqual(["a", "b"]);
  });
  it("khớp đúng với chuỗi dạng NFD (dấu rời)", () => {
    const nfd = "Hùng".normalize("NFD");
    const m = matchLabel(`Anh ${nfd}`, "hung");
    expect(m).not.toBeNull();
    const [a, b] = m!.ranges[0]!;
    expect(`Anh ${nfd}`.slice(a, b)).toBe(nfd);
    expect(foldMap(nfd).text).toBe("hung");
  });
});

describe("chữ mờ hoàn thành", () => {
  it("chỉ khi nhãn bắt đầu đúng bằng chữ đã gõ", () => {
    expect(completionTail("Anh Hùng", "anh h")).toBe("ùng");
    expect(completionTail("Anh Hùng", "anh hu")).toBe("");
    expect(completionTail("Anh Hùng", "")).toBe("");
    expect(completionTail("Anh", "Anh")).toBe("");
  });
});
