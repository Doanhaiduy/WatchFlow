import { z } from "zod";
import { api } from "@/server/http";
import { lookupUnit } from "@/server/catalog";

// Quét QR / gõ mã nội bộ / serial → chiếc (FR-UNIT-12)
export const GET = api({ perm: "catalog.view", query: z.object({ code: z.string().trim().min(1).max(200) }) }, async ({ query, db }) => {
  const items = await db((tx) => lookupUnit(tx, query.code));
  return { items };
});
