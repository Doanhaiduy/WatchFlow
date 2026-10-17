import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { invalidateSettings } from "@/server/settings";
import { SETTINGS, isSettingKey, type SettingKey } from "@/lib/settings-catalog";
import { SettingPatchBody } from "@/lib/types/admin";

export const GET = api({ perm: "settings.view" }, async ({ db }) => {
  const rows = await db((tx) =>
    tx.q<{ key: string; value: unknown; updated_at: string }>(`SELECT key, value, updated_at FROM public.settings ORDER BY key`),
  );
  return {
    items: rows
      .filter((r) => isSettingKey(r.key))
      .map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at, label: SETTINGS[r.key as SettingKey].label, group: SETTINGS[r.key as SettingKey].group })),
  };
});

export const PATCH = api({ perm: "settings.manage", body: SettingPatchBody }, async ({ body, db }) => {
  if (!isSettingKey(body.key)) throw new ApiError(404, "WF-NOT-FOUND", "Không có khóa cài đặt này.");
  const parsed = SETTINGS[body.key].schema.safeParse(body.value);
  if (!parsed.success) throw new ApiError(422, "WF-VALIDATION", `Giá trị không hợp lệ cho "${SETTINGS[body.key].label}".`);
  await db((tx) => tx.fn("app.fn_set_setting", [body.key, JSON.stringify(parsed.data)]));
  invalidateSettings();
  return { ok: true };
});
