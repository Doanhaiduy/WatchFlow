import { Suspense } from "react";
import { PosView } from "./PosView";

export const metadata = { title: "Bán hàng" };

export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosView />
    </Suspense>
  );
}
