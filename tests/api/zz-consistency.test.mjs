// Chạy CUỐI (tên zz-): sau mọi kịch bản vàng/đồng thời trên cùng DB test, app.fn_consistency_check() (I1–I15) phải sạch;
// doanh thu trong báo cáo khớp tổng chứng từ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerSql, asUser, userOf } from "./_lib.mjs";

test("fn_consistency_check(): 0 vi phạm sau toàn bộ bộ test", async () => {
  const v = await ownerSql("SELECT * FROM app.fn_consistency_check()");
  assert.deepEqual(v, [], JSON.stringify(v, null, 1));
});

test("SC-13 (bản gọn): Σ doanh thu báo cáo (mọi kỳ) = Σ giá trị đơn bán đã ghi (cửa hàng + CTV) + Σ máy sửa đã giao; mỗi đơn bán = Σ dòng", async () => {
  const [r] = await ownerSql(`SELECT
    (SELECT coalesce(sum(grand_total_vnd),0) FROM public.sales WHERE status='confirmed')::bigint AS sales_total,
    (SELECT coalesce(sum(sl.shop_revenue_vnd),0) FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id=s.id WHERE s.status='confirmed' AND sl.is_effective)::bigint AS lines_total,
    (SELECT coalesce(sum(revenue_vnd),0) FROM public.repair_orders WHERE status='delivered' AND kind='customer')::bigint AS repair_total`);
  assert.equal(Number(r.sales_total), Number(r.lines_total), "đơn = Σ dòng");
  const rep = await asUser(userOf("owner").id, (c) => c.query("SELECT app.rpt_revenue('2000-01-01','2100-01-01','year') AS r"));
  const total = rep.rows[0].r.reduce((a, x) => a + Number(x.revenue), 0);
  assert.equal(total, Number(r.sales_total) + Number(r.repair_total), JSON.stringify(r));
});

test("fn_consistency_check phát hiện được lỗi cố ý (kiểm chứng bộ kiểm): chào hàng CTV còn hiệu lực trên chiếc đã bán ⇒ I13", async () => {
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.in_fn','on',true)");
    const sold = (await c.query("SELECT id FROM public.watch_units WHERE status='sold' LIMIT 1")).rows[0];
    const collab = (await c.query("SELECT user_id FROM public.collaborator_profiles WHERE is_active LIMIT 1")).rows[0];
    assert.ok(sold && collab, "cần dữ liệu từ các bộ test trước");
    await c.query("INSERT INTO public.collaborator_offers (unit_id, collaborator_id, offered_by, status) VALUES ($1,$2,$3,'active')", [sold.id, collab.user_id, collab.user_id]);
    const r = await c.query("SELECT check_code FROM app.fn_consistency_check()");
    assert.ok(r.rows.some((x) => x.check_code === "I13"), JSON.stringify(r.rows));
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }
});
