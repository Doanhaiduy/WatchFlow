"use client";
import { BarChart3, FileClock, Handshake } from "lucide-react";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { REPORTS } from "@/components/reports/meta";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSession } from "@/lib/session";

export default function ReportsIndex() {
  const { can } = useSession();
  const list = REPORTS.filter((r) => can(r.perm));
  return (
    <>
      <PageHeader title="Báo cáo" description="Số liệu do máy chủ tính; chọn báo cáo để xem, xuất Excel hoặc in" />
      <RequirePerm perm={["report.sales", "report.inventory", "profit.view", "debt.view", "collab.view", "audit.view", "warranty.view"]}>
        <InsetList label="Danh sách báo cáo">
          {list.map((r) => (
            <InsetRow key={r.code} href={`/bao-cao/${r.code}`} icon={<BarChart3 size={20} aria-hidden="true" />} tone="info" title={`${r.no} · ${r.title}`} subtitle={r.desc} />
          ))}
          {can("collab.view") && <InsetRow href="/cong-tac-vien/thong-ke" icon={<Handshake size={20} aria-hidden="true" />} tone="check" title="R9 · Thống kê cộng tác viên" subtitle="Theo tháng, quý, năm; đã/chưa nộp" />}
          {can("audit.view") && <InsetRow href="/quan-tri/nhat-ky" icon={<FileClock size={20} aria-hidden="true" />} tone="neutral" title="R12 · Nhật ký hoạt động" subtitle="Ai đã làm gì, khi nào" />}
        </InsetList>
      </RequirePerm>
    </>
  );
}
