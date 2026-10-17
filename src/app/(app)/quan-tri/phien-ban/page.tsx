"use client";
import { RequirePerm } from "@/components/auth/RequirePerm";
import { AdminTabs } from "@/components/layout/AdminTabs";
import { navItem } from "@/components/layout/nav";
import { Timeline } from "@/components/ui/Display";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { CHANGELOG } from "@/content/changelog";

export default function VersionPage() {
  const cur = CHANGELOG[0];
  return (
    <>
      <PageHeader title="Phiên bản" description={cur ? `Đang chạy ${cur.version}` : undefined} />
      <RequirePerm perm={navItem("admin")?.permission}>
        <AdminTabs />
        <div className="wf-stack">
          {CHANGELOG.map((c, i) => (
            <section key={c.version} className="g wf-pad" aria-label={`Phiên bản ${c.version}`}>
              <div className="wf-dev-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>{c.title}</h2>
                <span className="wf-dev-row">
                  {i === 0 && <StatusChip tone="ok">Hiện tại</StatusChip>}
                  <StatusChip tone="info">v{c.version}</StatusChip>
                </span>
              </div>
              <p className="wf-mute" style={{ marginBottom: 10 }}>{c.date}</p>
              <Timeline items={c.items.map((t) => ({ title: <span style={{ fontWeight: 500 }}>{t}</span> }))} />
            </section>
          ))}
        </div>
      </RequirePerm>
    </>
  );
}
