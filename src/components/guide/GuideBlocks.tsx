"use client";
// Bộ dựng khối nội dung hướng dẫn (src/content/guide.ts) thành giao diện Glass: bước có đường nối, ghi chú theo tone, đường dẫn menu, bảng,
// thẻ, sơ đồ luồng, tab phân đoạn (SegmentedControl — Lucian #047 đã port), mục xổ. Không có HTML thô: chữ đi qua Inline/MiniMarkdown.
import {
  AlertTriangle, BarChart3, Bell, BookOpen, ChevronDown, ChevronRight, FileSpreadsheet, Handshake, Info, Lightbulb, LogIn,
  Search, Settings, ShieldAlert, ShieldCheck, ShoppingBag, Smartphone, UserRound, Users, Watch, Wrench, CircleHelp,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useId, useState } from "react";
import type { CalloutTone, GuideBlock, GuideIcon } from "@/content/guide";
import { Inline, MiniMarkdown } from "../ui/MiniMarkdown";
import { SegmentedControl } from "../ui/SegmentedControl";
import { cx } from "../ui/cx";
import { DemoView } from "./GuideDemos";
import "./guide.css";

export const GUIDE_ICONS: Record<GuideIcon, LucideIcon> = {
  start: LogIn, app: Smartphone, shield: ShieldCheck, sale: ShoppingBag,
  watch: Watch, customer: Users, excel: FileSpreadsheet, ctv: Handshake, me: UserRound, repair: Wrench,
  report: BarChart3, admin: Settings, help: CircleHelp, bell: Bell, search: Search, book: BookOpen,
};

const CALLOUT: Record<CalloutTone, { tone: "ok" | "info" | "hold" | "bad"; Icon: LucideIcon; label: string }> = {
  tip: { tone: "ok", Icon: Lightbulb, label: "Mẹo" },
  info: { tone: "info", Icon: Info, label: "Lưu ý" },
  warn: { tone: "hold", Icon: AlertTriangle, label: "Chú ý" },
  danger: { tone: "bad", Icon: ShieldAlert, label: "Quan trọng" },
};

/** "Vào đâu": đường dẫn menu dạng chuỗi viên thuốc */
export function PathCrumbs({ items, label }: { items: string[]; label?: string }) {
  return (
    <div className="wf-gd-path">
      {label && <span className="lb">{label}:</span>}
      {items.map((p, i) => (
        <Fragment key={`${p}${i}`}>
          {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
          <span className={cx("c", i === items.length - 1 && "last")}>{p}</span>
        </Fragment>
      ))}
    </div>
  );
}

function Steps({ title, items }: { title?: string; items: Extract<GuideBlock, { t: "steps" }>["items"] }) {
  return (
    <div className="wf-gd-stepsw">
      {title && <h4 className="wf-gd-h4">{title}</h4>}
      <ol className="wf-gd-steps">
        {items.map((s, i) => (
          <li key={i}>
            <span className="n" aria-hidden="true">{i + 1}</span>
            <b className="t">{s.title}</b>
            {s.path && <PathCrumbs items={s.path} />}
            {s.text && <p className="x"><Inline text={s.text} /></p>}
            {s.demo && <DemoView name={s.demo} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tabs({ tabs }: { tabs: Extract<GuideBlock, { t: "tabs" }>["tabs"] }) {
  const id = useId();
  const [v, setV] = useState("0");
  return (
    <div className="wf-gd-tabs">
      <SegmentedControl mode="tabs" ariaLabel="Chọn nhóm nội dung" options={tabs.map((t, i) => ({ value: String(i), label: t.label }))} value={v} onChange={setV} />
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" id={`${id}-${i}`} hidden={String(i) !== v} className="wf-gd-panel">
          <p className="wf-gd-ptitle">{t.label}</p>
          <Blocks blocks={t.blocks} />
        </div>
      ))}
    </div>
  );
}

function Accordion({ items }: { items: Extract<GuideBlock, { t: "accordion" }>["items"] }) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="wf-gd-acc">
      {items.map((it, n) => {
        const on = open === n;
        return (
          <div key={it.title} className="it g-flat" data-open={on}>
            <button type="button" aria-expanded={on} aria-controls={`${base}-${n}`} onClick={() => setOpen(on ? null : n)}>
              <span className="no" aria-hidden="true">{n + 1}</span>
              <span className="tt">{it.title}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            <div id={`${base}-${n}`} className="bd" hidden={!on}>
              <Blocks blocks={it.blocks} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Flow({ caption, items }: { caption?: string; items: Extract<GuideBlock, { t: "flow" }>["items"] }) {
  return (
    <figure className="wf-gd-flow">
      {caption && <figcaption>{caption}</figcaption>}
      <ol>
        {items.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <li className="ar" aria-hidden="true"><ChevronRight size={16} /></li>}
            <li className="st">
              <span className="wf-chip" data-tone={s.tone ?? "neutral"}>{s.label}</span>
              {s.note && <small>{s.note}</small>}
            </li>
          </Fragment>
        ))}
      </ol>
    </figure>
  );
}

export function Blocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "md":
            return <MiniMarkdown key={i} text={b.text} />;
          case "heading":
            return <h3 key={i} className="wf-gd-h3">{b.text}</h3>;
          case "callout": {
            const c = CALLOUT[b.tone];
            return (
              <div key={i} className="wf-gd-call" data-tone={c.tone} role="note">
                <c.Icon size={18} aria-hidden="true" />
                <div>
                  <b>{b.title ?? c.label}</b>
                  <p><Inline text={b.text} /></p>
                </div>
              </div>
            );
          }
          case "steps":
            return <Steps key={i} title={b.title} items={b.items} />;
          case "path":
            return <div key={i} className="wf-gd-pathw"><PathCrumbs items={b.items} label={b.label} /></div>;
          case "cards":
            return (
              <div key={i} className={cx("wf-gd-cards", b.cols === 3 && "c3")}>
                {b.items.map((c) => {
                  const Icon = GUIDE_ICONS[c.icon];
                  return (
                    <div key={c.title} className="card g-flat">
                      <span className="wf-ib" aria-hidden="true"><Icon size={18} /></span>
                      <b>{c.title}</b>
                      <p><Inline text={c.text} /></p>
                    </div>
                  );
                })}
              </div>
            );
          case "flow":
            return <Flow key={i} caption={b.caption} items={b.items} />;
          case "demo":
            return <DemoView key={i} name={b.name} caption={b.caption} />;
          case "table":
            return (
              <div key={i} className="wf-gd-tbl" role="region" aria-label="Bảng" tabIndex={0}>
                <table>
                  <thead>
                    <tr>{b.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, n) => (
                      <tr key={n}>{r.map((c, j) => <td key={j} data-label={b.head[j]}><Inline text={c} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "tabs":
            return <Tabs key={i} tabs={b.tabs} />;
          case "accordion":
            return <Accordion key={i} items={b.items} />;
        }
      })}
    </>
  );
}
