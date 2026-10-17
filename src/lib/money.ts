// Tiền = số nguyên VND (BR-GEN-01). Một nơi duy nhất cho làm tròn & phân bổ (costing-and-profit §5).
// Bản SQL tương ứng: app.round_vnd / app.allocate_vnd — test đối chiếu ở tests/api.

export const MAX_VND = Number.MAX_SAFE_INTEGER;

export function assertVnd(x: number, name = "số tiền"): number {
  if (!Number.isSafeInteger(x)) throw new RangeError(`${name} phải là số nguyên VND`);
  return x;
}

/** Làm tròn nửa lên về đồng. Nhận number hoặc chuỗi thập phân (vd. "21142.8572") để tránh sai số float. */
export function roundHalfUp(x: number | string): number {
  const s = typeof x === "number" ? x.toFixed(6) : x.trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new RangeError(`Giá trị không hợp lệ: ${x}`);
  const neg = m[1] === "-";
  let int = BigInt(m[2]!);
  const frac = m[3] ?? "";
  if (frac.length && frac.charCodeAt(0) >= 53 /* '5' */) int += 1n;
  const r = Number(int);
  return neg && r !== 0 ? -r : r;
}

export type AllocateOptions = {
  /** "by_value" (mặc định): theo trọng số; "equal": chia đều, phần dư vẫn cho dòng có trọng số lớn nhất */
  method?: "by_value" | "equal";
};

/**
 * Phân bổ `total` (nguyên ≥ 0) theo `weights` (nguyên ≥ 0). Σ kết quả = total tuyệt đối.
 * base_i = floor(total × w_i / Σw) (hoặc floor(total/n)); phần dư cộng vào dòng có trọng số lớn nhất, hòa ⇒ dòng đầu.
 * Σw = 0 ⇒ chia đều.
 */
export function allocate(total: number, weights: number[], opts: AllocateOptions = {}): number[] {
  assertVnd(total, "tổng");
  if (total < 0) throw new RangeError("tổng phân bổ không được âm");
  const n = weights.length;
  if (n === 0) {
    if (total !== 0) throw new RangeError("không có dòng để phân bổ");
    return [];
  }
  weights.forEach((w) => { assertVnd(w, "trọng số"); if (w < 0) throw new RangeError("trọng số không được âm"); });
  const T = BigInt(total);
  const W = weights.reduce((a, w) => a + BigInt(w), 0n);
  const equal = opts.method === "equal" || W === 0n;
  const base = weights.map((w) => (equal ? T / BigInt(n) : (T * BigInt(w)) / W));
  const rem = T - base.reduce((a, b) => a + b, 0n);
  let maxI = 0;
  for (let i = 1; i < n; i++) if (weights[i]! > weights[maxI]!) maxI = i;
  base[maxI] = base[maxI]! + rem;
  return base.map(Number);
}

const fmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 8200000 → "8.200.000 ₫" */
export function formatVnd(x: number | null | undefined, { symbol = true }: { symbol?: boolean } = {}): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return fmt.format(x).replace(/,/g, ".") + (symbol ? " ₫" : "");
}

/** 8200000 → "8,2 tr" (hiển thị gọn trên thẻ KPI) */
export function formatVndShort(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  if (a >= 1_000_000_000) return sign + (a / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ";
  if (a >= 1_000_000) return sign + (a / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr";
  if (a >= 1_000) return sign + (a / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + "k";
  return sign + String(a);
}

/** "8.200.000", "8 200 000 ₫", "8200000" → 8200000; rỗng ⇒ null; không hợp lệ ⇒ NaN */
export function parseVnd(s: string): number | null {
  const t = s.replace(/[\s.,₫đ]/gi, "");
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : NaN;
}
