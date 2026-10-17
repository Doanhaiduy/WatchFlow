import { Suspense } from "react";
import { UnitsView } from "./UnitsView";

export const metadata = { title: "Đồng hồ" };

export default function UnitsPage() {
  return (
    <Suspense fallback={null}>
      <UnitsView />
    </Suspense>
  );
}
