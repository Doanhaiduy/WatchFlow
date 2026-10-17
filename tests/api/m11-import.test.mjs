// M11 — Nhập Excel hàng loạt (FR-IMP-01…04): xem trước không ghi gì; khách (trùng SĐT, CCCD mã hóa, savepoint); đồng hồ qua MỘT phiếu opening
// đã xác nhận (giá vốn/kho/serial); linh kiện; phân quyền (PT); giới hạn 300 dòng; thân yêu cầu sai ⇒ 422; Idempotency-Key; tệp mẫu .xlsx.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client, login, ownerSql } from "./_lib.mjs";

const K = () => ({ "Idempotency-Key": crypto.randomUUID() });
let owner, sales, wh, ctv;
test("chuẩn bị", async () => {
  [owner, sales, wh, ctv] = await Promise.all([login("owner"), login("sales"), login("warehouse"), login("collaborator")]);
});
const R = (line, cells) => ({ line, cells });
const count = async (sql, p) => (await ownerSql(sql, p))[0].n;

test("khách: xem trước KHÔNG ghi gì; báo trùng SĐT (có sẵn/trong tệp), lỗi từng dòng", async () => {
  const before = await count("SELECT count(*)::int n FROM public.customers");
  const rows = [
    R(2, { fullName: "Phạm Nhập Một", phone: "0907 111 001", email: "Mot@Example.com", group: "khach quen", idNumber: "079099112233" }),
    R(3, { fullName: "Trùng Số Có Sẵn", phone: "+84 901 000 002" }), // trùng Trần Thị Bình (seed)
    R(4, { fullName: "Phạm Nhập Hai", phone: "907111001" }), // trùng dòng 2 trong tệp (thiếu số 0 đầu)
    R(5, { fullName: "", phone: "0907111002" }), // thiếu tên
    R(6, { fullName: "SĐT Hỏng", phone: "12345" }), // SĐT không hợp lệ
    R(7, { fullName: "Nhóm Lạ", phone: "0907111003", group: "Nhóm không tồn tại" }), // cảnh báo
  ];
  const r = await sales.post("/api/v1/import/customers/preview", { rows });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const by = Object.fromEntries(r.body.rows.map((x) => [x.line, x]));
  assert.equal(by[2].status, "ok");
  assert.equal(by[3].status, "duplicate");
  assert.match(by[3].messages.join(" "), /Trần Thị Bình/);
  assert.equal(by[4].status, "duplicate");
  assert.match(by[4].messages.join(" "), /dòng 2/);
  assert.equal(by[5].status, "error");
  assert.equal(by[6].status, "error");
  assert.equal(by[7].status, "warning");
  assert.deepEqual([by[2].include, by[3].include, by[4].include, by[5].include, by[7].include], [true, false, false, false, true]);
  assert.deepEqual(r.body.counts, { ok: 1, warning: 1, error: 2, duplicate: 2 });
  assert.ok(!JSON.stringify(r.body).includes("079099112233"), "không lặp lại CCCD");
  assert.equal(await count("SELECT count(*)::int n FROM public.customers"), before, "xem trước không ghi");
});

test("khách: nhập 3 dòng có 1 trùng SĐT ⇒ tạo 2; CCCD mã hóa; audit tổng hợp; cùng Idempotency-Key không tạo lại", async () => {
  const rows = [
    R(2, { fullName: "Khách Nhập A", phone: "0907 222 001", email: "A@Example.com", address: "1 Đường Giả", group: "Khách quen", note: "nhập thử", idNumber: "079011223344" }),
    R(3, { fullName: "Khách Trùng Bình", phone: "0901 000 002" }),
    R(4, { fullName: "Khách Nhập B", phone: "907222002" }),
  ];
  const before = await count("SELECT count(*)::int n FROM public.customers");
  const key = K();
  const r = await sales.post("/api/v1/import/customers/commit", { rows }, key);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.items.length, 2);
  assert.equal(r.body.skipped, 1);
  assert.deepEqual(r.body.items.map((x) => x.line), [2, 4]);
  assert.equal(await count("SELECT count(*)::int n FROM public.customers"), before + 2);
  const [a] = await ownerSql("SELECT full_name, phone, email, group_id, id_number_enc, id_number_bidx, id_number_last3, created_by FROM public.customers WHERE id=$1", [r.body.items[0].id]);
  assert.equal(a.phone, "0907222001");
  assert.equal(a.email, "a@example.com");
  assert.ok(a.group_id);
  assert.match(a.id_number_enc, /^v1:/, "CCCD mã hóa AES-GCM");
  assert.ok(!a.id_number_enc.includes("079011223344"));
  assert.equal(a.id_number_last3, "344");
  const [b] = await ownerSql("SELECT phone FROM public.customers WHERE id=$1", [r.body.items[1].id]);
  assert.equal(b.phone, "0907222002", "thiếu số 0 đầu được thêm lại");
  const au = await ownerSql("SELECT after::text AS a FROM public.audit_logs WHERE action='import.customers' ORDER BY at DESC LIMIT 1");
  assert.ok(au[0] && !au[0].a.includes("0907222001") && !au[0].a.includes("079011223344"), "audit tổng hợp không chứa PII");
  const again = await sales.post("/api/v1/import/customers/commit", { rows }, key);
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.items.map((x) => x.id), r.body.items.map((x) => x.id), "cùng khóa ⇒ cùng kết quả");
  assert.equal(await count("SELECT count(*)::int n FROM public.customers"), before + 2, "không tạo thêm");
  assert.equal((await sales.post("/api/v1/import/customers/commit", { rows }, undefined)).status, 428, "thiếu Idempotency-Key");
  // Dòng trùng + người dùng chọn nhập vẫn (include)
  const forced = await sales.post("/api/v1/import/customers/commit", { rows: [rows[1]], include: [3] }, K());
  assert.equal(forced.status, 200);
  assert.equal(forced.body.items.length, 1);
});

const WROW = (line, o) => R(line, { brand: "Seiko", model: "SEIKO-5-SRPD55", condition: "Mới", cost: "6.500.000", listPrice: "8300000", location: "Tủ trưng bày 1", ...o });

test("đồng hồ: xem trước báo lỗi từng dòng, không ghi gì", async () => {
  const [pr, un] = [await count("SELECT count(*)::int n FROM public.purchase_receipts"), await count("SELECT count(*)::int n FROM public.watch_units")];
  const rows = [
    WROW(2, { serial: "IMP-0001" }),
    WROW(3, { serial: "S5D-100001" }), // trùng serial trong kho (cùng hãng)
    WROW(4, { serial: "imp 0001" }), // trùng dòng 2 trong tệp (chuẩn hóa)
    WROW(5, { serial: "IMP-0005", model: "Loại không có" }),
    WROW(6, { serial: "IMP-0006", cost: "-100" }),
    WROW(7, { serial: "IMP-0007", cost: "6500000.5" }),
    WROW(8, { serial: "IMP-0008", cost: "" }),
    WROW(9, { serial: "IMP-0009", condition: "" }),
    WROW(10, { serial: "IMP-0010", location: "Kho ma" }),
    WROW(11, { serial: "IMP-0011", condition: "Cũ", grade: "B" }),
    WROW(12, { serial: "IMP-0012", grade: "Z" }),
  ];
  const r = await wh.post("/api/v1/import/watches/preview", { rows });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const by = Object.fromEntries(r.body.rows.map((x) => [x.line, x]));
  assert.equal(by[2].status, "ok");
  assert.equal(by[3].status, "error");
  assert.match(by[3].messages.join(" "), /đã có trong kho/);
  assert.equal(by[4].status, "error");
  assert.match(by[4].messages.join(" "), /dòng 2/);
  assert.match(by[5].messages.join(" "), /Chưa có loại “Loại không có”.*Loại & hãng/);
  assert.match(by[6].messages.join(" "), /âm/);
  assert.match(by[7].messages.join(" "), /số nguyên/);
  assert.match(by[8].messages.join(" "), /Thiếu giá vốn/);
  assert.match(by[9].messages.join(" "), /Thiếu tình trạng/);
  assert.match(by[10].messages.join(" "), /vị trí kho/);
  assert.equal(by[11].status, "ok");
  assert.equal(by[12].status, "error");
  assert.ok(r.body.notices.some((n) => /Chờ kiểm tra/.test(n)));
  // giá vốn không bị nhắc lại cho người không được xem — xem trước chỉ phản chiếu đúng dữ liệu người dùng vừa gửi
  assert.equal(await count("SELECT count(*)::int n FROM public.purchase_receipts"), pr);
  assert.equal(await count("SELECT count(*)::int n FROM public.watch_units"), un);
});

test("đồng hồ: nhập ⇒ đúng MỘT phiếu opening đã xác nhận, giá vốn khớp, hàng cũ Chờ kiểm tra, kho tăng; serial trùng bị chặn", async () => {
  const stockBefore = await count("SELECT count(*)::int n FROM public.watch_units");
  const rcptBefore = await count("SELECT count(*)::int n FROM public.purchase_receipts WHERE kind='opening'");
  const rows = [
    WROW(2, { serial: "IMP-1001", cost: "6.500.000" }),
    WROW(3, { serial: "IMP-1002", model: "Casio MTP-V001L", brand: "", condition: "Cũ", grade: "95%", cost: "900000", listPrice: "", location: "" }),
    WROW(4, { serial: "S5D-100001" }), // lỗi: trùng — bị loại, các dòng khác vẫn nhập
    WROW(5, { serial: "", model: "orient bambino version 2", brand: "Orient", condition: "Đã sửa", cost: "2.000.000" }),
  ];
  const lock = await ownerSql("SELECT id FROM public.storage_locations WHERE name='Két'");
  const r = await wh.post("/api/v1/import/watches/commit", { rows, options: { defaultLocationId: lock[0].id } }, K());
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.items.length, 3);
  assert.equal(r.body.skipped, 1);
  assert.ok(r.body.receipt.code);
  assert.equal(await count("SELECT count(*)::int n FROM public.purchase_receipts WHERE kind='opening'"), rcptBefore + 1, "đúng một phiếu");
  const [rc] = await ownerSql("SELECT status, kind, subtotal_vnd, grand_total_vnd, (SELECT count(*)::int FROM public.purchase_lines WHERE receipt_id=r.id) AS lines FROM public.purchase_receipts r WHERE id=$1", [r.body.receipt.id]);
  assert.deepEqual([rc.status, rc.kind, rc.subtotal_vnd, rc.grand_total_vnd, rc.lines], ["confirmed", "opening", 9_400_000, 9_400_000, 3]);
  assert.equal(await count("SELECT count(*)::int n FROM public.watch_units"), stockBefore + 3);
  const units = await ownerSql(
    `SELECT u.serial_no, u.status, u.condition, u.condition_grade, u.list_price_vnd, l.name AS loc, (SELECT cost_vnd FROM public.v_unit_costs c WHERE c.unit_id=u.id) AS cost
     FROM public.watch_units u JOIN public.storage_locations l ON l.id=u.location_id WHERE u.id = ANY($1::uuid[]) ORDER BY u.asset_code`, [r.body.items.map((x) => x.id)]);
  const bySerial = Object.fromEntries(units.map((u) => [u.serial_no ?? "(none)", u]));
  assert.deepEqual([bySerial["IMP-1001"].status, bySerial["IMP-1001"].cost, bySerial["IMP-1001"].list_price_vnd, bySerial["IMP-1001"].loc], ["in_stock", 6_500_000, 8_300_000, "Tủ trưng bày 1"]);
  assert.deepEqual([bySerial["IMP-1002"].status, bySerial["IMP-1002"].condition_grade, bySerial["IMP-1002"].cost, bySerial["IMP-1002"].loc], ["inspecting", "95%", 900_000, "Két"]);
  assert.deepEqual([bySerial["(none)"].status, bySerial["(none)"].cost], ["inspecting", 2_000_000]);
  // Chặn serial trùng khi nhập lại đúng tệp (mọi dòng đều lỗi) ⇒ 422, không tạo phiếu
  const dup = await wh.post("/api/v1/import/watches/commit", { rows: [rows[0], rows[1]] }, K());
  assert.equal(dup.status, 422, JSON.stringify(dup.body));
  assert.equal(await count("SELECT count(*)::int n FROM public.purchase_receipts WHERE kind='opening'"), rcptBefore + 1);
  // Đua: serial vừa bị người khác nhập sau khi xem trước ⇒ lỗi rõ, cả lô hoàn tác (không phiếu nửa vời)
  const racing = await Promise.all([1, 2].map((i) => wh.post("/api/v1/import/watches/commit", { rows: [WROW(2, { serial: "IMP-RACE-1" }), WROW(3, { serial: `IMP-RACE-${i + 1}` })] }, K())));
  const okN = racing.filter((x) => x.status === 200).length;
  assert.ok(okN >= 1, JSON.stringify(racing.map((x) => x.body)));
  assert.equal(await count("SELECT count(*)::int n FROM public.watch_units WHERE serial_no='IMP-RACE-1'"), 1, "serial không bao giờ trùng");
});

test("đồng hồ: tự tạo loại mới (tùy chọn): một loại dùng chung, tạo hãng mới", async () => {
  const rows = [WROW(2, { brand: "Hãng Thử Nhập", model: "Thử Nhập 01", serial: "NEWM-1" }), WROW(3, { brand: "Hãng Thử Nhập", model: "thu nhap 01", serial: "NEWM-2" })];
  const noOpt = await owner.post("/api/v1/import/watches/preview", { rows });
  assert.equal(noOpt.body.counts.error, 2);
  const withOpt = await owner.post("/api/v1/import/watches/preview", { rows, options: { createMissingModels: true } });
  assert.equal(withOpt.body.counts.warning, 2, JSON.stringify(withOpt.body));
  const brandsBefore = await count("SELECT count(*)::int n FROM public.brands");
  const c = await owner.post("/api/v1/import/watches/commit", { rows, options: { createMissingModels: true } }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.items.length, 2);
  assert.equal(await count("SELECT count(*)::int n FROM public.brands"), brandsBefore + 1);
  assert.equal(await count("SELECT count(*)::int n FROM public.watch_models WHERE name='Thử Nhập 01'"), 1, "một loại dùng chung cho 2 dòng");
  // thiếu cột Hãng ⇒ không tự tạo được loại
  const noBrand = await owner.post("/api/v1/import/watches/preview", { rows: [WROW(2, { brand: "", model: "Loại X Mới", serial: "NEWM-9" })], options: { createMissingModels: true } });
  assert.equal(noBrand.body.counts.error, 1);
  assert.match(noBrand.body.rows[0].messages.join(" "), /ghi cột Hãng/);
});

test("linh kiện: tạo mới + cộng tồn qua phiếu opening; mã có sẵn báo trùng", async () => {
  // Mã "có sẵn" do chính test tạo (không đụng linh kiện seed — các bộ test sau dựa vào giá vốn bình quân seed)
  const pre = await wh.post("/api/v1/import/parts/commit", { rows: [R(2, { code: "IMP-EXIST-1", name: "Có sẵn", category: "Dây", qty: "10", cost: "80000" })] }, K());
  assert.equal(pre.status, 200, JSON.stringify(pre.body));
  const rows = [
    R(2, { code: "IMP-PIN-01", name: "Pin nhập thử", category: "Dây", uom: "viên", qty: "20", cost: "15.000", reorder: "5", salePrice: "40000" }),
    R(3, { code: "imp-exist-1", name: "Có sẵn", category: "Dây", qty: "5", cost: "100000" }), // trùng mã có sẵn
    R(4, { code: "IMP-PIN-02", name: "Chỉ tạo", category: "Dây", qty: "0" }),
    R(5, { code: "IMP-PIN-03", name: "Danh mục lạ", category: "Không có", qty: "1", cost: "1000" }),
    R(6, { code: "IMP-PIN-04", name: "Thiếu giá", category: "Dây", qty: "3" }),
    R(7, { code: "imp-pin-01", name: "Trùng trong tệp", category: "Dây", qty: "1", cost: "1000" }),
  ];
  const p = await wh.post("/api/v1/import/parts/preview", { rows });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const by = Object.fromEntries(p.body.rows.map((x) => [x.line, x]));
  assert.deepEqual([by[2].status, by[3].status, by[4].status, by[5].status, by[6].status, by[7].status], ["ok", "duplicate", "ok", "error", "error", "error"]);
  const [lk1] = await ownerSql("SELECT qty_on_hand q FROM public.parts WHERE code='IMP-EXIST-1'");
  const c = await wh.post("/api/v1/import/parts/commit", { rows }, K());
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.items.length, 2);
  assert.ok(c.body.receipt.code);
  const [pin] = await ownerSql("SELECT p.qty_on_hand q, p.reorder_level r, p.sale_price_vnd s, (SELECT avg_cost::text FROM public.part_costs WHERE part_id=p.id) a FROM public.parts p WHERE code='IMP-PIN-01'");
  assert.deepEqual([pin.q, pin.r, pin.s, pin.a], [20, 5, 40000, "15000.0000"]);
  assert.equal((await ownerSql("SELECT qty_on_hand q FROM public.parts WHERE code='IMP-EXIST-1'"))[0].q, lk1.q, "mã trùng mặc định bỏ qua");
  assert.equal(await count("SELECT count(*)::int n FROM public.parts WHERE code='IMP-PIN-02'"), 1);
  // Cộng tồn vào mã có sẵn khi người dùng chọn
  const add = await wh.post("/api/v1/import/parts/commit", { rows: [rows[1]], include: [3] }, K());
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.equal((await ownerSql("SELECT qty_on_hand q FROM public.parts WHERE code='IMP-EXIST-1'"))[0].q, lk1.q + 5);
  // Kiểm tra toàn vẹn: số tồn = tổng movements
  const [x] = await ownerSql("SELECT p.qty_on_hand q, (SELECT sum(qty_delta) FROM public.part_stock_movements m WHERE m.part_id=p.id)::int s FROM public.parts p WHERE code='IMP-EXIST-1'");
  assert.equal(x.q, x.s);
});

test("phân quyền: thiếu quyền ⇒ 403; CTV không nhập được gì; giới hạn 300 dòng; thân sai ⇒ 422; loại lạ ⇒ 404", async () => {
  const one = [R(2, { fullName: "X", phone: "0907333001" })];
  assert.equal((await wh.post("/api/v1/import/customers/preview", { rows: one })).status, 403, "kho không có customer.create");
  assert.equal((await wh.post("/api/v1/import/customers/commit", { rows: one }, K())).status, 403);
  assert.equal((await sales.post("/api/v1/import/watches/preview", { rows: [WROW(2, {})] })).status, 403, "bán hàng không có purchase.create");
  assert.equal((await sales.post("/api/v1/import/parts/commit", { rows: [R(2, { code: "A" })] }, K())).status, 403);
  for (const k of ["watches", "parts"]) {
    assert.equal((await ctv.post(`/api/v1/import/${k}/preview`, { rows: one })).status, 403, `CTV ${k}`);
    assert.equal((await ctv.get(`/api/v1/import/${k}/template`)).status, 403, `CTV mẫu ${k}`);
  }
  assert.equal((await wh.get("/api/v1/import/customers/template")).status, 403);
  assert.equal((await sales.get("/api/v1/import/watches/template")).status, 403);
  assert.equal((await owner.post("/api/v1/import/khong-co/preview", { rows: one })).status, 404);
  const many = Array.from({ length: 301 }, (_, i) => R(i + 2, { fullName: `Khách ${i}`, phone: `09073${String(10000 + i).slice(-5)}` }));
  const big = await owner.post("/api/v1/import/customers/preview", { rows: many });
  assert.equal(big.status, 422);
  assert.match(big.body.detail + JSON.stringify(big.body.errors), /300/);
  assert.equal((await owner.post("/api/v1/import/customers/commit", { rows: many }, K())).status, 422);
  const ok300 = await owner.post("/api/v1/import/customers/preview", { rows: many.slice(0, 300) });
  assert.equal(ok300.status, 200);
  assert.equal(ok300.body.total, 300);
  assert.equal((await owner.post("/api/v1/import/customers/preview", { rows: [] })).status, 422);
  assert.equal((await owner.post("/api/v1/import/customers/preview", { rows: "x" })).status, 422);
  assert.equal((await owner.post("/api/v1/import/customers/preview", { rows: [{ line: 0, cells: {} }] })).status, 422);
  assert.equal((await owner.post("/api/v1/import/customers/preview", { rows: [{ line: 2, cells: { fullName: 5 } }] })).status, 422);
  assert.equal((await owner.post("/api/v1/import/customers/preview", { rows: [{ line: 2, cells: { fullName: "x".repeat(2001) } }] })).status, 422);
  // Chưa đăng nhập
  assert.equal((await new Client().post("/api/v1/import/customers/preview", { rows: one })).status, 403, "không cookie ⇒ chặn (CSRF/đăng nhập)");
});

test("tệp mẫu .xlsx: tải được theo quyền, là zip hợp lệ, có đủ sheet", async () => {
  for (const [c, k] of [[sales, "customers"], [wh, "watches"], [wh, "parts"], [owner, "watches"]]) {
    const res = await fetch(`${process.env.TEST_BASE_URL}/api/v1/import/${k}/template`, { headers: { Cookie: c.cookieHeader() } });
    assert.equal(res.status, 200, k);
    assert.match(res.headers.get("content-type"), /spreadsheetml/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString("hex"), "504b0304", "magic bytes ZIP");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    assert.deepEqual(wb.worksheets.map((w) => w.name), ["Dữ liệu", "Hướng dẫn", "Danh mục"]);
    const ws = wb.getWorksheet("Dữ liệu");
    assert.ok(ws.getRow(1).getCell(1).value);
    assert.ok(ws.getRow(2).values.some((v) => String(v).startsWith("[VÍ DỤ]")), "dòng ví dụ có đánh dấu để bị bỏ qua khi đọc");
  }
});
