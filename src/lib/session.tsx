"use client";
// Phiên người dùng phía client. Chỉ để UX (ẩn/hiện) — máy chủ & DB luôn kiểm lại quyền.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api-client";
import { can as canPerm, type Permission } from "./permissions";

export type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  perms: string[];
  mustChangePassword: boolean;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  mfaOk: boolean;
  /** Hạn mức giảm giá (%) cao nhất trong các vai trò — chỉ để cảnh báo sớm */
  maxDiscountPct?: number;
  /** Số ngày "tin cậy thiết bị" ở bước 2FA (0 = tắt) */
  trustedDeviceDays?: number;
};

type Ctx = {
  user: SessionUser | null;
  loading: boolean;
  can: (p: Permission | Permission[]) => boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children, initial = null }: { children: ReactNode; initial?: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const reload = useCallback(async () => {
    try {
      const me = await api<{ user: SessionUser }>("/api/v1/auth/me", { noRedirect: true });
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!initial) void reload();
  }, [initial, reload]);
  const logout = useCallback(async () => {
    await api("/api/v1/auth/logout", { method: "POST", noRedirect: true }).catch(() => {});
    setUser(null);
    location.href = "/dang-nhap";
  }, []);
  const value = useMemo<Ctx>(
    () => ({ user, loading, can: (p) => canPerm(user?.perms, p), reload, logout }),
    [user, loading, reload, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Như useSession nhưng không ném lỗi khi đứng ngoài <SessionProvider> (vd. trang mẫu /dev/design) — trả null. */
export function useOptionalSession(): Ctx | null {
  return useContext(SessionContext);
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error("useSession phải nằm trong <SessionProvider>");
  return c;
}

/** Chỉ render khi có quyền (không render ⇒ không gọi API con) */
export function CanSee({ permission, children, fallback = null }: { permission: Permission | Permission[]; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useSession();
  return <>{can(permission) ? children : fallback}</>;
}
