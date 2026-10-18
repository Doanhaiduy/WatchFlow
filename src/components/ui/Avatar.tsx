import { cx, type Tone } from "./cx";

/** Chữ cái đầu của tên gọi (từ cuối của họ tên): "Nguyễn Văn An" → "A" */
export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p.length > 1 ? p[p.length - 1]![0]! : p[0]?.[0]) ?? "?").toUpperCase();
}

const TONES: Tone[] = ["info", "ok", "hold", "repair", "check"];
/** Màu ổn định theo tên: cùng một người luôn cùng màu */
export function avatarTone(name: string): Tone {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length]!;
}

/** Hình tròn chữ cái đầu, nền gradient theo màu của tên (hoặc `tone` chỉ định; `neutral` = xám cho tài khoản ngưng) */
export function Avatar({ name, tone, className }: { name: string; tone?: Tone; className?: string }) {
  const t = tone ?? avatarTone(name);
  return (
    <span className={cx("wf-av", className)} data-tone={t} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
