"use client";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { StatsView } from "@/components/collab/StatsView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CtvStatsPage() {
  return (
    <>
      <PageHeader title="Thống kê của tôi" description="Số chiếc, bán ra, phải nộp, phần tôi hưởng" />
      <RequirePerm perm="collab.view_own">
        <StatsView endpoint="/api/v1/collab/me/stats" />
      </RequirePerm>
    </>
  );
}
