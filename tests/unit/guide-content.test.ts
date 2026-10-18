import { describe, expect, it } from "vitest";
import { GUIDE, GUIDE_QUICK, guideFor, type GuideBlock } from "@/content/guide";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

/** Duyệt mọi khối (kể cả lồng trong tab/mục xổ) */
function walk(blocks: GuideBlock[], fn: (b: GuideBlock) => void) {
  for (const b of blocks) {
    fn(b);
    if (b.t === "tabs") b.tabs.forEach((t) => walk(t.blocks, fn));
    if (b.t === "accordion") b.items.forEach((i) => walk(i.blocks, fn));
  }
}

describe("nội dung hướng dẫn (src/content/guide.ts)", () => {
  it("ID mục duy nhất, kiểu slug (dùng làm liên kết sâu /huong-dan#id)", () => {
    const ids = GUIDE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("mỗi mục có tiêu đề, tóm tắt và ít nhất một khối", () => {
    for (const s of GUIDE) {
      expect(s.title.trim(), s.id).not.toBe("");
      expect(s.summary.trim(), s.id).not.toBe("");
      expect(s.blocks.length, s.id).toBeGreaterThan(0);
    }
  });

  it("`perms` chỉ gồm quyền có thật (không gõ sai tên quyền)", () => {
    for (const s of GUIDE) for (const p of s.perms ?? []) expect(Object.keys(PERMISSIONS), `${s.id}: ${p}`).toContain(p);
  });

  it("lối tắt “Bắt đầu nhanh” trỏ tới mục có thật", () => {
    const ids = new Set(GUIDE.map((s) => s.id));
    for (const q of GUIDE_QUICK) expect(ids.has(q.target), q.target).toBe(true);
  });

  it("khối hợp lệ: bảng đủ cột, bước/thẻ/luồng/tab/mục xổ không rỗng", () => {
    for (const s of GUIDE) {
      walk(s.blocks, (b) => {
        const where = `${s.id}:${b.t}`;
        if (b.t === "table") {
          expect(b.head.length, where).toBeGreaterThan(0);
          for (const r of b.rows) expect(r.length, `${where} dòng “${r[0]}”`).toBe(b.head.length);
        }
        if (b.t === "steps") expect(b.items.length, where).toBeGreaterThan(0);
        if (b.t === "cards") expect(b.items.length, where).toBeGreaterThan(0);
        if (b.t === "flow") expect(b.items.length, where).toBeGreaterThan(1);
        if (b.t === "tabs") {
          expect(b.tabs.length, where).toBeGreaterThan(1);
          for (const t of b.tabs) expect(t.blocks.length, `${where} tab ${t.label}`).toBeGreaterThan(0);
        }
        if (b.t === "accordion") for (const i of b.items) expect(i.blocks.length, `${where} ${i.title}`).toBeGreaterThan(0);
        if (b.t === "path") expect(b.items.length, where).toBeGreaterThan(0);
      });
    }
  });

  it("liên kết nội bộ trong chữ chỉ trỏ vào đường dẫn của ứng dụng", () => {
    const re = /\]\(([^)\s]+)\)/g;
    const texts: string[] = [];
    for (const s of GUIDE) {
      walk(s.blocks, (b) => {
        if (b.t === "md") texts.push(b.text);
        if (b.t === "callout") texts.push(b.text);
        if (b.t === "steps") b.items.forEach((i) => i.text && texts.push(i.text));
        if (b.t === "cards") b.items.forEach((i) => texts.push(i.text));
      });
    }
    for (const t of texts) for (const m of t.matchAll(re)) expect(m[1], t.slice(0, 40)).toMatch(/^(\/(?!\/)|#)/);
  });

  it("guideFor: người không có quyền nào chỉ thấy mục chung; có quyền thì thấy thêm", () => {
    const none = guideFor(() => false);
    expect(none.length).toBeGreaterThan(0);
    expect(none.every((s) => !s.perms)).toBe(true);
    const sale = guideFor((p) => (Array.isArray(p) ? p : [p]).includes("sale.create_draft" as Permission));
    expect(sale.some((s) => s.id === "ban-hang")).toBe(true);
    expect(sale.some((s) => s.id === "ctv")).toBe(false);
    expect(guideFor(() => true).length).toBe(GUIDE.length);
  });
});
