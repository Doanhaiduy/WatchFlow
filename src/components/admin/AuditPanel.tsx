"use client";
import { ChevronDown, FileClock, Filter } from "lucide-react";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Pager } from "@/components/ui/Pager";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextInput } from "@/components/ui/TextInput";
import type { Tone } from "@/components/ui/cx";
import { swrFetcher } from "@/lib/api-client";
import { formatDateTimeVn } from "@/lib/dates";

type Row = { id: string; at: string; action: string; entityTable: string; entityId: string | null; reason: string | null; before: unknown; after: unknown; level: string; actorName: string | null };
type Res = { items: Row[]; total: number };
const PAGE = 25;

const LEVEL_TONE: Record<string, Tone> = { info: "info", warn: "hold", warning: "hold", critical: "bad", sensitive: "hold", error: "bad" };

const VERB: Record<string, string> = { recorded: "Ghi", offered: "Giao hàng", offer_withdrawn: "Thu hồi hàng giao", claimed: "Báo bán", claim_confirmed: "Xác nhận báo bán", claim_rejected: "Từ chối báo bán", claim_cancelled: "Rút báo bán", confirmed: "Xác nhận", voided: "Hủy", created: "Tạo", updated: "Cập nhật", deleted: "Xóa", insert: "Tạo mới", update: "Cập nhật", delete: "Xóa", cancelled: "Hủy", completed: "Hoàn thành", delivered: "Giao", reconciled: "Chốt", changed: "Thay đổi", login: "Đăng nhập", logout: "Đăng xuất" };
const SUBJECT: Record<string, string> = { purchase: "phiếu nhập", sale: "đơn bán", payment: "thanh toán", repair: "phiếu sửa", reservation: "giữ hàng", role: "vai trò", user: "người dùng", unit: "chiếc đồng hồ", assignment: "phiếu giao CTV", settlement: "quyết toán CTV", stocktake: "kiểm kê", settings: "cài đặt", collab: "cộng tác viên", auth: "" };
const TABLE: Record<string, string> = {
  purchase_receipts: "Phiếu nhập", purchase_lines: "Dòng nhập", purchase_costs: "Giá vốn nhập", watch_units: "Đồng hồ", users: "Người dùng", warranties: "Bảo hành", payments: "Thanh toán", repair_orders: "Phiếu sửa", repair_lines: "Dòng sửa",
  sales: "Đơn bán", sale_lines: "Dòng bán", collaborator_offers: "Hàng giao CTV", collaborator_claims: "CTV báo bán", customer_watches: "Đồng hồ khách", user_mfa: "Xác thực 2 bước", files: "Tệp", stocktakes: "Kiểm kê", stocktake_lines: "Dòng kiểm kê", collaborator_settlements: "Quyết toán CTV",
  collaborator_assignment_lines: "Dòng giao CTV", collaborator_assignments: "Phiếu giao CTV", customers: "Khách hàng", reservations: "Giữ hàng", roles: "Vai trò", settings: "Cài đặt",
};
/** Nhãn tiếng Việt cho mã hành động (vd. "sale.confirmed" → "Xác nhận phiếu bán"); mã lạ giữ nguyên */
function actionLabel(a: string): string {
  const [subj, verb] = a.includes(".") ? a.split(".", 2) : ["", a];
  const v = VERB[verb ?? ""];
  if (!v) return a;
  const s = SUBJECT[subj ?? ""];
  if (s === undefined && subj) return a;
  return s ? `${v} ${s}` : v;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** Xem trước/sau gọn: chỉ liệt kê trường thay đổi; không có cả hai thì in JSON */
function Diff({ before, after }: { before: unknown; after: unknown }) {
  if (isObj(before) && isObj(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (keys.length === 0) return <p className="wf-mute">Không có trường nào thay đổi.</p>;
    return (
      <pre className="wf-pre" aria-label="Thay đổi">
        {keys.map((k) => `${k}: ${show(before[k])} → ${show(after[k])}`).join("\n")}
      </pre>
    );
  }
  return (
    <>
      {before !== null && before !== undefined && (
        <>
          <p className="wf-dev-cap" style={{ marginTop: 8 }}>Trước</p>
          <pre className="wf-pre">{JSON.stringify(before, null, 2)}</pre>
        </>
      )}
      {after !== null && after !== undefined && (
        <>
          <p className="wf-dev-cap" style={{ marginTop: 8 }}>Sau</p>
          <pre className="wf-pre">{JSON.stringify(after, null, 2)}</pre>
        </>
      )}
    </>
  );
}

function AuditItem({ r }: { r: Row }) {
  const [open, setOpen] = useState(false);
  const has = (r.before !== null && r.before !== undefined) || (r.after !== null && r.after !== undefined);
  return (
    <li className="wf-ir" style={{ display: "block", minHeight: 0 }}>
      <button type="button" className="wf-ir" style={{ padding: 0, minHeight: 48 }} aria-expanded={open} onClick={() => has && setOpen((o) => !o)} disabled={!has}>
        <span className="wf-irm">
          <b>{actionLabel(r.action)}</b>
          <span>
            {formatDateTimeVn(r.at)} · {r.actorName ?? "Hệ thống"}
          </span>
        </span>
        <span className="wf-ire" style={{ maxWidth: "50%" }}>
          <StatusChip tone={LEVEL_TONE[r.level] ?? "neutral"}>{TABLE[r.entityTable] ?? r.entityTable}</StatusChip>
        </span>
        {has && <ChevronDown size={18} className="wf-cv" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />}
      </button>
      {r.reason && <p style={{ fontSize: 13, margin: "2px 0 0" }}>Lý do: {r.reason}</p>}
      {r.entityId && <p className="wf-mute" style={{ fontSize: 11.5, margin: 0 }}><span title={r.entityId}>Mã: {r.entityId.slice(0, 8)}…</span> · {r.action}</p>}
      {open && has && <Diff before={r.before} after={r.after} />}
    </li>
  );
}

export function AuditPanel() {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [entityId, setEntityId] = useState("");
  const [applied, setApplied] = useState({ entity: "", action: "", entityId: "" });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (applied.entity) qs.set("entity", applied.entity);
  if (applied.action) qs.set("action", applied.action);
  if (applied.entityId) qs.set("entityId", applied.entityId);
  const { data, error, isLoading, mutate } = useSWR<Res>(`/api/v1/audit?${qs}`, swrFetcher, { keepPreviousData: true });
  const filtered = !!(applied.entity || applied.action || applied.entityId);
  const [showFilter, setShowFilter] = useState(false);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setApplied({ entity: entity.trim(), action: action.trim(), entityId: entityId.trim() });
  };
  const clear = () => {
    setEntity(""); setAction(""); setEntityId(""); setPage(1);
    setApplied({ entity: "", action: "", entityId: "" });
  };

  return (
    <>
      <div>
        <div className="wf-dev-row" style={{ marginBottom: 10 }}>
          <Button sm icon={<Filter size={16} aria-hidden="true" />} aria-expanded={showFilter || filtered} aria-controls="audit-filter" onClick={() => setShowFilter((s) => !s)}>{filtered ? "Đang lọc" : "Bộ lọc"}</Button>
          {filtered && <Button sm onClick={clear}>Bỏ lọc</Button>}
        </div>
        <form id="audit-filter" className="g wf-pad" onSubmit={apply} style={{ marginBottom: 12, display: showFilter ? undefined : "none" }}>
          <div className="wf-dev-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 0 }}>
            <Field label="Bảng/đối tượng" hint="vd. users, roles, settings"><TextInput value={entity} onChange={(e) => setEntity(e.target.value)} autoCapitalize="none" /></Field>
            <Field label="Hành động bắt đầu bằng" hint="vd. user., role."><TextInput value={action} onChange={(e) => setAction(e.target.value)} autoCapitalize="none" /></Field>
            <Field label="Mã đối tượng"><TextInput value={entityId} onChange={(e) => setEntityId(e.target.value)} autoCapitalize="none" /></Field>
          </div>
          <div className="wf-dev-row">
            <Button type="submit" variant="primary">Lọc</Button>
            {filtered && <Button onClick={clear}>Bỏ lọc</Button>}
          </div>
        </form>
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={filtered ? "search" : "plain"} title={filtered ? "Không có bản ghi khớp bộ lọc" : "Chưa có hoạt động nào"} description={filtered ? "Thử bỏ bớt điều kiện lọc." : undefined} icon={<FileClock size={24} aria-hidden="true" />} />
          </div>
        ) : (
          <>
            <ul className="wf-ig g g-flat" aria-label="Nhật ký" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data?.items.map((r) => <AuditItem key={r.id} r={r} />)}
            </ul>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
