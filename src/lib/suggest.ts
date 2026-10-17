// Lọc gợi ý không dấu cho Combobox (thuần, kiểm thử được): xếp hạng đầu chuỗi > đầu từ > chứa > khớp chữ phụ; trả khoảng để tô đậm.
import { foldVi } from "./text";

export type SuggestItem = { value: string; label: string; sublabel?: string; keywords?: string };
export type Range = [number, number]; // [từ, đến) theo chỉ số của CHUỖI GỐC
export type Suggested<T extends SuggestItem> = { item: T; rank: number; ranges: Range[] };

/** Chuẩn hóa từng ký tự và nhớ vị trí gốc để ánh xạ khoảng khớp về chuỗi hiển thị (NFC/NFD đều đúng). */
export function foldMap(s: string): { text: string; start: number[]; end: number[] } {
  let text = "";
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = foldVi(ch);
    for (let k = 0; k < f.length; k++) {
      text += f[k];
      start.push(i);
      end.push(i + ch.length);
    }
    i += ch.length;
  }
  return { text, start, end };
}

const norm = (q: string) => foldVi(q).replace(/\s+/g, " ").trim();

/** Khoảng khớp của `q` trong `label` (không dấu); null nếu không khớp. Đầu chuỗi/đầu từ được ưu tiên. */
export function matchLabel(label: string, q: string): { rank: 0 | 1 | 2; ranges: Range[] } | null {
  const needle = norm(q);
  if (!needle) return null;
  const { text, start, end } = foldMap(label);
  const h = text;
  let at = h.startsWith(needle) ? 0 : -1;
  let rank: 0 | 1 | 2 = 0;
  if (at < 0) {
    for (let p = h.indexOf(needle); p >= 0; p = h.indexOf(needle, p + 1)) {
      if (p === 0 || h[p - 1] === " ") {
        at = p;
        rank = 1;
        break;
      }
    }
  }
  if (at < 0) {
    const p = h.indexOf(needle);
    if (p < 0) return null;
    at = p;
    rank = 2;
  }
  const a = start[at]!;
  const b = end[at + needle.length - 1]!;
  return { rank, ranges: [[a, b]] };
}

/** Lọc + xếp hạng (ổn định theo thứ tự gốc trong cùng hạng). q rỗng ⇒ `limit` mục đầu, không tô đậm. */
export function filterSuggestions<T extends SuggestItem>(items: readonly T[], q: string, limit = 8): Suggested<T>[] {
  const needle = norm(q);
  if (!needle) return items.slice(0, limit).map((item) => ({ item, rank: 0, ranges: [] }));
  const out: Array<Suggested<T> & { i: number }> = [];
  items.forEach((item, i) => {
    const m = matchLabel(item.label, q);
    if (m) return void out.push({ item, rank: m.rank, ranges: m.ranges, i });
    const extra = foldVi(`${item.sublabel ?? ""} ${item.keywords ?? ""}`);
    if (extra.includes(needle)) out.push({ item, rank: 3, ranges: [], i });
  });
  out.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return out.slice(0, limit).map(({ item, rank, ranges }) => ({ item, rank, ranges }));
}

/** Tách chuỗi thành các đoạn [chữ, có tô đậm] theo `ranges` (đã sắp, không chồng). */
export function splitByRanges(text: string, ranges: readonly Range[]): Array<[string, boolean]> {
  const out: Array<[string, boolean]> = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push([text.slice(pos, a), false]);
    if (b > a) out.push([text.slice(a, b), true]);
    pos = Math.max(pos, b);
  }
  if (pos < text.length) out.push([text.slice(pos), false]);
  return out;
}

/** Phần còn lại để gợi ý hoàn thành (chữ mờ): chỉ khi nhãn bắt đầu đúng bằng chữ đã gõ (không phân biệt hoa/thường, có dấu). */
export function completionTail(label: string, typed: string): string {
  if (!typed || label.length <= typed.length) return "";
  return label.toLowerCase().startsWith(typed.toLowerCase()) ? label.slice(typed.length) : "";
}
