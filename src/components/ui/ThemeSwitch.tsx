"use client";
// Chọn giao diện Sáng / Tối / Theo hệ thống (lưu localStorage `wf-theme`, bọc try/catch — private mode có thể chặn).
import { useEffect, useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_KEY } from "@/lib/theme-script";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";

export type ThemePref = "light" | "dark" | "system";
export type ThemeResolved = "light" | "dark";

const OPTIONS: ReadonlyArray<SegmentOption<ThemePref>> = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Theo hệ thống" },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePref): ThemeResolved {
  return pref === "dark" || (pref === "system" && systemDark()) ? "dark" : "light";
}

/** Áp chế độ lên <html> + meta theme-color (idempotent). */
export function applyTheme(pref: ThemePref): ThemeResolved {
  const r = resolve(pref);
  document.documentElement.dataset.theme = r;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[r]);
  return r;
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* không lưu được: vẫn áp cho phiên này */
  }
  applyTheme(pref);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === null) {
      applyTheme(readPref());
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "light" as ThemePref);
  return { pref, setPref: setThemePref };
}

/** Gắn một lần ở root layout: đồng bộ data-theme/meta lúc mount và theo dõi đổi chế độ của hệ điều hành khi đang chọn "Theo hệ thống". */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(readPref());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => {
      if (readPref() === "system") applyTheme("system");
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return null;
}

const COMPACT: ReadonlyArray<SegmentOption<ThemePref>> = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Hệ thống" },
];

/** Nút chọn giao diện 3 lựa chọn. `compact`: nhãn ngắn "Hệ thống" cho chỗ hẹp (sidebar). */
export function ThemeSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { pref, setPref } = useTheme();
  return <SegmentedControl options={compact ? COMPACT : OPTIONS} value={pref} onChange={setPref} ariaLabel="Giao diện" className={className} />;
}
