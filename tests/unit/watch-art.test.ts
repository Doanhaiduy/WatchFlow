import { describe, expect, it } from "vitest";
import { artFor, artSeed } from "@/components/ui/WatchArt";
import { avatarTone, initialsOf } from "@/components/ui/Avatar";

describe("artFor — kiểu dáng ảnh đồng hồ vẽ", () => {
  it("ổn định: cùng seed ⇒ cùng kiểu; khác seed ⇒ (thường) khác", () => {
    const a = artFor({ seed: artSeed("Seiko", "5 Sports SRPD55"), brand: "Seiko", model: "5 Sports SRPD55" });
    expect(artFor({ seed: artSeed("Seiko", "5 Sports SRPD55"), brand: "Seiko", model: "5 Sports SRPD55" })).toEqual(a);
    const kinds = new Set(["Seiko|A", "Casio|B", "Citizen|C", "Orient|D", "Tissot|E", "Omega|F", "Rolex|G", "Longines|H"].map((s) => JSON.stringify(artFor({ seed: s }))));
    expect(kinds.size).toBeGreaterThan(3);
  });

  it("đọc màu mặt / chất liệu vỏ / loại dây từ chữ mô tả (có hoặc không dấu, Việt hoặc Anh)", () => {
    expect(artFor({ seed: "x", dialColor: "Xanh navy" }).dial).toBe("#1f3a68");
    expect(artFor({ seed: "x", dialColor: "Đen" }).dial).toBe("#1b1b1f");
    expect(artFor({ seed: "x", dialColor: "Trắng" }).dial).toBe("#e9edf2");
    expect(artFor({ seed: "x", dialColor: "Xanh lá" }).dial).toBe("#2f5d4a");
    expect(artFor({ seed: "x", caseMaterial: "Vàng 18K" }).metal).toBe("gold");
    expect(artFor({ seed: "x", caseMaterial: "Thép không gỉ" }).metal).toBe("steel");
    expect(artFor({ seed: "x", caseMaterial: "Rose gold" }).metal).toBe("rose");
    expect(artFor({ seed: "x", strapType: "Dây kim loại" }).strap).toBe("bracelet");
    expect(artFor({ seed: "x", strapType: "Cao su" }).strap).toBe("rubber-black");
    expect(artFor({ seed: "x", strapType: "Dây da" }).strap).toMatch(/^leather-/);
    expect(artFor({ seed: "x", strapType: "NATO" }).strap).toBe("nato-green");
  });

  it("G-Shock / mã GA-… ⇒ đồng hồ điện tử: vỏ đen, dây cao su, mặt LCD sáng (chữ đọc được)", () => {
    for (const [brand, model] of [["Casio", "G-Shock GA-2100-1A1"], ["Casio", "GA-700"], ["Casio", "Baby-G BA-110"]] as const) {
      const a = artFor({ seed: "g", brand, model });
      expect(a.digital).toBe(true);
      expect(a.metal).toBe("black");
      expect(a.strap).toBe("rubber-black");
      expect(a.dial).toBe("#aebf93");
    }
    expect(artFor({ seed: "c", brand: "Casio", model: "MTP-V001L" }).digital).toBe(false);
  });

  it("luôn trả giá trị hợp lệ kể cả khi thiếu mọi dữ liệu", () => {
    const a = artFor({ seed: "" });
    expect(["steel", "gold", "rose", "black"]).toContain(a.metal);
    expect(["round", "cushion", "rect"]).toContain(a.shape);
    expect(["baton", "dots", "roman", "arabic"]).toContain(a.idx);
    expect(a.dial).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("Avatar", () => {
  it("chữ cái đầu của tên gọi (từ cuối)", () => {
    expect(initialsOf("Nguyễn Văn An")).toBe("A");
    expect(initialsOf("  minh  ")).toBe("M");
    expect(initialsOf("")).toBe("?");
  });
  it("màu ổn định theo tên", () => {
    expect(avatarTone("Trần Thị Bình")).toBe(avatarTone("Trần Thị Bình"));
    expect(["info", "ok", "hold", "repair", "check"]).toContain(avatarTone("Lê Hoàng Nam"));
  });
});
