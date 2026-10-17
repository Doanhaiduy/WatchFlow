import { describe, expect, it } from "vitest";
import { createClickGuard, createSubmitGuard } from "@/lib/submit-guard";

describe("chống bấm lặp", () => {
  it("lần bấm thứ hai trong 600ms bị bỏ, sau đó qua lại", () => {
    let t = 1000;
    const g = createClickGuard(600, () => t);
    expect(g.pass()).toBe(true);
    t += 100;
    expect(g.pass()).toBe(false);
    t += 499;
    expect(g.pass()).toBe(false); // 599ms kể từ lần được qua
    t += 2;
    expect(g.pass()).toBe(true);
    g.reset();
    expect(g.pass()).toBe(true);
  });
  it("hành động bất đồng bộ chỉ chạy một lần khi bấm đúp; nhả khóa cả khi lỗi", async () => {
    let t = 0;
    const g = createSubmitGuard(600, () => t);
    let n = 0;
    const slow = () => new Promise<number>((r) => setTimeout(() => r(++n), 20));
    const [a, b] = await Promise.all([g.run(slow), g.run(slow)]);
    expect(n).toBe(1);
    expect([a, b]).toEqual([1, undefined]);
    t += 1000;
    await expect(g.run(async () => { throw new Error("x"); })).rejects.toThrow("x");
    expect(g.pending).toBe(false);
    t += 1000;
    expect(await g.run(() => "ok")).toBe("ok");
  });
});
