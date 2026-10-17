import { NextResponse } from "next/server";
import { publicApi } from "@/server/http";
import { logout } from "@/server/auth/service";
import { COOKIE, clearAuthCookies } from "@/server/auth/cookies";
import { verifyAccess } from "@/server/auth/tokens";

export const POST = publicApi({ csrf: "origin" }, async ({ req }) => {
  const at = req.cookies.get(COOKIE.at)?.value;
  const claims = at ? await verifyAccess(at) : null;
  await logout(claims?.sid ?? null, req.cookies.get(COOKIE.rt)?.value ?? null);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
});
