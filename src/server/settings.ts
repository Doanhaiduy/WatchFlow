import "server-only";
// Đọc cài đặt phía máy chủ — cache 30 giây theo instance, vô hiệu khi sửa (settings-catalog §10).
import { withWorker, type Tx } from "./db";
import { SETTINGS, type SettingKey, type SettingValue } from "@/lib/settings-catalog";

let cache: { at: number; values: Map<string, unknown> } | null = null;
const TTL = 30_000;

async function load(tx?: Tx): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL) return cache.values;
  const read = async (t: Tx) => t.q<{ key: string; value: unknown }>("SELECT key, value FROM public.settings");
  const rows = tx ? await read(tx) : await withWorker(read);
  cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) };
  return cache.values;
}

export async function getSetting<K extends SettingKey>(key: K, tx?: Tx): Promise<SettingValue<K>> {
  const v = (await load(tx)).get(key);
  const parsed = SETTINGS[key].schema.safeParse(v);
  if (!parsed.success) throw new Error(`Cài đặt ${key} không hợp lệ`);
  return parsed.data as SettingValue<K>;
}

export function invalidateSettings() {
  cache = null;
}
