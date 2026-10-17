import "server-only";
// Khách hàng: DTO không bao giờ chứa CCCD đầy đủ (PT-12) — chỉ "*** *** 123"; mã hóa/blind index ở tầng ứng dụng (BR-SEC-03).
import type { Tx } from "./db";
import { ApiError } from "./errors";
import { blindIndex, encryptPii, maskId } from "./pii";

export const CUSTOMER_SELECT = `
  SELECT c.id, c.code, c.full_name AS "fullName", c.phone, c.email, c.address, c.group_id AS "groupId", g.name AS "groupName", c.note,
         c.id_number_last3 AS "idLast3", c.is_active AS "isActive", c.anonymized_at AS "anonymizedAt", c.version, c.created_at AS "createdAt",
         c.created_by AS "createdBy", app.user_display_name(c.created_by) AS "createdByName"
  FROM public.customers c LEFT JOIN public.customer_groups g ON g.id = c.group_id`;

export function withMask<T extends { idLast3?: string | null }>(r: T) {
  const { idLast3, ...rest } = r;
  return { ...rest, idMasked: idLast3 ? maskId(idLast3) : null, hasIdNumber: !!idLast3 };
}

export function piiColumns(idNumber: string | null | undefined) {
  if (!idNumber) return { enc: null, bidx: null, last3: null };
  const clean = idNumber.replace(/\s+/g, "").toUpperCase();
  return { enc: encryptPii(clean), bidx: blindIndex(clean), last3: clean.slice(-3) };
}

/** Cảnh báo trùng SĐT — chỉ trong phạm vi người gọi được thấy (không lộ khách của người khác cho CTV) */
export async function phoneDuplicates(tx: Tx, phone: string | null | undefined, exceptId?: string) {
  if (!phone) return [];
  return tx.q<{ id: string; code: string; fullName: string }>(
    `SELECT id, code, full_name AS "fullName" FROM public.customers WHERE phone_norm = app.norm_phone($1) AND anonymized_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2) LIMIT 5`,
    [phone, exceptId ?? null],
  );
}

export function dupError(d: { id: string; code: string; fullName: string }[]) {
  const e = new ApiError(409, "WF-CUS-PHONE-DUPLICATE", `Số điện thoại đã có ở khách ${d.map((x) => `${x.fullName} (${x.code})`).join(", ")}. Chọn khách đó hoặc xác nhận tạo mới.`);
  e.errors = d.map((x) => ({ path: "phone", message: x.id }));
  return e;
}
