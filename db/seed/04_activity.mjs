// Seed demo hoạt động (dữ liệu giả, chỉ local/staging): bán hàng, giữ hàng + cọc, giao hàng CTV (đơn đã/chưa quyết toán), sửa chữa.
// Mọi thao tác đi qua hàm nghiệp vụ thật (app.fn_*) dưới đúng người dùng demo ⇒ kho, thanh toán, giá vốn, bảo hành, audit nhất quán.
// Chạy lại không nhân đôi: bỏ qua nếu đã có phiếu bán.
const ONE = async (c, sql, params) => (await c.query(sql, params)).rows[0];

export default async function (c, ctx) {
  if ((await ONE(c, "SELECT count(*)::int n FROM public.sales")).n > 0) return;
  const user = (role, email) => ctx.accounts.users.find((u) => u.role === role && (!email || u.email === email)).id;
  const as = (id) => c.query("SELECT set_config('app.current_user_id',$1,true)", [id]);
  const owner = user("owner"), sales = user("sales");
  const ctv = user("collaborator", "ctv@watchflow.local"), ctv2 = user("collaborator", "ctv2@watchflow.local");
  const unit = async (serial) => (await ONE(c, "SELECT id FROM public.watch_units WHERE serial_no = $1", [serial])).id;
  const part = async (code) => (await ONE(c, "SELECT id FROM public.parts WHERE upper(code) = $1", [code])).id;
  const cust = async (phone) => (await ONE(c, "SELECT id FROM public.customers WHERE phone = $1", [phone])).id;
  const svc = async (code) => (await ONE(c, "SELECT id FROM public.service_types WHERE code = $1", [code])).id;
  const plusDays = async (n) => (await ONE(c, "SELECT (app.today_vn() + $1::int)::text d", [n])).d;

  const an = await cust("0901000001"), binh = await cust("0901000002"), cuong = await cust("0912345678"), dung = await cust("0987654321");

  // Phiếu bán nháp rồi xác nhận (đúng như API: INSERT đầu + dòng, rồi app.fn_confirm_sale)
  const draftSale = async ({ customer, lines, dueDate = null, orderDiscount = 0, collaborator = null, note = null }) => {
    const s = await ONE(c, `INSERT INTO public.sales (customer_id, due_date, order_discount_vnd, collaborator_id, note, created_by)
      VALUES ($1,$2,$3,$4,$5, app.current_user_id()) RETURNING id`, [customer, dueDate, orderDiscount, collaborator, note]);
    let no = 0;
    for (const l of lines) {
      if (l.unitId) await c.query("INSERT INTO public.sale_lines (sale_id, line_no, line_type, unit_id, qty, unit_price_vnd) VALUES ($1,$2,'watch',$3,1,$4)", [s.id, ++no, l.unitId, l.price]);
      else await c.query("INSERT INTO public.sale_lines (sale_id, line_no, line_type, part_id, qty, unit_price_vnd) VALUES ($1,$2,'part',$3,$4,$5)", [s.id, ++no, l.partId, l.qty, l.price]);
    }
    return s.id;
  };
  const confirmSale = async (id, payments = [], tendered = null) =>
    (await ONE(c, "SELECT app.fn_confirm_sale($1,$2::jsonb,$3) r", [id, JSON.stringify(payments), tendered])).r;

  // ── 1. Bán lẻ trả đủ tiền mặt (sinh phiếu bảo hành) — nhân viên bán hàng
  await as(sales);
  const s1 = await confirmSale(await draftSale({ customer: an, lines: [{ unitId: await unit("CMT-220011"), price: 1_200_000 }] }),
    [{ method: "cash", amount: 1_200_000 }], 1_200_000);
  ctx.log?.(`  bán ${s1.code}: Casio MTP-V001L, 1.200.000 đ tiền mặt`);

  // ── 2. Bán cho đại lý, giảm nhẹ + kèm dây da, trả trước một phần, hẹn trả nốt (công nợ)
  const s2 = await confirmSale(await draftSale({
    customer: dung, dueDate: await plusDays(14), note: "Đại lý lấy 1 chiếc, hẹn trả nốt sau 2 tuần",
    lines: [{ unitId: await unit("S5D-100001"), price: 8_000_000 }, { partId: await part("LK-0001"), qty: 1, price: 150_000 }],
  }), [{ method: "bank_transfer", amount: 5_000_000 }]);
  ctx.log?.(`  bán ${s2.code}: Seiko 5 SRPD55 + dây da, trả trước 5.000.000 đ, còn nợ`);

  // ── 3. Giữ hàng có cọc
  const rsv = (await ONE(c, "SELECT app.fn_create_reservation($1,$2,$3::date,$4,$5,$6,$7) r",
    [await unit("TPX-990001"), binh, await plusDays(7), "cash", 2_500_000, "Khách hẹn cuối tuần quay lại lấy", 2_500_000])).r;
  ctx.log?.(`  giữ hàng ${rsv.code ?? ""}: Tissot PRX, cọc 2.500.000 đ`);

  // ── 4. Cộng tác viên: chủ giao hàng kèm giá thu
  await as(owner);
  const assign = async (collab, rows) => {
    const a = await ONE(c, "INSERT INTO public.collaborator_assignments (collaborator_id, doc_date, note, created_by) VALUES ($1, app.today_vn(), $2, app.current_user_id()) RETURNING id",
      [collab, "Giao hàng demo"]);
    let no = 0;
    for (const [serial, base] of rows) {
      await c.query("INSERT INTO public.collaborator_assignment_lines (assignment_id, line_no, unit_id, base_price_vnd) VALUES ($1,$2,$3,$4)", [a.id, ++no, await unit(serial), base]);
    }
    return (await ONE(c, "SELECT app.fn_confirm_assignment($1) r", [a.id])).r;
  };
  const g1 = await assign(ctv, [["ORB-778899", 3_700_000], ["CTZ-551200", 4_300_000], ["S5D-100002", 6_500_000]]);
  const g2 = await assign(ctv2, [["CLT-130201", 700_000]]);
  ctx.log?.(`  giao CTV: ${g1.code} (3 chiếc cho CTV 1), ${g2.code} (1 chiếc cho CTV 2)`);

  // CTV tạo đơn từ hàng đang giữ → nhân viên bán hàng xác nhận (đơn CTV không thu tiền ở cửa hàng)
  const collabOrder = async (collab, customer, serial, price) => {
    await as(collab);
    const id = await draftSale({ customer, collaborator: collab, lines: [{ unitId: await unit(serial), price }] });
    await c.query("SELECT app.fn_emit_event('collab.order_submitted', $1::jsonb)", [JSON.stringify({ saleId: id })]);
    await as(sales);
    return confirmSale(id, []);
  };
  const c1 = await collabOrder(ctv, cuong, "ORB-778899", 4_900_000);
  const c2 = await collabOrder(ctv, an, "CTZ-551200", 5_300_000);
  ctx.log?.(`  đơn CTV ${c1.code} (Orient, hưởng 1.200.000 đ) và ${c2.code} (Citizen, hưởng 1.000.000 đ)`);

  // Quyết toán đơn thứ nhất (CTV nộp giá thu); đơn thứ hai để CHƯA quyết toán cho bạn thử
  await as(owner);
  const line = await ONE(c, "SELECT sl.id FROM public.sale_lines sl WHERE sl.sale_id = $1", [c1.id]);
  const st = (await ONE(c, "SELECT app.fn_settle_collaborator($1,$2::uuid[],$3,NULL,$4) r", [ctv, [line.id], "cash", "Quyết toán demo"])).r;
  ctx.log?.(`  quyết toán CTV 1: ${st.code ?? "ok"} (đơn ${c2.code} còn chờ quyết toán)`);

  // ── 5. Sửa chữa (chỉ chủ): một phiếu đã giao thu đủ, một phiếu đang chờ báo giá, một phiếu bảo hành miễn phí
  const repair = async (p) => (await ONE(c, "SELECT app.fn_create_repair($1::jsonb) r", [JSON.stringify(p)])).r;
  const addLine = async (order, row) => (await ONE(c,
    `INSERT INTO public.repair_lines (order_id, line_no, line_type, service_type_id, part_id, description, qty, unit_price_vnd)
     VALUES ($1, (SELECT coalesce(max(line_no),0)+1 FROM public.repair_lines WHERE order_id=$1), $2,$3,$4,$5,$6,$7) RETURNING id`,
    [order, row.type, row.serviceTypeId ?? null, row.partId ?? null, row.description ?? null, row.qty ?? 1, row.price])).id;

  const r1 = await repair({ kind: "customer", chargeMode: "paid", customerId: an, brandText: "Casio", modelText: "Edifice EF-539D", serialNo: "EF539-55012",
    complaint: "Hết pin, dây da bung khoen", intakeCondition: "Xước nhẹ mặt kính", expectedDate: await plusDays(2), deposit: { amount: 100_000, method: "cash" } });
  await addLine(r1.id, { type: "service", serviceTypeId: await svc("thay_pin"), price: 100_000 });
  await addLine(r1.id, { type: "service", serviceTypeId: await svc("bao_duong"), price: 300_000 });
  const partLine = await addLine(r1.id, { type: "part", partId: await part("LK-0001"), price: 150_000 });
  await c.query("SELECT app.fn_approve_quote($1,$2)", [r1.id, "Zalo"]);
  await c.query("SELECT app.fn_set_repair_status($1,'repairing',NULL)", [r1.id]);
  await c.query("SELECT app.fn_use_repair_part($1)", [partLine]);
  await c.query("SELECT app.fn_complete_repair($1)", [r1.id]);
  await c.query("SELECT app.fn_deliver_repair($1,$2::jsonb,NULL)", [r1.id, JSON.stringify([{ method: "cash", amount: 450_000 }])]);
  ctx.log?.(`  sửa ${r1.code}: đã giao, tổng 550.000 đ (cọc 100.000 + thu 450.000), có bảo hành sửa chữa`);

  const r2 = await repair({ kind: "customer", chargeMode: "paid", customerId: binh, brandText: "Orient", modelText: "Bambino Gen 2", serialNo: "FAC-3321",
    complaint: "Kính xước nặng, muốn thay kính", intakeCondition: "Vỏ có vài vết xước", expectedDate: await plusDays(5) });
  await addLine(r2.id, { type: "service", serviceTypeId: await svc("thay_kinh"), price: 250_000 });
  await addLine(r2.id, { type: "part", partId: await part("LK-0002"), price: 450_000 });
  await c.query("SELECT app.fn_set_repair_status($1,'inspecting',NULL)", [r2.id]);
  ctx.log?.(`  sửa ${r2.code}: đang kiểm tra, chờ khách duyệt báo giá 700.000 đ`);

  const war = await ONE(c, "SELECT id FROM public.warranties WHERE kind <> 'repair' ORDER BY created_at LIMIT 1");
  if (war) {
    const r3 = await repair({ kind: "customer", chargeMode: "warranty_free", warrantyId: war.id, complaint: "Chạy sai giờ sau khi mua", intakeCondition: "Máy còn nguyên tem bảo hành" });
    ctx.log?.(`  sửa ${r3.code}: nhận máy bảo hành miễn phí`);
  }
}
