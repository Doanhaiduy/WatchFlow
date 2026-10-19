// Seed demo hoạt động (dữ liệu giả, chỉ local/staging): ghi đơn bán, giao hàng cho nhiều CTV (một báo bán đã xác nhận, một đang chờ), sửa chữa.
// Mọi thao tác đi qua hàm nghiệp vụ thật (app.fn_*) dưới đúng người dùng demo ⇒ kho, bảo hành, giá vốn nội bộ, audit nhất quán.
// Chạy lại không nhân đôi: bỏ qua nếu đã có đơn bán.
const ONE = async (c, sql, params) => (await c.query(sql, params)).rows[0];

export default async function (c, ctx) {
  if ((await ONE(c, "SELECT count(*)::int n FROM public.sales")).n > 0) return;
  const user = (role, email) => ctx.accounts.users.find((u) => u.role === role && (!email || u.email === email)).id;
  const as = (id) => c.query("SELECT set_config('app.current_user_id',$1,true)", [id]);
  const owner = user("owner"), sales = user("sales");
  const ctv = user("collaborator", "ctv@watchflow.local"), ctv2 = user("collaborator", "ctv2@watchflow.local");
  const unit = async (serial) => (await ONE(c, "SELECT id FROM public.watch_units WHERE serial_no = $1", [serial])).id;
  const cust = async (phone) => (await ONE(c, "SELECT id FROM public.customers WHERE phone = $1", [phone])).id;
  const svc = async (code) => (await ONE(c, "SELECT id FROM public.service_types WHERE code = $1", [code])).id;
  const plusDays = async (n) => (await ONE(c, "SELECT (app.today_vn() + $1::int)::text d", [n])).d;

  const an = await cust("0901000001"), dung = await cust("0987654321"), binh = await cust("0901000002");

  // CTV phải có hồ sơ hoạt động để được giao hàng
  for (const [id, phone, area] of [[ctv, "0903000001", "Quận 1"], [ctv2, "0903000002", "Thủ Đức"]]) {
    await c.query(
      `INSERT INTO public.collaborator_profiles (user_id, phone, area, is_active) VALUES ($1,$2,$3,true)
       ON CONFLICT (user_id) DO UPDATE SET is_active = true`, [id, phone, area]);
  }

  // ── 1. Ghi đơn bán gọn — nhân viên bán hàng: chiếc + khách + giá + ngày (bảo hành tự tính theo tình trạng)
  await as(sales);
  const record = async (customer, lines, note = null) =>
    (await ONE(c, "SELECT app.fn_record_sale($1,NULL,$2::jsonb,$3,NULL) r", [customer, JSON.stringify(lines), note])).r;
  const s1 = await record(an, [{ unitId: await unit("CMT-220011"), price: 1_200_000 }]);
  ctx.log?.(`  đơn ${s1.code}: Casio MTP-V001L, 1.200.000 đ`);
  const s2 = await record(dung, [{ unitId: await unit("S5D-100001"), price: 8_000_000, warrantyMonths: 24 }], "Đại lý lấy 1 chiếc, bảo hành 24 tháng");
  ctx.log?.(`  đơn ${s2.code}: Seiko 5 SRPD55, 8.000.000 đ, bảo hành 24 tháng`);

  // ── 2. Chủ giao đồng hồ cho nhiều CTV — ai báo bán trước được giữ
  await as(owner);
  const offer = async (serials, collabs) =>
    (await ONE(c, "SELECT app.fn_offer_units($1::uuid[],$2::uuid[],$3) r", [await Promise.all(serials.map(unit)), collabs, "Giao hàng demo"])).r;
  await offer(["ORB-778899", "CTZ-551200"], [ctv, ctv2]); // cả hai CTV cùng được bán 2 chiếc này
  await offer(["S5D-100002"], [ctv]);
  await offer(["CLT-130201"], [ctv2]);
  ctx.log?.("  giao CTV: Orient + Citizen cho cả 2 CTV; Seiko cho CTV 1; Casio Collection cho CTV 2");

  // CTV 1 báo đã bán Orient ⇒ chủ xác nhận (giá mặc định = niêm yết) ⇒ CTV 2 mất chiếc này
  await as(ctv);
  const cl1 = (await ONE(c, "SELECT app.fn_collab_claim($1,$2,$3,$4) r", [await unit("ORB-778899"), "Phạm Văn Cường", "0912345678", "Khách xem ở cửa hàng, lấy luôn"])).r;
  await as(sales);
  const done = (await ONE(c, "SELECT app.fn_confirm_claim($1,NULL,NULL,NULL,NULL) r", [cl1.id])).r;
  ctx.log?.(`  CTV 1 báo bán Orient ⇒ đã xác nhận, đơn ${done.code} (${done.price} đ)`);
  // CTV 2 báo bán Citizen ⇒ để CHỜ chủ xác nhận cho bạn thử
  await as(ctv2);
  await c.query("SELECT app.fn_collab_claim($1,$2,$3,$4)", [await unit("CTZ-551200"), "Lê Thị Hồng", "0933 444 555", "Khách hẹn nhận máy chiều nay"]);
  ctx.log?.("  CTV 2 báo bán Citizen ⇒ đang chờ chủ xác nhận");

  // ── 3. Sửa chữa (chỉ chủ): một phiếu đã giao, một phiếu đang kiểm tra, một phiếu bảo hành miễn phí
  await as(owner);
  const repair = async (p) => (await ONE(c, "SELECT app.fn_create_repair($1::jsonb) r", [JSON.stringify(p)])).r;
  const addLine = async (order, row) => (await ONE(c,
    `INSERT INTO public.repair_lines (order_id, line_no, line_type, service_type_id, description, qty, unit_price_vnd)
     VALUES ($1, (SELECT coalesce(max(line_no),0)+1 FROM public.repair_lines WHERE order_id=$1), $2,$3,$4,1,$5) RETURNING id`,
    [order, row.type, row.serviceTypeId ?? null, row.description ?? null, row.price])).id;

  const r1 = await repair({ kind: "customer", chargeMode: "paid", customerId: an, brandText: "Casio", modelText: "Edifice EF-539D", serialNo: "EF539-55012",
    complaint: "Hết pin, dây da bung khoen", intakeCondition: "Xước nhẹ mặt kính", expectedDate: await plusDays(2) });
  await addLine(r1.id, { type: "service", serviceTypeId: await svc("thay_pin"), price: 100_000 });
  await addLine(r1.id, { type: "service", serviceTypeId: await svc("bao_duong"), price: 300_000 });
  await addLine(r1.id, { type: "other", description: "Thay dây da", price: 150_000 });
  await c.query("SELECT app.fn_set_repair_status($1,'repairing',NULL)", [r1.id]);
  await c.query("SELECT app.fn_complete_repair($1,'in_stock',NULL,NULL,NULL)", [r1.id]);
  await c.query("SELECT app.fn_deliver_repair($1,'[]'::jsonb,NULL)", [r1.id]);
  ctx.log?.(`  sửa ${r1.code}: đã giao, tổng 550.000 đ, có bảo hành sửa chữa`);

  const r2 = await repair({ kind: "customer", chargeMode: "paid", customerId: binh, brandText: "Orient", modelText: "Bambino Gen 2", serialNo: "FAC-3321",
    complaint: "Kính xước nặng, muốn thay kính", intakeCondition: "Vỏ có vài vết xước", expectedDate: await plusDays(5) });
  await addLine(r2.id, { type: "service", serviceTypeId: await svc("thay_kinh"), price: 250_000 });
  await c.query("SELECT app.fn_set_repair_status($1,'inspecting',NULL)", [r2.id]);
  ctx.log?.(`  sửa ${r2.code}: đang kiểm tra`);

  const war = await ONE(c, "SELECT id FROM public.warranties WHERE kind <> 'repair' AND status = 'active' ORDER BY created_at LIMIT 1");
  if (war) {
    const r3 = await repair({ kind: "customer", chargeMode: "warranty_free", warrantyId: war.id, complaint: "Chạy sai giờ sau khi mua", intakeCondition: "Máy còn nguyên tem bảo hành" });
    ctx.log?.(`  sửa ${r3.code}: nhận máy bảo hành miễn phí`);
  }
}
