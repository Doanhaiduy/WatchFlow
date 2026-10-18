// Chuỗi số liệu theo kỳ cho biểu đồ: báo cáo chỉ trả các kỳ CÓ phát sinh ⇒ điền kỳ trống bằng 0 để biểu đồ liền mạch và có đủ điểm.
// Ngày là chuỗi "YYYY-MM-DD" (giờ VN), không dùng new Date("YYYY-MM-DD") để cộng trừ (BR-GEN-08).
import { addDays, addMonths, diffDays, type IsoDate } from "./dates";

const HARD_CAP = 5000; // chặn vòng lặp nếu khoảng ngày bị nhập sai

export type SeriesGroup = "day" | "month";
type Row = { period: string } & Record<string, unknown>;

/** Các mốc kỳ từ `from` đến `to` (gồm cả hai): mỗi ngày, hoặc ngày 1 của mỗi tháng. Tối đa `limit` mốc (giữ các mốc cuối). */
export function bucketKeys(from: IsoDate, to: IsoDate, group: SeriesGroup, limit = 400): IsoDate[] {
  const out: IsoDate[] = [];
  if (group === "month") {
    let k = `${from.slice(0, 7)}-01`;
    const end = `${to.slice(0, 7)}-01`;
    while (k <= end && out.length < HARD_CAP) {
      out.push(k);
      k = addMonths(k, 1);
    }
  } else {
    let k = from;
    while (k <= to && out.length < HARD_CAP) {
      out.push(k);
      k = addDays(k, 1);
    }
  }
  return out.slice(-limit);
}

/**
 * Điền các kỳ thiếu bằng dòng 0 (`zero` = các trường số mặc định). Kỳ có dữ liệu giữ nguyên; thứ tự tăng dần theo kỳ.
 * Dòng ngoài khoảng [from, to] vẫn được giữ (không làm mất số liệu).
 */
export function fillSeries<T extends Row>(rows: readonly T[], from: IsoDate, to: IsoDate, group: SeriesGroup, zero: Omit<T, "period">): T[] {
  const by = new Map(rows.map((r) => [String(r.period).slice(0, 10), r]));
  const out: T[] = [];
  for (const k of bucketKeys(from, to, group)) {
    out.push(((by.get(k) as T | undefined) ?? { period: k, ...zero }) as T);
    by.delete(k);
  }
  for (const r of by.values()) out.push(r);
  return out.sort((a, b) => (String(a.period) < String(b.period) ? -1 : 1));
}

export type DashPeriod = "today" | "7d" | "month" | "quarter" | "year";

/** Khoảng so sánh với kỳ hiện tại: hôm qua; 7 ngày trước đó; tháng/quý/năm trước (cùng số ngày đã qua). */
export function previousRange(period: DashPeriod, from: IsoDate, to: IsoDate): [IsoDate, IsoDate] {
  if (period === "today") return [addDays(from, -1), addDays(to, -1)];
  if (period === "7d") return [addDays(from, -7), addDays(to, -7)];
  const m = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  return [addMonths(from, -m), addMonths(to, -m)];
}

/** Khoảng tùy chọn: khoảng liền trước, cùng số ngày. */
export function previousSpan(from: IsoDate, to: IsoDate): [IsoDate, IsoDate] {
  const n = diffDays(from, to) + 1;
  return [addDays(from, -n), addDays(from, -1)];
}

/** % thay đổi so với kỳ trước, làm tròn 1 chữ số; kỳ trước = 0 ⇒ null (không so được). */
export function deltaPct(cur: number | undefined, prev: number | undefined): number | null {
  if (typeof cur !== "number" || typeof prev !== "number" || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}
