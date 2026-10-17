import { api } from "@/server/http";
import { OpenWarrantyRepairBody } from "@/lib/types/repairs";

// Nhận máy bảo hành ⇒ phiếu sửa warranty_free (BR-WAR-02); hết hạn ⇒ WF-WAR-EXPIRED (nhận máy tính phí ở /repairs)
export const POST = api({ perm: "repair.create", body: OpenWarrantyRepairBody, idempotent: "required" }, async ({ params, body, db }) => {
  return db((tx) =>
    tx.fn("app.fn_create_repair", [JSON.stringify({ kind: "customer", chargeMode: "warranty_free", warrantyId: params.id, complaint: body.complaint, intakeCondition: body.intakeCondition ?? null })]),
  );
});
