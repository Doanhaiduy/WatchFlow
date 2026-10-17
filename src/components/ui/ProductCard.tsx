"use client";
import Link from "next/link";
import { Plus, Check } from "lucide-react";
import type { ReactNode } from "react";
import { formatVnd } from "@/lib/money";
import { cx } from "./cx";
import { StatusChip } from "./StatusChip";

type Props = {
  name: string;
  /** Mã nội bộ / serial */
  code: string;
  /** Giá hiệu lực (VND nguyên). null ⇒ "—" (vd. người dùng không có quyền xem) */
  price: number | null;
  /** Trạng thái chiếc (unit_status) → chip */
  status?: string;
  /** Ảnh thumb (WebP) — có `loading="lazy"`, tỷ lệ vuông cố định */
  imageSrc?: string;
  /** Hoặc nội dung tự vẽ (placeholder) */
  placeholder?: ReactNode;
  href?: string;
  onAdd?: () => void;
  inCart?: boolean;
  className?: string;
};

/** `.pc` — ảnh vuông gradient nhạt + chip trạng thái, tên, mã, giá 800, nút tròn "+". Lưới 2 cột (mobile) / 4 cột (desktop) `.wf-pgrid`. */
export function ProductCard({ name, code, price, status, imageSrc, placeholder, href, onAdd, inCart, className }: Props) {
  const body = (
    <>
      <span className="im">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" loading="lazy" width={240} height={240} />
        ) : (
          placeholder
        )}
        {status && (
          <span className="st">
            <StatusChip kind="unit" status={status} />
          </span>
        )}
      </span>
      <span className="nm">{name}</span>
      <small>{code}</small>
    </>
  );
  return (
    <div className={cx("wf-pc g g-flat", className)}>
      {href ? (
        <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="pr">
        <strong>{price === null ? "—" : formatVnd(price)}</strong>
        {onAdd && (
          <button type="button" className={cx("ad", inCart && "in")} onClick={onAdd} aria-label={inCart ? `Đã thêm ${name} vào phiếu` : `Thêm ${name} vào phiếu`}>
            <span>{inCart ? <Check size={18} /> : <Plus size={18} />}</span>
          </button>
        )}
      </div>
    </div>
  );
}
