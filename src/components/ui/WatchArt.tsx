// Ảnh đồng hồ vẽ bằng SVG — dùng khi chiếc CHƯA có ảnh thật (thẻ sản phẩm, danh sách, chi tiết, POS).
// Port từ mẫu khách đã duyệt (design/ui-preview/assets/shared.js · WF.watch), viết lại bằng JSX (không chèn HTML thô nên nhãn hãng/loại do người dùng nhập vẫn an toàn).
// Kiểu dáng suy ra TỪ DỮ LIỆU thật (màu mặt, chất liệu vỏ, loại dây) nếu có; thiếu thì chọn ổn định theo `seed` (cùng chiếc luôn ra cùng hình).
import { useId, type ReactNode } from "react";

export type WatchMetal = "steel" | "gold" | "rose" | "black";
export type WatchShape = "round" | "cushion" | "rect";
export type WatchStrap = "leather-brown" | "leather-black" | "rubber-black" | "nato-green" | "bracelet";
export type WatchIndex = "baton" | "dots" | "roman" | "arabic";
export type WatchArtAttrs = { metal: WatchMetal; shape: WatchShape; dial: string; strap: WatchStrap; idx: WatchIndex; date: boolean; bezel?: string; digital?: boolean };

export type WatchArtInput = {
  /** Chuỗi để băm ra kiểu dáng ổn định (mã nội bộ, id…) */
  seed: string;
  brand?: string | null;
  model?: string | null;
  /** Mô tả bằng chữ lấy từ danh mục (vd. "Xanh navy", "Thép không gỉ", "Dây da") — nhận cả tiếng Việt/Anh, có hoặc không dấu */
  dialColor?: string | null;
  caseMaterial?: string | null;
  strapType?: string | null;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pick = <T,>(h: number, arr: readonly T[], salt: number): T => arr[Math.floor(((h >>> salt) & 0xffff) / 65536 * arr.length) % arr.length]!;
const fold = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");

const DIALS = ["#f3eedd", "#1f3a68", "#1b1b1f", "#2f5d4a", "#e9edf2", "#7b2d3a", "#d8c28b", "#334155"] as const;
const DIAL_WORDS: Array<[RegExp, string]> = [
  [/xanh la|\bgreen\b|olive/, "#2f5d4a"], [/xanh|\bblue\b|navy|duong/, "#1f3a68"], [/\bden\b|\bblack\b/, "#1b1b1f"], [/trang|\bwhite\b|\bsilver\b|\bbac\b|\bghi\b/, "#e9edf2"],
  [/\bdo\b|\bred\b|burgundy|ruou/, "#7b2d3a"], [/vang|\bgold\b|champagne|sampanh/, "#d8c28b"], [/\bnau\b|\bbrown\b|chocolate/, "#6b4a2f"], [/\bxam\b|\bgrey\b|\bgray\b|anthracite/, "#4b5563"], [/\bkem\b|cream|ivory|\bbe\b/, "#f3eedd"],
];

/** Chuỗi băm dùng chung để MỌI nơi (thẻ, danh sách, giỏ POS, chi tiết) vẽ cùng một kiểu dáng cho cùng một loại đồng hồ */
export const artSeed = (brand: string | null | undefined, model: string | null | undefined) => `${brand ?? ""}|${model ?? ""}`;

/** Kiểu dáng ổn định cho một chiếc: ưu tiên chữ mô tả có trong danh mục, còn lại băm theo `seed` */
export function artFor(i: WatchArtInput): WatchArtAttrs {
  const h = hash(i.seed || `${i.brand}|${i.model}`);
  const text = fold(`${i.brand ?? ""} ${i.model ?? ""}`);
  const digital = /g-?shock|baby-?g/.test(text) || /\b(ga|dw|gw|gm|gx)-?\d/i.test(`${i.model ?? ""}`);
  const dialTxt = fold(i.dialColor);
  const caseTxt = fold(i.caseMaterial);
  const strapTxt = fold(i.strapType);

  const metal: WatchMetal = digital
    ? "black"
    : /\brose\b|\bhong\b/.test(caseTxt) ? "rose"
    : /vang|\bgold\b/.test(caseTxt) ? "gold"
    : /pvd|\bden\b|\bblack\b|nhua|resin|carbon/.test(caseTxt) ? "black"
    : /thep|steel|stainless|titan|\bbac\b/.test(caseTxt) ? "steel"
    : pick(h, ["steel", "steel", "steel", "gold", "rose", "black"] as const, 3);

  let dial = digital ? "#aebf93" : "";
  if (!dial && dialTxt) for (const [re, hex] of DIAL_WORDS) if (re.test(dialTxt)) { dial = hex; break; }
  if (!dial) dial = pick(h, DIALS, 7);

  const strap: WatchStrap = digital
    ? "rubber-black"
    : /kim loai|bracelet|metal|day thep|thep/.test(strapTxt) ? "bracelet"
    : /cao su|rubber|silicone|resin|nhua/.test(strapTxt) ? "rubber-black"
    : /nato|vai|canvas|nylon/.test(strapTxt) ? "nato-green"
    : /\bda\b|leather/.test(strapTxt) ? pick(h, ["leather-brown", "leather-black"] as const, 11)
    : metal === "gold" || metal === "rose" ? pick(h, ["bracelet", "leather-brown", "leather-black"] as const, 11)
    : pick(h, ["leather-brown", "leather-black", "bracelet", "bracelet", "rubber-black", "nato-green"] as const, 11);

  const shape: WatchShape = digital ? "cushion" : pick(h, ["round", "round", "round", "round", "cushion", "rect"] as const, 5);
  const idx: WatchIndex = pick(h, ["baton", "baton", "dots", "roman", "arabic"] as const, 9);
  const date = ((h >>> 13) & 3) !== 0;
  const bezel = !digital && shape === "round" && /dive|diver|seamaster|submariner|prospex|\bsrp[cdfk]|sub\b/.test(text) ? "#1d2b4a" : undefined;
  return { metal, shape, dial, strap, idx, date, bezel, digital };
}

// ---------------------------------------------------------------- màu
function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, p: number): string {
  const x = rgb(a), y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i]! - v) * p).toString(16).padStart(2, "0")).join("");
}
const lum = (hex: string) => { const c = rgb(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
const pol = (cx: number, cy: number, len: number, deg: number): [number, number] => { const r = (deg * Math.PI) / 180; return [+(cx + len * Math.sin(r)).toFixed(1), +(cy - len * Math.cos(r)).toFixed(1)]; };

const METAL: Record<WatchMetal, [string, string, string]> = { steel: ["#f7f9fb", "#b4bcc6", "#6f7984"], gold: ["#fff3c4", "#d8b25a", "#86601f"], rose: ["#fbe3d4", "#d9a387", "#8f563d"], black: ["#7d8591", "#363c46", "#14171c"] };
const STRAP: Record<Exclude<WatchStrap, "bracelet">, [string, string]> = { "leather-brown": ["#9a6a3f", "#5a3419"], "leather-black": ["#38383d", "#131316"], "rubber-black": ["#2e2f35", "#0e0f12"], "nato-green": ["#5d7340", "#3b4b28"] };

type Props = WatchArtInput & {
  /** "head" = chỉ mặt đồng hồ (ảnh nhỏ/thumbnail); mặc định cả dây */
  crop?: "head" | "full";
  className?: string;
};

export function WatchArt({ crop = "full", className, ...input }: Props) {
  const uid = useId().replace(/:/g, "");
  const a = artFor(input);
  const label = (input.brand ?? "").trim() || "";
  const M = METAL[a.metal];
  const dial2 = mix(a.dial, "#000000", 0.38);
  const light = lum(a.dial) > 0.55;
  const ink = light ? "#23272e" : a.metal === "gold" ? "#f3dca0" : "#f2eee3";
  const sw = a.shape === "round" ? 50 : a.shape === "cushion" ? 48 : 40;
  const SC: [string, string] = a.strap === "bracelet" ? [M[0], M[2]] : STRAP[a.strap];
  const tl = 100 - sw * 0.42, tr = 100 + sw * 0.42, bl = 100 - sw / 2, br = 100 + sw / 2;
  const g = (s: string) => `${uid}${s}`;
  const ref = (s: string) => `url(#${g(s)})`;
  const name = `${input.brand ?? ""} ${input.model ?? ""}`.trim() || "Đồng hồ";

  const strapDetail: ReactNode[] = [];
  const rows = (from: number, to: number, step: number, fn: (y: number) => ReactNode) => { for (let y = from; y < to; y += step) strapDetail.push(fn(y)); };
  if (a.strap === "bracelet") {
    rows(14, 84, 11, (y) => { const hw = sw * 0.42 + sw * 0.08 * ((y - 4) / 86); return <path key={`bt${y}`} d={`M${100 - hw} ${y} H${100 + hw}`} stroke={M[2]} strokeWidth={0.9} opacity={0.55} />; });
    rows(178, 250, 11, (y) => { const hw = sw * 0.5 - sw * 0.08 * ((y - 170) / 86); return <path key={`bb${y}`} d={`M${100 - hw} ${y} H${100 + hw}`} stroke={M[2]} strokeWidth={0.9} opacity={0.55} />; });
    strapDetail.push(<path key="bl" d={`M${100 - sw * 0.16} 8 V86M${100 + sw * 0.16} 8 V86M${100 - sw * 0.16} 174 V252M${100 + sw * 0.16} 174 V252`} stroke={M[2]} strokeWidth={0.7} opacity={0.4} />);
  } else if (a.strap.startsWith("leather")) {
    const stitch = a.strap === "leather-brown" ? "#e4c39a" : "#9a9aa2";
    strapDetail.push(<path key="st" d={`M${100 - sw * 0.36} 10 L${100 - sw * 0.43} 84M${100 + sw * 0.36} 10 L${100 + sw * 0.43} 84M${100 - sw * 0.43} 176 L${100 - sw * 0.36} 250M${100 + sw * 0.43} 176 L${100 + sw * 0.36} 250`} stroke={stitch} strokeWidth={1} strokeDasharray="3 3" opacity={0.75} />);
  } else if (a.strap === "rubber-black") {
    rows(16, 84, 8, (y) => { const hw = sw * 0.42 + sw * 0.08 * ((y - 4) / 86); return <path key={`rt${y}`} d={`M${100 - hw + 3} ${y} H${100 + hw - 3}`} stroke="#000" strokeWidth={1.4} opacity={0.35} />; });
    rows(180, 252, 8, (y) => { const hw = sw * 0.5 - sw * 0.08 * ((y - 170) / 86); return <path key={`rb${y}`} d={`M${100 - hw + 3} ${y} H${100 + hw - 3}`} stroke="#000" strokeWidth={1.4} opacity={0.35} />; });
  } else {
    strapDetail.push(<path key="nc" d="M100 6V88M100 172V254" stroke="#25301a" strokeWidth={3} opacity={0.3} />);
    strapDetail.push(<path key="nl" d={`M${100 - sw * 0.3} 6V88M${100 + sw * 0.3} 6V88M${100 - sw * 0.3} 172V254M${100 + sw * 0.3} 172V254`} stroke="#d9e3c4" strokeWidth={1} opacity={0.5} />);
  }

  // Vỏ + mặt
  let body: ReactNode;
  if (a.shape === "round") {
    body = (
      <>
        <rect x={161} y={123} width={10} height={14} rx={3} fill={ref("m")} stroke={M[2]} strokeWidth={0.6} />
        <circle cx={100} cy={130} r={64} fill={ref("m")} stroke={M[2]} strokeWidth={0.8} />
        <circle cx={100} cy={130} r={58} fill={a.bezel ?? ref("r")} />
        {a.bezel && Array.from({ length: 12 }, (_, i) => { const p = pol(100, 130, 55.5, i * 30); return <circle key={i} cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 1.6 : 1} fill="#f2eee3" opacity={0.85} />; })}
        <circle cx={100} cy={130} r={52} fill="#000" opacity={0.28} />
        <circle cx={100} cy={130} r={50.5} fill={ref("d")} />
      </>
    );
  } else if (a.shape === "cushion") {
    body = (
      <>
        <rect x={162} y={123} width={10} height={14} rx={3} fill={ref("m")} stroke={M[2]} strokeWidth={0.6} />
        <rect x={36} y={66} width={128} height={128} rx={38} fill={ref("m")} stroke={M[2]} strokeWidth={0.8} />
        <rect x={43} y={73} width={114} height={114} rx={32} fill={a.bezel ?? ref("r")} />
        <rect x={49} y={79} width={102} height={102} rx={27} fill="#000" opacity={0.28} />
        <rect x={50.5} y={80.5} width={99} height={99} rx={26} fill={ref("d")} />
      </>
    );
  } else {
    body = (
      <>
        <rect x={143} y={124} width={8} height={14} rx={2.5} fill={ref("m")} stroke={M[2]} strokeWidth={0.6} />
        <rect x={56} y={72} width={88} height={116} rx={13} fill={ref("m")} stroke={M[2]} strokeWidth={0.8} />
        <rect x={62} y={78} width={76} height={104} rx={9} fill={ref("r")} />
        <rect x={67} y={83} width={66} height={94} rx={6} fill="#000" opacity={0.28} />
        <rect x={68.5} y={84.5} width={63} height={91} rx={5} fill={ref("d")} />
      </>
    );
  }

  // Chỉ số + kim
  let face: ReactNode;
  const up = (label || "").toUpperCase();
  if (a.digital) {
    face = (
      <>
        <text x={100} y={104} textAnchor="middle" fontSize={7} fontWeight={700} letterSpacing={1.4} fill="#2c3324" fontFamily="Arial,sans-serif">{up || "CASIO"}</text>
        <text x={100} y={118} textAnchor="middle" fontSize={8} fill="#2c3324" fontFamily="Consolas,Menlo,monospace" opacity={0.8}>FRI 16</text>
        <text x={100} y={140} textAnchor="middle" fontSize={25} fontWeight={700} fill="#2c3324" fontFamily="Consolas,Menlo,monospace">10:08</text>
        <path d="M78 152h44" stroke="#2c3324" strokeWidth={1} opacity={0.4} />
        <text x={100} y={164} textAnchor="middle" fontSize={6} fill="#2c3324" opacity={0.75} fontFamily="Arial">ALARM  CHRONO</text>
      </>
    );
  } else if (a.shape === "rect") {
    const hp = pol(100, 130, 15, 304), mp = pol(100, 130, 26, 48);
    face = (
      <>
        {([["XII", 100, 100], ["VI", 100, 168], ["III", 124, 134], ["IX", 76, 134]] as const).map(([t, x, y]) => (
          <text key={t} x={x} y={y} textAnchor="middle" fontSize={9} fontFamily="Georgia,serif" fill={ink}>{t}</text>
        ))}
        <text x={100} y={120} textAnchor="middle" fontSize={5.5} fontWeight={700} letterSpacing={1} fill={ink} opacity={0.8} fontFamily="Arial">{up}</text>
        <path d={`M100 130L${hp[0]} ${hp[1]}`} stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
        <path d={`M100 130L${mp[0]} ${mp[1]}`} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
        <circle cx={100} cy={130} r={2.6} fill={ink} />
      </>
    );
  } else {
    const R = a.shape === "round" ? 42 : 43;
    const hp = pol(100, 130, 24, 304), mp = pol(100, 130, 37, 48), s2 = pol(100, 130, 41, 168), s3 = pol(100, 130, -9, 168);
    const ticks: ReactNode[] = [];
    for (let i = 0; i < 12; i++) {
      const ang = i * 30;
      if (a.date && i === 3) continue;
      if (a.idx === "baton") ticks.push(<rect key={i} x={-1.7} y={-R - 4} width={3.4} height={i % 3 === 0 ? 10 : 8} rx={0.7} fill={ink} transform={`translate(100 130) rotate(${ang})`} />);
      else if (a.idx === "dots") { const p = pol(100, 130, R, ang); ticks.push(<circle key={i} cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 3.1 : 1.9} fill={ink} />); }
      else if (i % 3 === 0) {
        const p = pol(100, 130, R - 8, ang);
        ticks.push(<text key={i} x={p[0]} y={p[1] + 3.6} textAnchor="middle" fontSize={a.idx === "roman" ? 9 : 12} fontFamily="Georgia,serif" fill={ink}>{a.idx === "roman" ? ["XII", "III", "VI", "IX"][i / 3] : [12, 3, 6, 9][i / 3]}</text>);
      } else ticks.push(<rect key={i} x={-0.8} y={-R - 4} width={1.6} height={5} fill={ink} transform={`translate(100 130) rotate(${ang})`} />);
    }
    face = (
      <>
        {ticks}
        <text x={100} y={a.idx === "roman" || a.idx === "arabic" ? 113 : 108} textAnchor="middle" fontSize={6} fontWeight={700} letterSpacing={1.3} fill={ink} opacity={0.82} fontFamily="Arial,sans-serif">{up}</text>
        {a.date && (
          <>
            <rect x={125} y={125} width={15} height={10} rx={1.4} fill="#fbfbf8" stroke={M[2]} strokeWidth={0.6} />
            <text x={132.5} y={133} textAnchor="middle" fontSize={8} fontWeight={700} fill="#222" fontFamily="Arial">16</text>
          </>
        )}
        <path d={`M100 130L${hp[0]} ${hp[1]}`} stroke={ink} strokeWidth={4.2} strokeLinecap="round" />
        <path d={`M100 130L${mp[0]} ${mp[1]}`} stroke={ink} strokeWidth={2.8} strokeLinecap="round" />
        <path d={`M${s3[0]} ${s3[1]}L${s2[0]} ${s2[1]}`} stroke="#e2452f" strokeWidth={1.1} strokeLinecap="round" />
        <circle cx={100} cy={130} r={3.4} fill={ink} />
        <circle cx={100} cy={130} r={1.4} fill="#e2452f" />
      </>
    );
  }

  return (
    <svg className={className ? `wf-watchart ${className}` : "wf-watchart"} viewBox={crop === "head" ? "28 58 144 144" : "0 0 200 260"} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name}>
      <defs>
        <linearGradient id={g("m")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={M[0]} /><stop offset=".5" stopColor={M[1]} /><stop offset="1" stopColor={M[2]} /></linearGradient>
        <linearGradient id={g("r")} x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor={M[0]} /><stop offset=".55" stopColor={M[1]} /><stop offset="1" stopColor={M[2]} /></linearGradient>
        <radialGradient id={g("d")} cx=".4" cy=".32" r=".9"><stop offset="0" stopColor={a.dial} /><stop offset="1" stopColor={dial2} /></radialGradient>
        <linearGradient id={g("s")} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={SC[1]} /><stop offset=".35" stopColor={SC[0]} /><stop offset=".65" stopColor={SC[0]} /><stop offset="1" stopColor={SC[1]} /></linearGradient>
      </defs>
      <path d={`M${tl} 4 L${tr} 4 L${br} 90 L${bl} 90Z`} fill={ref("s")} stroke={SC[1]} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M${bl} 170 L${br} 170 L${tr} 256 L${tl} 256Z`} fill={ref("s")} stroke={SC[1]} strokeWidth={0.8} strokeLinejoin="round" />
      {strapDetail}
      {body}
      {face}
      <ellipse cx={86} cy={106} rx={32} ry={16} transform="rotate(-35 86 106)" fill="#fff" opacity={0.09} />
    </svg>
  );
}
