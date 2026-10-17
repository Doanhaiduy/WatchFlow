import { z } from "zod";
import { api } from "@/server/http";
import { todayVn, addDays } from "@/lib/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Q = z.object({ period: z.enum(["today", "7d", "month", "quarter", "year"]).default("today"), from: isoDate.optional(), to: isoDate.optional() });

function range(period: string, today: string): [string, string] {
  const y = today.slice(0, 4), m = Number(today.slice(5, 7));
  if (period === "7d") return [addDays(today, -6), today];
  if (period === "month") return [`${today.slice(0, 7)}-01`, today];
  if (period === "quarter") return [`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`, today];
  if (period === "year") return [`${y}-01-01`, today];
  return [today, today];
}

// Tổng quan theo vai trò: hàm DB chỉ trả khóa người gọi được phép (FR-DASH-11); kèm chuỗi ngày cho biểu đồ (nếu có quyền doanh thu/lãi)
export const GET = api({ query: Q }, async ({ query, db, can }) => {
  const today = todayVn();
  const [from, to] = query.from && query.to ? [query.from, query.to] : range(query.period, today);
  return db(async (tx) => {
    const kpis = (await tx.one<{ r: Record<string, unknown> }>("SELECT app.rpt_dashboard($1,$2) AS r", [from, to]))!.r;
    const chartFrom = query.period === "today" ? addDays(today, -6) : from;
    const group = query.period === "year" || query.period === "quarter" ? "month" : "day";
    const series: Record<string, unknown> = {};
    if (can("report.sales")) series.revenue = (await tx.one<{ r: unknown }>("SELECT app.rpt_revenue($1,$2,$3) AS r", [chartFrom, to, group]))!.r;
    if (can("profit.view")) series.profit = (await tx.one<{ r: unknown }>("SELECT app.rpt_profit($1,$2,$3) AS r", [chartFrom, to, group]))!.r;
    const recentSales = can(["sale.view"])
      ? await tx.q(`SELECT s.id, s.code, s.doc_date AS "docDate", s.grand_total_vnd AS "grandTotal", c.full_name AS "customerName", s.collaborator_id IS NOT NULL AS "isCollab"
                    FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id WHERE s.status = 'confirmed' ORDER BY s.confirmed_at DESC LIMIT 6`)
      : undefined;
    const openRepairs = can("repair.view")
      ? await tx.q(`SELECT o.id, o.code, o.status, c.full_name AS "customerName", o.expected_date AS "expectedDate" FROM public.repair_orders o
                    LEFT JOIN public.customers c ON c.id = o.customer_id WHERE o.status IN ('received','inspecting','repairing','waiting_parts','completed') ORDER BY o.received_at DESC LIMIT 6`)
      : undefined;
    return { from, to, period: query.period, kpis, series, recentSales, openRepairs };
  });
});
