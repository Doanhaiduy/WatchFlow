// public/sw.js chạy trong vm với service worker GIẢ: trang offline khi điều hướng lỗi mạng, không đụng yêu cầu khác,
// push ⇒ showNotification, bấm thông báo chỉ mở đường dẫn nội bộ (kèm ?n=<id>). Không gọi dịch vụ đẩy thật.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Handler = (e: Record<string, unknown>) => void;
const ORIGIN = "https://watchflow.example";
const NID = "0190aaaa-bbbb-cccc-dddd-eeeeffff0001";

function load(opts: { fetch?: () => Promise<unknown>; clients?: unknown[] } = {}) {
  const handlers: Record<string, Handler> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const cacheStore = new Map<string, unknown>([["/offline.html", { offline: true }]]);
  const deleted: string[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, h: Handler) => (handlers[t] = h),
    skipWaiting: () => Promise.resolve(),
    registration: { showNotification: (title: string, o: Record<string, unknown>) => (shown.push({ title, opts: o }), Promise.resolve()) },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(opts.clients ?? []),
      openWindow: (u: string) => (opened.push(u), Promise.resolve()),
    },
  };
  const ctx = {
    self,
    URL,
    Request: class { constructor(public url: string) {} },
    Response: { error: () => ({ error: true }) },
    MessageChannel: class { port1: Record<string, unknown> = {}; port2 = {}; },
    setTimeout,
    fetch: opts.fetch ?? (() => Promise.resolve({ ok: true })),
    caches: {
      open: () => Promise.resolve({ addAll: () => Promise.resolve() }),
      keys: () => Promise.resolve(["wf-static-v1", "wf-offline-v2"]),
      delete: (k: string) => (deleted.push(k), Promise.resolve(true)),
      match: (u: string) => Promise.resolve(cacheStore.get(u)),
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8"), ctx);
  return { handlers, shown, opened, deleted };
}

/** Chạy handler với event giả, trả Promise đã gom từ waitUntil/respondWith */
async function fire(h: Handler, e: Record<string, unknown>) {
  let p: Promise<unknown> = Promise.resolve();
  h({ ...e, waitUntil: (x: Promise<unknown>) => (p = x), respondWith: (x: Promise<unknown>) => (p = x) });
  return p;
}

describe("service worker", () => {
  it("điều hướng lỗi mạng ⇒ trả offline.html", async () => {
    const { handlers } = load({ fetch: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await fire(handlers.fetch!, { request: { mode: "navigate" } })).toEqual({ offline: true });
  });
  it("điều hướng bình thường ⇒ đi thẳng mạng; yêu cầu khác (API, ảnh…) ⇒ không can thiệp", async () => {
    const { handlers } = load();
    expect(await fire(handlers.fetch!, { request: { mode: "navigate" } })).toEqual({ ok: true });
    let intercepted = false;
    handlers.fetch!({ request: { mode: "cors", url: ORIGIN + "/api/v1/sales" }, respondWith: () => (intercepted = true) });
    expect(intercepted).toBe(false);
  });
  it("kích hoạt xóa bộ nhớ đệm bản cũ (wf-static-v1), giữ wf-offline-v2", async () => {
    const { handlers, deleted } = load();
    await fire(handlers.activate!, {});
    expect(deleted).toEqual(["wf-static-v1"]);
  });
  it("push ⇒ hiển thị tiêu đề/nội dung, mang theo url + nid; không có dữ liệu ⇒ tiêu đề mặc định", async () => {
    const { handlers, shown } = load();
    await fire(handlers.push!, { data: { json: () => ({ title: "Đơn CTV", body: "Chờ xác nhận", url: "/ban-hang/1", nid: NID, tag: NID }) } });
    expect(shown[0]!.title).toBe("Đơn CTV");
    expect(shown[0]!.opts).toMatchObject({ body: "Chờ xác nhận", tag: NID, data: { url: "/ban-hang/1", nid: NID }, icon: "/icons/icon-192.png", badge: "/icons/badge-72.png" });
    await fire(handlers.push!, { data: null });
    expect(shown[1]!.title).toBe("WatchFlow");
    expect(shown[1]!.opts.data).toEqual({ url: "/", nid: null });
  });
  const click = async (url: unknown, nid: unknown = NID) => {
    const { handlers, opened } = load();
    await fire(handlers.notificationclick!, { notification: { close() {}, data: { url, nid } } });
    return opened[0];
  };
  it("bấm thông báo: mở đường dẫn nội bộ kèm ?n=<id> (giữ tham số có sẵn)", async () => {
    expect(await click("/ban-hang/1")).toBe(`${ORIGIN}/ban-hang/1?n=${NID}`);
    expect(await click("/dong-ho?aging=1#x")).toBe(`${ORIGIN}/dong-ho?aging=1&n=${NID}#x`);
    expect(await click("/giu-hang", "không-phải-uuid")).toBe(`${ORIGIN}/giu-hang`);
  });
  it.each(["https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/a\nb", 42, null])("bấm thông báo với liên kết lạ %j ⇒ về trang chủ", async (u) => {
    expect(await click(u, null)).toBe(`${ORIGIN}/`);
  });
});
