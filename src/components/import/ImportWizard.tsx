"use client";
// Nhập Excel hàng loạt: chọn tệp (kéo-thả/bấm) → xem trước từng dòng & chọn dòng → xác nhận → kết quả có liên kết.
// Tệp được đọc ngay trong trình duyệt (máy chủ chỉ nhận JSON các dòng, ≤ 300). Bước ghi dùng Idempotency-Key (bấm đúp không nhập hai lần).
// Thành phần: WizardSteps (Lucian #042), SegmentedControl (#047), Checkbox/Select/Switch/StatusChip Glass. Khu thả tệp tự dựng theo Glass (không có trong Lucian).
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Info, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import useSWR from "swr";
import { errMsg, sapi } from "@/components/auth/helpers";
import { Button } from "@/components/ui/Button";
import { Checkbox, Switch } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { WizardSteps } from "@/components/lucian/WizardSteps";
import { newIdempotencyKey, swrFetcher } from "@/lib/api-client";
import { IMPORT_KINDS, IMPORT_KIND_INFO, IMPORT_MAX_ROWS, type ImportKind, type TableRow } from "@/lib/import/columns";
import { canImport } from "@/lib/import/perms";
import { readImportFile } from "@/lib/import/read-file";
import type { CommitResult, Preview, PreviewRow, RowStatus } from "@/lib/import/types";
import { useSession } from "@/lib/session";
import "./import.css";

const STEPS = ["Chọn tệp", "Xem trước", "Kết quả"];
const STATUS_TONE = { ok: "ok", warning: "hold", error: "bad", duplicate: "info" } as const;
const STATUS_LABEL: Record<RowStatus, string> = { ok: "Hợp lệ", warning: "Cảnh báo", error: "Lỗi", duplicate: "Trùng" };

function Note({ tone = "hold", children }: { tone?: "hold" | "bad" | "info" | "ok"; children: React.ReactNode }) {
  const Icon = tone === "bad" || tone === "hold" ? AlertTriangle : tone === "ok" ? CheckCircle2 : Info;
  return (
    <div className="imp-note" data-tone={tone} role={tone === "bad" ? "alert" : undefined}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function ImportWizard({ initialKind }: { initialKind?: ImportKind }) {
  const { can } = useSession();
  const toast = useToast();
  const kinds = useMemo(() => IMPORT_KINDS.filter((k) => canImport(k, (p) => can(p))), [can]);
  const [kind, setKind] = useState<ImportKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0] ?? "customers");
  const [step, setStep] = useState(0);
  const [reading, setReading] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ name: string; rows: TableRow[]; unknown: string[]; examples: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "attention" | "error">("all");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [createModels, setCreateModels] = useState(false);
  const [locationId, setLocationId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commitKey = useRef(newIdempotencyKey());

  const info = IMPORT_KIND_INFO[kind];
  const locs = useSWR<{ items: { id: string; name: string; isActive: boolean }[] }>(kind === "watches" && step === 0 ? "/api/v1/catalog/locations" : null, swrFetcher);

  const reset = (k: ImportKind = kind) => {
    setKind(k);
    setStep(0);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setPicked(new Set());
    setFilter("all");
    commitKey.current = newIdempotencyKey();
  };

  const optionsBody = kind === "watches" ? { createMissingModels: createModels || undefined, defaultLocationId: locationId || null } : undefined;

  async function runPreview(rows: TableRow[]) {
    const p = await sapi<Preview>(`/api/v1/import/${kind}/preview`, { body: { rows, options: optionsBody } });
    setPreview(p);
    setPicked(new Set(p.rows.filter((r) => r.include).map((r) => r.line)));
    setFilter(p.counts.error + p.counts.duplicate > 0 ? "attention" : "all");
    commitKey.current = newIdempotencyKey();
    setStep(1);
  }

  async function onFile(f: File | undefined) {
    if (!f || reading) return;
    setError("");
    setReading(true);
    try {
      const t = await readImportFile(f, kind);
      if (t.missingColumns.length) throw new Error(`Tệp thiếu cột bắt buộc: ${t.missingColumns.join(", ")}. Hãy dùng tệp mẫu.`);
      if (!t.rows.length) throw new Error(t.skippedExamples ? "Tệp chỉ có dòng ví dụ. Hãy điền dữ liệu thật rồi chọn lại." : "Tệp không có dòng dữ liệu nào.");
      if (t.rows.length > IMPORT_MAX_ROWS) throw new Error(`Tệp có ${t.rows.length} dòng; mỗi lần nhập tối đa ${IMPORT_MAX_ROWS} dòng. Hãy chia tệp thành nhiều phần.`);
      setFile({ name: t.fileName, rows: t.rows, unknown: t.unknownHeaders, examples: t.skippedExamples });
      await runPreview(t.rows);
    } catch (e) {
      setError(e instanceof Error && !("status" in e) ? e.message : errMsg(e));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function commit() {
    if (!file || !preview || committing) return;
    setCommitting(true);
    try {
      const r = await sapi<CommitResult>(`/api/v1/import/${kind}/commit`, {
        body: { rows: file.rows, options: optionsBody, include: [...picked] },
        idempotencyKey: commitKey.current,
      });
      setResult(r);
      setStep(2);
      toast.success(r.items.length ? `Đã nhập ${r.items.length} dòng` : "Không có dòng nào được nhập");
    } catch (e) {
      toast.error("Chưa nhập được", errMsg(e));
    } finally {
      setCommitting(false);
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void onFile(e.dataTransfer.files?.[0]);
  };

  const rows = preview?.rows ?? [];
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "error" ? r.status === "error" : r.status !== "ok"));
  const toggle = (r: PreviewRow, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(r.line); else n.delete(r.line); return n; });
  const nPicked = rows.filter((r) => picked.has(r.line) && r.status !== "error").length;

  if (!kinds.length) {
    return (
      <div className="g wf-pad">
        <EmptyState title="Bạn chưa có quyền nhập loại dữ liệu nào" description="Nhập khách cần quyền tạo khách hàng; nhập đồng hồ/linh kiện cần quyền lập và xác nhận phiếu nhập. Liên hệ chủ cửa hàng." />
      </div>
    );
  }

  return (
    <div>
      {step === 0 && kinds.length > 1 && (
        <div className="imp-kinds">
          <SegmentedControl ariaLabel="Loại dữ liệu cần nhập" value={kind} onChange={(k) => reset(k)} options={kinds.map((k) => ({ value: k, label: IMPORT_KIND_INFO[k].short }))} />
        </div>
      )}
      <div className="imp-steps"><WizardSteps steps={STEPS} current={step} onStep={(i) => i < step && step !== 2 && setStep(i)} label="Các bước nhập Excel" /></div>

      {step === 0 && (
        <>
          <section className="g imp-card" aria-labelledby="imp-h">
            <h2 id="imp-h">Nhập {info.label.toLowerCase()} từ Excel</h2>
            <p>Tải tệp mẫu, điền dữ liệu (tối đa {IMPORT_MAX_ROWS} dòng), rồi chọn tệp .xlsx hoặc .csv. Bạn sẽ xem trước từng dòng trước khi ghi.</p>
            <div style={{ marginTop: 12 }}>
              <a className="wf-btn wf-btn-sm wf-touch" href={`/api/v1/import/${kind}/template`} download><Download size={16} aria-hidden="true" />Tải tệp mẫu (.xlsx)</a>
            </div>
          </section>

          {kind === "watches" && (
            <section className="g imp-card" aria-label="Tùy chọn nhập đồng hồ">
              <Field label="Vị trí kho mặc định (dùng khi ô Vị trí kho để trống)">
                <Select placeholder="Không đặt — bắt buộc ghi ở từng dòng" value={locationId} onChange={(e) => setLocationId(e.target.value)}
                  options={(locs.data?.items ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} />
              </Field>
              {can("catalog.manage") && (
                <div style={{ marginTop: 10 }}>
                  <Switch checked={createModels} onChange={setCreateModels} label="Tự tạo hãng/loại chưa có" description="Dòng có cột Hãng + Loại mà chưa có trong danh mục sẽ được tạo mới khi nhập." />
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <Note tone="info">Hàng <b>Cũ</b> và <b>Đã sửa</b> luôn vào kho ở trạng thái <b>Chờ kiểm tra</b> — cần hạng tình trạng + ảnh mới chuyển sang Sẵn sàng bán. Hàng Mới vào thẳng Sẵn sàng bán. Giá vốn = cột “Giá vốn (giá thu)”.</Note>
              </div>
            </section>
          )}
          {kind === "parts" && (
            <div style={{ marginTop: 12 }}>
              <Note tone="info">Tồn đầu &gt; 0 được ghi bằng một phiếu nhập “Tồn đầu kỳ”. Mã linh kiện đã có sẽ báo trùng; nếu bạn chọn nhập, số lượng được <b>cộng thêm</b> vào tồn hiện có.</Note>
            </div>
          )}
          {kind === "customers" && (
            <div style={{ marginTop: 12 }}>
              <Note tone="info">SĐT trùng với khách có sẵn hoặc trùng trong tệp sẽ được báo — mặc định bỏ qua, bạn chọn lại ở bước xem trước. CCCD (nếu có) được mã hóa khi lưu.</Note>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button type="button" className="imp-drop" data-over={over} aria-busy={reading} disabled={reading}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
              aria-label={`Chọn tệp Excel hoặc CSV để nhập ${info.label.toLowerCase()}`}>
              <span className="imp-drop-ic">{reading ? <span className="wf-spin" aria-hidden="true" /> : <UploadCloud size={26} aria-hidden="true" />}</span>
              <b>{reading ? "Đang đọc và kiểm tra tệp…" : "Chọn tệp hoặc kéo thả vào đây"}</b>
              <small>.xlsx hoặc .csv · tối đa 5 MB · {IMPORT_MAX_ROWS} dòng</small>
            </button>
            <input ref={inputRef} className="imp-file" type="file" tabIndex={-1} aria-hidden="true" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          {error && <div style={{ marginTop: 12 }}><Note tone="bad">{error}</Note></div>}
        </>
      )}

      {step === 1 && preview && file && (
        <>
          <p className="wf-mute" style={{ margin: "0 4px 10px", fontSize: 13 }}>
            <FileSpreadsheet size={14} style={{ verticalAlign: "-2px" }} aria-hidden="true" /> {file.name} · {preview.total} dòng
            {file.examples ? ` · bỏ qua ${file.examples} dòng ví dụ` : ""}
          </p>
          <div className="imp-sum" role="group" aria-label="Tóm tắt kiểm tra">
            {(["ok", "warning", "duplicate", "error"] as const).map((s) => (
              <div key={s} data-s={s}><b>{preview.counts[s]}</b><small>{STATUS_LABEL[s]}</small></div>
            ))}
          </div>
          {file.unknown.length > 0 && <Note tone="hold">Bỏ qua cột không nhận ra: {file.unknown.join(", ")}.</Note>}
          {preview.notices.map((n) => <Note key={n} tone="info">{n}</Note>)}
          {preview.counts.error > 0 && <div style={{ marginTop: 8 }}><Note tone="bad">Dòng lỗi sẽ không được nhập. Sửa trong tệp rồi chọn lại tệp, hoặc nhập các dòng còn lại.</Note></div>}

          <div className="imp-tools">
            <SegmentedControl ariaLabel="Lọc dòng" value={filter} onChange={setFilter} options={[
              { value: "all", label: `Tất cả ${rows.length}` },
              { value: "attention", label: `Cần xem ${rows.filter((r) => r.status !== "ok").length}` },
              { value: "error", label: `Lỗi ${preview.counts.error}` },
            ]} />
            <span style={{ display: "flex", gap: 6 }}>
              <Button sm onClick={() => setPicked(new Set(rows.filter((r) => r.status === "ok" || r.status === "warning").map((r) => r.line)))}>Chọn hợp lệ</Button>
              <Button sm onClick={() => setPicked(new Set())}>Bỏ chọn hết</Button>
            </span>
          </div>

          {shown.length === 0 ? (
            <div className="g wf-pad wf-mute" style={{ textAlign: "center" }}>Không có dòng nào trong bộ lọc này.</div>
          ) : (
            <ul className="g g-flat imp-list" aria-label="Kết quả kiểm tra từng dòng">
              {shown.map((r) => (
                <li key={r.line} className="imp-row" data-status={r.status}>
                  <Checkbox checked={picked.has(r.line) && r.status !== "error"} disabled={r.status === "error"} onChange={(on) => toggle(r, on)}
                    aria-label={`Nhập dòng ${r.line}: ${r.label}`}
                    label={<span className="imp-row-t"><b>{r.label}</b><small>Dòng {r.line}{r.detail ? ` · ${r.detail}` : ""}</small></span>} />
                  <StatusChip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusChip>
                  {r.messages.length > 0 && <ul className="imp-msgs">{r.messages.map((m) => <li key={m}>{m}</li>)}</ul>}
                </li>
              ))}
            </ul>
          )}

          <div className="g imp-bar">
            <span aria-live="polite">Sẽ nhập {nPicked} / {preview.total} dòng</span>
            <span style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => reset()} disabled={committing}>Chọn tệp khác</Button>
              <Button variant="primary" loading={committing} disabled={nPicked === 0} onClick={() => void commit()} guard>Nhập {nPicked} dòng</Button>
            </span>
          </div>
        </>
      )}

      {step === 2 && result && (
        <>
          <section className="g imp-done" aria-live="polite">
            <div className="imp-done-ic"><CheckCircle2 size={32} aria-hidden="true" /></div>
            <h2>{result.items.length ? `Đã nhập ${result.items.length} dòng` : "Không có dòng nào được nhập"}</h2>
            <p>
              {result.skipped ? `Bỏ qua ${result.skipped} dòng` : "Không bỏ qua dòng nào"}
              {result.failed.length ? ` · ${result.failed.length} dòng lỗi khi lưu` : ""}
              {result.receipt ? ` · Phiếu nhập ${result.receipt.code}` : ""}
            </p>
            <div className="imp-done-acts">
              {result.receipt && <Button sm href={result.receipt.href}>Mở phiếu {result.receipt.code}</Button>}
              <Button sm href={kind === "customers" ? "/khach-hang" : kind === "watches" ? "/dong-ho" : "/linh-kien"}>Xem danh sách {info.short.toLowerCase()}</Button>
              <Button sm variant="primary" onClick={() => reset()}>Nhập tệp khác</Button>
            </div>
          </section>
          {result.failed.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {result.failed.map((f) => <Note key={f.line} tone="bad"><b>Dòng {f.line} — {f.label}:</b> {f.message}</Note>)}
            </div>
          )}
          {result.items.length > 0 && (
            <>
              <div className="wf-sec"><h3>Đã nhập</h3></div>
              <InsetList label="Các dòng đã nhập">
                {result.items.slice(0, 100).map((it) => (
                  <InsetRow key={`${it.line}-${it.id}`} href={it.href} title={it.label} subtitle={`Dòng ${it.line}${it.note ? ` · ${it.note}` : ""}`} end={it.code ?? undefined} />
                ))}
              </InsetList>
              {result.items.length > 100 && <p className="wf-mute" style={{ margin: "8px 4px", fontSize: 13 }}>…và {result.items.length - 100} dòng nữa (xem trong danh sách).</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
