import { z } from "zod";
import { api } from "@/server/http";
import { repairsBySerial } from "@/server/repairs";

// Lịch sử sửa chữa theo serial / mã chiếc — hợp nhất máy khách và máy của shop (BR-REP-13)
export const GET = api({ perm: "repair.view", query: z.object({ serial: z.string().trim().min(2).max(60) }) }, async ({ query, db }) => {
  return { items: await db((tx) => repairsBySerial(tx, query.serial)) };
});
