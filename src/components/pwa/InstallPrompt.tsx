"use client";
// Cài WatchFlow lên màn hình chính (PWA) + cảnh báo khi mở trong trình duyệt nhúng của Zalo/Facebook/Messenger/Instagram/TikTok.
// Mẫu đã chạy thật: ref-sources/domus-francis/src/components/InstallPrompt.tsx — viết lại theo token Glass (sáng + tối).
//   • InAppBrowserBar : dải trên cùng ở trang đăng nhập và trong ứng dụng (CTV hay mở liên kết qua Zalo: đăng nhập dễ bị mất). Ẩn trong phiên.
//   • InstallHint     : thẻ nhỏ không làm phiền ở trang chủ / trang CTV, hiện một lần sau vài giây; đóng ⇒ ẩn 21 ngày; không hiện khi đã chạy standalone.
//   • InstallSection  : khối đầy đủ ở Cài đặt → Tài khoản (nút cài, hướng dẫn iOS Safari).
import { Check, Copy, Download, ExternalLink, Share, Smartphone, TriangleAlert, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { chromeIntentUrl, type InAppBrowserInfo } from "@/lib/in-app-browser";
import { copyText, useDeviceEnv, useInstallApp } from "@/lib/pwa";
import "./pwa.css";

const TIP_HIDE_KEY = "wf-install-tip-hidden";
const INAPP_HIDE_KEY = "wf-inapp-tip-hidden";
const TIP_HIDE_DAYS = 21;

/** Nội dung cảnh báo + nút Sao chép liên kết / Mở bằng Chrome (Android). */
export function InAppBrowserNotice({ info, ios, android, onClose }: { info: InAppBrowserInfo; ios: boolean; android: boolean; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [href, setHref] = useState("");
  useEffect(() => setHref(window.location.href), []);
  const intent = android && href ? chromeIntentUrl(href) : null;
  const browser = ios ? "Safari" : "Chrome";
  const copy = async () => {
    const ok = await copyText(href || window.location.href);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="wf-pwa-bar" role="region" aria-label={`Đang mở trong trình duyệt của ${info.label}`}>
      <div className="row">
        <TriangleAlert className="ic" size={20} aria-hidden="true" />
        <div className="tx">
          <b>
            Bạn đang mở trong {info.label} — đăng nhập có thể bị mất. Mở bằng {browser}.
          </b>
          <span>
            {ios ? (
              <>
                Bấm <b style={{ display: "inline" }}>⋯</b> hoặc nút chia sẻ <Share size={12} style={{ display: "inline", verticalAlign: "-1px" }} aria-label="chia sẻ" /> ở góc màn hình rồi chọn “Mở bằng trình duyệt” (Open in Safari), hoặc sao chép liên kết rồi dán vào Safari.
              </>
            ) : android ? (
              <>Bấm “Mở bằng Chrome”, hoặc bấm ⋮ ở góc trên rồi chọn “Mở bằng trình duyệt”. Ở đây cũng không cài được ứng dụng và không nhận được thông báo.</>
            ) : (
              <>Sao chép liên kết rồi dán vào {browser}. Ở đây không cài được ứng dụng và không nhận được thông báo.</>
            )}
          </span>
        </div>
        {onClose && (
          <button type="button" className="x" onClick={onClose} aria-label="Ẩn cảnh báo">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="acts">
        {intent && (
          <a className="wf-btn wf-btn-pri wf-btn-sm wf-touch" href={intent}>
            <ExternalLink size={16} aria-hidden="true" /> Mở bằng Chrome
          </a>
        )}
        <Button sm icon={copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} onClick={() => void copy()}>
          {copied ? "Đã sao chép" : "Sao chép liên kết"}
        </Button>
      </div>
    </div>
  );
}

/** Dải cảnh báo trình duyệt nhúng; không render gì ở trình duyệt thường. Ẩn được trong phiên (sessionStorage). */
export function InAppBrowserBar() {
  const env = useDeviceEnv();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(INAPP_HIDE_KEY) === "1");
    } catch {
      /* trình duyệt chặn bộ nhớ — luôn hiện */
    }
  }, []);
  if (!env.inApp || hidden) return null;
  return (
    <InAppBrowserNotice
      info={env.inApp}
      ios={env.ios}
      android={env.android}
      onClose={() => {
        try {
          sessionStorage.setItem(INAPP_HIDE_KEY, "1");
        } catch {
          /* bỏ qua */
        }
        setHidden(true);
      }}
    />
  );
}

function IosSteps() {
  return (
    <p className="wf-pwa-help" role="note">
      Trong <b>Safari</b>: bấm nút <b>Chia sẻ</b> <Share size={12} style={{ display: "inline", verticalAlign: "-1px" }} aria-hidden="true" /> (ô vuông có mũi tên lên) → <b>“Thêm vào MH chính”</b> → <b>Thêm</b>. Sau đó mở WatchFlow từ biểu tượng mới trên màn hình chính.
    </p>
  );
}

/** Thẻ gợi ý nhỏ ở trang chủ / trang CTV: chỉ khi có thể cài, chưa cài, không ở trình duyệt nhúng và chưa bị người dùng ẩn trong 21 ngày. */
export function InstallHint() {
  const pathname = usePathname();
  const toast = useToast();
  const app = useInstallApp();
  const [hiddenAt, setHiddenAt] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    try {
      setHiddenAt(Number(localStorage.getItem(TIP_HIDE_KEY) ?? 0));
    } catch {
      setHiddenAt(0);
    }
    const t = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(t);
  }, []);

  const onHome = pathname === "/" || pathname === "/ctv";
  const hiddenNow = hiddenAt === null || (hiddenAt > 0 && Date.now() - hiddenAt < TIP_HIDE_DAYS * 86_400_000);
  const canTip = !app.installed && !app.inApp && (app.canInstall || app.ios);
  if (!onHome || !ready || hiddenNow || !canTip) return null;

  const hide = () => {
    try {
      localStorage.setItem(TIP_HIDE_KEY, String(Date.now()));
    } catch {
      /* bỏ qua */
    }
    setHiddenAt(Date.now());
  };
  return (
    <div className="wf-pwa-card g" role="region" aria-label="Gợi ý cài ứng dụng">
      <div className="row">
        <span className="ic" aria-hidden="true">
          <Smartphone size={20} />
        </span>
        <div className="tx">
          <b>Cài WatchFlow lên màn hình chính</b>
          <span>{app.ios ? "Mở nhanh như ứng dụng thường; trên iPhone phải cài thì mới nhận được thông báo." : "Mở nhanh, toàn màn hình, không lẫn với các tab khác."}</span>
        </div>
        <button type="button" className="x" onClick={hide} aria-label="Ẩn gợi ý" title="Ẩn gợi ý này 21 ngày">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {help && app.ios && <IosSteps />}
      <div className="acts">
        {app.canInstall ? (
          <Button
            sm
            variant="primary"
            icon={<Download size={16} aria-hidden="true" />}
            onClick={async () => {
              if ((await app.install()) === "accepted") {
                toast.success("Đã cài WatchFlow", "Mở từ biểu tượng trên màn hình chính nhé.");
                hide();
              }
            }}
          >
            Cài ứng dụng
          </Button>
        ) : (
          <Button sm variant="primary" icon={<Share size={16} aria-hidden="true" />} aria-expanded={help} onClick={() => setHelp((v) => !v)}>
            {help ? "Ẩn hướng dẫn" : "Xem cách cài"}
          </Button>
        )}
        <Button sm onClick={hide}>
          Để sau
        </Button>
      </div>
    </div>
  );
}

/** Khối ở Cài đặt → Tài khoản. */
export function InstallSection() {
  const toast = useToast();
  const app = useInstallApp();
  const [help, setHelp] = useState(false);
  return (
    <section className="g wf-pad" aria-label="Cài ứng dụng">
      <h2 className="wf-g-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
        Ứng dụng trên màn hình chính
      </h2>
      <div className="wf-pwa-set">
        {app.installed ? (
          <div>
            <StatusChip tone="ok">{app.standalone ? "Đang chạy như ứng dụng" : "Đã cài trên thiết bị này"}</StatusChip>
          </div>
        ) : app.inApp ? (
          <p className="note">Bạn đang mở trong {app.inApp.label}: ở đây không cài được ứng dụng. Hãy mở liên kết này bằng {app.ios ? "Safari" : "Chrome"} rồi cài.</p>
        ) : app.canInstall ? (
          <div>
            <Button
              variant="primary"
              icon={<Download size={18} aria-hidden="true" />}
              onClick={async () => {
                if ((await app.install()) === "accepted") toast.success("Đã cài WatchFlow", "Mở từ biểu tượng trên màn hình chính nhé.");
              }}
            >
              Cài WatchFlow lên màn hình chính
            </Button>
          </div>
        ) : app.ios ? (
          <>
            <div>
              <Button variant="primary" icon={<Share size={18} aria-hidden="true" />} aria-expanded={help} onClick={() => setHelp((v) => !v)}>
                Cài WatchFlow lên màn hình chính
              </Button>
            </div>
            {help && (
              <ol className="wf-pwa-steps">
                <li>Mở trang này bằng <b>Safari</b> (không phải Zalo/Facebook).</li>
                <li>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) ở thanh dưới.</li>
                <li>Chọn <b>“Thêm vào MH chính”</b> rồi bấm <b>Thêm</b>.</li>
              </ol>
            )}
          </>
        ) : (
          <p className="note">Trình duyệt này chưa cho cài ứng dụng. Dùng Chrome hoặc Edge (Android, máy tính) hoặc Safari (iPhone/iPad) để cài.</p>
        )}
        <p className="note">Mở nhanh như ứng dụng thường, toàn màn hình. Trên iPhone, phải cài ứng dụng thì mới nhận được thông báo đẩy.</p>
      </div>
    </section>
  );
}
