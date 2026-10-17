import { api } from "@/server/http";
import { AnonymizeBody } from "@/lib/types/customers";

export const POST = api({ perm: ["customer.manage"], body: AnonymizeBody, idempotent: "required" }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  return db((tx) => tx.fn("app.fn_anonymize_customer", [params.id, body.reason]));
});
