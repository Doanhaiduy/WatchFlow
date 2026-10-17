"use client";
// Lucian UX/UI Prompt #042 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#042
// Thanh bước: đường tiến độ chạy tới chấm kế, bước xong thành dấu tích (bấm để quay lại). Chỉ phần thanh bước; nội dung từng bước do trang dựng.
import type { CSSProperties } from "react";
import "./lucian-042.css";

export function WizardSteps({ steps, current, onStep, label = "Các bước" }: { steps: string[]; current: number; onStep?: (i: number) => void; label?: string }) {
  const p = steps.length > 1 ? current / (steps.length - 1) : 0;
  return (
    <div className="ux u042">
      <ol className="u042-steps" aria-label={label}>
        <li className="u042-line" aria-hidden="true" style={{ "--p": p.toFixed(3) } as CSSProperties}>
          <i />
        </li>
        {steps.map((s, k) => {
          const done = k < current;
          return (
            <li key={s} className={`u042-st${done ? " done" : ""}${k === current ? " cur" : ""}`}>
              <button
                className="u042-dot"
                type="button"
                tabIndex={done ? 0 : -1}
                aria-current={k === current ? "step" : undefined}
                aria-label={`Bước ${k + 1}, ${s}${done ? ", đã xong. Bấm để quay lại" : k === current ? ", đang làm" : ""}`}
                onClick={() => done && onStep?.(k)}
              >
                <span>{k + 1}</span>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.4l3 3 6-6.4" />
                </svg>
              </button>
              <small>{s}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
