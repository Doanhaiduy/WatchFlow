import { api } from "@/server/http";
import { offeredUnits } from "@/server/collab";
import { OfferBody, OfferListQuery } from "@/lib/types/collab";

// Chiếc đang giao cho CTV (chủ). Chiếc vẫn ở kho; có thể giao cùng lúc cho nhiều CTV (BR-COL-12).
export const GET = api({ perm: "collab.view", query: OfferListQuery }, async ({ query, db }) => {
  const items = await db((tx) => offeredUnits(tx, { q: query.q, collaboratorId: query.collaboratorId, pendingOnly: query.pendingOnly === "1" }));
  return { items };
});

export const POST = api({ perm: "collab.manage", body: OfferBody, idempotent: "required" }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_offer_units", [body.unitIds, body.collaboratorIds, body.note ?? null]));
});
