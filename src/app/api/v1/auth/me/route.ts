import { NextResponse } from "next/server";
import { api, ensureCsrf } from "@/server/http";

export const GET = api({ auth: "auth" }, async ({ req, user, db }) => {
  const { sessionId: _s, reauthAt: _r, ...pub } = user;
  // Hạn mức giảm giá của chính mình — để POS cảnh báo sớm (máy chủ vẫn kiểm khi xác nhận)
  const lim = await db((tx) => tx.one<{ p: string; d: number }>("SELECT app.my_max_discount_pct()::text AS p, app.setting_int('security.trusted_device_days', 30) AS d"));
  return ensureCsrf(req, NextResponse.json({ user: { ...pub, maxDiscountPct: Number(lim?.p ?? 0), trustedDeviceDays: Math.max(0, Math.min(90, lim?.d ?? 30)) } }));
});
