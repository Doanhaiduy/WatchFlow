import { Suspense } from "react";
import { MfaView } from "./MfaView";

export const metadata = { title: "Xác thực 2 bước" };

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaView />
    </Suspense>
  );
}
