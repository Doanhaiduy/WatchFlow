"use client";
import Link from "next/link";
import { forwardRef, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { createClickGuard } from "@/lib/submit-guard";
import { cx } from "./cx";

export type ButtonVariant = "glass" | "primary" | "dark" | "danger";

type Common = {
  variant?: ButtonVariant;
  sm?: boolean;
  block?: boolean;
  /** Đang xử lý: khóa nút + vòng quay (chống bấm đúp) */
  loading?: boolean;
  /** Chống bấm lặp: bỏ lần bấm thứ hai trong 600ms (hoặc số ms nêu). Mặc định bật cho nút `type="submit"`; nút xác nhận/gửi khác nên bật tay. */
  guard?: boolean | number;
  /** Nút chỉ có biểu tượng (cần aria-label) */
  iconOnly?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

const V: Record<ButtonVariant, string> = { glass: "", primary: "wf-btn-pri", dark: "wf-btn-dk", danger: "wf-btn-bad" };

function classes(p: Common, extra?: string) {
  return cx("wf-btn", V[p.variant ?? "glass"], p.sm && "wf-btn-sm wf-touch", p.block && "wf-btn-block", p.iconOnly && "wf-btn-icon", extra);
}

/** Nút Glass: `glass` (kính), `primary` (gradient), `dark`, `danger`; cao 46px (sm 36px + vùng chạm ≥ 44px). Có `href` ⇒ render liên kết. */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps | LinkProps>(function Button(props, ref) {
  const { variant, sm, block, loading, iconOnly, icon, children, className, guard, ...rest } = props as Common & { className?: string } & Record<string, unknown>;
  const gate = useRef<ReturnType<typeof createClickGuard> | null>(null);
  const body = (
    <>
      {loading ? <span className="wf-spin" aria-hidden="true" /> : icon}
      {children}
    </>
  );
  if ("href" in props && props.href !== undefined) {
    const { href, ...a } = rest as unknown as { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={classes({ variant, sm, block, iconOnly }, className)}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        {...a}
      >
        {body}
      </Link>
    );
  }
  const b = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  const ms = guard === true || (guard === undefined && (b.type ?? "button") === "submit") ? 600 : typeof guard === "number" ? guard : 0;
  const onClick = ms
    ? (e: MouseEvent<HTMLButtonElement>) => {
        gate.current ??= createClickGuard(ms);
        if (!gate.current.pass()) return void e.preventDefault(); // bấm lặp: bỏ (kể cả gửi form)
        b.onClick?.(e);
      }
    : b.onClick;
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={b.type ?? "button"}
      className={classes({ variant, sm, block, iconOnly }, className)}
      aria-busy={loading || undefined}
      {...b}
      onClick={onClick}
      disabled={b.disabled || loading}
    >
      {body}
    </button>
  );
});
