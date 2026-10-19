import { z } from "zod";

/** Lý do (≥ 10 ký tự) khi hủy/từ chối chứng từ — BR-GEN-05 */
export const VoidBody = z.object({ reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500) });
