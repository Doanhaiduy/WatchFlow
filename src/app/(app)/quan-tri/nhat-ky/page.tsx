"use client";
import { useEffect, useState } from "react";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { ActivityPanel } from "@/components/admin/ActivityPanel";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

type Muc = "du-lieu" | "truy-cap";

// Nhật ký (CF-18): MỘT trang gộp — "Thay đổi dữ liệu" (ai sửa gì) và "Truy cập & đăng nhập" (ai làm gì, đăng nhập). Không sửa được.
export default function AuditPage() {
  const [muc, setMuc] = useState<Muc>("du-lieu");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("muc") === "truy-cap") setMuc("truy-cap");
  }, []);
  return (
    <>
      <PageHeader title="Nhật ký" description="Ai đã làm gì, khi nào — không sửa được" />
      <RequirePerm perm="audit.view">
        <AdminTabs />
        <div style={{ marginBottom: 12 }}>
          <SegmentedControl<Muc> ariaLabel="Loại nhật ký" value={muc} onChange={setMuc} options={[{ value: "du-lieu", label: "Thay đổi dữ liệu" }, { value: "truy-cap", label: "Truy cập & đăng nhập" }]} />
        </div>
        {muc === "du-lieu" ? <AuditPanel /> : <ActivityPanel />}
      </RequirePerm>
    </>
  );
}
