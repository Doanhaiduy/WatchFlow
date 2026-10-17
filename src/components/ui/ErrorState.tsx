"use client";
// Lỗi tải + tự thử lại: Lucian UX/UI Prompt #090 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#090
// (phích cắm rút, vòng đếm ngược trên nút, chấm lần thử, chi tiết lỗi). CSS gốc: ../lucian/lucian-090.css
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "../lucian/lucian-090.css";
import { cx } from "./cx";

type Props = {
  title?: string;
  description?: string;
  /** Thử lại; trả `true` nếu thành công (cha thường tự gỡ ErrorState). Ném lỗi/trả false ⇒ coi là thất bại */
  onRetry?: () => Promise<boolean | void> | boolean | void;
  /** Giây chờ trước khi tự thử lại (bỏ trống = không tự thử) */
  autoRetrySeconds?: number;
  /** Số lần tự thử tối đa (mặc định 3; sau đó chỉ thử tay) */
  maxAttempts?: number;
  /** Mã/chi tiết kỹ thuật cho người hỗ trợ (vd. "WF-NET-001 · mã yêu cầu 7f3a-c21e") */
  details?: string;
  className?: string;
};

export function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Máy chủ chưa phản hồi. Kiểm tra mạng rồi thử lại.",
  onRetry,
  autoRetrySeconds,
  maxAttempts = 3,
  details,
  className,
}: Props) {
  const [phase, setPhase] = useState<"wait" | "try">("wait");
  const [fails, setFails] = useState(1);
  const [secs, setSecs] = useState(autoRetrySeconds ?? 0);
  const [zap, setZap] = useState(false);
  const [more, setMore] = useState(false);
  const ring = useRef<SVGCircleElement>(null);
  const alive = useRef(true);
  const detId = useId();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const attempt = useCallback(async () => {
    if (phase === "try" || !onRetry) return;
    setPhase("try");
    let ok = false;
    try {
      ok = (await onRetry()) !== false;
    } catch {
      ok = false;
    }
    if (!alive.current) return;
    if (!ok) {
      setFails((f) => f + 1);
      setZap(true);
      setTimeout(() => alive.current && setZap(false), 600);
      setSecs(autoRetrySeconds ? autoRetrySeconds + 3 : 0);
      setPhase("wait");
    }
  }, [phase, onRetry, autoRetrySeconds]);

  // Đếm ngược tự thử lại
  const canAuto = !!autoRetrySeconds && !!onRetry && fails < maxAttempts + 1;
  useEffect(() => {
    if (phase !== "wait" || !canAuto) return;
    const c = ring.current;
    if (c) {
      c.style.transition = "none";
      c.style.strokeDashoffset = "0";
      void c.getBoundingClientRect();
      c.style.transition = `stroke-dashoffset ${secs}s linear`;
      c.style.strokeDashoffset = "100";
    }
    let left = secs;
    const t = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(t);
        void attempt();
      } else setSecs(left);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, canAuto, fails]);

  const dots = Array.from({ length: maxAttempts }, (_, i) => (i < fails ? "f" : i === fails && phase === "try" ? "cur" : ""));
  return (
    <div className={cx("ux u090", zap && "zap", className)} data-s={phase} role="alert">
      <div className="u090-err">
        <svg className="u090-plug" viewBox="0 0 220 70" aria-hidden="true">
          <g className="u090-L">
            <path className="u090-cord" d="M-14 54C24 54 40 35 72 35" />
            <path className="u090-pr" d="M100 28h14M100 42h14" />
            <rect className="u090-bd" x="68" y="19" width="34" height="32" rx="8" />
          </g>
          <g className="u090-spark">
            <path d="M121 20l-2-7M129 24l5-5M113 24l-5-5M121 50l-2 7M129 46l5 5M113 46l-5 5" />
          </g>
          <g className="u090-R">
            <rect className="u090-bd" x="124" y="17" width="38" height="36" rx="9" />
            <path className="u090-hole" d="M124 28h6M124 42h6" />
            <circle className="u090-led" cx="153" cy="25" r="3" />
            <path className="u090-cord" d="M162 35C188 35 194 16 236 16" />
          </g>
        </svg>
        <p className="u090-t">{title}</p>
        <p className="u090-s">{description}</p>
        {onRetry && (
          <div className="u090-at">
            <span className="u090-dots" aria-hidden="true">
              {dots.map((d, i) => (
                <i key={i} className={d} />
              ))}
            </span>
            <span aria-live="polite">
              {phase === "try" ? `Đang thử lần ${fails + 1}…` : canAuto ? `Tự thử lại sau ${secs} giây` : "Bấm để thử lại"}
            </span>
          </div>
        )}
        {details && (
          <>
            <button type="button" className="u090-more" aria-expanded={more} aria-controls={detId} onClick={() => setMore((m) => !m)}>
              Chi tiết
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            <div className="u090-det" id={detId}>
              <div>
                <code>{details}</code>
              </div>
            </div>
          </>
        )}
      </div>
      {onRetry && (
        <button type="button" className="u090-go" aria-disabled={phase === "try"} onClick={() => void attempt()} style={{ minWidth: 200, padding: "0 20px" }}>
          <svg className="u090-ring" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
            <circle ref={ring} cx="10" cy="10" r="8" pathLength="100" />
          </svg>
          <span>{phase === "try" ? "Đang kết nối…" : "Thử lại ngay"}</span>
        </button>
      )}
    </div>
  );
}
