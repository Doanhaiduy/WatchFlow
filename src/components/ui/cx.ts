/** Ghép tên lớp, bỏ giá trị rỗng */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "ok" | "bad" | "hold" | "info" | "check" | "repair" | "neutral";
