"use client";
// Lỗi hiển thị bên trong khung ứng dụng: giữ nguyên thanh điều hướng, chỉ vùng nội dung báo lỗi (không mất ngữ cảnh).
import { useEffect } from "react";
import { reportClientError } from "@/components/ClientErrorReporter";
import { ErrorState } from "@/components/ui/ErrorState";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError("boundary", error.message, error.stack, error.digest);
  }, [error]);
  return (
    <div className="g wf-pad">
      <ErrorState
        title="Màn hình này gặp sự cố"
        description="Có lỗi khi hiển thị màn hình. Thử lại; nếu vẫn lỗi hãy chuyển sang mục khác và báo cho quản trị viên."
        details={error.digest ? `Mã lỗi: ${error.digest}` : undefined}
        onRetry={() => {
          reset();
          return true;
        }}
      />
    </div>
  );
}
