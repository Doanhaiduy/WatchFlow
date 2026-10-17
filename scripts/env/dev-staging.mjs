// Chạy máy dev trỏ DB STAGING (chỉ khi thật cần). In cảnh báo đỏ, đọc .env.staging, đặt ALLOW_REMOTE_DB=true.
// Máy công ty: CẤM (IMPLEMENT_PROMPT §0 — không kết nối cloud).
import { spawn } from "node:child_process";
import path from "node:path";
import { loadEnv, ROOT } from "../lib/env.mjs";

const vars = loadEnv("staging", { override: true });
if (!vars.DATABASE_URL) { console.error("Thiếu .env.staging"); process.exit(1); }
console.log("\x1b[41m\x1b[37m CẢNH BÁO: đang chạy với DB STAGING — mọi thao tác ghi là thật trên staging. \x1b[0m");
process.env.ALLOW_REMOTE_DB = "true";
const child = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3000"], { stdio: "inherit", env: process.env });
child.on("exit", (c) => process.exit(c ?? 0));
