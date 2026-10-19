// M12 — Ghi đơn bán gọn (CF-13/15): SC-19 (ghi đơn, bảo hành, hủy trong hạn, in), CT-01 (hai đơn cùng bán một chiếc song song),
// CT-07 (cùng Idempotency-Key), PT-01 (sales/kho/CTV), tra cứu đơn, bất biến I4/I8.
import { test } from "node:test";
import assert from "node:assert/strict";
import { login, reauth, ownerSql, makeUnit, userOf } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv, KH;
const DAY = "2026-11-03";

test("chuẩn bị", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
  for (const c of [owner, sales, wh, ctv]) c.today = DAY;
  KH = Object.fromEntries((await ownerSql("SELECT full_name, id FROM public.customers")).map((r) => [r.full_name, r.id]));
});

const record = (who, body, headers = K()) => who.post("/api/v1/sales", body, headers);

test("SC-19: ghi đơn — khách mới nhập ngay, 2 chiếc (A mặc định bảo hành 12 tháng, B bảo hành 0), tổng = Σ giá, không thanh toán/nợ", async () => {
  const A = await makeUnit(9_000_000, { serial: "SC19-A" });
  const B = await makeUnit(2_500_000, { cond: "used", serial: "SC19-B" });
  const r = await record(sales, { customer: { fullName: "Khách Mẫu", phone: "0912 000 111" }, docDate: DAY, note: "Khách lấy luôn",
    lines: [{ unitId: A.id, price: 8_700_000 }, { unitId: B.id, price: 2_500_000, warrantyMonths: 0 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.code, /^HD-2026-\d{4,}$/);
  assert.equal(r.body.grandTotal, 11_200_000);
  const s = (await sales.get(`/api/v1/sales/${r.body.id}`)).body;
  assert.deepEqual([s.status, s.customerName, s.docDate, s.grandTotal, s.note], ["confirmed", "Khách Mẫu", DAY, 11_200_000, "Khách lấy luôn"]);
  assert.deepEqual(s.lines.map((l) => [l.assetCode, l.unitPrice, l.warrantyEnd]), [[A.code, 8_700_000, "2027-11-03"], [B.code, 2_500_000, null]]);
  for (const k of ["payments", "paid", "due", "cost", "grossProfit", "profit"]) assert.ok(!(k in s), "đơn không có " + k);
  assert.ok(!JSON.stringify(s).match(/"cost|profit|grossProfit/i));
  assert.deepEqual((await ownerSql("SELECT status FROM public.watch_units WHERE id = ANY($1) ORDER BY asset_code", [[A.id, B.id]])).map((x) => x.status), ["sold", "sold"]);
  // cùng SĐT lần sau dùng lại khách đã có
  const C = await makeUnit(1_000_000);
  const r2 = await record(sales, { customer: { fullName: "Khách Mẫu (gõ lại)", phone: "0912000111" }, lines: [{ unitId: C.id, price: 1_000_000 }] });
  assert.equal((await sales.get(`/api/v1/sales/${r2.body.id}`)).body.customerId, s.customerId);
  // không có thanh toán/nợ trong DB cho đơn mới
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.payments WHERE doc_id = ANY($1)", [[r.body.id, r2.body.id]]))[0].n, 0);
  // bán thấp hơn niêm yết chỉ hiển thị, không bị chặn (BR-SALE-23): niêm yết 9tr + 2,5tr, bán 11,2tr
  assert.equal(s.subtotalList, 11_500_000);
  assert.equal(s.discountTotal, 300_000);
});

test("SC-19: các lỗi — chiếc đã bán, trùng chiếc trong đơn, ngày tương lai, ghi lùi, thiếu khách, kho/CTV không được ghi", async () => {
  const X = await makeUnit(5_000_000);
  const ok = await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: X.id, price: 5_000_000 }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: X.id, price: 5_000_000 }] })).body.code, "WF-SALE-UNIT-UNAVAILABLE");
  const Y = await makeUnit(5_000_000);
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Y.id, price: 1 }, { unitId: Y.id, price: 1 }] })).body.code, "WF-VALIDATION");
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], docDate: "2026-11-09", lines: [{ unitId: Y.id, price: 1 }] })).body.code, "WF-DOC-FUTURE");
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], docDate: "2026-10-01", lines: [{ unitId: Y.id, price: 1 }] })).body.code, "WF-DOC-BACKDATE");
  assert.equal((await record(sales, { lines: [{ unitId: Y.id, price: 1 }] })).status, 422, "thiếu khách");
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [] })).status, 422, "thiếu chiếc");
  assert.equal((await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Y.id, price: -5 }] })).status, 422);
  assert.equal((await record(wh, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Y.id, price: 1 }] })).status, 403);
  assert.equal((await record(ctv, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Y.id, price: 1 }] })).status, 403);
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [Y.id]))[0].status, "in_stock", "lỗi ⇒ chiếc không đổi trạng thái");
});

test("CT-01: hai đơn cùng bán một chiếc song song ⇒ đúng 1 thành công; CT-07: cùng Idempotency-Key ⇒ một đơn", async () => {
  const U = await makeUnit(11_500_000);
  const [r1, r2] = await Promise.all([record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: U.id, price: 11_500_000 }] }),
    record(owner, { customerId: KH["Trần Thị Bình"], lines: [{ unitId: U.id, price: 11_000_000 }] })]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.sale_lines WHERE unit_id=$1 AND is_effective", [U.id]))[0].n, 1);
  const V = await makeUnit(3_000_000);
  const key = K();
  const body = { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: V.id, price: 3_000_000 }] };
  const [a, b] = await Promise.all([record(sales, body, key), record(sales, body, key)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(a.body.code, b.body.code);
  assert.equal((await ownerSql("SELECT count(*)::int n FROM public.sale_lines WHERE unit_id=$1", [V.id]))[0].n, 1);
});

test("tra cứu đơn: theo tên không dấu / SĐT / mã đơn / serial; lọc kênh; CTV & kho không xem được", async () => {
  const S = await makeUnit(4_000_000, { serial: "TRA-CUU-77" });
  const phone = "0971" + String(Date.now()).slice(-6); // SĐT riêng — các bộ khác đã dùng 0966777888
  const r = await record(sales, { customer: { fullName: "Lê Thị Tra Cứu", phone }, lines: [{ unitId: S.id, price: 4_000_000 }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const find = async (q) => (await sales.get("/api/v1/sales?q=" + encodeURIComponent(q))).body.items.map((x) => x.id);
  for (const q of ["le thi tra cuu", phone, r.body.code, "tra-cuu-77"]) assert.ok((await find(q)).includes(r.body.id), q);
  assert.ok((await sales.get("/api/v1/sales?channel=shop")).body.items.some((x) => x.id === r.body.id));
  assert.ok(!(await sales.get("/api/v1/sales?channel=collab")).body.items.some((x) => x.id === r.body.id));
  assert.equal((await ctv.get("/api/v1/sales")).status, 403);
  assert.equal((await wh.get("/api/v1/sales")).status, 403);
  assert.equal((await ctv.get(`/api/v1/sales/${r.body.id}`)).status, 403);
  const list = (await sales.get("/api/v1/sales")).body;
  assert.ok(!JSON.stringify(list).match(/"cost|profit|paid|due/i));
});

test("SC-19 bước 3: hủy đơn — sales 403; owner cần lý do ≥ 10 ký tự + nhập lại mật khẩu; chiếc về kho, bảo hành hủy; hủy lần hai & quá hạn bị chặn", async () => {
  const Q = await makeUnit(8_500_000, { serial: "SC15-Q" });
  const d = await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Q.id, price: 8_200_000 }] });
  assert.equal((await sales.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Nhập nhầm khách hàng" }, K())).status, 403);
  await ownerSql("UPDATE public.auth_sessions SET reauth_at = NULL WHERE user_id=$1", [userOf("owner").id]);
  assert.equal((await owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Nhập nhầm khách hàng" }, K())).body.code, "WF-SEC-REAUTH");
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "ngắn" }, K())).status, 422);
  const v = await owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Nhập nhầm khách hàng" }, K());
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal((await ownerSql("SELECT status FROM public.watch_units WHERE id=$1", [Q.id]))[0].status, "in_stock");
  const [w] = await ownerSql("SELECT w.status FROM public.warranties w JOIN public.sale_lines sl ON sl.id=w.sale_line_id WHERE sl.sale_id=$1", [d.body.id]);
  assert.equal(w.status, "voided");
  assert.equal((await sales.get(`/api/v1/sales/${d.body.id}`)).body.status, "voided");
  assert.equal((await owner.post(`/api/v1/sales/${d.body.id}/void`, { reason: "Hủy lần hai thử xem" }, K())).body.code, "WF-DOC-NOT-DRAFT");
  // ghi lại chiếc Q rồi cho quá 25 giờ ⇒ hết hạn hủy
  const d2 = await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: Q.id, price: 8_500_000 }] });
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: process.env.TEST_OWNER_DB_URL });
  await c.connect();
  try { await c.query("SELECT set_config('app.in_fn','on',false)"); await c.query("UPDATE public.sales SET confirmed_at = now() - interval '25 hours' WHERE id = $1", [d2.body.id]); } finally { await c.end(); }
  await reauth(owner);
  assert.equal((await owner.post(`/api/v1/sales/${d2.body.id}/void`, { reason: "Hủy muộn quá hạn" }, K())).body.code, "WF-SALE-VOID-EXPIRED");
});

test("SC-19 bước 4: in phiếu — lần 1 thường, lần 2 là bản in lại (có audit)", async () => {
  const P = await makeUnit(2_000_000);
  const d = await record(sales, { customerId: KH["Nguyễn Văn An"], lines: [{ unitId: P.id, price: 2_000_000 }] });
  const p1 = await sales.post(`/api/v1/sales/${d.body.id}/print`, {});
  const p2 = await sales.post(`/api/v1/sales/${d.body.id}/print`, {});
  assert.equal(p1.status, 200, JSON.stringify(p1.body));
  assert.equal(p1.body.reprint, false);
  assert.equal(p2.body.reprint, true);
});

test("bất biến sau ghi đơn: I4 (sold ⇔ đúng 1 dòng hiệu lực), I8 (dòng hiệu lực có giá vốn chốt nội bộ); fn_consistency_check sạch", async () => {
  assert.deepEqual(await ownerSql(`SELECT u.id FROM public.watch_units u WHERE (u.status='sold') <> (1 = (SELECT count(*) FROM public.sale_lines sl JOIN public.sales s ON s.id = sl.sale_id
    WHERE sl.unit_id = u.id AND sl.is_effective AND s.status='confirmed')) AND u.status IN ('sold','in_stock')`), []);
  assert.deepEqual(await ownerSql("SELECT sl.id FROM public.sale_lines sl JOIN public.sales s ON s.id=sl.sale_id WHERE s.status='confirmed' AND sl.is_effective AND NOT EXISTS (SELECT 1 FROM public.sale_line_costs c WHERE c.sale_line_id = sl.id)"), []);
  assert.deepEqual(await ownerSql("SELECT * FROM app.fn_consistency_check()"), []);
});
