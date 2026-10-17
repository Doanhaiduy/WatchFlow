import { z } from "zod";
import { api } from "@/server/http";
import { searchAll } from "@/server/search";

const Q = z.object({ q: z.string().trim().min(2, "Gõ ít nhất 2 ký tự để tìm.").max(60, "Từ khóa tối đa 60 ký tự.") });

// Tìm toàn cục (Ctrl+K): chiếc, khách, phiếu bán/sửa/nhập, giữ hàng, linh kiện. Mỗi nhóm theo quyền + RLS; ≤ 5 dòng/nhóm; không giá vốn.
export const GET = api({ query: Q }, async ({ query, db, can }) => db((tx) => searchAll(tx, query.q, can)));
