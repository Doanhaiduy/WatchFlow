"use client";
// Dải cảnh báo vận hành cho người có quyền system.health (FR-NAV-03). Port ý tưởng OpsBanner của dự án mẫu (ref-sources/domus-francis):
//   ĐỎ  : cron quá hạn/lỗi, sao lưu lỗi/quá hạn, kho ảnh sắp đầy.   VÀNG: có lỗi hệ thống mới (24 giờ), kho ảnh đã dùng nhiều.
// Bấm → Quản trị → Hệ thống. Ẩn đến hết hôm nay (localStorage, bọc try/catch); có vấn đề KHÁC (hoặc sang ngày) thì hiện lại.
// Dữ liệu: GET /api/v1/system/status?summary=1 (5 phút/lần + khi quay lại tab); không gọi API khi người dùng không có quyền.
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { todayVn } from "@/lib/dates";
import type { CanFn } from "./nav";
import "./shell-extras.css";

type Issue = { key: string; level: "error" | "warn"; title: string };
type Summary = { level: "ok" | "warn" | "error"; issues: Issue[]; checkedAt: string };

const HIDE_KEY = "wf-ops-banner-hidden";
export const OPS_SUMMARY_KEY = "/api/v1/system/status?summary=1";

export function OpsBanner({ can }: { can: CanFn }) {
  const allowed = can("system.health");
  const { data } = useSWR<Summary>(allowed ? OPS_SUMMARY_KEY : null, swrFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: true,
    focusThrottleInterval: 60_000,
    shouldRetryOnError: false,
  });
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY));
    } catch {
      /* trình duyệt chặn bộ nhớ — luôn hiện */
    }
  }, []);

  if (!allowed || !data || data.level === "ok" || data.issues.length === 0) return null;
  // Chữ ký = ngày + các loại vấn đề: ẩn hôm nay thì chỉ hiện lại khi sang ngày mới hoặc có vấn đề loại khác
  const sig = `${todayVn()}|${data.issues.map((i) => i.key).sort().join(",")}`;
  if (hidden === sig) return null;

  const red = data.level === "error";
  const first = data.issues.find((i) => i.level === "error") ?? data.issues[0]!;
  const more = data.issues.length - 1;
  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, sig);
    } catch {
      /* bỏ qua */
    }
    setHidden(sig);
  };
  return (
    <div className="wf-ops" data-level={red ? "error" : "warn"} role={red ? "alert" : "status"}>
      <AlertTriangle size={20} aria-hidden="true" />
      <Link href="/quan-tri/he-thong" className="wf-ops-main">
        <span>
          <b>{red ? "Sự cố vận hành: " : "Cần xem: "}</b>
          {first.title}
          {more > 0 && <span className="wf-mute"> (+{more} mục khác)</span>}
        </span>
        <span className="wf-ops-more">
          Xem chi tiết <ChevronRight size={14} aria-hidden="true" />
        </span>
      </Link>
      <button type="button" className="wf-ops-x" onClick={hide} aria-label="Ẩn cảnh báo này đến hết hôm nay" title="Ẩn đến hết hôm nay">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
