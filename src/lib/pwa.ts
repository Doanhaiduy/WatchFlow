"use client";
// Phía trình duyệt của PWA: bắt sự kiện cài ứng dụng, nhận diện môi trường (iOS / Android / đã cài / trình duyệt nhúng), đăng ký service worker,
// bật-tắt thông báo đẩy của THIẾT BỊ NÀY, số chưa đọc trên biểu tượng ứng dụng. Mẫu: ref-sources/domus-francis/src/lib/push.ts.
// Hàm thuần (detectInAppBrowser, chromeIntentUrl, safeLink…) nằm ở src/lib/in-app-browser.ts và notification-link.ts để test được.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api-client";
import { detectInAppBrowser, type InAppBrowserInfo } from "./in-app-browser";

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Đăng ký service worker (idempotent); chỉ chạy ở production — bản dev không có sw.js đã build và dễ làm hỏng HMR. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

const b64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// ---------------------------------------------------------------------
// Cài ứng dụng. Chrome/Edge/Android bắn `beforeinstallprompt` MỘT lần, thường ngay sau khi trang tải — có thể trước khi trang con kịp gắn
// bộ nghe ⇒ bắt ngay khi mô-đun này được nạp (RegisterSW ở layout gốc nạp nó cho mọi trang), giữ trong kho dùng chung.
// ---------------------------------------------------------------------
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Đã cài ứng dụng trên thiết bị này (đặt khi trình duyệt báo `appinstalled`). */
export const INSTALLED_KEY = "wf-app-installed";

interface InstallSnapshot {
  evt: BeforeInstallPromptEvent | null;
  installed: boolean;
}
const SERVER_SNAPSHOT: InstallSnapshot = { evt: null, installed: false };
let snapshot: InstallSnapshot = SERVER_SNAPSHOT;
const installSubs = new Set<() => void>();
const setSnapshot = (next: Partial<InstallSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  installSubs.forEach((f) => f());
};
const subscribeInstall = (f: () => void) => {
  installSubs.add(f);
  return () => {
    installSubs.delete(f);
  };
};

/** Gắn bộ nghe cài đặt (idempotent). Tự gọi khi mô-đun được nạp trên trình duyệt. */
export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __wfInstallHook?: boolean };
  if (w.__wfInstallHook) return;
  w.__wfInstallHook = true;
  let installed = false;
  try {
    installed = localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    /* chế độ riêng tư — bỏ qua */
  }
  snapshot = { evt: null, installed };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    // Trình duyệt chỉ bắn sự kiện khi ứng dụng CHƯA cài trên máy này ⇒ gỡ dấu "đã cài" cũ (vd. người dùng đã gỡ ứng dụng)
    try {
      localStorage.removeItem(INSTALLED_KEY);
    } catch {
      /* bỏ qua */
    }
    setSnapshot({ evt: e as BeforeInstallPromptEvent, installed: false });
  });
  window.addEventListener("appinstalled", () => {
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {
      /* bỏ qua */
    }
    setSnapshot({ evt: null, installed: true });
  });
}
captureInstallPrompt();

/** Đang chạy như ứng dụng đã cài (mở từ biểu tượng trên màn hình chính). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const isIosDevice = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1));

export const isAndroidDevice = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

type Env = { standalone: boolean; ios: boolean; android: boolean; inApp: InAppBrowserInfo | null };
const NO_ENV: Env = { standalone: false, ios: false, android: false, inApp: null };

/** Môi trường của thiết bị (đọc sau khi gắn vào trình duyệt để không lệch với bản render ở máy chủ). */
export function useDeviceEnv(): Env {
  const [env, setEnv] = useState<Env>(NO_ENV);
  useEffect(() => {
    const update = () => setEnv({ standalone: isStandalone(), ios: isIosDevice(), android: isAndroidDevice(), inApp: detectInAppBrowser(navigator.userAgent) });
    update();
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  return env;
}

/**
 * Cài ứng dụng lên màn hình chính: Chrome/Edge/Android có nút bấm (sự kiện đã bắt sẵn từ lúc tải trang); iOS Safari hướng dẫn thủ công.
 * `installed` = đang mở dạng ứng dụng đã cài HOẶC trình duyệt đã báo cài xong trên máy này.
 */
export function useInstallApp() {
  const snap = useSyncExternalStore(subscribeInstall, () => snapshot, () => SERVER_SNAPSHOT);
  const env = useDeviceEnv();
  useEffect(() => captureInstallPrompt(), []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const e = snapshot.evt;
    if (!e) return "unavailable";
    await e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    // Mỗi sự kiện chỉ gọi prompt() được một lần
    setSnapshot({ evt: null, installed: choice.outcome === "accepted" ? true : snapshot.installed });
    return choice.outcome;
  }, []);

  return {
    canInstall: !!snap.evt && !env.standalone,
    installed: env.standalone || snap.installed,
    standalone: env.standalone,
    /** iPhone/iPad mở bằng trình duyệt (chưa phải ứng dụng đã cài) ⇒ hướng dẫn "Thêm vào Màn hình chính" */
    ios: env.ios && !env.standalone,
    android: env.android,
    inApp: env.inApp,
    install,
  };
}

// ---------------------------------------------------------------------
// Thông báo đẩy của THIẾT BỊ NÀY (không phải của tài khoản)
// ---------------------------------------------------------------------
export type PushState = "unsupported" | "denied" | "off" | "on";

/** `pushManager.subscribe` chỉ chạy khi người dùng BẬT công tắc (enable) — không bao giờ tự gọi. */
export function usePushDevice(vapidPublicKey: string | null | undefined) {
  const [state, setState] = useState<PushState>("off");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!pushSupported() || !vapidPublicKey) throw new Error("Thiết bị hoặc máy chủ chưa hỗ trợ thông báo đẩy.");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        throw new Error(perm === "denied" ? "Bạn đã chặn thông báo — hãy cho phép trong cài đặt trình duyệt (biểu tượng ổ khóa cạnh địa chỉ)." : "Bạn chưa cho phép thông báo.");
      }
      const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.getRegistration("/"));
      if (!reg) throw new Error("Chưa đăng ký được service worker (chỉ có ở bản chạy thật). Hãy mở bản đã triển khai.");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidPublicKey) as BufferSource });
      const j = sub.toJSON();
      await api("/api/v1/me/push-subscriptions", { method: "POST", body: { endpoint: j.endpoint, keys: j.keys } });
      setEndpoint(sub.endpoint);
      setState("on");
    } finally {
      setBusy(false);
    }
  }, [vapidPublicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/v1/me/push-subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, endpoint, busy, enable, disable, refresh };
}

// ---------------------------------------------------------------------
// Số chưa đọc trên biểu tượng ứng dụng (Badging API: Chrome/Edge ứng dụng đã cài, Android, iOS 16.4+ khi đã cho phép thông báo)
// ---------------------------------------------------------------------
type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export const appBadgeSupported = () => typeof navigator !== "undefined" && typeof (navigator as BadgeNavigator).setAppBadge === "function";

let lastBadge = -1;
/** Đặt / xóa số trên biểu tượng ứng dụng. Trình duyệt không hỗ trợ (hoặc chưa cài ứng dụng) ⇒ bỏ qua, không lỗi. */
export function syncAppBadge(count: number) {
  if (!appBadgeSupported()) return;
  const n = Math.max(0, Math.min(Math.floor(count), 999));
  if (n === lastBadge) return;
  lastBadge = n;
  const nav = navigator as BadgeNavigator;
  try {
    const p = n > 0 ? nav.setAppBadge!(n) : nav.clearAppBadge ? nav.clearAppBadge() : nav.setAppBadge!(0);
    void p?.catch?.(() => {});
  } catch {
    /* NotAllowedError (chưa cho phép thông báo) — bỏ qua */
  }
}

/** Sao chép chữ: Clipboard API, không được (trình duyệt nhúng hay chặn) thì dùng ô chữ ẩn + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* thử cách cũ */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
