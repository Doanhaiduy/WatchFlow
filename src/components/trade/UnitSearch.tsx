"use client";
import { Watch } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api-client";
import { formatVnd } from "@/lib/money";
import { unitTitle, type UnitDto, type UnitList } from "../catalog/types";
import { ScanDialog } from "../catalog/ScanDialog";
import { InsetList, InsetRow } from "../ui/InsetList";
import { SearchBar } from "../ui/SearchBar";
import { StatusChip } from "../ui/StatusChip";
import { useDebounced } from "./useDebounced";

/** Tìm chiếc theo mã nội bộ/serial/tên để thêm vào phiếu bán, giữ hàng… `status` mặc định chỉ chiếc sẵn sàng bán. */
export function UnitSearch({ onPick, status = "in_stock", exclude = [], placeholder }: { onPick: (u: UnitDto) => void; status?: string; exclude?: string[]; placeholder?: string }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const key = dq.length >= 1 ? `/api/v1/catalog/units?status=${status}&q=${encodeURIComponent(dq)}&pageSize=8` : `/api/v1/catalog/units?status=${status}&pageSize=6&sort=-created_at`;
  const res = useSWR<UnitList>(key, swrFetcher, { keepPreviousData: true });
  const [scan, setScan] = useState(false);
  const items = (res.data?.items ?? []).filter((u) => !exclude.includes(u.id));
  return (
    <div>
      <SearchBar value={q} onChange={setQ} onScan={() => setScan(true)} placeholder={placeholder ?? "Tìm mã nội bộ, serial, tên đồng hồ…"} />
      {items.length === 0 && res.data ? (
        <p className="wf-mute" style={{ padding: "6px 8px" }}>{dq ? `Không có chiếc sẵn sàng bán khớp “${dq}”.` : "Chưa có chiếc nào sẵn sàng bán."}</p>
      ) : (
        <InsetList label="Chiếc tìm được">
          {items.map((u) => (
            <InsetRow key={u.id} onClick={() => onPick(u)} icon={<Watch size={20} aria-hidden="true" />} tone="check" title={unitTitle(u)} subtitle={`${u.assetCode}${u.serialNo ? ` · ${u.serialNo}` : ""}`} end={formatVnd(u.effectivePrice)} endSub={<StatusChip kind="unit" status={u.status} />} />
          ))}
        </InsetList>
      )}
      <ScanDialog open={scan} onClose={() => setScan(false)} onFound={(u) => { setScan(false); if (u.status === status || status.split(",").includes(u.status)) onPick(u); }} />
    </div>
  );
}
