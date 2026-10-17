"use client";
import { formatDateVn } from "@/lib/dates";
import { formatVnd } from "@/lib/money";
import type { Col } from "./meta";

const isIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

function cell(v: unknown, c: Col): string {
  if (v === null || v === undefined || v === "") return "—";
  if (c.money) return formatVnd(Math.round(Number(v)));
  if (c.date && isIso(v)) return formatDateVn(v.slice(0, 10));
  if (c.num) return Number(v).toLocaleString("vi-VN");
  return String(v);
}

/**
 * Báo cáo dạng bảng. Máy tính + khi in: bảng cuộn ngang (vùng cuộn focus được bằng phím) có dòng tổng cuối bảng.
 * Điện thoại/máy tính bảng hẹp: mỗi dòng là một thẻ (cột đầu làm tiêu đề, các cột còn lại dạng nhãn – giá trị, bỏ ô trống)
 * để không phải kéo ngang. Tổng chỉ cộng lại số máy chủ trả để hiển thị.
 */
export function ReportTable({ title, rows, cols, totals }: { title: string; rows: Array<Record<string, unknown>>; cols: Col[]; totals?: string[] }) {
  const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const [first, ...rest] = cols;
  const totalCols = cols.filter((c) => totals?.includes(c.key));
  return (
    <section className="g wf-pad" aria-label={title}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title} <span className="wf-mute" style={{ fontWeight: 500 }}>({rows.length})</span></h3>
      {rows.length === 0 ? (
        <p className="wf-mute">Không có dữ liệu trong khoảng này.</p>
      ) : (
        <>
          <div className="wf-tbl hidden desk:block print:block" tabIndex={0} role="region" aria-label={`Bảng ${title}`}>
            <table>
              <thead>
                <tr>{cols.map((c) => <th key={c.key} scope="col" className={c.money || c.num ? "r" : undefined}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{cols.map((c) => <td key={c.key} className={c.money || c.num ? "r wf-num" : undefined}>{cell(r[c.key], c)}</td>)}</tr>
                ))}
              </tbody>
              {totals && totals.length > 0 && (
                <tfoot>
                  <tr>
                    {cols.map((c, i) => (
                      <td key={c.key} className={c.money || c.num ? "r wf-num" : undefined}>{i === 0 ? "Tổng" : totals.includes(c.key) ? cell(sum(c.key), c) : ""}</td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {first && (
            <ul className="wf-rcards desk:hidden print:hidden" aria-label={`Danh sách ${title}`}>
              {rows.map((r, i) => (
                <li key={i} className="wf-rcard">
                  <b className="wf-rcard-h">{cell(r[first.key], first)}</b>
                  <dl className="wf-kv">
                    {rest
                      .filter((c) => r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== "")
                      .map((c) => (
                        <div key={c.key}>
                          <dt>{c.label}</dt>
                          <dd className={c.money || c.num ? "wf-num" : undefined}>{cell(r[c.key], c)}</dd>
                        </div>
                      ))}
                  </dl>
                </li>
              ))}
              {totalCols.length > 0 && (
                <li className="wf-rcard wf-rcard-tot">
                  <b className="wf-rcard-h">Tổng</b>
                  <dl className="wf-kv">
                    {totalCols.map((c) => (
                      <div key={c.key}>
                        <dt>{c.label}</dt>
                        <dd className="wf-num">{cell(sum(c.key), c)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
