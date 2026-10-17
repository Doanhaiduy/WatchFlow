import { api } from "@/server/http";
import { MoveBody } from "@/lib/types/catalog";

export const POST = api({ perm: "location.manage", body: MoveBody, idempotent: "optional" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_move_unit", [params.id, body.locationId, body.note ?? null]));
});
