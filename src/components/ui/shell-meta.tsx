"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ShellMeta = { title?: string; description?: string };

type Ctx = {
  meta: ShellMeta;
  setMeta: (m: ShellMeta) => void;
  /** Có thông báo chưa đọc ⇒ chấm đỏ ở chuông */
  unread: boolean;
  /** Người dùng xem được kho đồng hồ ⇒ đầu trang điện thoại có nút tìm/quét */
  search: boolean;
};

const MetaCtx = createContext<Ctx | null>(null);

/** Cho `PageHeader` (trong trang) báo tiêu đề/mô tả lên `TopBar` (desktop) của khung ứng dụng. */
export function ShellMetaProvider({ unread = false, search = false, children }: { unread?: boolean; search?: boolean; children: ReactNode }) {
  const [meta, setMetaState] = useState<ShellMeta>({});
  const setMeta = useCallback((m: ShellMeta) => setMetaState((p) => (p.title === m.title && p.description === m.description ? p : m)), []);
  const value = useMemo(() => ({ meta, setMeta, unread, search }), [meta, setMeta, unread, search]);
  return <MetaCtx.Provider value={value}>{children}</MetaCtx.Provider>;
}

/** `null` khi không nằm trong khung ứng dụng (vd. trang /dev/design) */
export function useShellMeta(): Ctx | null {
  return useContext(MetaCtx);
}
