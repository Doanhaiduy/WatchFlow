// Diễn tập khôi phục (BR-BAK-03) bản local: sao lưu DB watchflow → giải mã → pg_restore vào DB tạm → đối chiếu số dòng bảng chính,
// app_migrations, (nếu có) app.fn_consistency_check() → ghi biên bản .local/backups/drill-*.md + nhịp tim restore_drill → xóa DB tạm.
// Dùng: pnpm db:restore-drill [-- --file <tệp .dump.enc>] [--keep]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, argValue, hasFlag, loadEnv } from "../lib/env.mjs";
import { connect, ensureDatabase, dropDatabase } from "../lib/db.mjs";
import { superuserUrl, pgBin, start } from "./pg.mjs";
import { dump, encrypt, decrypt, passphrase } from "./backup.mjs";

loadEnv("local");
start({ quiet: true });
const SRC = "watchflow";
const TMP = "watchflow_restore_drill";
const t0 = Date.now();
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };

try {
  let enc;
  const file = argValue("--file");
  if (file) enc = fs.readFileSync(file);
  else enc = encrypt(dump(superuserUrl(SRC)), passphrase());
  log(`- Bản sao lưu: ${file ?? "tạo mới từ DB " + SRC} (${(enc.length / 1024).toFixed(0)} KB, đã mã hóa)`);
  const raw = decrypt(enc, passphrase());
  log("- Giải mã: OK");
  const dumpFile = path.join(ROOT, ".local", "backups", "drill.dump");
  fs.mkdirSync(path.dirname(dumpFile), { recursive: true });
  fs.writeFileSync(dumpFile, raw, { mode: 0o600 });

  await dropDatabase(TMP);
  await ensureDatabase(TMP);
  // Vai trò cụm đã có (0001). Extension tạo trước khi restore.
  const pre = await connect(superuserUrl(TMP));
  for (const e of ["pgcrypto", "citext", "pg_trgm", "unaccent"]) await pre.query(`CREATE EXTENSION IF NOT EXISTS ${e}`);
  await pre.end();
  // Bỏ mục "SCHEMA - public" (DB mới đã có schema public chứa extension)
  const toc = spawnSync(pgBin("pg_restore"), ["-l", dumpFile], { windowsHide: true, encoding: "utf8", maxBuffer: 256 * 1024 ** 2 });
  const listFile = dumpFile + ".list";
  fs.writeFileSync(listFile, toc.stdout.split(/\r?\n/).filter((l) => !/ SCHEMA - public /.test(l)).join("\n"));
  const r = spawnSync(pgBin("pg_restore"), ["--no-owner", "--role=postgres", "--exit-on-error", "-L", listFile, "-d", superuserUrl(TMP), dumpFile], { windowsHide: true, maxBuffer: 1024 ** 3 });
  fs.rmSync(dumpFile, { force: true });
  fs.rmSync(listFile, { force: true });
  if (r.status !== 0) throw new Error("pg_restore lỗi: " + r.stderr?.toString().slice(0, 2000));
  log("- pg_restore vào DB tạm: OK");

  const a = await connect(superuserUrl(SRC));
  const b = await connect(superuserUrl(TMP));
  const tables = (await a.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows.map((x) => x.tablename);
  let mismatch = 0;
  for (const t of tables) {
    const [x, y] = await Promise.all([a.query(`SELECT count(*)::int n FROM public."${t}"`), b.query(`SELECT count(*)::int n FROM public."${t}"`)]);
    if (x.rows[0].n !== y.rows[0].n) { mismatch++; log(`  ✘ ${t}: gốc ${x.rows[0].n} ≠ khôi phục ${y.rows[0].n}`); }
  }
  log(`- Đối chiếu số dòng ${tables.length} bảng: ${mismatch ? mismatch + " lệch" : "khớp hết"}`);
  const m1 = (await a.query("SELECT string_agg(name||':'||sha256, ',' ORDER BY name) s FROM public.app_migrations")).rows[0].s;
  const m2 = (await b.query("SELECT string_agg(name||':'||sha256, ',' ORDER BY name) s FROM public.app_migrations")).rows[0].s;
  log(`- app_migrations: ${m1 === m2 ? "khớp" : "LỆCH"}`);
  const hasCheck = (await b.query("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='fn_consistency_check'")).rowCount;
  let consistent = true;
  if (hasCheck) {
    const v = (await b.query("SELECT count(*)::int n FROM app.fn_consistency_check()")).rows[0].n;
    consistent = v === 0;
    log(`- fn_consistency_check(): ${v} vi phạm`);
  } else log("- fn_consistency_check(): chưa có (M7)");
  const ok = mismatch === 0 && m1 === m2 && consistent;
  await a.query("INSERT INTO public.ops_heartbeats (kind, ok, note) VALUES ('restore_drill', $1, $2)", [ok, `diễn tập local ${Math.round((Date.now() - t0) / 1000)} giây`]);
  if (ok) await a.query("INSERT INTO public.ops_heartbeats (kind, ok, note) VALUES ('backup', true, 'sao lưu local (diễn tập)')");
  await a.end();
  await b.end();
  if (!hasFlag("--keep")) await dropDatabase(TMP);
  log(`\n**Kết quả: ${ok ? "ĐẠT" : "KHÔNG ĐẠT"}** · thời gian ${Math.round((Date.now() - t0) / 1000)} giây`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = path.join(ROOT, ".local", "backups", `drill-${stamp}.md`);
  fs.writeFileSync(report, `# Biên bản diễn tập khôi phục (local)\n\nThời điểm: ${new Date().toISOString()}\n\n${lines.join("\n")}\n`);
  console.log("Biên bản: " + path.relative(ROOT, report));
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error("✘ " + e.message);
  await dropDatabase(TMP).catch(() => {});
  process.exit(1);
}
