"use client";
import { useEffect, useState } from "react";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ImportWizard } from "@/components/import/ImportWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import { IMPORT_KINDS, IMPORT_KIND_INFO, type ImportKind } from "@/lib/import/columns";
import { ALL_IMPORT_PERMS } from "@/lib/import/perms";

// Nhập Excel hàng loạt (khách, đồng hồ). ?loai=khach|dong-ho chọn sẵn loại.
export default function ImportPage() {
  const [kind, setKind] = useState<ImportKind | undefined>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("loai");
    setKind(IMPORT_KINDS.find((k) => IMPORT_KIND_INFO[k].slug === q));
    setReady(true);
  }, []);
  return (
    <>
      <PageHeader title="Nhập từ Excel" description="Nhập hàng loạt khách hàng hoặc đồng hồ — xem trước từng dòng rồi mới ghi" />
      <RequirePerm perm={ALL_IMPORT_PERMS}>{ready && <ImportWizard initialKind={kind} />}</RequirePerm>
    </>
  );
}
