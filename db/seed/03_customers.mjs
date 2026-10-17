// Seed khách hàng demo (khớp F0 golden-scenarios): KH-A Nguyễn Văn An, KH-B Trần Thị Bình, KH-C do CTV C1 tạo. CCCD là SỐ GIẢ.
import { encrypt, blindIndex } from "../../scripts/lib/crypto.mjs";

const CUSTOMERS = [
  ["Nguyễn Văn An", "0901000001", "an.nguyen@example.com", "Q.3, TP.HCM", "Khách quen", "079090000123", "owner"],
  ["Trần Thị Bình", "0901000002", null, "Thủ Đức, TP.HCM", "Khách lẻ", null, "owner"],
  ["Lê Văn Cường", "0912345678", null, "Biên Hòa, Đồng Nai", "Khách lẻ", null, "collaborator"],
  ["Phạm Thị Dung", "0987654321", "dung.pham@example.com", "Q.7, TP.HCM", "Đại lý / mua sỉ", null, "sales"],
];

export default async function (c, ctx) {
  const have = (await c.query("SELECT count(*)::int n FROM public.customers")).rows[0].n;
  if (have > 0) return;
  const group = Object.fromEntries((await c.query("SELECT name, id FROM public.customer_groups")).rows.map((r) => [r.name, r.id]));
  for (const [name, phone, email, addr, g, idNo, by] of CUSTOMERS) {
    const creator = ctx.accounts.users.find((u) => u.role === by).id;
    await c.query("SELECT set_config('app.current_user_id',$1,true)", [creator]);
    await c.query(
      `INSERT INTO public.customers (full_name, phone, email, address, group_id, id_number_enc, id_number_bidx, id_number_last3, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [name, phone, email, addr, group[g], idNo ? encrypt(idNo, ctx.env.PII_KEY_V1) : null, idNo ? blindIndex(idNo, ctx.env.PII_BIDX_KEY) : null, idNo ? idNo.slice(-3) : null, creator],
    );
  }
}
