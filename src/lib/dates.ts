// Ngày chứng từ = ngày theo giờ Việt Nam (BR-GEN-08). Không dùng new Date("YYYY-MM-DD") để cộng trừ ngày.
export const VN_TZ = "Asia/Ho_Chi_Minh";
export type IsoDate = string; // "YYYY-MM-DD"

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ngày VN của một thời điểm (mặc định bây giờ) */
export function todayVn(at: Date = new Date()): IsoDate {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return p; // en-CA cho dạng YYYY-MM-DD
}

export function isIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtcDays(s: IsoDate): number {
  if (!isIsoDate(s)) throw new RangeError(`Ngày không hợp lệ: ${s}`);
  const m = ISO_RE.exec(s)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

function fromUtcDays(days: number): IsoDate {
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(s: IsoDate, n: number): IsoDate {
  return fromUtcDays(toUtcDays(s) + n);
}

/** Cộng tháng, kẹp cuối tháng (31/01 + 1 tháng = 28|29/02) */
export function addMonths(s: IsoDate, n: number): IsoDate {
  const m = ISO_RE.exec(s);
  if (!m || !isIsoDate(s)) throw new RangeError(`Ngày không hợp lệ: ${s}`);
  const y = Number(m[1]), mo = Number(m[2]) - 1 + n, d = Number(m[3]);
  const ty = y + Math.floor(mo / 12), tm = ((mo % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fromUtcDays(Date.UTC(ty, tm, Math.min(d, last)) / 86_400_000);
}

/** b − a theo ngày */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toUtcDays(b) - toUtcDays(a);
}

/** "2026-10-16" → "16/10/2026" */
export function formatDateVn(s: IsoDate | null | undefined): string {
  if (!s) return "—";
  const m = ISO_RE.exec(s.slice(0, 10));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

/** Thời điểm ISO UTC → "16/10/2026 14:05" giờ VN */
export function formatDateTimeVn(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Kiểm ngày chứng từ (BR-GEN-08): không tương lai; lùi ≤ maxBackdate trừ khi có quyền */
export function checkDocDate(doc: IsoDate, today: IsoDate, maxBackdateDays: number, canBackdate: boolean): "ok" | "future" | "backdate" {
  const d = diffDays(doc, today);
  if (d < 0) return "future";
  if (d > maxBackdateDays && !canBackdate) return "backdate";
  return "ok";
}
