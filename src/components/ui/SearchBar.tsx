"use client";
import { ScanLine, Search } from "lucide-react";
import { useId, type FormEvent } from "react";
import { cx } from "./cx";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Bấm Enter/tìm */
  onSubmit?: (v: string) => void;
  /** Có ⇒ hiện nút quét QR */
  onScan?: () => void;
  placeholder?: string;
  className?: string;
  /** Tự đặt con trỏ vào ô khi mở trang */
  autoFocus?: boolean;
};

/** `.sbar` — viên thuốc kính + nút quét. Ô tìm MỘT cho mọi mã (mã chiếc, serial, SĐT, mã phiếu). */
export function SearchBar({ value, onChange, onSubmit, onScan, placeholder = "Tìm mã, serial, SĐT khách…", className, autoFocus }: Props) {
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(value);
  };
  return (
    <form role="search" className={cx("wf-sbar", className)} onSubmit={submit}>
      <label htmlFor={id} className="g g-flat">
        <Search size={20} aria-hidden="true" />
        <span className="wf-sr">Tìm kiếm</span>
        <input id={id} autoFocus={autoFocus} type="search" enterKeyHint="search" autoComplete="off" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </label>
      {onScan && (
        <button type="button" className="wf-cb wf-cb-lg g g-flat" onClick={onScan} aria-label="Quét mã QR">
          <ScanLine size={22} />
        </button>
      )}
    </form>
  );
}
