"use client";
import { useEffect, useState } from "react";

/** true khi màn rộng ≥ 1000px (breakpoint desk của Glass) */
export function useIsDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1000px)");
    const on = () => setD(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return d;
}
