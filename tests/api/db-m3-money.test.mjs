// M3 — Tiền tối giản (mức DB): đối chiếu TS ↔ SQL cho allocate/round (SC-11, thuộc tính ngẫu nhiên Σ = tổng),
// payments bất biến (PT-09), fn_record_payment từ chối chứng từ không tồn tại, ràng buộc purpose↔doc_type↔direction (I1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerSql, asUser, userOf, expectWf } from "./_lib.mjs";

// Bản JS của allocate — import trực tiếp src/lib/money.ts không được trong node:test thuần ⇒ chép thuật toán để đối chiếu cả hai chiều với bộ vitest
function allocateJs(total, w, method = "by_value") {
  const n = w.length, T = BigInt(total), W = w.reduce((a, x) => a + BigInt(x), 0n);
  const eq = method === "equal" || W === 0n;
  const base = w.map((x) => (eq ? T / BigInt(n) : (T * BigInt(x)) / W));
  let mi = 0; for (let i = 1; i < n; i++) if (w[i] > w[mi]) mi = i;
  base[mi] += T - base.reduce((a, b) => a + b, 0n);
  return base.map(Number);
}

test("SC-11 ca a,b,c,g,f trên SQL", async () => {
  const q = async (t, w, m) => (await ownerSql("SELECT app.allocate_vnd($1, $2::bigint[], $3) r", [t, w, m]))[0].r.map(Number);
  assert.deepEqual(await q(1_000_000, [3e6, 3e6, 3e6], "by_value"), [333_334, 333_333, 333_333]);
  assert.deepEqual(await q(100_000, [1e6, 2e6, 3e6], "by_value"), [16_666, 33_333, 50_001]);
  assert.deepEqual(await q(100_000, [1e6, 2e6, 3e6], "equal"), [33_333, 33_333, 33_334]);
  assert.deepEqual(await q(100_001, [1e6, 1e6, 1e6], "by_value"), [33_335, 33_333, 33_333]);
  assert.deepEqual(await q(100_000, [3e6, 1e6], "by_value"), [75_000, 25_000]);
  assert.equal((await ownerSql("SELECT app.round_vnd(2 * 10571.4286) r"))[0].r, 21_143);
  assert.equal((await ownerSql("SELECT app.round_vnd(74000::numeric/7*2) r"))[0].r, 21_143);
});

test("thuộc tính: 300 bộ ngẫu nhiên — SQL = JS và Σ = tổng", async () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
  const cases = [];
  for (let k = 0; k < 300; k++) {
    const n = 1 + rnd(7);
    cases.push({ t: rnd(50_000_000), w: Array.from({ length: n }, () => rnd(80_000_000)), m: rnd(3) === 0 ? "equal" : "by_value" });
  }
  const rows = await ownerSql(
    `SELECT i, app.allocate_vnd((c->>'t')::bigint, ARRAY(SELECT jsonb_array_elements_text(c->'w')::bigint), c->>'m') r
     FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS x(c, i) ORDER BY i`, [JSON.stringify(cases)]);
  rows.forEach((r, i) => {
    const sql = r.r.map(Number);
    assert.deepEqual(sql, allocateJs(cases[i].t, cases[i].w, cases[i].m), JSON.stringify(cases[i]));
    assert.equal(sql.reduce((a, b) => a + b, 0), cases[i].t);
  });
});

test("fn_record_payment: chứng từ không tồn tại ⇒ WF-PAY-DOC-INVALID; thiếu quyền ⇒ FORBIDDEN; số tiền ≤ 0 ⇒ VALIDATION", async () => {
  const sales = userOf("sales"), wh = userOf("warehouse");
  await expectWf(asUser(sales.id, (c) => c.query("SELECT app.fn_record_payment('sale', app.uuid_v7(), 'sale_receipt', 'cash', 1000)")), "WF-PAY-DOC-INVALID");
  await expectWf(asUser(wh.id, (c) => c.query("SELECT app.fn_record_payment('sale', app.uuid_v7(), 'sale_receipt', 'cash', 1000)")), "WF-AUTH-FORBIDDEN");
  await expectWf(asUser(sales.id, (c) => c.query("SELECT app.fn_record_payment('sale', app.uuid_v7(), 'sale_receipt', 'cash', 0)")), "WF-VALIDATION");
  await expectWf(asUser(sales.id, (c) => c.query("SELECT app.fn_record_payment('sale', app.uuid_v7(), 'sale_receipt', 'cash', 10, (app.today_vn()+1))")), "WF-DOC-FUTURE");
  await expectWf(asUser(sales.id, (c) => c.query("SELECT app.fn_record_payment('sale', app.uuid_v7(), 'sale_receipt', 'cash', 10, (app.today_vn()-30))")), "WF-DOC-BACKDATE");
});

test("I1 / PT-09: purpose↔doc_type↔direction; payments không sửa số tiền, không xóa; wf_app không INSERT trực tiếp", async () => {
  await assert.rejects(ownerSql(`INSERT INTO public.payments (code, direction, purpose, method, amount_vnd, doc_date, doc_type, doc_id)
    VALUES ('PT-X1','in','sale_receipt','cash',1,current_date,'repair',app.uuid_v7())`), /payments_purpose_doc/);
  const [p] = await ownerSql(`INSERT INTO public.payments (code, direction, purpose, method, amount_vnd, doc_date, doc_type, doc_id)
    VALUES ('PT-X2','in','sale_receipt','cash',1000,current_date,'sale',app.uuid_v7()) RETURNING id`);
  await assert.rejects(ownerSql("UPDATE public.payments SET amount_vnd = 1 WHERE id=$1", [p.id]), /WF-IMMUTABLE/);
  await assert.rejects(ownerSql("DELETE FROM public.payments WHERE id=$1", [p.id]), /WF-IMMUTABLE/);
  await assert.rejects(ownerSql("TRUNCATE public.payments"), /WF-IMMUTABLE/);
  await ownerSql("UPDATE public.payments SET status='voided', voided_at=now(), void_reason='Kiểm thử hủy hợp lệ' WHERE id=$1", [p.id]);
  await assert.rejects(ownerSql("UPDATE public.payments SET status='posted', voided_at=NULL WHERE id=$1", [p.id]), /WF-IMMUTABLE/);
  await assert.rejects(asUser(userOf("owner").id, (c) => c.query(`INSERT INTO public.payments (code, direction, purpose, method, amount_vnd, doc_date, doc_type, doc_id)
    VALUES ('PT-X3','in','sale_receipt','cash',1,current_date,'sale',app.uuid_v7())`)), /permission denied/);
  await ownerSql("DELETE FROM public.audit_logs WHERE false"); // không xóa gì — chỉ để chắc truy vấn hợp lệ
});
