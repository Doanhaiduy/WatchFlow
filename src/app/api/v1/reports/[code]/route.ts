import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { REPORTS, toXlsx } from "@/server/reports";
import { hitDb } from "@/server/ratelimit";
import { todayVn, addDays } from "@/lib/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Q = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  group: z.enum(["day", "month", "quarter", "year"]).default("day"),
  format: z.enum(["json", "xlsx"]).default("json"),
});

// 3 báo cáo (doanh thu / số lượng đồng hồ / cộng tác viên): dữ liệu từ hàm DB (kiểm quyền trong thân); xuất Excel cần thêm report.export, giới hạn 5 lần/giờ, ghi audit (PT-05)
export const GET = api({ perm: ["report.sales", "report.inventory", "collab.view"], query: Q, writes: true }, async ({ params, query, db, can, user, req }) => {
  const def = REPORTS[params.code ?? ""];
  if (!def) throw new ApiError(404, "WF-NOT-FOUND", "Không có báo cáo này.");
  const to = query.to ?? todayVn();
  const from = query.from ?? addDays(to, -29);
  if (from > to) throw new ApiError(422, "WF-VALIDATION", "Ngày bắt đầu phải trước ngày kết thúc.");
  if (query.format === "xlsx") {
    if (!can("report.export")) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền xuất file.");
    await hitDb("export", user.userId);
  }
  const data = await db(async (tx) => {
    const d = await def.run(tx, { from, to, group: query.group });
    if (query.format === "xlsx") {
      await tx.q("SELECT app.fn_audit_event('report.exported', 'reports', $1, NULL, $2::jsonb, NULL, 'info')", [params.code, JSON.stringify({ from, to })]);
    }
    return d;
  });
  const generatedAt = new Date().toISOString();
  if (query.format === "xlsx") {
    const buf = await toXlsx(def.title, def.sheets(data), `Từ ${from} đến ${to} · Dữ liệu đến lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", timeStyle: "short", dateStyle: "short" }).format(new Date())}`);
    return new NextResponse(Buffer.from(buf), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="bao-cao-${params.code}-${from}_${to}.xlsx"` },
    });
  }
  void req;
  return { code: params.code, title: def.title, from, to, group: query.group, generatedAt, data };
});
