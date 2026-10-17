import QRCode from "qrcode";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";

// Dữ liệu tem QR (mã nội bộ) — trang /units/[id]/label dựng tem và in (lưu PDF bằng trình duyệt). CQ-006.
export const GET = api({ perm: "catalog.view" }, async ({ params, db }) => {
  const u = await db((tx) =>
    tx.one<{ asset_code: string; model_name: string; brand_name: string; serial_no: string | null; price: number }>(
      `SELECT u.asset_code, m.name AS model_name, b.name AS brand_name, u.serial_no,
              app.unit_effective_price(u.list_price_vnd, u.promo_price_vnd, u.promo_from, u.promo_to) AS price
       FROM public.watch_units u JOIN public.watch_models m ON m.id = u.model_id JOIN public.brands b ON b.id = u.brand_id
       WHERE u.id::text = $1 OR upper(u.asset_code) = upper($1)`, [params.id]),
  );
  if (!u) throw new ApiError(404, "WF-NOT-FOUND", "Không tìm thấy chiếc đồng hồ.");
  const qrSvg = await QRCode.toString(u.asset_code, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return { assetCode: u.asset_code, modelName: u.model_name, brandName: u.brand_name, serialNo: u.serial_no, price: u.price, qrSvg };
});
