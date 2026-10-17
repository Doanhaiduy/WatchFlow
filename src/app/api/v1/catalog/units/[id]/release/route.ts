import { api } from "@/server/http";
import { ReleaseBody } from "@/lib/types/catalog";

export const POST = api({ perm: "unit.release", body: ReleaseBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) => tx.fn("app.fn_release_unit", [params.id, body.note ?? null]));
});
