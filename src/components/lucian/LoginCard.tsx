"use client";
// Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062
// Thẻ đăng nhập: nút co thành vòng quay, sai mật khẩu thì thẻ rung + báo số lần còn lại, đúng thì nút thành dấu tích.
// Bản WatchFlow là thành phần TRÌNH BÀY: không tự gọi API; cha truyền onSubmit/loading/error/attemptsLeft/success.
import { Watch } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import "./lucian-062.css";

type Props = {
  onSubmit: (email: string, password: string) => void | Promise<void>;
  /** Đang gửi (nút co thành vòng quay) */
  loading?: boolean;
  /** Câu lỗi tiếng Việt (vd. "Sai email hoặc mật khẩu"); có giá trị ⇒ thẻ rung + hiện dưới ô mật khẩu */
  error?: string | null;
  /** Số lần thử còn lại trước khi khóa (hiện cạnh câu lỗi) */
  attemptsLeft?: number;
  /** Đăng nhập xong: nút thành dấu tích (cha sau đó chuyển trang) */
  success?: boolean;
  /** Điền sẵn email (vd. nhớ lần trước) */
  defaultEmail?: string;
  /** Có ⇒ hiện liên kết "Quên mật khẩu?" */
  onForgot?: () => void;
  title?: string;
  subtitle?: string;
};

export function LoginCard({
  onSubmit, loading = false, error = null, attemptsLeft, success = false, defaultEmail = "", onForgot,
  title = "Chào mừng quay lại", subtitle = "Đăng nhập WatchFlow để quản lý cửa hàng",
}: Props) {
  const uid = useId();
  const [email, setEmail] = useState(defaultEmail);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [shake, setShake] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const prev = useRef({ loading, error, attemptsLeft });

  // Rung thẻ khi lỗi mới xuất hiện (hoặc gửi xong mà vẫn lỗi)
  useEffect(() => {
    const p = prev.current;
    const fresh = !!error && (error !== p.error || attemptsLeft !== p.attemptsLeft || (p.loading && !loading));
    prev.current = { loading, error, attemptsLeft };
    if (!fresh) return;
    setShake(false);
    const r = requestAnimationFrame(() => {
      setShake(true);
      pwRef.current?.select();
    });
    return () => cancelAnimationFrame(r);
  }, [error, attemptsLeft, loading]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading || success || !email.trim() || !pw) return;
    void onSubmit(email.trim(), pw);
  };

  const errText = error ? (attemptsLeft !== undefined && attemptsLeft >= 0 ? `${error} · còn ${attemptsLeft} lần thử` : error) : "";
  const busy = loading && !success;
  return (
    <div className={`ux u062${shake ? " shake" : ""}`} onAnimationEnd={(e) => e.target === e.currentTarget && setShake(false)}>
      <form className="u062-pane u062-login" noValidate onSubmit={submit} aria-busy={busy}>
        <span className="u062-logo" aria-hidden="true">
          <Watch size={24} />
        </span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <div className="u062-f">
          <label htmlFor={`${uid}-e`}>Email</label>
          <div className="u062-box">
            <input id={`${uid}-e`} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ten@cuahang.vn" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className={`u062-f u062-pw${error ? " bad" : ""}`}>
          <label htmlFor={`${uid}-p`}>Mật khẩu</label>
          <span className={`u062-caps${caps ? " on" : ""}`} aria-live="polite">
            {caps ? "Đang bật Caps Lock" : ""}
          </span>
          <div className="u062-box">
            <input
              ref={pwRef}
              id={`${uid}-p`}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              value={pw}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${uid}-err`}
              onChange={(e) => setPw(e.target.value)}
              onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
              required
            />
            <button type="button" className="u062-eye" aria-pressed={show} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow((s) => !s)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <g className="u062-lid">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </g>
                <path className="u062-slash" d="M4 4l16 16" />
              </svg>
            </button>
          </div>
          <div className="u062-err">
            <span id={`${uid}-err`} role="alert">
              {errText}
            </span>
          </div>
        </div>
        {onForgot && (
          <div className="u062-row">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onForgot();
              }}
            >
              Quên mật khẩu?
            </a>
          </div>
        )}
        <button className={`u062-go${busy ? " busy" : ""}${success ? " ok" : ""}`} type="submit" aria-label={success ? "Đã đăng nhập" : busy ? "Đang kiểm tra" : undefined} disabled={!success && (busy || !email.trim() || !pw)}>
          <span>Đăng nhập</span>
          <i aria-hidden="true" />
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <path d="M6 13.5l4.5 4.5L20 8.5" />
          </svg>
        </button>
      </form>
    </div>
  );
}
