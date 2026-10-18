"use client";
// Số liệu tổng quan dùng chung cho dải số liệu ở đầu các trang danh sách (cùng khóa SWR với trang Tổng quan ⇒ không gọi lại trong 60 giây).
// Máy chủ chỉ trả những khóa người dùng được phép xem; thiếu khóa ⇒ nơi dùng không vẽ thẻ tương ứng.
import useSWR from "swr";
import { swrFetcher } from "./api-client";

export type DashKpis = Record<string, number | undefined>;

export function useDashKpis(enabled = true): { kpis: DashKpis; prev: DashKpis; ready: boolean } {
  const { data } = useSWR<{ kpis: DashKpis; prev?: DashKpis }>(enabled ? "/api/v1/reports/dashboard?period=today" : null, swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });
  return { kpis: data?.kpis ?? {}, prev: data?.prev ?? {}, ready: !!data };
}

export const hasKpi = (k: DashKpis, key: string): boolean => typeof k[key] === "number";
