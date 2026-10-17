"use client";
// Bảng lệnh / tìm toàn cục Ctrl+K (FR-NAV-01). Ý tưởng + phím tắt port từ ref-sources/domus-francis (CommandPalette.tsx, lib/store.tsx);
// giao diện dựa Lucian #046 (Command palette · MIT) — xem lucian-046.css và ui-design-system §9.
// Nội dung: (a) hành động nhanh theo QUYỀN, (b) trang theo QUYỀN (nav.ts), (c) tìm máy chủ GET /api/v1/search (chiếc, khách, phiếu…, theo quyền + RLS).
// Mở: Ctrl/⌘+K, "/" (khi không gõ trong ô nhập), nút tìm ở thanh trên / đầu trang điện thoại. Gần đây lưu localStorage: chỉ nhãn + đường dẫn,
// KHÔNG lưu khách/SĐT/tên khách (PII).
import {
  BookOpen, Bookmark, Boxes, Clock, CornerDownLeft, PackagePlus, Search, ShoppingBag, UserRound, Watch, Wrench, X, type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errMsg } from "@/components/auth/helpers";
import { api } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { foldVi } from "@/lib/text";
import type { Tone } from "../ui/cx";
import { useIsClient } from "../ui/Modal";
import { useOverlayBehavior, usePresence } from "../ui/overlay";
import { statusInfo } from "../ui/status";
import { ADMIN_TABS, allowed, detectProfile, menuGroups, navItem, QUICK_ACTIONS, quickActions, type CanFn } from "./nav";
import { PALETTE_EVENT } from "./palette-bus";
import "../lucian/lucian-046.css";

// ---------- Kiểu dữ liệu ----------
type SUnit = { id: string; assetCode: string; serialNo: string | null; title: string; status: string; exact: boolean };
type SCustomer = { id: string; code: string; fullName: string; phoneTail: string | null };
type SDoc = { id: string; code: string; status: string; docDate: string | null; subtitle: string | null };
type SPart = { id: string; code: string; name: string };
type SearchPayload = {
  q: string;
  units?: SUnit[];
  customers?: SCustomer[];
  sales?: SDoc[];
  repairs?: SDoc[];
  purchases?: SDoc[];
  reservations?: SDoc[];
  parts?: SPart[];
  exactUnitId: string | null;
};

type Kind = "page" | "action" | "unit" | "customer" | "sale" | "repair" | "purchase" | "reservation" | "part";
type Entry = {
  id: string;
  group: string;
  kind: Kind;
  label: string;
  sub?: string;
  href: string;
  tone?: Tone;
  tag?: string;
  /** Chuỗi bổ sung để khớp khi gõ không dấu (từ khóa) */
  kw?: string;
  /** Có ghi vào "Gần đây" khi chọn */
  remember?: boolean;
};

const KIND_ICON: Record<Kind, LucideIcon> = {
  page: BookOpen, action: Search, unit: Watch, customer: UserRound, sale: ShoppingBag, repair: Wrench, purchase: PackagePlus, reservation: Bookmark, part: Boxes,
};
const KIND_TONE: Record<Kind, Tone> = {
  page: "neutral", action: "info", unit: "check", customer: "info", sale: "ok", repair: "repair", purchase: "info", reservation: "hold", part: "repair",
};
const TONE_STYLE = (t: Tone): CSSProperties =>
  ({ "--tb": `var(--wf-${t}-t)`, "--tc": t === "ok" || t === "hold" || t === "bad" ? `var(--wf-${t}-text)` : `var(--wf-${t})` }) as CSSProperties;

const GROUP_ORDER = ["Gần đây", "Khớp chính xác", "Hành động nhanh", "Trang", "Đồng hồ", "Khách hàng", "Phiếu bán", "Phiếu sửa", "Phiếu nhập", "Giữ hàng", "Linh kiện"];

// Nhãn + từ khóa riêng cho bảng lệnh (nhãn ngắn gọn theo cách người dùng gọi)
const ACTION_LABEL: Record<string, { label: string; kw: string }> = {
  sell: { label: "Bán nhanh", kw: "pos ban hang thanh toan tinh tien" },
  purchase: { label: "Nhập hàng", kw: "phieu nhap mua may" },
  repair: { label: "Nhận máy sửa", kw: "sua chua bao hanh tiep nhan" },
  reserve: { label: "Giữ hàng / đặt cọc", kw: "giu hang dat coc" },
  "deliver-ctv": { label: "Giao hàng cho CTV", kw: "cong tac vien giao" },
  "add-customer": { label: "Thêm khách", kw: "khach hang moi tao khach" },
  "ctv-pending": { label: "Đơn CTV chờ xác nhận", kw: "duyet don ctv" },
  "quick-unit": { label: "Nhập một chiếc", kw: "nhap nhanh dong ho them chiec" },
  stocktake: { label: "Kiểm kê", kw: "kiem kho" },
  "print-qr": { label: "In tem QR", kw: "tem ma qr" },
  "ctv-new": { label: "Tạo đơn bán", kw: "ban hang ctv" },
  "ctv-find": { label: "Tìm chiếc đang giữ", kw: "hang dang giu" },
};

const RECENT_KEY = "wf-palette-recent-v1";
const RECENT_MAX = 5;
type Recent = { label: string; sub?: string; href: string; kind: Kind };

function loadRecents(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[];
    return Array.isArray(v) ? v.filter((r) => r && typeof r.href === "string" && r.href.startsWith("/") && !r.href.startsWith("//") && r.kind in KIND_ICON).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function saveRecent(r: Recent) {
  try {
    const next = [r, ...loadRecents().filter((x) => x.href !== r.href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* trình duyệt chặn bộ nhớ — bỏ qua */
  }
}

// ---------- Khớp không dấu + tô chữ khớp ----------
function foldWithMap(s: string) {
  let f = "";
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = foldVi(s[i]!);
    for (let k = 0; k < c.length; k++) {
      f += c[k];
      idx.push(i);
    }
  }
  return { f, idx };
}

function Hl({ text, q }: { text: string; q: string }): ReactNode {
  const toks = [...new Set(foldVi(q).split(/\s+/).filter(Boolean))];
  if (!toks.length) return text;
  const { f, idx } = foldWithMap(text);
  // Mỗi từ khóa tô ở lần xuất hiện đầu tiên; gộp các đoạn chồng nhau
  const spans: Array<[number, number]> = [];
  for (const t of toks) {
    const at = f.indexOf(t);
    if (at >= 0) spans.push([idx[at]!, idx[at + t.length - 1]! + 1]);
  }
  if (!spans.length) return text;
  spans.sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]);
    else merged.push([sp[0], sp[1]]);
  }
  const out: ReactNode[] = [];
  let pos = 0;
  merged.forEach(([x, y], i) => {
    if (x > pos) out.push(text.slice(pos, x));
    out.push(<mark key={i}>{text.slice(x, y)}</mark>);
    pos = y;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

function matches(e: { label: string; sub?: string; kw?: string }, q: string): boolean {
  const hay = foldVi(`${e.label} ${e.sub ?? ""} ${e.kw ?? ""}`);
  return foldVi(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

/** Gõ có dạng mã/serial (có chữ số; serial được chuẩn hóa bỏ dấu cách/gạch nên cho phép khoảng trắng) ⇒ Enter nhảy thẳng tới chiếc khớp chính xác nếu có */
const looksLikeCode = (q: string) => q.length >= 3 && q.length <= 40 && /\d/.test(q);

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

// ---------- Thành phần ----------
export function CommandPalette({ can }: { can: CanFn }) {
  const router = useRouter();
  const client = useIsClient();
  const [open, setOpen] = useState(false);
  const { mounted, shown } = usePresence(open, 500);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);
  const uid = useId();

  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [act, setAct] = useState(0);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [retry, setRetry] = useState(0);
  const [res, setRes] = useState<{ status: "idle" | "loading" | "done" | "error"; data?: SearchPayload; error?: string }>({ status: "idle" });

  const openRef = useRef(false);
  openRef.current = open;
  const resRef = useRef(res);
  resRef.current = res;
  const close = useCallback(() => setOpen(false), []);
  useOverlayBehavior(ref, open && mounted && client, close);

  // Mở/đóng: phím tắt + sự kiện từ nút tìm
  useEffect(() => {
    const show = (initial = "") => {
      setQ(initial);
      setDq(initial.trim());
      setAct(0);
      setRecents(loadRecents());
      setRes({ status: "idle" });
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && k === "k") {
        e.preventDefault();
        if (openRef.current) setOpen(false);
        else show();
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && !isTypingTarget(e.target) && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = (e: Event) => show(((e as CustomEvent).detail?.q as string) ?? "");
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  // Đổi trang ⇒ đóng (phòng khi điều hướng từ nơi khác)
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const trimmed = q.trim();
  // Debounce 250ms
  useEffect(() => {
    const t = setTimeout(() => setDq(trimmed), 250);
    return () => clearTimeout(t);
  }, [trimmed]);

  // Tìm máy chủ (≥ 2 ký tự)
  useEffect(() => {
    if (!open) return;
    if (dq.length < 2) {
      setRes({ status: "idle" });
      return;
    }
    if (resRef.current.status === "done" && resRef.current.data?.q === dq) return; // đã tra tức thì bằng Enter
    const ac = new AbortController();
    setRes((p) => ({ status: "loading", data: p.data }));
    api<SearchPayload>(`/api/v1/search?q=${encodeURIComponent(dq)}`, { signal: ac.signal, noRedirect: true })
      .then((data) => setRes({ status: "done", data }))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setRes({ status: "error", error: errMsg(e) });
      });
    return () => ac.abort();
  }, [dq, open, retry]);

  // ----- Mục tĩnh theo quyền -----
  const staticEntries = useMemo(() => {
    const ctvOnly = detectProfile(can) === "ctv";
    // CTV có luồng riêng (Tạo đơn bán…): chỉ hiện đúng các hành động của hồ sơ CTV, không hiện POS/Thêm khách của cửa hàng
    const actions: Entry[] = (ctvOnly ? quickActions(can) : QUICK_ACTIONS.filter((a) => can(a.permission))).map((a) => ({
      id: `a:${a.id}`,
      group: "Hành động nhanh",
      kind: "action",
      label: ACTION_LABEL[a.id]?.label ?? a.label,
      kw: ACTION_LABEL[a.id]?.kw,
      href: a.href,
      tone: a.tone,
      remember: true,
    }));
    const pages: Entry[] = [];
    for (const g of menuGroups(can)) {
      for (const n of g.items) pages.push({ id: `p:${n.id}`, group: "Trang", kind: "page", label: n.label, sub: g.label, href: n.href, tone: n.tone, remember: true });
    }
    const notif = navItem("notifications");
    if (notif && allowed(notif, can)) pages.push({ id: "p:notifications", group: "Trang", kind: "page", label: notif.label, sub: "Tài khoản", href: notif.href, tone: notif.tone, remember: true });
    if (!ctvOnly) {
      for (const t of ADMIN_TABS) {
        if (allowed(t, can)) pages.push({ id: `p:${t.href}`, group: "Trang", kind: "page", label: `Quản trị · ${t.label}`, sub: "Quản trị", href: t.href, tone: "neutral", remember: true });
      }
    }
    return { actions, pages };
  }, [can]);

  const unitHref = useCallback(
    (id: string) => (can("catalog.view") ? `/dong-ho/${id}` : can("sale.create_draft") ? `/ctv/tao-don?unit=${id}` : "/ctv"),
    [can],
  );

  const serverFresh = res.data && res.data.q === trimmed ? res.data : undefined;

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    if (!trimmed) {
      recents.forEach((r, i) => out.push({ id: `r:${i}:${r.href}`, group: "Gần đây", kind: r.kind, label: r.label, sub: r.sub, href: r.href, tone: KIND_TONE[r.kind] }));
      out.push(...staticEntries.actions.slice(0, 6), ...staticEntries.pages);
      return out;
    }
    const d = serverFresh;
    const exact = d?.units?.find((u) => u.exact);
    const unitEntry = (u: SUnit): Entry => ({
      id: `u:${u.id}`,
      group: u.exact ? "Khớp chính xác" : "Đồng hồ",
      kind: "unit",
      label: `${u.assetCode} · ${u.title}`,
      sub: `${u.serialNo ? `Serial ${u.serialNo} · ` : ""}${statusInfo("unit", u.status).label}`,
      href: unitHref(u.id),
      tag: u.exact ? "Enter để mở" : undefined,
      remember: true,
    });
    if (exact) out.push(unitEntry(exact));
    out.push(...staticEntries.actions.filter((e) => matches(e, trimmed)).slice(0, 5));
    out.push(...staticEntries.pages.filter((e) => matches(e, trimmed)).slice(0, 6));
    if (d) {
      d.units?.filter((u) => !u.exact).forEach((u) => out.push(unitEntry(u)));
      d.customers?.forEach((c) =>
        out.push({ id: `c:${c.id}`, group: "Khách hàng", kind: "customer", label: c.fullName, sub: `${c.code}${c.phoneTail ? ` · SĐT …${c.phoneTail}` : ""}`, href: `/khach-hang/${c.id}` }),
      );
      const doc = (list: SDoc[] | undefined, group: string, kind: Kind, kindStatus: "doc" | "repair" | "reservation", base: string, withId: boolean) =>
        list?.forEach((x) =>
          out.push({
            id: `${kind}:${x.id}`,
            group,
            kind,
            label: x.code,
            // Tên khách ở dòng phụ chỉ để nhận diện trên màn hình — KHÔNG đưa vào "Gần đây"
            sub: [statusInfo(kindStatus, x.status).label, x.subtitle, x.docDate ? formatDateVn(x.docDate) : null].filter(Boolean).join(" · "),
            href: withId ? `${base}/${x.id}` : base,
            remember: true,
          }),
        );
      doc(d.sales, "Phiếu bán", "sale", "doc", "/ban-hang", true);
      doc(d.repairs, "Phiếu sửa", "repair", "repair", "/sua-chua", true);
      doc(d.purchases, "Phiếu nhập", "purchase", "doc", "/nhap-hang", true);
      doc(d.reservations, "Giữ hàng", "reservation", "reservation", "/giu-hang", false);
      d.parts?.forEach((p) => out.push({ id: `part:${p.id}`, group: "Linh kiện", kind: "part", label: `${p.code} · ${p.name}`, href: `/linh-kien/${p.id}`, remember: true }));
    }
    return out;
  }, [trimmed, recents, staticEntries, serverFresh, unitHref]);

  // Nhóm theo thứ tự cố định, giữ thứ tự trong nhóm
  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) m.set(e.group, [...(m.get(e.group) ?? []), e]);
    const names = [...m.keys()].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
    return names.map((g) => ({ name: g, items: m.get(g)! }));
  }, [entries]);
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const idxById = useMemo(() => new Map(flat.map((e, i) => [e.id, i])), [flat]);

  useEffect(() => setAct(0), [trimmed, serverFresh]);

  // Thanh sáng trượt theo mục đang chọn + cuộn vào tầm nhìn
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const list = listRef.current;
    const hl = hlRef.current;
    if (!body || !list || !hl) return;
    const o = list.querySelector<HTMLElement>(`[data-i="${act}"]`);
    if (!o) {
      hl.style.opacity = "0";
      return;
    }
    hl.style.opacity = "1";
    const top = list.offsetTop + o.offsetTop;
    hl.style.setProperty("--y", `${top}px`);
    hl.style.setProperty("--h", `${o.offsetHeight}px`);
    if (top + o.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = top + o.offsetHeight - body.clientHeight + 8;
    else if (top < body.scrollTop + 30) body.scrollTop = act === 0 ? 0 : top - 36;
  }, [act, flat, mounted]);

  const go = useCallback(
    (e: Entry) => {
      if (e.remember) saveRecent({ label: e.label, sub: e.kind === "unit" || e.kind === "part" || e.kind === "page" ? e.sub : undefined, href: e.href, kind: e.kind });
      setOpen(false);
      router.push(e.href);
    },
    [router],
  );

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) setAct((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Gõ mã/serial rồi Enter ngay (chưa kịp hết debounce) ⇒ tra tức thì và nhảy thẳng nếu khớp chính xác
      if (looksLikeCode(trimmed) && !serverFresh) {
        try {
          const d = await api<SearchPayload>(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, { noRedirect: true });
          const u = d.units?.find((x) => x.exact);
          if (u) {
            saveRecent({ label: `${u.assetCode} · ${u.title}`, sub: `${u.serialNo ? `Serial ${u.serialNo} · ` : ""}${statusInfo("unit", u.status).label}`, href: unitHref(u.id), kind: "unit" });
            setOpen(false);
            router.push(unitHref(u.id));
            return;
          }
          setRes({ status: "done", data: d });
          setDq(trimmed);
        } catch (err) {
          setRes({ status: "error", error: errMsg(err) });
        }
        return;
      }
      const target = flat[act];
      if (target) go(target);
    } else if (e.key === "Home" && !trimmed) {
      setAct(0);
    }
  };

  if (!client || !mounted) return null;

  const loading = trimmed.length >= 2 && (dq !== trimmed || res.status === "loading");
  const emptyAll = !loading && trimmed.length >= 2 && flat.length === 0 && res.status !== "error";
  const actId = flat[act] ? `${uid}-o${act}` : undefined;
  const live = res.status === "error" ? "Không tìm được." : loading ? "Đang tìm…" : trimmed ? `${flat.length} kết quả` : "";

  return createPortal(
    <div className="wf-layer">
      <div className="wf-scrim" data-open={shown} onClick={close} aria-hidden="true" />
      <div ref={ref} className="ux u046" data-open={shown} role="dialog" aria-modal="true" aria-label="Tìm nhanh" tabIndex={-1}>
        <div className="u046-pal">
          <div className="u046-field" onMouseDown={(e) => e.target !== inputRef.current && e.preventDefault()} onClick={() => inputRef.current?.focus()}>
            <Search aria-hidden="true" />
            <input
              ref={inputRef}
              data-autofocus
              className="u046-in"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${uid}-list`}
              aria-activedescendant={actId}
              aria-autocomplete="list"
              aria-label="Tìm nhanh: trang, hành động, đồng hồ, khách, phiếu"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={60}
              placeholder="Tìm mã, serial, khách, phiếu…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => void onKeyDown(e)}
            />
            <kbd className="u046-kbd">Esc</kbd>
            <button type="button" className="u046-x" onClick={close} aria-label="Đóng tìm nhanh">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="u046-body" ref={bodyRef}>
            <span className="u046-hl" ref={hlRef} aria-hidden="true" />
            <ul className="u046-list" id={`${uid}-list`} role="listbox" aria-label="Kết quả tìm nhanh" ref={listRef}>
              {grouped.map((g) => (
                <Fragment key={g.name}>
                  <li className="u046-g" role="presentation">
                    {g.name}
                  </li>
                  {g.items.map((e) => {
                    const i = idxById.get(e.id)!;
                    const Icon = e.kind === "action" || e.kind === "page" ? iconFor(e) : KIND_ICON[e.kind];
                    return (
                      <li
                        key={e.id}
                        id={`${uid}-o${i}`}
                        data-i={i}
                        role="option"
                        aria-selected={i === act}
                        className="u046-op"
                        style={{ "--i": Math.min(i, 12) } as CSSProperties}
                        onPointerMove={() => i !== act && setAct(i)}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => go(e)}
                      >
                        <span className="u046-ic" style={TONE_STYLE(e.tone ?? KIND_TONE[e.kind])} aria-hidden="true">
                          {g.name === "Gần đây" ? <Clock size={16} /> : <Icon size={16} />}
                        </span>
                        <span className="u046-tx">
                          <span>
                            <Hl text={e.label} q={trimmed} />
                          </span>
                          {e.sub && (
                            <small>
                              <Hl text={e.sub} q={trimmed} />
                            </small>
                          )}
                        </span>
                        {e.tag && <span className="u046-tag">{e.tag}</span>}
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
            {trimmed.length === 1 && (
              <div className="u046-st">
                <span>Gõ thêm ít nhất 1 ký tự để tìm đồng hồ, khách, phiếu trong dữ liệu.</span>
              </div>
            )}
            {loading && (
              <div className="u046-st" role="status">
                <i className="u046-spin" aria-hidden="true" />
                <span>Đang tìm trong dữ liệu…</span>
              </div>
            )}
            {res.status === "error" && trimmed.length >= 2 && (
              <div className="u046-st" role="alert">
                <span>
                  <b>Chưa tìm được.</b> {res.error}
                </span>
                <button type="button" onClick={() => setRetry((n) => n + 1)}>
                  Thử lại
                </button>
              </div>
            )}
            {emptyAll && (
              <div className="u046-empty" role="status">
                <b>Không tìm thấy “{trimmed}”</b>
                Thử mã chiếc, serial, tên khách, số điện thoại hoặc mã phiếu khác.
              </div>
            )}
          </div>
          <div className="u046-foot" aria-hidden="true">
            <span>
              <kbd className="u046-kbd">↑↓</kbd>Chọn
            </span>
            <span>
              <kbd className="u046-kbd">
                <CornerDownLeft size={11} />
              </kbd>
              Mở
            </span>
            <span>
              <kbd className="u046-kbd">Esc</kbd>Đóng
            </span>
          </div>
          <div className="wf-sr" aria-live="polite">
            {live}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function iconFor(e: Entry): LucideIcon {
  if (e.kind === "page") {
    const id = e.id.startsWith("p:") ? e.id.slice(2) : "";
    return navItem(id)?.icon ?? BookOpen;
  }
  const id = e.id.slice(2);
  return QUICK_ACTIONS.find((a) => a.id === id)?.icon ?? Search;
}
