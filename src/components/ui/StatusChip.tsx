import type { ReactNode } from "react";
import { cx, type Tone } from "./cx";
import { statusInfo, type StatusKind } from "./status";

type Props =
  | { kind: StatusKind; status: string; label?: string; className?: string; tone?: undefined; children?: undefined }
  | { tone: Tone; children: ReactNode; className?: string; kind?: undefined; status?: undefined; label?: undefined };

/** Viên thuốc trạng thái `.wf-chip[data-tone]`. Nhận `kind`+`status` → tự ánh xạ nhãn/tone, hoặc `tone`+nội dung tự do. */
export function StatusChip(props: Props) {
  if (props.kind !== undefined) {
    const info = statusInfo(props.kind, props.status);
    return (
      <span className={cx("wf-chip", props.className)} data-tone={info.tone}>
        {props.label ?? info.label}
      </span>
    );
  }
  return (
    <span className={cx("wf-chip", props.className)} data-tone={props.tone}>
      {props.children}
    </span>
  );
}
