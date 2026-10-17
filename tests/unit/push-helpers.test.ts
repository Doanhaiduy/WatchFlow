import { describe, expect, it } from "vitest";
import { chromeIntentUrl, detectInAppBrowser } from "@/lib/in-app-browser";
import { safeLink } from "@/lib/notification-link";
import { quietUntil, vnMinuteOfDay } from "@/lib/push-quiet";

describe("detectInAppBrowser", () => {
  const cases: [string, string | null][] = [
    ["Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Zalo/22.1.1", "zalo"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/23.10", "zalo"],
    ["Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/118 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/430.0.0.0;]", "facebook"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/420.0]", "facebook"],
    ["Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430]", "messenger"],
    ["Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile/15E148 Instagram 300.0.0.0", "instagram"],
    ["Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 musical_ly_30.0.0", "tiktok"],
    ["Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 Line/13.0.0", "line"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120", null],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", null],
    ["", null],
  ];
  it.each(cases)("%s", (ua, app) => expect(detectInAppBrowser(ua)?.app ?? null).toBe(app));
  it("trả nhãn hiển thị", () => expect(detectInAppBrowser("Zalo/1")?.label).toBe("Zalo"));
});

describe("chromeIntentUrl", () => {
  it("dựng intent mở Chrome kèm đường dự phòng", () => {
    const u = chromeIntentUrl("https://watchflow.example/ctv?x=1#a");
    expect(u).toBe("intent://watchflow.example/ctv?x=1#a#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fwatchflow.example%2Fctv%3Fx%3D1%23a;end");
  });
  it("chỉ http/https", () => {
    expect(chromeIntentUrl("javascript:alert(1)")).toBeNull();
    expect(chromeIntentUrl("không phải url")).toBeNull();
  });
});

describe("safeLink", () => {
  it("nhận đường dẫn nội bộ", () => {
    expect(safeLink("/ban-hang/123")).toBe("/ban-hang/123");
    expect(safeLink("/dong-ho?aging=1#x")).toBe("/dong-ho?aging=1#x");
    expect(safeLink("/")).toBe("/");
  });
  it.each([
    ["//evil.com"], ["/\\evil.com"], ["https://evil.com"], ["javascript:alert(1)"], ["ban-hang"], [""], [null], [undefined], [42],
    ["/a\nb"], ["/a\\b"], ["/" + "x".repeat(500)],
  ])("từ chối %j", (v) => expect(safeLink(v)).toBeNull());
});

describe("quietUntil (giờ Việt Nam)", () => {
  // 15:00 UTC = 22:00 VN
  const at = (utc: string) => new Date(`2026-10-17T${utc}:00Z`);
  const night = { enabled: true, start: 22 * 60, end: 7 * 60 };
  it("phút trong ngày theo giờ VN", () => {
    expect(vnMinuteOfDay(at("15:00"))).toBe(22 * 60);
    expect(vnMinuteOfDay(at("17:30"))).toBe(30); // 00:30 VN hôm sau
  });
  it("vắt qua nửa đêm: 23:00 VN ⇒ chờ tới 07:00", () => {
    expect(quietUntil(at("16:00"), night)?.toISOString()).toBe("2026-10-18T00:00:00.000Z"); // 07:00 VN
  });
  it("01:00 VN ⇒ cũng đang yên tĩnh, hết lúc 07:00", () => {
    expect(quietUntil(at("18:00"), night)?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
  });
  it("ngoài giờ ⇒ null; 07:00 đúng không còn yên tĩnh", () => {
    expect(quietUntil(at("05:00"), night)).toBeNull(); // 12:00 VN
    expect(quietUntil(at("00:00"), night)).toBeNull(); // 07:00 VN
    expect(quietUntil(at("14:59"), night)).toBeNull(); // 21:59 VN
  });
  it("khoảng trong cùng ngày 12:00–13:00", () => {
    const lunch = { enabled: true, start: 720, end: 780 };
    expect(quietUntil(at("05:20"), lunch)?.toISOString()).toBe("2026-10-17T06:00:00.000Z");
    expect(quietUntil(at("06:00"), lunch)).toBeNull();
  });
  it("tắt hoặc start = end ⇒ null", () => {
    expect(quietUntil(at("16:00"), { ...night, enabled: false })).toBeNull();
    expect(quietUntil(at("16:00"), { enabled: true, start: 600, end: 600 })).toBeNull();
  });
});
