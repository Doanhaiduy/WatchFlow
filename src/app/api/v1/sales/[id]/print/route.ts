import { api } from "@/server/http";

// Ghi nhận một lần in đơn bán; trả reprint=true từ lần 2 (in "BẢN IN LẠI") — BR-SALE-11
export const POST = api({ perm: "sale.view" }, async ({ params, db }) => {
  return db((tx) => tx.fn("app.fn_mark_sale_printed", [params.id]));
});
