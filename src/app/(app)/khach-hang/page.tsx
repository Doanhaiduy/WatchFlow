"use client";
import { FileSpreadsheet, Plus, ShoppingBag, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { RequirePerm } from "@/components/auth/RequirePerm";
import type { Customer } from "@/components/catalog/types";
import { CustomerModal } from "@/components/customers/CustomerModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InsetList, InsetRow } from "@/components/ui/InsetList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { swrFetcher } from "@/lib/api-client";
import { useSession } from "@/lib/session";
import { hasKpi, useDashKpis } from "@/lib/use-dashboard";

type Res = { items: Customer[]; total: number; page: number; pageSize: number };
const PAGE = 25;

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

// Khách hàng: tên, SĐT, địa chỉ, ghi chú và lịch sử mua/sửa để tra cứu lại (CF-13). Đã bỏ nhóm khách, CCCD, công nợ, cọc.
export default function CustomersPage() {
  const { can } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [dq]);
  const allowed = can(["customer.view", "customer.view_own"]);
  const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
  if (dq) p.set("q", dq);
  const { data, error, isLoading, mutate } = useSWR<Res>(allowed ? `/api/v1/customers?${p}` : null, swrFetcher, { keepPreviousData: true });
  const [form, setForm] = useState(false);
  const { kpis } = useDashKpis(allowed && can("sale.view"));

  // Mở sẵn form khi vào từ nút "+" (?moi=1)
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("moi") === "1" && can("customer.create")) setForm(true);
  }, [can]);

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Thông tin liên hệ và lịch sử mua, sửa của khách"
        actions={(<>{can("customer.create") && <Button sm href="/nhap-excel?loai=khach" icon={<FileSpreadsheet size={16} aria-hidden="true" />}>Nhập Excel</Button>}{can("customer.create") && <Button sm variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setForm(true)}>Thêm</Button>}</>)}
      />
      <RequirePerm perm={["customer.view", "customer.view_own"]}>
        <StatStrip
          items={[
            data && { label: "Khách hàng", value: data.total, icon: <Users size={16} />, tone: "info", hint: dq ? "khớp tìm kiếm" : "đang lưu" },
            hasKpi(kpis, "invoiceCount") && { label: "Đơn hôm nay", value: kpis.invoiceCount!, icon: <ShoppingBag size={16} />, tone: "ok", hint: "xem ở Bán hàng", href: can("sale.view") ? "/ban-hang" : undefined },
          ]}
        />
        <SearchBar value={q} onChange={setQ} placeholder="Tìm tên hoặc số điện thoại…" />
        {isLoading ? <SkeletonList rows={6} /> : error ? (
          <div className="g wf-pad"><ErrorState description={errMsg(error)} onRetry={async () => (await mutate()) !== undefined} /></div>
        ) : data && data.items.length === 0 ? (
          <div className="g wf-pad">
            <EmptyState variant={dq ? "search" : "plain"} icon={<Users size={24} />} title={dq ? "Không có khách khớp" : "Bạn chưa có khách hàng"} description={dq ? "Thử số điện thoại khác." : "Khách được lưu tự động khi bạn ghi đơn bán; bạn cũng có thể thêm trước."} action={!dq && can("customer.create") ? { label: "Thêm khách", onClick: () => setForm(true) } : undefined} />
          </div>
        ) : (
          <>
            <InsetList label="Danh sách khách hàng">
              {data?.items.map((c) => (
                <InsetRow
                  key={c.id}
                  href={`/khach-hang/${c.id}`}
                  lead={<Avatar name={c.fullName} tone={c.isActive ? undefined : "neutral"} />}
                  title={c.fullName}
                  subtitle={c.phone ?? "Chưa có SĐT"}
                  end={c.code}
                />
              ))}
            </InsetList>
            <Pager page={page} pageSize={PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
        <CustomerModal customer={null} open={form} onClose={() => setForm(false)} onDone={async (id) => { await mutate(); setForm(false); if (id) router.push(`/khach-hang/${id}`); }} />
      </RequirePerm>
    </>
  );
}
