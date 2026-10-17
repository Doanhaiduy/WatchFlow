"use client";
import { useEffect } from "react";
import { reportClientError } from "@/components/ClientErrorReporter";
import { ErrorState } from "@/components/ui/ErrorState";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Gửi về nhật ký lỗi (đã rút gọn, không PII) — chi tiết ở src/components/ClientErrorReporter.tsx
    reportClientError("boundary", error.message, error.stack, error.digest);
  }, [error]);
  return (
    <main className="wf-auth">
      <div className="wf-auth-in g wf-auth-card">
        <ErrorState
          title="Trang gặp sự cố"
          description="Có lỗi xảy ra khi hiển thị trang. Thử lại, nếu vẫn lỗi hãy báo cho quản trị viên."
          details={error.digest ? `Mã lỗi: ${error.digest}` : undefined}
          onRetry={() => {
            reset();
            return true;
          }}
        />
      </div>
    </main>
  );
}
