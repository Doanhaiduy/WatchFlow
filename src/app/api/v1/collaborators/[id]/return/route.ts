import { api } from "@/server/http";
import { ReturnBody } from "@/lib/types/collab";

// Thu hồi chiếc từ CTV về kho (BR-COL-07)
export const POST = api({ perm: "collab.manage", body: ReturnBody, idempotent: "required" }, async ({ body, db }) => {
  return db((tx) => tx.fn("app.fn_return_from_collaborator", [body.unitId, body.locationId, body.reason]));
});
