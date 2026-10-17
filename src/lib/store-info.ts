"use client";
// Thông tin cửa hàng + tài khoản nhận chuyển khoản (GET /api/v1/store-info) — dùng cho VietQR và PDF. Một lần tải, dùng chung (SWR).
import useSWR from "swr";
import { swrFetcher } from "./api-client";

export type StoreInfo = {
  store: { name: string; address: string; phone: string; taxCode: string; receiptFooter: string; warrantyTerms: string; repairTerms: string };
  payment: { configured: boolean; bankBin: string; accountNo: string; accountName: string; transferTemplate: string };
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
