import { api } from "@/server/http";

export const GET = api({}, async ({ db }) => {
  const items = await db((tx) =>
    tx.q(`SELECT code, module, name_vi AS "nameVi", is_sensitive AS "isSensitive" FROM public.permissions ORDER BY module, code`),
  );
  return { items };
});
