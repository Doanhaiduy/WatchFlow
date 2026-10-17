// Chạy CUỐI (tên zz-): sau mọi kịch bản vàng/đồng thời trên cùng DB test, app.fn_consistency_check() (I1–I12) phải sạch;
// db:audit vẫn sạch; không còn idempotency/rate-limit rác ảnh hưởng.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerSql } from "./_lib.mjs";

test("fn_consistency_check(): 0 vi phạm sau toàn bộ bộ test", async () => {
  const v = await ownerSql("SELECT * FROM app.fn_consistency_check()");
  assert.deepEqual(v, [], JSON.stringify(v, null, 1));
});

test("SC-13 hằng đẳng thức toàn DB: Doanh thu − Thực thu = Khách nợ + CTV chưa nộp − Cọc giữ − Cọc tịch thu − Nhận trước sửa + Giá thu máy cũ", async () => {
  const [r] = await ownerSql(`SELECT
    (SELECT coalesce(sum(sl.shop_revenue_vnd),0) FROM public.sales s JOIN public.sale_lines sl ON sl.sale_id=s.id WHERE s.status='confirmed')
      + (SELECT coalesce(sum(revenue_vnd),0) FROM public.repair_orders WHERE status='delivered' AND kind='customer') AS revenue,
    (SELECT coalesce(sum(CASE WHEN direction='in' THEN amount_vnd ELSE -amount_vnd END),0) FROM public.payments WHERE status='posted') AS collected,
    (SELECT coalesce(sum(due),0) FROM public.v_doc_balances WHERE due > 0) AS due,
    (SELECT coalesce(sum(sl.base_price_vnd),0) FROM public.sale_lines sl JOIN public.sales s ON s.id=sl.sale_id WHERE s.status='confirmed' AND s.collaborator_id IS NOT NULL AND sl.settlement_id IS NULL) AS unsettled,
    (SELECT coalesce(sum(held),0) FROM public.v_doc_balances WHERE doc_type='reservation') AS deposits,
    (SELECT coalesce(sum(forfeited_vnd),0) FROM public.reservations) AS forfeited,
    (SELECT coalesce(sum(held),0) FROM public.v_doc_balances WHERE doc_type='repair') AS prepaid,
    (SELECT coalesce(sum(trade_in_total_vnd),0) FROM public.sales WHERE status='confirmed') AS tradein`);
  const left = Number(r.revenue) - Number(r.collected);
  const right = Number(r.due) + Number(r.unsettled) - Number(r.deposits) - Number(r.forfeited) - Number(r.prepaid) + Number(r.tradein);
  assert.equal(left, right, JSON.stringify(r));
});

test("fn_consistency_check phát hiện được lỗi cố ý (kiểm chứng bộ kiểm)", async () => {
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.in_fn','on',true)");
    await c.query("ALTER TABLE public.parts DISABLE TRIGGER trg_parts__qty_guard");
    await c.query("UPDATE public.parts SET qty_on_hand = qty_on_hand + 1 WHERE id = (SELECT id FROM public.parts LIMIT 1)");
    const r = await c.query("SELECT check_code FROM app.fn_consistency_check()");
    assert.ok(r.rows.some((x) => x.check_code === "I7"));
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }
});
