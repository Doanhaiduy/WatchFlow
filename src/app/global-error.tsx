"use client";
// Lỗi ở chính root layout (hiếm): Next thay cả <html>/<body> bằng tệp này, nên phải tự dựng khung + nạp lại CSS Glass.
import { useEffect } from "react";
import "@/styles/globals.css";
import { reportClientError } from "@/components/ClientErrorReporter";
import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError("global", error.message, error.stack, error.digest);
  }, [error]);
  return (
    <html lang="vi">
      <body>
        <main className="wf-auth">
          <div className="wf-auth-in g wf-auth-card">
            <ErrorState
              title="Ứng dụng gặp sự cố"
              description="Có lỗi nghiêm trọng khi mở ứng dụng. Bấm thử lại; nếu vẫn lỗi hãy tải lại trang hoặc báo cho quản trị viên."
              details={error.digest ? `Mã lỗi: ${error.digest}` : undefined}
              onRetry={() => {
                reset();
                return true;
              }}
            />
          </div>
        </main>
      </body>
    </html>
  );
}
