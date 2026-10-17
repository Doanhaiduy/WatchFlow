#!/usr/bin/env node
// Kiểm bố cục tự động (pnpm audit:layout) — port từ mẫu Lưu Xá (scripts/e2e/layout-audit.mjs), đổi sang WatchFlow.
// Đăng nhập TỪNG VAI TRÒ, duyệt MỌI route sinh từ thư mục src/app (route động lấy id mẫu qua API), ở nhiều khổ màn hình × sáng/tối, bắt:
//   • tràn ngang (cuộn ngang ngoài ý muốn / phần tử vượt mép phải)
//   • nhãn nút / liên kết bị xuống dòng
//   • chữ bị cắt (overflow ẩn mà chữ dài hơn khung, ellipsis quá hẹp, chữ tràn khung)
//   • phần tử tương tác < 44px (chỉ khổ điện thoại)
//   • ảnh không alt
//   • axe-core mức serious / critical
// Xuất báo cáo markdown + ảnh (chỉ trang có lỗi) vào test-results/layout-audit/.
//
//   node scripts/e2e/layout-audit.mjs [--base http://localhost:3000] [--roles owner,sales,warehouse,collaborator] [--widths 360,390,1366]
//        [--themes light,dark] [--pages /ban-hang,/dong-ho] [--accounts .local/demo-accounts.txt] [--workers 3] [--out test-results/layout-audit]
//        [--no-axe] [--shots] [--no-fail] [--quick]
//   --quick  = chỉ vai trò owner, khổ 390 + 1366, chỉ giao diện sáng (chạy nhanh khi đang sửa giao diện)
// Mật khẩu/khóa TOTP đọc từ .local/demo-accounts.txt (dữ liệu giả của máy dev) hoặc biến môi trường AUDIT_PASSWORD / AUDIT_TOTP / AUDIT_EMAIL_<ROLE>.
// KHÔNG đổi mật khẩu/2FA của tài khoản: chỉ đăng nhập (owner nhập mã TOTP hiện tại, thử lại ở bước 30 giây kế nếu mã vừa bị dùng).
// Thoát 1 nếu có phát hiện (trừ --no-fail), 2 nếu không chạy được.
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { TOTP, Secret } from "otpauth";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const QUICK = flag("--quick");
const BASE = opt("--base", "http://localhost:3000").replace(/\/+$/, "");
const ROLES = opt("--roles", QUICK ? "owner" : "owner,sales,warehouse,collaborator").split(",").filter(Boolean);
const WIDTHS = opt("--widths", QUICK ? "390,1366" : "360,390,1366").split(",").map(Number);
const THEMES = opt("--themes", QUICK ? "light" : "light,dark").split(",").filter(Boolean);
const WORKERS = Math.max(1, Number(opt("--workers", "3")));
const OUT = path.resolve(ROOT, opt("--out", "test-results/layout-audit"));
const NO_AXE = flag("--no-axe");
const ALL_SHOTS = flag("--shots");
// Git Bash (MSYS) đổi "/ban-hang" thành "C:/Program Files/Git/ban-hang" khi truyền qua tham số ⇒ gỡ tiền tố đó
const normPage = (p) => "/" + p.replace(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]?/i, "").replace(/^[\\/]+/, "");
const ONLY = opt("--pages", "").split(",").filter(Boolean).map(normPage);
const MAX_SHOTS = Number(opt("--max-shots", "250"));

// ---------------------------------------------------------------------
// Tài khoản
// ---------------------------------------------------------------------
function loadAccounts() {
  const file = path.resolve(ROOT, opt("--accounts", ".local/demo-accounts.txt"));
  const acc = { password: process.env.AUDIT_PASSWORD ?? "", totp: process.env.AUDIT_TOTP ?? "", emails: {} };
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const pw = /mật khẩu chung:\s*(\S+)/i.exec(line);
      if (pw && !acc.password) acc.password = pw[1];
      const tk = /khóa TOTP[^:]*:\s*([A-Z2-7]{16,})/i.exec(line);
      if (tk && !acc.totp) acc.totp = tk[1];
      const em = /^(owner|sales|warehouse|collaborator)\s+(\S+@\S+)/.exec(line.trim());
      if (em && !acc.emails[em[1]]) acc.emails[em[1]] = em[2];
    }
  }
  for (const r of ROLES) if (process.env[`AUDIT_EMAIL_${r.toUpperCase()}`]) acc.emails[r] = process.env[`AUDIT_EMAIL_${r.toUpperCase()}`];
  return acc;
}
const ACC = loadAccounts();
if (!ACC.password) { console.error("Thiếu mật khẩu: tạo .local/demo-accounts.txt (pnpm setup:local) hoặc đặt AUDIT_PASSWORD."); process.exit(2); }

const totpNow = () => new TOTP({ secret: Secret.fromBase32(ACC.totp), algorithm: "SHA1", digits: 6, period: 30 }).generate();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Đăng nhập bằng API trên một context (cookie dính vào context). Trả storageState. */
async function loginRole(browser, role) {
  const email = ACC.emails[role];
  if (!email) throw new Error(`Không có email cho vai trò ${role}`);
  const ctx = await browser.newContext({ baseURL: BASE });
  const req = ctx.request;
  const headers = { Origin: BASE, "Content-Type": "application/json" };
  const r = await req.post("/api/v1/auth/login", { headers, data: { email, password: ACC.password } });
  if (!r.ok()) throw new Error(`Đăng nhập ${role} lỗi ${r.status()}: ${(await r.text()).slice(0, 200)}`);
  const body = await r.json();
  if (body.mfaPending) {
    if (!ACC.totp) throw new Error(`Vai trò ${role} cần mã 2FA nhưng thiếu khóa TOTP (AUDIT_TOTP).`);
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const csrf = (await ctx.cookies()).find((c) => /wf_csrf$/.test(c.name))?.value ?? "";
      const v = await req.post("/api/v1/auth/mfa/verify", { headers: { ...headers, "X-CSRF-Token": csrf }, data: { code: totpNow() } });
      ok = v.ok();
      if (!ok) await sleep(31_000 - (Date.now() % 30_000)); // mã vừa bị dùng ở phiên khác ⇒ chờ bước 30 giây kế
    }
    if (!ok) throw new Error(`Không qua được bước 2FA của ${role}`);
  }
  const state = await ctx.storageState();
  const me = await req.get("/api/v1/auth/me");
  if (!me.ok()) throw new Error(`Phiên ${role} không hợp lệ sau đăng nhập (${me.status()})`);
  return { state, ctx };
}

// ---------------------------------------------------------------------
// Route sinh từ thư mục src/app (bỏ nhóm (x), api, thư mục bắt đầu bằng _)
// ---------------------------------------------------------------------
function discoverRoutes() {
  const base = path.join(ROOT, "src", "app");
  const out = [];
  const walk = (dir, segs) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (e.name === "api" || e.name.startsWith("_") || e.name.startsWith("@")) continue;
      const nextSegs = /^\(.*\)$/.test(e.name) ? segs : [...segs, e.name];
      const full = path.join(dir, e.name);
      if (fs.existsSync(path.join(full, "page.tsx")) || fs.existsSync(path.join(full, "page.ts"))) out.push("/" + nextSegs.join("/"));
      walk(full, nextSegs);
    }
  };
  if (fs.existsSync(path.join(base, "page.tsx"))) out.push("/");
  walk(base, []);
  return [...new Set(out)].sort();
}

/** Giá trị mẫu cho từng tham số động: [đường dẫn mẫu] → API trả danh sách (lấy phần tử đầu). */
const SAMPLE_SOURCES = {
  "/ban-hang/[id]": "/api/v1/sales?pageSize=1",
  "/cong-tac-vien/[id]": "/api/v1/collaborators?pageSize=1",
  "/dong-ho/[id]": "/api/v1/catalog/units?pageSize=1",
  "/khach-hang/[id]": "/api/v1/customers?pageSize=1",
  "/kiem-ke/[id]": "/api/v1/stocktakes?pageSize=1",
  "/linh-kien/[id]": "/api/v1/parts?pageSize=1",
  "/nhap-hang/[id]": "/api/v1/purchases?pageSize=1",
  "/sua-chua/[id]": "/api/v1/repairs?pageSize=1",
};
const SAMPLE_CONST = { "/bao-cao/[ma]": "revenue" };
const firstId = (j) => {
  const list = Array.isArray(j) ? j : (j?.items ?? j?.data ?? j?.units ?? []);
  return list[0]?.id ?? null;
};

async function expandRoutes(routes, req) {
  const out = [];
  const skipped = [];
  const cache = new Map();
  const sample = async (pat) => {
    if (cache.has(pat)) return cache.get(pat);
    let v = SAMPLE_CONST[pat] ?? null;
    if (!v && SAMPLE_SOURCES[pat]) {
      const r = await req.get(SAMPLE_SOURCES[pat]).catch(() => null);
      if (r?.ok()) v = firstId(await r.json().catch(() => null));
    }
    cache.set(pat, v);
    return v;
  };
  for (const r of routes) {
    if (!r.includes("[")) { out.push({ pattern: r, url: r }); continue; }
    // thay từng tham số: tham số động thuộc cha → dùng mẫu của cha cho phần "[x]" đầu tiên
    const m = /^(.*?\/\[[^\]]+\])(.*)$/.exec(r);
    const parentPat = m ? m[1] : r;
    const v = await sample(parentPat);
    if (!v) { skipped.push({ route: r, why: "không có dữ liệu mẫu để thay tham số động" }); continue; }
    out.push({ pattern: r, url: r.replace(/\[[^\]]+\]/, encodeURIComponent(v)) });
  }
  return { routes: out, skipped };
}

// ---------------------------------------------------------------------
// Đo trong trang
// ---------------------------------------------------------------------
const PROBE = (mobile) => {
  const MIN = 44;
  const vw = document.documentElement.clientWidth;
  const found = [];
  const idOf = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className?.baseVal ?? el.className).split(/\s+/).filter(Boolean).slice(0, 4).join(".")}`.slice(0, 90);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    for (let p = el; p; p = p.parentElement) if (p.getAttribute?.("aria-hidden") === "true" || p.hasAttribute?.("inert")) return false;
    return true;
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth - 1) return true;
    }
    return false;
  };
  const skip = (el) => !!el.closest("[data-no-audit], .sr-only, .wf-sr, [hidden]");

  // 1) tràn ngang
  if (document.documentElement.scrollWidth > vw + 1) found.push({ kind: "tràn-ngang", el: "document", text: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.position === "fixed" || cs.position === "sticky") continue;
    if (cs.position === "absolute" && !(el.innerText || "").trim() && !el.querySelector("button,a,input,img,svg")) continue;
    if (r.right > vw + 1 && r.left < vw && !inScroller(el) && !skip(el)) found.push({ kind: "vượt-mép-phải", el: idOf(el), text: (el.innerText || "").trim().slice(0, 40), extra: `mép ${Math.round(r.right)} > ${vw}` });
  }

  // 2) nhãn nút / liên kết dạng nút bị xuống dòng
  for (const el of document.querySelectorAll("button, a[href], [role=tab], [role=button]")) {
    if (!visible(el) || skip(el)) continue;
    if (!/^inline-(flex|block)/.test(getComputedStyle(el).display)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || "").replace(/[ \t\r\n]+/g, " ").trim();
      if (t.length < 4 || t.length > 40 || !t.includes(" ")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tops = new Set([...range.getClientRects()].filter((q) => q.width > 2 && q.height > 4).map((q) => Math.round(q.top / 6)));
      if (tops.size > 1) { found.push({ kind: "nhãn-xuống-dòng", el: idOf(el), text: t.slice(0, 40), extra: `${tops.size} dòng` }); break; }
    }
  }

  // 3) chữ bị cắt
  const textOverflows = (el) => {
    const er = el.getBoundingClientRect();
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!(n.textContent || "").trim()) continue;
      let decorative = false;
      for (let q = n.parentElement; q && q !== el; q = q.parentElement) {
        const cs = getComputedStyle(q);
        if (cs.position === "absolute" || cs.position === "fixed" || q.getAttribute("aria-hidden") === "true" || /(hidden|clip|auto|scroll)/.test(cs.overflowX)) decorative = true;
      }
      if (decorative) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 1 && (r.right > er.right + 2 || r.left < er.left - 2)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || skip(el)) continue;
    const cs = getComputedStyle(el);
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const text = (el.innerText || "").trim();
    if (!text || el.matches("html,body") || cs.display === "inline") continue;
    if (/(hidden|clip)/.test(cs.overflowX)) {
      const ellipsis = cs.textOverflow === "ellipsis";
      if (ellipsis && el.clientWidth < 70 && text.length > 8) found.push({ kind: "chữ-bị-cắt", el: idOf(el), text: text.slice(0, 40), extra: `ellipsis chỉ còn ${Math.round(el.clientWidth)}px` });
      else if (!ellipsis && el.scrollWidth > el.clientWidth + 8 && textOverflows(el)) found.push({ kind: "chữ-bị-cắt", el: idOf(el), text: text.slice(0, 40), extra: `${el.scrollWidth}px trong khung ${el.clientWidth}px` });
    } else if (!/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4 && cs.display !== "table-cell" && textOverflows(el)) {
      found.push({ kind: "chữ-tràn-khung", el: idOf(el), text: text.slice(0, 40), extra: `${el.scrollWidth}px trong khung ${el.clientWidth}px` });
    }
  }

  // 4) phần tử tương tác < 44px (điện thoại)
  if (mobile) {
    const sel = "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option]";
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el) || skip(el) || el.disabled) continue;
      const cs = getComputedStyle(el);
      if (el.tagName === "A" && cs.display === "inline") continue; // liên kết trong đoạn văn
      if (el.matches(".wf-skip")) continue; // liên kết "Bỏ qua điều hướng": chỉ dành cho bàn phím
      let r = el.getBoundingClientRect();
      if (el.matches("input[type=checkbox],input[type=radio]")) {
        const lab = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
        if (lab) r = lab.getBoundingClientRect();
      }
      // Vùng chạm mở rộng bằng ::before/::after absolute có inset âm (vd. .wf-touch, .wf-switch) ⇒ tính vào kích thước chạm
      let w = r.width, h = r.height;
      for (const pe of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pe);
        if (ps.content === "none" || ps.position !== "absolute") continue;
        const px = (v) => (v.endsWith("px") ? parseFloat(v) : 0);
        const t = px(ps.top), b = px(ps.bottom), l = px(ps.left), rr = px(ps.right);
        if (t < 0 && b < 0) h = Math.max(h, r.height - t - b);
        if (l < 0 && rr < 0) w = Math.max(w, r.width - l - rr);
      }
      if (w < MIN - 0.5 || h < MIN - 0.5) found.push({ kind: "chạm-nhỏ", el: idOf(el), text: (el.innerText || el.getAttribute("aria-label") || el.value || "").trim().slice(0, 30), extra: `${Math.round(r.width)}×${Math.round(r.height)}px` });
    }
  }

  // 5) ảnh không alt
  for (const el of document.querySelectorAll("img:not([alt]), input[type=image]:not([alt]), [role=img]:not([aria-label]):not([aria-labelledby])")) {
    if (skip(el)) continue;
    found.push({ kind: "ảnh-thiếu-alt", el: idOf(el), text: (el.getAttribute("src") || "").slice(0, 60) });
  }

  const seen = new Set();
  return found.filter((f) => {
    const k = f.kind + f.el + f.text;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 40);
};

// ---------------------------------------------------------------------
// Chạy
// ---------------------------------------------------------------------
const slug = (s) => (s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home").slice(0, 80);
const findings = [];
const skippedPages = [];
const pagesRun = { n: 0, withFindings: 0 };
let shots = 0;

async function waitSettled(page) {
  await page.waitForFunction(() => !document.querySelector(".wf-skb, [aria-busy=true]"), null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function auditPage(page, route, ctxInfo, relogin) {
  const { role, width, theme } = ctxInfo;
  const mobile = width < 700;
  let status = null;
  try {
    const resp = await page.goto(BASE + route.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    status = resp?.status() ?? null;
  } catch (e) {
    skippedPages.push({ role, width, theme, route: route.url, why: "không tải được: " + String(e.message).slice(0, 80) });
    return;
  }
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  let path0 = new URL(page.url()).pathname;
  if (path0.startsWith("/dang-nhap") && !route.url.startsWith("/dang-nhap")) {
    if (await relogin()) { await page.goto(BASE + route.url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {}); path0 = new URL(page.url()).pathname; }
  }
  const want = route.url.split("?")[0];
  if (path0 !== want && !(want === "/" && path0 === "/")) {
    skippedPages.push({ role, width, theme, route: route.url, why: `chuyển hướng sang ${path0} (vai trò không dùng trang này / phải qua bước khác)` });
    return;
  }
  await waitSettled(page);
  if (status && status >= 500) {
    findings.push({ role, width, theme, route: route.pattern, url: route.url, kind: "lỗi-máy-chủ", el: "document", text: `HTTP ${status}` });
  }
  if (await page.getByText("Bạn không có quyền xem mục này").count().catch(() => 0)) {
    skippedPages.push({ role, width, theme, route: route.url, why: "vai trò không có quyền xem (EmptyState)" });
    return;
  }
  pagesRun.n++;
  let res = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try { res = await page.evaluate(PROBE, mobile); break; }
    catch (e) { if (attempt === 2) { res = [{ kind: "đo-lỗi", el: "document", text: String(e.message).slice(0, 80) }]; break; } await page.waitForTimeout(1200); }
  }
  if (!NO_AXE) {
    try {
      const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      for (const v of ax.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
        res.push({ kind: "axe-" + v.impact, el: v.id, text: v.help.slice(0, 80), extra: `${v.nodes.length} nút · ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ").slice(0, 120)}` });
      }
    } catch { /* trang đang chuyển cảnh */ }
  }
  for (const f of res) findings.push({ role, width, theme, route: route.pattern, url: route.url, ...f });
  if (res.length) pagesRun.withFindings++;
  if ((res.length || ALL_SHOTS) && shots < MAX_SHOTS) {
    const file = path.join("images", role, `${width}-${theme}`, slug(route.url) + ".png");
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    await page.screenshot({ path: path.join(OUT, file), fullPage: true }).then(() => { shots++; for (const f of res) f.shot = file; }).catch(() => {});
    for (const f of findings.slice(-res.length)) f.shot = file;
  }
  const tag = res.length ? "✗" : "✓";
  console.log(`${tag} ${role} ${width}px ${theme} ${route.url}${res.length ? `  (${res.length})` : ""}`);
}

process.on("SIGINT", () => { try { writeReport(0, false); } catch { /* bỏ qua */ } process.exit(130); });

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true }).catch(() => chromium.launch({ headless: true }));
  const all = discoverRoutes().filter((r) => !ONLY?.length || ONLY.some((p) => r === p || r.startsWith(p + "/")));
  console.log(`Base ${BASE} · vai trò ${ROLES.join(",")} · khổ ${WIDTHS.join(",")} · giao diện ${THEMES.join(",")} · ${all.length} route (từ src/app)`);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  let expanded = null;
  const states = {};
  try {
    for (const role of ROLES) {
      let ses;
      try { ses = await loginRole(browser, role); } catch (e) { console.error(`✗ ${role}: ${e.message}`); skippedPages.push({ role, route: "*", why: "không đăng nhập được: " + e.message }); continue; }
      states[role] = ses.state;
      if (!expanded) {
        // id mẫu lấy bằng vai trò đầu tiên có quyền xem (thường owner); các vai trò sau dùng cùng id
        expanded = await expandRoutes(all, ses.ctx.request);
        for (const s of expanded.skipped) skippedPages.push({ role: "*", route: s.route, why: s.why });
      }
      await ses.ctx.close();
      for (const width of WIDTHS) {
        for (const theme of THEMES) {
          const mobile = width < 700;
          const context = await browser.newContext({
            baseURL: BASE, storageState: states[role], viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile,
            deviceScaleFactor: mobile ? 2 : 1, locale: "vi-VN",
          });
          await context.addInitScript((t) => { try { localStorage.setItem("wf-theme", t); } catch { /* bỏ qua */ } }, theme);
          const relogin = async () => {
            try { const s = await loginRole(browser, role); await context.addCookies((await s.ctx.storageState()).cookies); await s.ctx.close(); return true; } catch { return false; }
          };
          const queue = [...expanded.routes];
          await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
            const page = await context.newPage();
            for (let r = queue.shift(); r; r = queue.shift()) {
              await auditPage(page, r, { role, width, theme }, relogin).catch((e) => skippedPages.push({ role, width, theme, route: r.url, why: "lỗi kiểm: " + String(e.message).slice(0, 80) }));
            }
            await page.close();
          }));
          await context.close();
          writeReport(Date.now() - t0, false);
        }
      }
    }
  } finally {
    await browser.close();
  }
  writeReport(Date.now() - t0);
}

// ---------------------------------------------------------------------
// Báo cáo
// ---------------------------------------------------------------------
const sig = (f) => `${f.kind}|${f.el}|${f.kind.startsWith("axe") ? "" : f.text.slice(0, 24)}`;

function writeReport(ms, final = true) {
  const groups = new Map();
  for (const f of findings) {
    const k = sig(f);
    const g = groups.get(k) ?? { ...f, variants: new Set(), roles: new Set(), routes: new Set() };
    g.routes.add(f.route);
    g.variants.add(`${f.width}px/${f.theme}`);
    g.roles.add(f.role);
    groups.set(k, g);
  }
  const uniq = [...groups.values()].sort((a, b) => b.routes.size * b.variants.size * b.roles.size - a.routes.size * a.variants.size * a.roles.size);
  const byKind = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  const kindsUniq = {};
  for (const g of uniq) kindsUniq[g.kind] = (kindsUniq[g.kind] ?? 0) + 1;
  const md = [];
  md.push(`# Kiểm bố cục tự động`, "");
  md.push(`- Thời điểm: ${new Date().toISOString()} · base ${BASE} · mất ${Math.round(ms / 1000)} giây`);
  md.push(`- Vai trò: ${ROLES.join(", ")} · khổ: ${WIDTHS.join(", ")}px · giao diện: ${THEMES.join(", ")} · axe: ${NO_AXE ? "tắt" : "bật (serious/critical)"}`);
  md.push(`- Lượt kiểm trang: ${pagesRun.n} · lượt có lỗi: ${pagesRun.withFindings} · **phát hiện: ${findings.length}** (${uniq.length} vấn đề duy nhất) · trang bỏ qua: ${skippedPages.length}`, "");
  md.push(`## Theo loại`, "", `| Loại | Lượt phát hiện | Vấn đề duy nhất |`, `|---|---:|---:|`);
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n} | ${kindsUniq[k] ?? 0} |`);
  if (!findings.length) md.push(`| (không có) | 0 | 0 |`);
  md.push("", `## Top 10 vấn đề (xếp theo số route × khổ/giao diện × vai trò bị ảnh hưởng)`, "");
  uniq.slice(0, 10).forEach((g, i) => {
    md.push(`${i + 1}. **${g.kind}** — \`${g.el}\`${g.text ? ` — “${g.text}”` : ""}${g.extra ? ` — ${g.extra}` : ""}  `);
    md.push(`   ${g.routes.size} route (vd. ${[...g.routes].slice(0, 3).map((r) => "`" + r + "`").join(", ")}) · ${[...g.variants].join(", ")} · vai trò: ${[...g.roles].join(", ")}${g.shot ? ` · ảnh: ${g.shot}` : ""}`);
  });
  if (!uniq.length) md.push("(không có)");
  md.push("", `## Toàn bộ vấn đề duy nhất (${uniq.length})`, "");
  for (const g of uniq) md.push(`- **${g.kind}** \`${g.el}\`${g.text ? ` “${g.text}”` : ""}${g.extra ? ` (${g.extra})` : ""} — ${g.routes.size} route: ${[...g.routes].slice(0, 6).join(", ")}${g.routes.size > 6 ? "…" : ""} — ${[...g.variants].join(", ")} — ${[...g.roles].join(", ")}`);
  md.push("", `## Trang bỏ qua (${skippedPages.length})`, "");
  const sk = new Map();
  for (const s of skippedPages) { const k = `${s.route} — ${s.why}`; sk.set(k, (sk.get(k) ?? 0) + 1); }
  for (const [k, n] of sk) md.push(`- ${k} ×${n}`);
  fs.writeFileSync(path.join(OUT, "report.md"), md.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify({ findings, uniq: uniq.map((g) => ({ ...g, variants: [...g.variants], roles: [...g.roles], routes: [...g.routes] })), skippedPages }, null, 1));
  if (!final) return;
  console.log(`\n${findings.length ? `✗ ${findings.length} phát hiện (${uniq.length} duy nhất) ở ${pagesRun.withFindings}/${pagesRun.n} lượt` : "✓ không phát hiện lỗi bố cục"} · báo cáo: ${path.relative(ROOT, path.join(OUT, "report.md"))}`);
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`   ${k}: ${n}`);
  process.exit(findings.length && !flag("--no-fail") ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
