"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { formatDateVn } from "@/lib/dates";
import { useSession } from "@/lib/session";
import type { ComboOption } from "../ui/Combobox";

/** Gợi ý "Nguồn hàng" từ các phiếu nhập đã có (GET /api/v1/purchases/sources) — dùng cho Combobox. */
export function useSourceNames(enabled = true): ComboOption[] {
  const { can } = useSession();
  const on = enabled && (can("purchase.create") || can("purchase.view"));
  const res = useSWR<{ items: Array<{ name: string; count: number; lastDate: string }> }>(on ? "/api/v1/purchases/sources" : null, swrFetcher, { revalidateOnFocus: false });
  return useMemo(
    () => (res.data?.items ?? []).map((s) => ({ value: s.name, label: s.name, sublabel: `${s.count} phiếu · gần nhất ${formatDateVn(s.lastDate)}` })),
    [res.data],
  );
}
