"use client";
// Select tự dựng (thay <select> gốc). API giữ như bản cũ: value / onChange(e.target.value) / options / placeholder / invalid / disabled.
// Giao diện: Lucian UX/UI Prompt #031 (Custom select listbox) · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#031
// — thanh sáng trượt, dấu ✓ nảy, mũi tên xoay (lucian-031.css); phần portal/lật lên/bottom sheet/ô tìm không dấu viết theo cách của
// ref-sources/domus-francis (CustomSelect, FloatingPanel, MobileDetailSheet) với token Glass. Sổ phần tử: ui-design-system §9.
import { ChevronDown, Search } from "lucide-react";
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent } from "react";
import { foldVi } from "@/lib/text";
import "../lucian/lucian-031.css";
import { useIsDesktop } from "../trade/useIsDesktop";
import { cx } from "./cx";
import { useFieldLabel, useFieldProps } from "./Field";
import { Modal } from "./Modal";
import { Popover } from "./Popover";

/** `sublabel`: dòng phụ nhỏ dưới tên (vd. mã); `keywords`: chữ thêm để ô tìm khớp (không hiển thị). */
export type SelectOption = { value: string; label: string; disabled?: boolean; sublabel?: string; keywords?: string };

type SelectProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value" | "defaultValue" | "children" | "role"> & {
  value?: string;
  defaultValue?: string;
  /** Tương thích bản <select> cũ: nhận đối tượng có `target.value` (không phải sự kiện DOM thật) */
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  onValueChange?: (value: string) => void;
  options?: ReadonlyArray<SelectOption>;
  /** Dòng đầu (giá trị "") — chọn lại được để bỏ chọn, như <option value=""> */
  placeholder?: string;
  invalid?: boolean;
  /** Tiêu đề tờ trượt trên điện thoại (mặc định: nhãn của Field / aria-label / placeholder) */
  label?: string;
  /** Hiện ô tìm; mặc định bật khi > 8 lựa chọn */
  searchable?: boolean;
  name?: string;
};

const SEARCH_AT = 8;
const ROW = 44;

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, defaultValue, onChange, onValueChange, options = [], placeholder, invalid, label, searchable, name, className, id, disabled, onKeyDown, onClick, ...rest },
  ref,
) {
  const f = useFieldProps(id);
  const fieldLabel = useFieldLabel();
  const uid = useId();
  const listId = `${uid}-l`;
  const desktop = useIsDesktop();
  const btn = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => btn.current as HTMLButtonElement);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const [inner, setInner] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const cur = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [act, setAct] = useState(0);
  const typed = useRef<{ s: string; t: ReturnType<typeof setTimeout> | null }>({ s: "", t: null });

  const hasSearch = searchable ?? options.length > SEARCH_AT;
  const all = useMemo<SelectOption[]>(() => (placeholder !== undefined ? [{ value: "", label: placeholder }, ...options] : [...options]), [placeholder, options]);
  const shown = useMemo(() => {
    const t = foldVi(q.trim());
    if (!t) return all;
    return all.filter((o) => !(placeholder !== undefined && o.value === "") && foldVi(`${o.label} ${o.sublabel ?? ""} ${o.keywords ?? ""}`).includes(t));
  }, [all, q, placeholder]);
  const selected = options.find((o) => o.value === cur);
  const title = label ?? rest["aria-label"] ?? fieldLabel ?? placeholder ?? "Chọn";

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQ("");
    if (refocus) btn.current?.focus({ preventScroll: true });
  }, []);

  const choose = useCallback(
    (o: SelectOption | undefined) => {
      if (!o || o.disabled) return;
      if (!controlled) setInner(o.value);
      onValueChange?.(o.value);
      onChange?.({ target: { value: o.value, name } });
      close(true);
    },
    [controlled, onChange, onValueChange, name, close],
  );

  const openList = () => {
    if (disabled) return;
    const i = all.findIndex((o) => o.value === cur && !o.disabled);
    setAct(Math.max(0, i));
    setQ("");
    setOpen(true);
  };

  const move = (from: number, dir: 1 | -1) => {
    for (let j = from + dir; j >= 0 && j < shown.length; j += dir) {
      if (!shown[j]!.disabled) return j;
    }
    return from;
  };
  const edge = (dir: 1 | -1) => {
    const idx = dir === 1 ? shown.findIndex((o) => !o.disabled) : shown.map((o) => !o.disabled).lastIndexOf(true);
    return Math.max(0, idx);
  };

  const mode: "trigger" | "search" | "sheet" = !desktop ? "sheet" : hasSearch ? "search" : "trigger";

  // Giữ mục đang trỏ trong tầm nhìn của danh sách cuộn
  useEffect(() => {
    if (!open) return;
    const l = list.current;
    const el = l?.querySelector<HTMLElement>(`[data-i="${act}"]`);
    if (l && el) {
      const top = el.offsetTop, bot = top + el.offsetHeight;
      if (top < l.scrollTop) l.scrollTop = Math.max(0, top - 6);
      else if (bot > l.scrollTop + l.clientHeight) l.scrollTop = bot - l.clientHeight + 6;
    }
  }, [open, act, shown]);
  // Ô tìm (desktop) chỉ có trong DOM sau khi Popover gắn vào: focus ngay khi nó xuất hiện
  const searchRef = useCallback(
    (el: HTMLInputElement | null) => {
      search.current = el;
      if (el && mode === "search") el.focus({ preventScroll: true });
    },
    [mode],
  );
  useEffect(() => {
    const ty = typed.current;
    return () => {
      if (ty.t) clearTimeout(ty.t);
    };
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLElement>) => {
    const k = e.key;
    const inSearch = e.currentTarget === search.current;
    if (k === "ArrowDown") { e.preventDefault(); setAct((a) => move(a, 1)); }
    else if (k === "ArrowUp") { e.preventDefault(); setAct((a) => move(a, -1)); }
    else if (k === "Home" && !inSearch) { e.preventDefault(); setAct(edge(1)); }
    else if (k === "End" && !inSearch) { e.preventDefault(); setAct(edge(-1)); }
    else if (k === "Enter" || (k === " " && !inSearch)) { e.preventDefault(); choose(shown[act]); }
    else if (k === "Tab" && mode === "trigger") close(false);
    else if (k.length === 1 && !inSearch && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // gõ chữ để nhảy tới mục bắt đầu bằng chuỗi đã gõ (không dấu)
      const ty = typed.current;
      if (ty.t) clearTimeout(ty.t);
      ty.s += foldVi(k);
      ty.t = setTimeout(() => { ty.s = ""; ty.t = null; }, 600);
      const hit = shown.findIndex((o) => !o.disabled && !(placeholder !== undefined && o.value === "") && foldVi(o.label).startsWith(ty.s));
      if (hit >= 0) setAct(hit);
    }
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openList(); }
      return;
    }
    if (mode === "trigger") handleKey(e);
  };

  const activeId = open && shown[act] ? `${uid}-o${act}` : undefined;
  const text = selected && selected.value !== "" ? selected.label : placeholder ?? "";
  const isPh = !selected || selected.value === "";
  const inv = invalid || f["aria-invalid"];

  const content = (sheet: boolean) => (
    <>
      {hasSearch && (
        <div className={cx("wf-in-wrap wf-select-q", sheet && "wf-select-q-sheet")}>
          <span className="wf-in-ico" aria-hidden="true"><Search size={16} /></span>
          <input
            ref={searchRef}
            data-autofocus={sheet ? "" : undefined}
            className="wf-in"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label={`Tìm trong ${title}`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Tìm…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setAct(0); }}
            onKeyDown={handleKey}
          />
        </div>
      )}
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={title}
        tabIndex={-1}
        data-sheet={sheet ? "true" : undefined}
        data-autofocus={sheet && !hasSearch ? "" : undefined}
        className="u031-list ux"
        onKeyDown={sheet && !hasSearch ? handleKey : undefined}
      >
        {shown.length > 0 && <li className="u031-hl" role="presentation" aria-hidden="true" style={{ ["--i" as string]: act }} />}
        {shown.map((o, i) => (
          <li
            key={`${o.value}:${i}`}
            id={`${uid}-o${i}`}
            data-i={i}
            role="option"
            aria-selected={o.value === cur || (isPh && o.value === "")}
            aria-disabled={o.disabled || undefined}
            className={cx("u031-o", placeholder !== undefined && o.value === "" && "ph")}
            onMouseDown={(e) => e.preventDefault() /* giữ focus ở nút/ô tìm */}
            onPointerMove={() => !o.disabled && act !== i && setAct(i)}
            onClick={() => choose(o)}
          >
            <span>{o.label}{o.sublabel && <small className="u031-sub">{o.sublabel}</small>}</span>
            <svg className="u031-ck" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9.5l3.5 3.5L14 6" /></svg>
          </li>
        ))}
        {shown.length === 0 && <li className="u031-empty" role="presentation">Không có kết quả</li>}
      </ul>
    </>
  );

  const rows = Math.min(shown.length || 1, 7);
  const est = rows * ROW + 14 + (hasSearch ? 60 : 0);

  return (
    <div className="wf-select-wrap">
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && mode === "trigger" ? activeId : undefined}
        className={cx("wf-in wf-select-btn", className)}
        data-open={open || undefined}
        data-empty={isPh || undefined}
        disabled={disabled}
        {...f}
        aria-invalid={inv || undefined}
        {...rest}
        onKeyDown={onTriggerKey}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          if (open) close(true);
          else openList();
        }}
      >
        <span className="wf-select-v">{text || " "}</span>
        <ChevronDown className="u031-car" aria-hidden="true" />
      </button>
      {name && <input type="hidden" name={name} value={cur} />}
      {desktop ? (
        <Popover open={open} onClose={() => close(true)} anchorRef={btn} height={est} className="wf-pop-select">
          {content(false)}
        </Popover>
      ) : (
        <Modal open={open} onClose={() => close(true)} title={title}>
          {content(true)}
        </Modal>
      )}
    </div>
  );
});
