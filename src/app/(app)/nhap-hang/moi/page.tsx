"use client";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { PurchaseForm } from "@/components/purchases/PurchaseForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewPurchasePage() {
  return (
    <>
      <PageHeader title="Lập phiếu nhập" description="Nhập đồng hồ, linh kiện vào kho" />
      <RequirePerm perm="purchase.create">
        <PurchaseForm />
      </RequirePerm>
    </>
  );
}
