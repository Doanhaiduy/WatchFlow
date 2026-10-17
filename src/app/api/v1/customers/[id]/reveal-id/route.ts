import { api } from "@/server/http";
import { decryptPii } from "@/server/pii";
import { RevealBody } from "@/lib/types/customers";

// Xem CCCD đầy đủ (BR-SEC-03): customer.pii.view + lý do + xác thực lại 5 phút; DB ghi audit pii.reveal. Không log giá trị.
export const POST = api({ perm: "customer.pii.view", body: RevealBody }, async ({ params, body, db, requireReauth }) => {
  requireReauth();
  const enc = await db((tx) => tx.fn<string | null>("app.fn_reveal_customer_id", [params.id, body.reason]));
  return { idNumber: enc ? decryptPii(enc) : null };
});
