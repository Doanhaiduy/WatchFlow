"use client";
// Ô nhập CÓ GỢI Ý: gõ tự do (giá trị luôn là chữ trong ô) + chọn một gợi ý để điền nhanh. Khác Select: không bắt buộc chọn trong danh sách.
// Giao diện: Lucian UX/UI Prompt #034 (Airport autocomplete) · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#034
// — chữ mờ hoàn thành (Tab nhận), danh sách tô đậm phần khớp, thanh sáng trượt (lucian-034.css). Phần Popover/không dấu/a11y viết theo Select;
// ý tưởng CustomCombobox + FloatingPanel của ref-sources/domus-francis. Sổ phần tử: ui-design-system §9.
// Bàn phím: ↑/↓ chọn (Enter nhận; chưa chọn thì Enter vẫn gửi biểu mẫu), Tab nhận chữ mờ, Esc CHỈ đóng danh sách (hộp thoại chứa nó vẫn mở).
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { completionTail, filterSuggestions, splitByRanges, type SuggestItem } from "@/lib/suggest";
import { foldVi } from "@/lib/text";
import "../lucian/lucian-034.css";
import { useIsDesktop } from "../trade/useIsDesktop";
import { useFieldLabel } from "./Field";
import { useOverlayBehavior } from "./overlay";
import { Popover } from "./Popover";
import { TextInput } from "./TextInput";

/** `label` là chữ điền vào ô khi chọn; `sublabel`: dòng phụ; `keywords`: chữ thêm để khớp (không hiển thị). */
export type ComboOption = SuggestItem;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "role" | "list" | "defaultValue"> & {
  value: string;
  onChange: (value: string) => void;
  /** Gợi ý: chuỗi hoặc đối tượng. Danh sách nên sắp theo mức hay dùng/mới nhất (cùng hạng khớp giữ nguyên thứ tự). */
  options: ReadonlyArray<ComboOption | string>;
  /** Gọi khi người dùng CHỌN một gợi ý (sau onChange) */
  onPick?: (o: ComboOption) => void;
  /** Số gợi ý tối đa hiện ra (mặc định 8) */
  maxItems?: number;
  invalid?: boolean;
  /** Tên danh sách cho trình đọc màn hình (mặc định: nhãn của Field) */
  label?: string;
  /** Dòng ghi chú đầu danh sách khi chưa gõ gì (vd. "Đã dùng gần đây") */
  heading?: string;
};

export const Combobox = forwardRef<HTMLInputElement, Props>(function Combobox(
  { value, onChange, options, onPick, maxItems = 8, invalid, label, heading, onKeyDown, onBlur, onClick, onFocus, disabled, ...rest },
  ref,
) {
  const uid = useId();
  const listId = `${uid}-l`;
  const fieldLabel = useFieldLabel();
  const desktop = useIsDesktop();
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const blurT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const [focused, setFocused] = useState(false);

  const items = useMemo<ComboOption[]>(() => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)), [options]);
  const shown = useMemo(() => {
    const r = filterSuggestions(items, value, maxItems);
    // Ô đã đúng bằng đúng một gợi ý ⇒ không cần gợi ý nữa
    if (r.length === 1 && value.trim() && foldVi(r[0]!.item.label) === foldVi(value.trim())) return [];
    return r;
  }, [items, value, maxItems]);
  const visible = open && shown.length > 0 && !disabled;
  const two = shown.some((s) => !!s.item.sublabel);
  const ghost = desktop && focused && !disabled && shown.length > 0 ? completionTail(shown[0]!.item.label, value) : "";
  const name = label ?? fieldLabel ?? "Gợi ý";
  const showHeading = !!heading && !value.trim();

  const close = useCallback(() => {
    setOpen(false);
    setAct(-1);
  }, []);
  const pick = useCallback(
    (o: ComboOption) => {
      onChange(o.label);
      onPick?.(o);
      close();
      input.current?.focus({ preventScroll: true });
    },
    [onChange, onPick, close],
  );

  // Esc chỉ đóng danh sách (xếp chồng trên hộp thoại). Desktop: Popover tự lo Esc; điện thoại: đăng ký ở đây.
  useOverlayBehavior(list, visible && !desktop, close, { trap: false, lock: false, autoFocus: false, restoreFocus: false });

  useEffect(() => {
    if (!visible || act < 0) return;
    const l = list.current;
    const el = l?.querySelector<HTMLElement>(`[data-i="${act}"]`);
    if (l && el) {
      const top = el.offsetTop, bot = top + el.offsetHeight;
      if (top < l.scrollTop) l.scrollTop = Math.max(0, top - 6);
      else if (bot > l.scrollTop + l.clientHeight) l.scrollTop = bot - l.clientHeight + 6;
    }
  }, [visible, act]);
  useEffect(
    () => () => {
      if (blurT.current) clearTimeout(blurT.current);
    },
    [],
  );

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const n = shown.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      if (!visible) {
        setOpen(true);
        setAct(0);
      } else setAct((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp" && n && visible) {
      e.preventDefault();
      setAct((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === "Enter" && visible && act >= 0 && shown[act]) {
      e.preventDefault(); // chỉ khi đang trỏ một gợi ý; còn lại Enter vẫn gửi biểu mẫu
      pick(shown[act]!.item);
    } else if (e.key === "Tab" && !e.shiftKey && ghost) {
      e.preventDefault();
      pick(shown[0]!.item);
    }
  };

  const content = (
    <ul ref={list} id={listId} role="listbox" aria-label={name} data-inline={desktop ? undefined : "true"} data-two={two || undefined} data-none={act < 0 || undefined} className="u034-list ux">
      <li className="u034-hl" role="presentation" aria-hidden="true" style={{ ["--i" as string]: Math.max(0, act) }} />
      {showHeading && (
        <li className="u034-note" role="presentation">
          {heading}
        </li>
      )}
      {shown.map((s, i) => (
        <li
          key={`${s.item.value}:${i}`}
          id={`${uid}-o${i}`}
          data-i={i}
          role="option"
          aria-selected={i === act}
          className="u034-o"
          style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
          onMouseDown={(e) => e.preventDefault() /* giữ focus ở ô nhập */}
          onPointerMove={() => act !== i && setAct(i)}
          onClick={() => pick(s.item)}
        >
          <span>
            <b>{splitByRanges(s.item.label, s.ranges).map(([t, hit], k) => (hit ? <mark key={k}>{t}</mark> : t))}</b>
            {s.item.sublabel && <small>{s.item.sublabel}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
  // Chiều cao ước lượng để Popover quyết định lật lên/xuống
  const est = Math.min(shown.length, 6) * (two ? 58 : 48) + 12 + (showHeading ? 30 : 0);

  return (
    <div className="wf-combo">
      <div ref={box} className="u034-box">
        <TextInput
          ref={input}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          {...rest}
          invalid={invalid}
          disabled={disabled}
          value={value}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={visible}
          aria-controls={visible ? listId : undefined}
          aria-autocomplete={ghost ? "both" : "list"}
          aria-activedescendant={visible && act >= 0 ? `${uid}-o${act}` : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);
            setOpen(true);
            setAct(-1);
          }}
          onKeyDown={handleKey}
          onClick={(e) => {
            onClick?.(e);
            if (!e.defaultPrevented) setOpen(true);
          }}
          onFocus={(e) => {
            if (blurT.current) clearTimeout(blurT.current);
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
            if (blurT.current) clearTimeout(blurT.current);
            blurT.current = setTimeout(close, 140); // chờ một nhịp để cú chạm vào gợi ý kịp thành "chọn"
          }}
        />
        {ghost && (
          <span className="u034-ghost" aria-hidden="true">
            <b>{value}</b>
            {ghost}
          </span>
        )}
      </div>
      {desktop ? (
        <Popover open={visible} onClose={close} anchorRef={box} height={est} className="wf-pop-select">
          {content}
        </Popover>
      ) : (
        visible && content
      )}
    </div>
  );
});
