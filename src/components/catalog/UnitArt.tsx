// Ảnh đại diện của một chiếc khi CHƯA có ảnh thật: đồng hồ vẽ SVG, kiểu dáng ổn định theo loại (model). Có ảnh thật ⇒ dùng ảnh thật.
import { WatchArt, artSeed } from "../ui/WatchArt";
import type { UnitDto } from "./types";

type U = Pick<UnitDto, "model" | "brand"> & Partial<Pick<UnitDto, "assetCode" | "thumbUrl">>;

/** Hình đồng hồ vẽ (không phải ảnh thật) cho một chiếc — cùng loại luôn ra cùng kiểu dáng */
export function UnitArt({ u, crop }: { u: U; crop?: "head" | "full" }) {
  return <WatchArt seed={artSeed(u.brand.name, u.model.name)} brand={u.brand.name} model={u.model.name} crop={crop} />;
}

/** Ảnh nhỏ (48px) cho dòng danh sách: ảnh thật nếu có, không thì mặt đồng hồ vẽ */
export function UnitThumb({ u }: { u: U }) {
  if (u.thumbUrl) {
    return <img src={u.thumbUrl} alt="" loading="lazy" width={48} height={48} />;
  }
  return <UnitArt u={u} crop="head" />;
}
