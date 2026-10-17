"use client";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import type { Brand, Location, Model } from "./types";

/** Danh sách tham chiếu (thương hiệu, loại, vị trí) — SWR cache dùng chung, chỉ gọi khi `enabled` */
export function useBrands(enabled = true) {
  return useSWR<{ items: Brand[] }>(enabled ? "/api/v1/catalog/brands" : null, swrFetcher);
}
export function useModels(brandId?: string, enabled = true) {
  return useSWR<{ items: Model[] }>(enabled ? `/api/v1/catalog/models${brandId ? `?brandId=${brandId}` : ""}` : null, swrFetcher);
}
export function useLocations(enabled = true) {
  return useSWR<{ items: Location[] }>(enabled ? "/api/v1/catalog/locations" : null, swrFetcher);
}
