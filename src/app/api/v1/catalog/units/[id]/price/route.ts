import { api } from "@/server/http";
import { PriceBody } from "@/lib/types/catalog";

export const POST = api({ perm: "unit.price.edit", body: PriceBody, idempotent: "optional" }, async ({ params, body, db }) => {
  return db((tx) =>
    tx.fn("app.fn_set_unit_price", [params.id, body.listPrice, body.promoPrice ?? null, body.promoFrom ?? null, body.promoTo ?? null, body.reason ?? null, body.version ?? null]),
  );
});
