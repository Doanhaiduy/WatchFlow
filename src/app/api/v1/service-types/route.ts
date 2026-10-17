import { z } from "zod";
import { api } from "@/server/http";

export const GET = api({ perm: ["repair.view", "repair.create"] }, async ({ db }) => {
  const items = await db((tx) => tx.q(`SELECT id, code, name, default_price_vnd AS "defaultPrice", is_active AS "isActive" FROM public.service_types ORDER BY is_active DESC, name`));
  return { items };
});

const Body = z.object({ name: z.string().trim().min(1).max(80), defaultPrice: z.number().int().min(0) });
export const POST = api({ perm: "repair.price.edit", body: Body }, async ({ body, db }) => {
  const code = body.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "loai_viec";
  const r = await db((tx) => tx.one<{ id: string }>("INSERT INTO public.service_types (code, name, default_price_vnd) VALUES ($1,$2,$3) RETURNING id",
    [code + "_" + Date.now().toString(36).slice(-4), body.name, body.defaultPrice]));
  return { id: r!.id };
});
