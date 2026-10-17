import { z } from "zod";
import { api } from "@/server/http";
import { pushConfigured, pushPublicKey } from "@/server/push";

// Cấu hình thông báo đẩy của CHÍNH MÌNH: khóa công khai VAPID, giờ yên tĩnh, các thiết bị đã đăng ký (không kèm khóa bí mật p256dh/auth).
type Device = { id: string; endpoint: string; userAgent: string | null; createdAt: string; lastOkAt: string | null; disabledAt: string | null };

export const GET = api({}, async ({ db }) => {
  return db(async (tx) => {
    const devices = await tx.q<Device>(
      `SELECT id, endpoint, user_agent AS "userAgent", created_at AS "createdAt", last_ok_at AS "lastOkAt", disabled_at AS "disabledAt"
         FROM public.push_subscriptions WHERE user_id = app.current_user_id() ORDER BY created_at DESC`,
    );
    const pref = await tx.one<{ enabled: boolean; start: number; end: number }>(
      `SELECT quiet_enabled AS enabled, quiet_start AS start, quiet_end AS "end" FROM public.push_preferences WHERE user_id = app.current_user_id()`,
    );
    return {
      enabled: pushConfigured(),
      publicKey: pushPublicKey(),
      quiet: pref ?? { enabled: false, start: 1320, end: 420 },
      devices,
    };
  });
});

const Prefs = z.object({
  quietEnabled: z.boolean(),
  quietStart: z.number().int().min(0).max(1439),
  quietEnd: z.number().int().min(0).max(1439),
});

export const PUT = api({ body: Prefs }, async ({ body, db }) => {
  await db((tx) => tx.fn("app.fn_set_push_preferences", [body.quietEnabled, body.quietStart, body.quietEnd]));
  return { ok: true };
});
