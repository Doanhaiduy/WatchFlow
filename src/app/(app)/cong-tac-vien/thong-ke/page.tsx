"use client";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { StatsView } from "@/components/collab/StatsView";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CollabStatsPage() {
  return (
    <>
      <PageHeader title="Thống kê CTV" description="Số chiếc, bán ra, phải nộp, phần CTV hưởng, đã/chưa nộp" />
      <RequirePerm perm="collab.view">
        <StatsView endpoint="/api/v1/reports/collaborators" pickCollab />
      </RequirePerm>
    </>
  );
}
