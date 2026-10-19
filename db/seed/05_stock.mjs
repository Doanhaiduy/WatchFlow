// Seed demo nhập thêm hàng (chỉ local/staging): một phiếu "mua vào" — để có hàng thử bán/giao CTV sau khi các bước trước đã bán/giao bớt kho.
// Đi qua app.fn_confirm_purchase như khi bấm "Thêm đồng hồ". Giá nhập chỉ ghi nội bộ (không giao diện nào hiện). Chạy lại không nhân đôi.
const ONE = async (c, sql, params) => (await c.query(sql, params)).rows[0];

// [mã loại, serial, giá niêm yết, giá nhập, vị trí]
const UNITS = [
  ["SEIKO-5-SRPD55", "S5D-100003", 8_200_000, 6_000_000, "Tủ trưng bày 1"],
  ["SEIKO-5-SRPD55", "S5D-100004", 8_200_000, 6_000_000, "Tủ trưng bày 1"],
  ["CASIO-MTP-V001", "CMT-220012", 1_200_000, 800_000, "Tủ trưng bày 2"],
  ["CASIO-MTP-V001", "CMT-220013", 1_200_000, 800_000, "Tủ trưng bày 2"],
  ["CITIZEN-NH8350", "CTZ-551201", 5_800_000, 4_100_000, "Tủ trưng bày 1"],
  ["TISSOT-PRX-40", "TPX-990002", 11_500_000, 8_900_000, "Két"],
  ["CASIO-LTP-1302", "CLT-130202", 900_000, 600_000, "Tủ trưng bày 2"],
  ["ORIENT-BAMBINO-V2", "ORB-778900", 4_900_000, 3_600_000, "Tủ trưng bày 1"],
];

export default async function (c, ctx) {
  if ((await ONE(c, "SELECT count(*)::int n FROM public.purchase_receipts WHERE kind='purchase'")).n > 0) return;
  const owner = ctx.accounts.users.find((u) => u.role === "owner").id;
  await c.query("SELECT set_config('app.current_user_id',$1,true)", [owner]);
  const model = Object.fromEntries((await c.query("SELECT code, id FROM public.watch_models")).rows.map((r) => [r.code, r.id]));
  const loc = Object.fromEntries((await c.query("SELECT name, id FROM public.storage_locations")).rows.map((r) => [r.name, r.id]));

  const rec = (await ONE(c, `INSERT INTO public.purchase_receipts (kind, source_name, note, received_by, created_by)
    VALUES ('purchase','Đại lý đồng hồ Hà Nội (demo)','Nhập thêm hàng demo',$1,$1) RETURNING id`, [owner])).id;
  let no = 0;
  for (const [m, serial, list, cost, l] of UNITS) {
    await c.query(`INSERT INTO public.purchase_lines (receipt_id, line_no, line_type, model_id, serial_no, has_serial, condition, initial_status, location_id, list_price_vnd, unit_price_vnd)
      VALUES ($1,$2,'watch',$3,$4,true,'new','in_stock',$5,$6,$7)`, [rec, ++no, model[m], serial, loc[l], list, cost]);
  }
  const r = (await ONE(c, "SELECT app.fn_confirm_purchase($1) AS r", [rec])).r;
  ctx.log?.(`  phiếu nhập ${r.code}: ${r.units?.length ?? UNITS.length} chiếc`);
}
