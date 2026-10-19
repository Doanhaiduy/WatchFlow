"use client";
// Thông tin cửa hàng (GET /api/v1/store-info) — dùng cho phiếu in và PDF. Một lần tải, dùng chung (SWR).
import useSWR from "swr";
import { swrFetcher } from "./api-client";

export type StoreInfo = {
  store: { name: string; address: string; phone: string; taxCode: string; receiptFooter: string; warrantyTerms: string; repairTerms: string };
};

export function useStoreInfo() {
  return useSWR<StoreInfo>("/api/v1/store-info", swrFetcher, { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false });
}

/** Lấy StoreInfo một lần (ngoài React), vd. khi dựng PDF. */
export async function fetchStoreInfo(): Promise<StoreInfo | null> {
  try {
    return await swrFetcher<StoreInfo>("/api/v1/store-info");
  } catch {
    return null;
  }
}
