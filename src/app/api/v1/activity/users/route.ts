import { api } from "@/server/http";
import { ActivityQuery, listActivityUsers } from "@/server/activity";

/** Người có hoạt động trong khoảng ngày (cho ô lọc theo người) — chỉ audit.view. */
export const GET = api({ perm: "audit.view", query: ActivityQuery }, async ({ query, db }) => ({ items: await db((tx) => listActivityUsers(tx, query)) }));
