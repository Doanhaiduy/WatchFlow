"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import { fetchMe, nextStep, safeNext } from "@/components/auth/helpers";
import { LoginCard } from "@/components/lucian/LoginCard";

export function LoginView() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | undefined>();
  const alive = useRef(true);

  const go = (step: string | null) => router.replace(step ? `${step}?next=${encodeURIComponent(next)}` : next);

  useEffect(() => {
    alive.current = true;
    // Đã đăng nhập đầy đủ ⇒ về trang đích; đang dở bước 2FA/đổi mật khẩu ⇒ sang bước đó
    void fetchMe().then((u) => {
      if (u && alive.current) go(nextStep(u));
    });
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LoginCard
      loading={loading}
      success={ok}
      error={error}
      attemptsLeft={left}
      onSubmit={async (email, password) => {
        setLoading(true);
        setError(null);
        setLeft(undefined);
        try {
          await api("/api/v1/auth/login", { body: { email, password }, noRedirect: true });
          const me = await fetchMe();
          setOk(true);
          setLoading(false);
          setTimeout(() => alive.current && go(me ? nextStep(me) : null), 550);
        } catch (e) {
          setLoading(false);
          if (e instanceof ApiClientError) {
            const m = /Còn (\d+) lần/.exec(e.detail);
            if (e.code === "WF-AUTH-INVALID") {
              setError("Email hoặc mật khẩu không đúng");
              setLeft(m ? Number(m[1]) : undefined);
            } else setError(e.detail);
          } else setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
        }
      }}
    />
  );
}
