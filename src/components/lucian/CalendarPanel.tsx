"use client";
// Lịch tháng: Lucian UX/UI Prompt #030 (Date range calendar) · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#030
// CSS gốc ở ./lucian-030.css. Viết lại bằng React: lưới ngày trượt khi đổi tháng, dải chọn khoảng bám theo con trỏ, bàn phím mũi tên.
// Thêm cho WatchFlow: tiếng Việt (T2…CN, tuần bắt đầu thứ Hai), min/max, chế độ MỘT ngày, lưới chọn tháng/năm, nút Hôm nay/Xóa.
// Ngày là chuỗi "YYYY-MM-DD"; phép cộng trừ dùng src/lib/dates.ts (không dùng new Date("YYYY-MM-DD")).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addDays, addMonths, diffDays, formatDateVn, type IsoDate } from "@/lib/dates";
import "./lucian-030.css";

type Base = {
  min?: IsoDate;
  max?: IsoDate;
  /** Hôm nay (giờ VN) — truyền từ ngoài để test được */
  today: IsoDate;
  /** Chuyển focus vào lưới khi mở */
  autoFocus?: boolean;
};
type Single = Base & { mode?: "single"; value: IsoDate | ""; onSelect: (iso: IsoDate) => void; onClear?: () => void };
type Range = Base & { mode: "range"; from: IsoDate | ""; to: IsoDate | ""; onApply: (from: IsoDate, to: IsoDate) => void };
type Props = Single | Range;

const WD_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WD_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const iso = (y: number, m: number, d: number): IsoDate => `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`;
const parts = (s: IsoDate) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1, d: Number(s.slice(8, 10)) });
/** Thứ trong tuần kiểu Chủ nhật = 0 */
const dow = (s: IsoDate) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))).getUTCDay();
const monIdx = (s: IsoDate) => (dow(s) + 6) % 7;
const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const ym = (s: IsoDate) => s.slice(0, 7);

export function CalendarPanel(props: Props) {
  const { min, max, today, autoFocus } = props;
  const range = props.mode === "range";
  const sel0 = range ? props.from : props.value;
  const base: IsoDate = sel0 || today;

  const [view, setView] = useState(() => ({ y: parts(base).y, m: parts(base).m }));
  const [dir, setDir] = useState<"r" | "l" | "n">("n");
  const [pick, setPick] = useState<"days" | "months">("days");
  const [focusIso, setFocusIso] = useState<IsoDate>(base);
  const [start, setStart] = useState<IsoDate | "">(range ? props.from : "");
  const [end, setEnd] = useState<IsoDate | "">(range ? props.to : "");
  const [hover, setHover] = useState<IsoDate | "">("");
  const wantFocus = useRef(!!autoFocus);
  const gridRef = useRef<HTMLDivElement>(null);

  const off = (d: IsoDate) => (!!min && d < min) || (!!max && d > max);
  const viewKey = `${pad(view.y, 4)}-${pad(view.m + 1)}`;

  const goMonth = (delta: number) => {
    const t = new Date(Date.UTC(view.y, view.m + delta, 1));
    setDir(delta > 0 ? "r" : "l");
    setView({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  };
  const prevOff = !!min && viewKey <= ym(min);
  const nextOff = !!max && viewKey >= ym(max);

  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
    const n = dim(view.y, view.m);
    return Array.from({ length: 42 }, (_, i) => {
      const d = i - lead + 1;
      return d >= 1 && d <= n ? iso(view.y, view.m, d) : null;
    });
  }, [view]);

  // Ô giữ tabindex=0 (roving): ô đang trỏ, nếu không có thì ô đã chọn / hôm nay / ngày hợp lệ đầu tiên của tháng
  const tabIso = useMemo(() => {
    const inView = (d: IsoDate | "") => !!d && ym(d) === viewKey && !off(d);
    if (inView(focusIso)) return focusIso;
    const s = range ? start : (sel0 as IsoDate | "");
    if (inView(s)) return s as IsoDate;
    if (inView(today)) return today;
    return cells.find((c): c is IsoDate => !!c && !off(c)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIso, viewKey, start, sel0, today, cells, min, max]);

  useEffect(() => {
    if (!wantFocus.current || pick !== "days") return;
    const b = gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]');
    if (b) {
      b.focus({ preventScroll: true });
      wantFocus.current = false;
    }
  }, [tabIso, viewKey, pick]);

  const clampIso = (d: IsoDate): IsoDate => (min && d < min ? min : max && d > max ? max : d);

  const onDayKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-k]");
    if (!b) return;
    const cur = b.dataset.k as IsoDate;
    let to: IsoDate | null = null;
    switch (e.key) {
      case "ArrowLeft": to = addDays(cur, -1); break;
      case "ArrowRight": to = addDays(cur, 1); break;
      case "ArrowUp": to = addDays(cur, -7); break;
      case "ArrowDown": to = addDays(cur, 7); break;
      case "Home": to = addDays(cur, -monIdx(cur)); break;
      case "End": to = addDays(cur, 6 - monIdx(cur)); break;
      case "PageUp": to = addMonths(cur, e.shiftKey ? -12 : -1); break;
      case "PageDown": to = addMonths(cur, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    to = clampIso(to);
    if (to === cur) return;
    wantFocus.current = true;
    setFocusIso(to);
    if (ym(to) !== viewKey) {
      setDir(to > cur ? "r" : "l");
      setView({ y: parts(to).y, m: parts(to).m });
    }
    if (range && start && !end) setHover(to);
  };

  const choose = (d: IsoDate) => {
    if (off(d)) return;
    setFocusIso(d);
    if (!range) {
      (props as Single).onSelect(d);
      return;
    }
    setHover("");
    if (!start || end) {
      setStart(d);
      setEnd("");
    } else if (d === start) {
      setEnd("");
    } else if (d < start) {
      setEnd(start);
      setStart(d);
    } else {
      setEnd(d);
    }
  };

  // Tô dải khoảng
  let lo: IsoDate | "" = range ? start : "";
  let hi: IsoDate | "" = range ? end || (start && hover ? hover : "") : "";
  if (lo && hi && hi < lo) [lo, hi] = [hi, lo];
  const single = !range ? (sel0 as IsoDate | "") : "";

  const monthLabel = `Tháng ${view.m + 1}, ${view.y}`;
  const canApply = range && !!start && !!end;
  const nDays = range && start && end ? diffDays(start, end) + 1 : 0;

  return (
    <div className="u030 ux">
      {range && (
        <div className="u030-pills">
          <div className={`u030-pill${!start || end ? " on" : ""}`}>
            <small>Từ ngày</small>
            <b className={start ? "" : "ph"}>{start ? formatDateVn(start) : "Chọn ngày"}</b>
          </div>
          <div className={`u030-pill${start && !end ? " on" : ""}`}>
            <small>Đến ngày</small>
            <b className={end ? "" : "ph"}>{end ? formatDateVn(end) : "Chọn ngày"}</b>
          </div>
        </div>
      )}
      <div className="u030-top">
        <button type="button" className="u030-m" aria-expanded={pick === "months"} aria-label={`${monthLabel}, đổi tháng hoặc năm`} onClick={() => setPick((p) => (p === "days" ? "months" : "days"))}>
          <span aria-live="polite">{pick === "months" ? `Năm ${view.y}` : monthLabel}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>
        </button>
        <div className="u030-nav">
          <button
            type="button"
            aria-label={pick === "months" ? "Năm trước" : "Tháng trước"}
            disabled={pick === "months" ? !!min && view.y <= parts(min).y : prevOff}
            onClick={() => (pick === "months" ? (setDir("l"), setView((v) => ({ ...v, y: v.y - 1 }))) : goMonth(-1))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
          </button>
          <button
            type="button"
            aria-label={pick === "months" ? "Năm sau" : "Tháng sau"}
            disabled={pick === "months" ? !!max && view.y >= parts(max).y : nextOff}
            onClick={() => (pick === "months" ? (setDir("r"), setView((v) => ({ ...v, y: v.y + 1 }))) : goMonth(1))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
          </button>
        </div>
      </div>
      {pick === "days" && (
        <div className="u030-wk" aria-hidden="true">
          {WD_SHORT.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      )}
      <div className="u030-view">
        {pick === "months" ? (
          <div className="u030-mon" role="group" aria-label={`Chọn tháng của năm ${view.y}`}>
            {Array.from({ length: 12 }, (_, m) => {
              const first = iso(view.y, m, 1), last = iso(view.y, m, dim(view.y, m));
              const disabled = (!!min && last < min) || (!!max && first > max);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  aria-pressed={m === view.m}
                  onClick={() => {
                    setDir("n");
                    setView((v) => ({ ...v, m }));
                    setPick("days");
                  }}
                >
                  Tháng {m + 1}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            key={viewKey}
            ref={gridRef}
            className={`u030-grid${dir === "l" ? " l" : dir === "n" ? " n" : ""}`}
            role="group"
            aria-label={monthLabel}
            onKeyDown={onDayKey}
            onPointerLeave={() => hover && setHover("")}
          >
            {cells.map((d, i) => {
              const k = d ?? "";
              const isS = !!d && (range ? (hi ? d === lo : d === start) : d === single);
              const isE = !!d && (range ? !!hi && d === hi : d === single);
              const inR = !!d && range && !!hi && !!lo && d >= lo && d <= hi;
              const cls = `u030-cell${inR ? " in" : ""}${isS ? " s" : ""}${isE ? " e" : ""}`;
              return (
                <div key={i} className={cls}>
                  {d && (
                    <button
                      type="button"
                      className={`u030-d${d === today ? " today" : ""}`}
                      data-k={k}
                      data-autofocus={d === tabIso ? "" : undefined}
                      tabIndex={d === tabIso ? 0 : -1}
                      disabled={off(d)}
                      aria-label={`${WD_LONG[dow(d)]}, ${parts(d).d} tháng ${parts(d).m + 1}, ${parts(d).y}${d === today ? " (hôm nay)" : ""}`}
                      aria-current={d === today ? "date" : undefined}
                      aria-pressed={isS || isE}
                      onClick={() => choose(d)}
                      onPointerEnter={() => range && start && !end && !off(d) && setHover(d)}
                    >
                      {parts(d).d}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="u030-foot">
        {range ? (
          <>
            <span className="u030-sum" aria-live="polite">
              {nDays ? <b>{nDays} ngày</b> : start ? "Chọn ngày kết thúc" : "Chọn ngày bắt đầu"}
            </span>
            <button type="button" className="u030-ok" disabled={!canApply} onClick={() => canApply && (props as Range).onApply(start as IsoDate, end as IsoDate)}>
              Áp dụng
            </button>
          </>
        ) : (
          <>
            <button type="button" className="u030-link" disabled={off(today)} onClick={() => choose(today)}>
              Hôm nay
            </button>
            {(props as Single).onClear && (
              <button type="button" className="u030-link" disabled={!single} onClick={() => (props as Single).onClear?.()}>
                Xóa
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
