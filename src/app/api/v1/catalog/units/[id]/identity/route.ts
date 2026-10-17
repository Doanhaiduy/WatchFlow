import { api } from "@/server/http";
import { IdentityBody } from "@/lib/types/catalog";

// Sửa loại/serial (BR-UNIT-06) — chiếc đã bán cần lý do
export const POST = api({ perm: "catalog.manage", body: IdentityBody }, async ({ params, body, db }) => {
  return db((tx) =>
    tx.fn("app.fn_update_unit_identity", [params.id, body.modelId, body.serialNo ?? null, body.hasSerial, body.reason ?? null, body.version ?? null]),
  );
});
