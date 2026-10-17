import { notFound } from "next/navigation";
import { DesignShowcase } from "./DesignShowcase";

// Trang bày thành phần Glass để rà bằng mắt (390px + 1366px). Chỉ cho dev; production trả 404 trừ khi WF_ENABLE_DEV_DESIGN=1.
export const dynamic = "force-dynamic";
export const metadata = { title: "Mẫu giao diện (dev)", robots: { index: false, follow: false } };

export default function DevDesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.WF_ENABLE_DEV_DESIGN !== "1") notFound();
  return <DesignShowcase />;
}
