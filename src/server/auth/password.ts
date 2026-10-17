import "server-only";
// Mật khẩu Argon2id (@node-rs/argon2) — BR-SEC-04.
import { hash, verify } from "@node-rs/argon2";

const OPTS = { algorithm: 2 /* Argon2id */ as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummyHash: Promise<string> | null = null;

export function hashPassword(pw: string) {
  return hash(pw, OPTS);
}

/** So mật khẩu; không có hash (email không tồn tại) vẫn tốn thời gian tương đương để chống dò tài khoản. */
export async function verifyPassword(hashStr: string | null, pw: string): Promise<boolean> {
  try {
    if (!hashStr) {
      dummyHash ??= hash("wf-dummy-password", OPTS);
      await verify(await dummyHash, pw);
      return false;
    }
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

const COMMON = new Set([
  "1234567890", "12345678910", "0123456789", "password123", "matkhau123", "qwertyuiop", "1111111111", "abc1234567",
  "iloveyou12", "admin12345", "123456789a", "a123456789", "1q2w3e4r5t", "khongcomatkhau", "watchflow1", "dongho12345",
  "password1234", "matkhau1234", "12345678900", "qwerty12345",
]);

/** Trả câu lỗi tiếng Việt hoặc null nếu đạt */
export function passwordProblem(pw: string, minLength: number, email?: string): string | null {
  if (pw.length < minLength) return `Mật khẩu phải có ít nhất ${minLength} ký tự.`;
  if (pw.length > 200) return "Mật khẩu quá dài.";
  if (COMMON.has(pw.toLowerCase())) return "Mật khẩu quá phổ biến, hãy chọn mật khẩu khác.";
  if (/^(.)\1+$/.test(pw)) return "Mật khẩu không được chỉ lặp một ký tự.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return "Mật khẩu không được chứa tên đăng nhập.";
  return null;
}
