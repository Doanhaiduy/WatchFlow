// Chạy câu SQL nhanh trên DB local (quyền chủ DB). Dùng: node scripts/db/sql.mjs "SELECT ..." [--db watchflow_test]
import { argValue } from "../lib/env.mjs";
import { ownerUrl, connect } from "../lib/db.mjs";
const q = process.argv.slice(2).find((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--db" && arr[i - 1] !== "--env");
const c = await connect(ownerUrl({ dbName: argValue("--db") }));
try {
  const r = await c.query(q);
  const rows = Array.isArray(r) ? r.at(-1).rows : r.rows;
  console.table(rows);
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await c.end(); }
