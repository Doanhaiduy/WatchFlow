import { NextResponse } from "next/server";
import { publicApi, ensureCsrf } from "@/server/http";
import { refresh } from "@/server/auth/service";
import { COOKIE, setAuthCookies, clearAuthCookies } from "@/server/auth/cookies";
import { ApiError } from "@/server/errors";

export const POST = publicApi({ csrf: "origin" }, async ({ req }) => {
  const rt = req.cookies.get(COOKIE.rt)?.value;
  if (!rt) throw new ApiError(401, "WF-AUTH-UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  try {
    const issued = await refresh(rt);
    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, issued.accessToken, issued.accessTtl, issued.refreshToken, issued.refreshTtlDays);
    return ensureCsrf(req, res);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const res = NextResponse.json({ type: "https://watchflow.app/errors/" + e.code, status: 401, code: e.code, detail: e.detail }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }
    throw e;
  }
});
