"use client";
import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, Banknote, Boxes, Lock, PackageSearch, Watch } from "lucide-react";
import { AppShell, type DemoUser } from "@/components/layout/AppShell";
import { PaymentSheet, type PaymentLineInput } from "@/components/payments";
import { CopyCodeButton, QuantityStepper, FilterButton, ActiveFilterChips } from "@/components/lucian";
import { DetentSheet, type Detent } from "@/components/lucian/DetentSheet";
import { PERMISSION_CODES } from "@/lib/permissions";
import { formatVnd, formatVndShort } from "@/lib/money";
import {
  ActionSheet, AreaChart, BarChart, Button, Checkbox, Combobox, ConfirmDialog, DateInput, DateRange, Donut, EmptyState, ErrorState, Field, FilterChips, GlassCard, HeroCard,
  InsetList, InsetRow, KeyValue, KpiGrid, KpiTile, LockNote, LoginCard, Modal, ModalClose, MoneyAmountInput, MoneyInput, OfflineBanner, OtpInput, PageHeader,
  PhoneInput, ProductCard, ProgressRing, RadioGroup, Ring, SearchBar, SegmentedControl, Select, Skeleton, SkeletonKpis, SkeletonList, StatusChip, STATUS_MAP,
  Stepper, Switch, TextInput, ThemeSwitch, Textarea, Timeline, ToastProvider, useToast, warrantyStatus, type StatusKind,
} from "@/components/ui";

// ---------- Dữ liệu giả (tiếng Việt) ----------
const UNITS = [
  { name: "Seiko 5 Sports SRPD55K1", code: "WF-000412", price: 8_200_000, status: "in_stock" },
  { name: "Casio G-Shock GA-2100-1A1", code: "WF-000398", price: 3_650_000, status: "reserved" },
  { name: "Orient Bambino Gen 2 Open Heart", code: "WF-000377", price: 6_900_000, status: "with_collaborator" },
  { name: "Tissot PRX Powermatic 80", code: "WF-000351", price: 14_500_000, status: "in_repair" },
];
const REVENUE = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, i) => ({ label, value: [12, 18, 15, 24, 21, 33, 29][i]! * 1_000_000 }));
const BARS = ["Th7", "Th8", "Th9", "Th10"].map((label, i) => ({ label, value: [96, 118, 104, 142][i]! * 1_000_000 }));
const BRANDS = [
  { label: "Seiko", value: 38 }, { label: "Casio", value: 27 }, { label: "Orient", value: 16 }, { label: "Citizen", value: 11 }, { label: "Khác", value: 8 },
];

const ALL = [...PERMISSION_CODES] as string[];
const ROLE_PERMS: Record<string, { label: string; user: Omit<DemoUser, "perms">; perms: string[] }> = {
  owner: { label: "Chủ cửa hàng", user: { fullName: "Nguyễn Văn An", roles: ["Chủ cửa hàng"] }, perms: ALL.filter((p) => p !== "collab.view_own") },
  sales: {
    label: "Nhân viên bán hàng",
    user: { fullName: "Trần Thị Bích", roles: ["Nhân viên bán hàng"] },
    perms: ["catalog.view", "sale.view", "sale.view_own", "sale.create_draft", "sale.confirm", "customer.view", "customer.create", "reservation.manage", "warranty.view", "repair.view"],
  },
  warehouse: {
    label: "Quản lý kho",
    user: { fullName: "Lê Hoàng Kho", roles: ["Quản lý kho"] },
    perms: ["catalog.view", "catalog.manage", "part.view", "part.manage", "purchase.view", "purchase.create", "stocktake.manage", "report.inventory", "location.manage"],
  },
  ctv: { label: "Cộng tác viên", user: { fullName: "Phạm Minh CTV", roles: ["Cộng tác viên"] }, perms: ["collab.view_own", "sale.view_own"] },
};

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="wf-dev-sec" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
const Cap = ({ children }: { children: ReactNode }) => <p className="wf-dev-cap">{children}</p>;

// ---------- Các khối ----------
function Tokens() {
  const tones = ["ok", "bad", "hold", "info", "check", "repair", "neutral"] as const;
  return (
    <Sec id="s-tokens" title="Token & tone">
      <GlassCard padded>
        <div className="wf-dev-row">
          {tones.map((t) => (
            <StatusChip key={t} tone={t}>
              {t}
            </StatusChip>
          ))}
        </div>
        <p className="wf-mute" style={{ marginTop: 10 }}>
          Chữ phụ <b>--wf-mute</b> trên kính; số tiền luôn tabular-nums: <b className="wf-num">{formatVnd(8_200_000)}</b> · gọn: <b className="wf-num">{formatVndShort(54_200_000)}</b>
        </p>
      </GlassCard>
    </Sec>
  );
}

function Chips() {
  const kinds = Object.keys(STATUS_MAP) as StatusKind[];
  const names: Record<StatusKind, string> = { unit: "Chiếc", repair: "Phiếu sửa", doc: "Chứng từ", warranty: "Bảo hành", reservation: "Giữ hàng" };
  return (
    <Sec id="s-chip" title="StatusChip (mọi trạng thái)">
      <div className="wf-dev-grid">
        {kinds.map((k) => (
          <GlassCard key={k} padded>
            <Cap>{names[k]}</Cap>
            <div className="wf-dev-row">
              {Object.keys(STATUS_MAP[k]).map((s) => (
                <StatusChip key={s} kind={k} status={s} />
              ))}
            </div>
          </GlassCard>
        ))}
        <GlassCard padded>
          <Cap>Bảo hành theo số ngày còn lại (≤ 14 = sắp hết)</Cap>
          <div className="wf-dev-row">
            {[120, 10, -3].map((d) => (
              <StatusChip key={d} kind="warranty" status={warrantyStatus(d)} label={`${d >= 0 ? `Còn ${d} ngày` : "Hết hạn"}`} />
            ))}
          </div>
        </GlassCard>
      </div>
    </Sec>
  );
}

function Buttons() {
  const [busy, setBusy] = useState(false);
  return (
    <Sec id="s-btn" title="Button">
      <GlassCard padded>
        <Cap>Thường</Cap>
        <div className="wf-dev-row">
          <Button>Kính</Button>
          <Button variant="primary">Chính</Button>
          <Button variant="dark">Tối</Button>
          <Button variant="danger">Hủy phiếu</Button>
          <Button sm>Nhỏ</Button>
        </div>
        <Cap>Hover (mô phỏng) / Focus (mô phỏng)</Cap>
        <div className="wf-dev-row">
          <span className="wf-hover">
            <Button>Hover</Button>
          </span>
          <span className="wf-focus">
            <Button variant="primary">Focus</Button>
          </span>
        </div>
        <Cap>Vô hiệu / Đang tải</Cap>
        <div className="wf-dev-row">
          <Button disabled>Vô hiệu</Button>
          <Button variant="primary" disabled>
            Vô hiệu
          </Button>
          <Button variant="primary" loading>
            Đang lưu
          </Button>
          <Button
            variant="dark"
            loading={busy}
            onClick={() => {
              setBusy(true);
              setTimeout(() => setBusy(false), 1500);
            }}
          >
            Bấm thử (1,5 giây)
          </Button>
        </div>
        <Cap>Toàn chiều rộng</Cap>
        <Button variant="primary" block>
          Xác nhận &amp; in phiếu
        </Button>
      </GlassCard>
    </Sec>
  );
}

function Fields() {
  const [money, setMoney] = useState<number | null>(8_200_000);
  const [empty, setEmpty] = useState<number | null>(null);
  const [phone, setPhone] = useState("0901234567");
  const [bad, setBad] = useState("09012");
  const [chk, setChk] = useState(true);
  const [sw, setSw] = useState(true);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("Seiko 5 Sports SRPD55K1");
  const [date, setDate] = useState("2026-10-17");
  const [due, setDue] = useState("");
  const [range, setRange] = useState({ from: "2026-09-18", to: "2026-10-17" });
  const [radio, setRadio] = useState("cash");
  return (
    <Sec id="s-fld" title="Field · TextInput · MoneyInput · PhoneInput · Select · DateInput · Textarea · Checkbox · Switch · Radio">
      <GlassCard padded>
        <div className="wf-dev-grid">
          <div>
            <Field label="Tên khách" required hint="Họ và tên như trên CCCD">
              <TextInput placeholder="Nguyễn Văn A" />
            </Field>
            <Field label="Email (lỗi)" error="Email chưa đúng, ví dụ ten@cuahang.vn">
              <TextInput defaultValue="abc@" />
            </Field>
            <Field label="Mã serial (vô hiệu)">
              <TextInput disabled defaultValue="SN-88213" />
            </Field>
            <Field label="Số tiền (có gợi ý nhanh)">
              <MoneyInput value={money} onChange={setMoney} quickAdds={[100_000, 500_000, 1_000_000]} />
            </Field>
            <Field label="Số tiền (trống)">
              <MoneyInput value={empty} onChange={setEmpty} />
            </Field>
          </div>
          <div>
            <Field label="Số điện thoại">
              <PhoneInput value={phone} onChange={setPhone} />
            </Field>
            <Field label="Số điện thoại (thiếu số)" error="SĐT cần đủ 10 số, bắt đầu bằng 0">
              <PhoneInput value={bad} onChange={setBad} />
            </Field>
            <Field label="Thương hiệu">
              <Select placeholder="Chọn thương hiệu" value={brand} onChange={(e) => setBrand(e.target.value)} options={["Seiko", "Casio", "Orient", "Citizen", "Tissot"].map((b) => ({ value: b, label: b }))} />
            </Field>
            <Field label="Loại đồng hồ (có ô tìm, > 8 lựa chọn)">
              <Select value={model} onChange={(e) => setModel(e.target.value)} options={["Seiko 5 Sports SRPD55K1", "Casio G-Shock GA-2100-1A1", "Orient Bambino Gen 2", "Tissot PRX Powermatic 80", "Citizen Eco-Drive BM7100", "Casio Edifice EFR-556", "Seiko Presage Cocktail", "Orient Star Classic", "Đồng hồ Đà Lạt cổ", "Tissot Le Locle", "Casio Vintage A168"].map((b, i) => ({ value: b, label: b, disabled: i === 5 }))} />
            </Field>
            <Field label="Phạm vi (lỗi)" error="Chọn một phạm vi để kiểm kê">
              <Select placeholder="Chưa chọn" options={[{ value: "a", label: "Toàn kho" }, { value: "b", label: "Theo vị trí" }]} />
            </Field>
            <Field label="Vô hiệu">
              <Select disabled value="a" options={[{ value: "a", label: "Toàn kho" }]} />
            </Field>
            <Field label="Ngày hẹn trả (trống, tối đa hôm nay + 30)">
              <DateInput value={due} min="2026-10-17" max="2026-11-16" onChange={setDue} />
            </Field>
            <Field label="Ngày chứng từ (gõ tay dd/mm/yyyy)">
              <DateInput value={date} max="2026-10-17" clearable={false} onChange={setDate} />
            </Field>
            <Field label="Khoảng ngày (báo cáo)">
              <DateRange from={range.from} to={range.to} max="2026-10-17" onChange={setRange} />
            </Field>
            <Field label="Ghi chú tình trạng">
              <Textarea placeholder="Xước nhẹ mặt kính, đã thay pin" />
            </Field>
            <Checkbox checked={chk} onChange={setChk} label="Có hộp và giấy bảo hành" />
            <Switch checked={sw} onChange={setSw} label="Nhắc hạn giữ hàng" description="Gửi thông báo trước 1 ngày" />
            <Switch checked={false} onChange={() => {}} label="Công tắc vô hiệu" disabled />
            <RadioGroup
              ariaLabel="Hình thức thanh toán"
              value={radio}
              onChange={setRadio}
              options={[
                { value: "cash", label: "Tiền mặt" },
                { value: "transfer", label: "Chuyển khoản", description: "Ghi mã giao dịch ở bước sau" },
                { value: "card", label: "Quẹt thẻ", disabled: true },
              ]}
            />
          </div>
        </div>
      </GlassCard>
    </Sec>
  );
}

function Nav() {
  const [period, setPeriod] = useState("week");
  const [tab, setTab] = useState("rev");
  const [chips, setChips] = useState<string[]>(["in_stock"]);
  const [q, setQ] = useState("");
  return (
    <Sec id="s-seg" title="SegmentedControl · FilterChips · SearchBar · Stepper">
      <div className="wf-stack">
        <SegmentedControl
          ariaLabel="Kỳ báo cáo"
          value={period}
          onChange={setPeriod}
          options={[{ value: "day", label: "Hôm nay" }, { value: "week", label: "7 ngày" }, { value: "month", label: "Tháng" }, { value: "quarter", label: "Quý" }, { value: "year", label: "Năm" }]}
        />
        <SegmentedControl
          mode="tabs"
          ariaLabel="Chỉ số"
          value={tab}
          onChange={setTab}
          options={[{ value: "rev", label: "Doanh thu" }, { value: "gp", label: "Lãi gộp" }, { value: "cash", label: "Thực thu" }]}
        />
        <FilterChips
          ariaLabel="Lọc trạng thái"
          value={chips}
          onChange={setChips}
          multiple
          options={[{ value: "in_stock", label: "Sẵn sàng bán", count: 42 }, { value: "reserved", label: "Đã giữ", count: 5 }, { value: "with_collaborator", label: "Đang ở CTV", count: 9 }, { value: "in_repair", label: "Đang sửa", count: 3 }, { value: "sold", label: "Đã bán", count: 210 }]}
        />
        <SearchBar value={q} onChange={setQ} onScan={() => {}} />
        <GlassCard padded>
          <Stepper steps={["Khách", "Máy", "Tình trạng", "Cọc"]} current={2} onStep={() => {}} />
        </GlassCard>
      </div>
    </Sec>
  );
}

function Data() {
  const [cart, setCart] = useState<string | null>("WF-000398");
  return (
    <Sec id="s-data" title="Danh sách · KPI · Hero · ProductCard · KeyValue · Timeline · Ring · LockNote">
      <div className="wf-stack">
        <HeroCard
          label="Doanh thu tháng 10"
          value="148.600.000"
          unit="₫"
          progress={72}
          progressLabels={["72% mục tiêu", "Còn 12 ngày"]}
          stats={[{ label: "Lãi gộp", value: "31,2 tr" }, { label: "Thực thu", value: "139 tr" }, { label: "Đã bán", value: "17 chiếc" }]}
          action={{ label: "Xem báo cáo", href: "/bao-cao" }}
        />
        <KpiGrid>
          <KpiTile label="Tồn kho" value="58" hint="9 ở CTV" icon={<Boxes size={16} />} tone="info" />
          <KpiTile label="Giá trị tồn" value="412 tr" hint="+3,1%" hintTone="ok" icon={<Banknote size={16} />} tone="ok" />
          <KpiTile label="Đã bán" value="17" hint="tháng này" icon={<Watch size={16} />} tone="check" />
        </KpiGrid>
        <InsetList label="Danh sách chiếc">
          {UNITS.map((u) => (
            <InsetRow
              key={u.code}
              href="/dong-ho"
              thumb={<Watch size={26} aria-hidden="true" />}
              title={u.name}
              subtitle={u.code}
              end={formatVnd(u.price)}
              endSub={<StatusChip kind="unit" status={u.status} />}
            />
          ))}
          <InsetRow icon={<PackageSearch size={20} />} tone="hold" title="Đơn CTV chờ xác nhận" subtitle="2 đơn mới" end="2" chevron />
        </InsetList>
        <div className="wf-pgrid">
          {UNITS.map((u) => (
            <ProductCard
              key={u.code}
              name={u.name}
              code={u.code}
              price={u.price}
              status={u.status}
              placeholder={<Watch size={56} aria-hidden="true" style={{ color: "var(--wf-accent)" }} />}
              onAdd={() => setCart(cart === u.code ? null : u.code)}
              inCart={cart === u.code}
            />
          ))}
        </div>
        <GlassCard padded>
          <KeyValue items={[{ label: "Mã nội bộ", value: "WF-000412" }, { label: "Serial", value: "SN-88213" }, { label: "Vị trí", value: "Tủ A · Ngăn 2" }, { label: "Giá bán", value: formatVnd(8_200_000) }]} />
          <LockNote />
          <div style={{ marginTop: 14 }}>
            <Timeline items={[{ title: "Đã bán cho Nguyễn Văn A", meta: "16/10/2026 · 14:32" }, { title: "Giữ hàng đặt cọc 2.000.000 ₫", meta: "14/10/2026" }, { title: "Nhập kho", meta: "02/10/2026" }]} />
          </div>
        </GlassCard>
        <GlassCard padded>
          <div className="wf-dev-row">
            <ProgressRing value={65} tone="repair" />
            <ProgressRing value={100} tone="ok" />
            <ProgressRing value={20} tone="info" size={72} stroke={8} />
            <ProgressRing value={0} />
          </div>
        </GlassCard>
      </div>
    </Sec>
  );
}

function Charts() {
  const fmt = (n: number) => formatVndShort(n);
  const [show, setShow] = useState("rev");
  return (
    <Sec id="s-chart" title="Biểu đồ (SVG nhẹ)">
      <div className="wf-dev-grid">
        <GlassCard padded>
          <SegmentedControl ariaLabel="Chỉ số biểu đồ" mode="tabs" value={show} onChange={setShow} options={[{ value: "rev", label: "Doanh thu" }, { value: "gp", label: "Lãi gộp" }]} />
          <AreaChart data={REVENUE.map((d) => (show === "gp" ? { ...d, value: Math.round(d.value * 0.21) } : d))} color={show === "gp" ? "var(--wf-ok)" : "var(--wf-accent)"} format={fmt} ariaLabel={show === "gp" ? "Lãi gộp 7 ngày" : "Doanh thu 7 ngày"} />
        </GlassCard>
        <GlassCard padded>
          <BarChart data={BARS} format={fmt} ariaLabel="Doanh thu theo tháng" />
        </GlassCard>
        <GlassCard padded>
          <Donut segments={BRANDS} center={{ title: "100", caption: "chiếc" }} ariaLabel="Tỷ trọng thương hiệu" format={(n) => `${n}%`} />
        </GlassCard>
        <GlassCard padded>
          <div className="wf-dev-row">
            <Ring value={72} label="72%" />
            <Ring value={40} tone="ok" size={80} stroke={9} />
            <AreaChart data={[]} ariaLabel="Chưa có dữ liệu" />
          </div>
        </GlassCard>
      </div>
    </Sec>
  );
}

function Overlays() {
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [danger, setDanger] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  return (
    <Sec id="s-ovl" title="Modal / BottomSheet · ActionSheet · ConfirmDialog">
      <GlassCard padded>
        <div className="wf-dev-row">
          <Button onClick={() => setModal(true)}>Mở Modal</Button>
          <Button onClick={() => setSheet(true)}>Mở ActionSheet</Button>
          <Button onClick={() => setConfirm(true)}>Xác nhận thường</Button>
          <Button variant="danger" onClick={() => setDanger(true)}>
            Hủy phiếu (lý do ≥ 10 ký tự)
          </Button>
        </div>
      </GlassCard>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nhận máy sửa"
        footer={
          <>
            <Button onClick={() => setModal(false)}>Đóng</Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Tiếp tục
            </Button>
          </>
        }
      >
        <Stepper steps={["Khách", "Máy", "Lỗi"]} current={0} />
        <Field label="Số điện thoại khách">
          <PhoneInput value="" onChange={() => {}} />
        </Field>
        <Field label="Thương hiệu (bảng chọn nằm trên Modal)">
          <Select placeholder="Chọn thương hiệu" options={["Seiko", "Casio", "Orient", "Citizen", "Tissot"].map((b) => ({ value: b, label: b }))} />
        </Field>
        <Field label="Hẹn trả máy">
          <DateInput value="" onChange={() => {}} />
        </Field>
        <p className="wf-mute">Esc đóng lớp trên cùng, Tab bị giữ trong hộp, nền không cuộn.</p>
      </Modal>
      <ActionSheet
        open={sheet}
        onClose={() => setSheet(false)}
        actions={[
          { id: "a", label: "Bán hàng", tone: "ok", icon: <Watch size={20} />, onSelect: () => toast.success("Mở phiếu bán") },
          { id: "b", label: "Nhập hàng", tone: "info", icon: <Boxes size={20} />, onSelect: () => toast.info("Mở phiếu nhập") },
          { id: "c", label: "Nhận máy sửa", tone: "repair", icon: <BarChart3 size={20} /> },
        ]}
      />
      <ConfirmDialog open={confirm} title="Xác nhận phiếu bán?" message="Sẽ trừ kho 1 chiếc và ghi nhận thu 8.200.000 ₫." confirmLabel="Xác nhận" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
      <ConfirmDialog
        open={danger}
        danger
        requireReason
        loading={loading}
        title="Hủy phiếu bán PB-000231?"
        message="Sẽ trả máy về kho và hủy thanh toán 8.200.000 ₫. Không hoàn tác được."
        confirmLabel="Hủy phiếu"
        onCancel={() => setDanger(false)}
        onConfirm={() => {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            setDanger(false);
            toast.success("Đã hủy phiếu", "Máy đã trả về kho");
          }, 1000);
        }}
      />
    </Sec>
  );
}

const SOURCES = [
  { value: "1", label: "Anh Hùng - Chợ Lớn", sublabel: "3 phiếu · gần nhất 17/10/2026" },
  { value: "2", label: "Cửa hàng Hồng Hạnh", sublabel: "2 phiếu · gần nhất 02/10/2026" },
  { value: "3", label: "Đồng hồ Đà Nẵng", sublabel: "1 phiếu · gần nhất 28/09/2026" },
  { value: "4", label: "Khách bán lại", sublabel: "5 phiếu · gần nhất 15/10/2026" },
];

/** Bảo vệ đóng (dirty/busy) cho Modal & DetentSheet + Combobox (ui-design-system §5.2, §5.3) */
function GuardsDemo() {
  const [modal, setModal] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [det, setDet] = useState<Detent>(0);
  const [dText, setDText] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [src, setSrc] = useState("");
  const toast = useToast();
  const fake = (setB: (b: boolean) => void, done: () => void) => {
    setB(true);
    setTimeout(() => {
      setB(false);
      done();
      toast.success("Đã lưu");
    }, 1800);
  };
  return (
    <Sec id="s-guard" title="Bảo vệ form (dirty/busy) · Combobox">
      <GlassCard padded>
        <div className="wf-dev-row">
          <Button onClick={() => setModal(true)}>Modal dirty + busy</Button>
          <Button onClick={() => setDet(1)}>DetentSheet dirty + busy</Button>
        </div>
        <Field label="Nguồn hàng (Combobox — gõ tự do + gợi ý không dấu)" hint="Thử gõ “cho”, “dong ho”, “anh h” rồi Tab / ↑↓ Enter / Esc">
          <Combobox value={src} onChange={setSrc} options={SOURCES} heading="Nguồn đã dùng gần đây" />
        </Field>
      </GlassCard>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        dirty={!!text.trim()}
        busy={busy}
        title="Thêm ghi chú"
        footer={
          <>
            <ModalClose>Hủy</ModalClose>
            <Button variant="primary" guard disabled={!text.trim()} onClick={() => fake(setBusy, () => { setModal(false); setText(""); })}>Lưu</Button>
          </>
        }
      >
        <Field label="Ghi chú" hint="Gõ gì đó rồi bấm ra ngoài / Esc / X / Hủy: hộp hỏi “Bỏ thay đổi chưa lưu?”. Bấm Lưu: lớp “Đang xử lý…”.">
          <TextInput value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Nguồn (Combobox trong hộp thoại: Esc chỉ đóng danh sách)">
          <Combobox value={src} onChange={setSrc} options={SOURCES} />
        </Field>
      </Modal>
      <DetentSheet
        detent={det}
        onDetent={setDet}
        dirty={!!dText.trim()}
        busy={dBusy}
        title="Phiếu nháp"
        footer={<Button variant="primary" block guard disabled={!dText.trim()} onClick={() => fake(setDBusy, () => { setDet(0); setDText(""); })}>Lưu phiếu</Button>}
      >
        <Field label="Ghi chú phiếu">
          <TextInput value={dText} onChange={(e) => setDText(e.target.value)} />
        </Field>
        <p className="wf-mute">Vuốt xuống / bấm nền / Esc khi đang có chữ: hỏi bỏ thay đổi, tờ bật về mức cũ.</p>
      </DetentSheet>
    </Sec>
  );
}

function Toasts() {
  const t = useToast();
  return (
    <Sec id="s-toast" title="Toast (Lucian #070) — bấm nhiều lần rồi rê chuột để xòe">
      <GlassCard padded>
        <div className="wf-dev-row">
          <Button onClick={() => t.success("Đã lưu thay đổi", "Phiếu bán PB-000231")}>Thành công</Button>
          <Button onClick={() => t.error("Không lưu được", "Kiểm tra kết nối rồi thử lại")}>Lỗi</Button>
          <Button onClick={() => t.info("Có đơn CTV mới", "Phạm Minh CTV · 1 chiếc")}>Thông tin</Button>
          <Button onClick={() => t.warning("Sắp hết hạn giữ hàng", "Còn 1 ngày")}>Cảnh báo</Button>
          <Button
            onClick={() => {
              void t.promise(new Promise((r) => setTimeout(r, 1500)), { loading: "Đang lưu…", success: "Đã lưu xong", error: "Lưu thất bại" });
            }}
          >
            Đang xử lý → xong
          </Button>
          <Button onClick={() => t.toast({ title: "Đã hủy phiếu", description: "Hoàn tác trong 5 giây", action: { label: "Hoàn tác", onClick: () => t.info("Đã hoàn tác") }, duration: 5000 })}>Có nút hành động</Button>
        </div>
      </GlassCard>
    </Sec>
  );
}

function LucianBits() {
  const [attempts, setAttempts] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [amount, setAmount] = useState(0);
  const due = 8_200_000;
  return (
    <Sec id="s-lucian" title="Phần tử Lucian: ô mã 6 số (#026) · thẻ đăng nhập (#062) · nhập số tiền (#035)">
      <div className="wf-dev-grid">
        <GlassCard padded>
          <Cap>OtpInput — mã đúng là 482915</Cap>
          <OtpInput onComplete={(c) => new Promise((r) => setTimeout(() => r(c === "482915"), 400))} />
        </GlassCard>
        <GlassCard padded>
          <Cap>MoneyAmountInput — khách đưa (cần trả {formatVnd(due)})</Cap>
          <MoneyAmountInput
            value={amount}
            onChange={setAmount}
            fullAmount={due}
            quickAdds={[100_000, 500_000, 1_000_000]}
            subText={(v) => (v >= due ? `Tiền thừa: ${formatVnd(v - due)}` : v > 0 ? `Còn thiếu: ${formatVnd(due - v)}` : "Nhập số tiền khách đưa")}
          />
        </GlassCard>
        <div>
          <Cap>LoginCard — mật khẩu đúng: demo1234 (sai 3 lần là hết lượt)</Cap>
          <LoginCard
            loading={loading}
            success={ok}
            error={err}
            attemptsLeft={err ? attempts : undefined}
            onSubmit={(_, pw) => {
              setLoading(true);
              setErr(null);
              setTimeout(() => {
                setLoading(false);
                if (pw === "demo1234") {
                  setOk(true);
                  setTimeout(() => setOk(false), 2500);
                } else {
                  setAttempts((a) => Math.max(0, a - 1));
                  setErr("Sai email hoặc mật khẩu");
                }
              }, 900);
            }}
            onForgot={() => {}}
          />
        </div>
      </div>
    </Sec>
  );
}

function PaymentDemo() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [debt, setDebt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(2);
  const [chips, setChips] = useState(["Hãng: Seiko", "Tồn lâu"]);
  return (
    <Sec id="s-pay" title="PaymentSheet (M3) · Lucian #008 #018 #305">
      <GlassCard padded>
        <div className="wf-dev-row">
          <Button variant="primary" onClick={() => setOpen(true)}>Mở tờ thanh toán (8.200.000 ₫)</Button>
          <Switch checked={debt} onChange={setDebt} label="Cho ghi nợ" />
        </div>
        <Cap>Sao chép mã (#008) · Bộ chỉnh số lượng (#018) · Nút lọc + chip (#305)</Cap>
        <div className="wf-dev-row">
          <CopyCodeButton text="WF-000412" />
          <QuantityStepper ariaLabel="Số lượng điều chỉnh" value={qty} onChange={setQty} min={-20} max={20} signed />
          <FilterButton count={chips.length} expanded={false} onClick={() => setChips(["Hãng: Seiko", "Tồn lâu", "Vị trí: Tủ A"])} />
        </div>
        <ActiveFilterChips chips={chips.map((c) => ({ id: c, label: c, onRemove: () => setChips((l) => l.filter((x) => x !== c)) }))} />
      </GlassCard>
      <PaymentSheet
        open={open}
        onClose={() => setOpen(false)}
        payable={8_200_000}
        allowDebt={debt}
        submitting={busy}
        onSubmit={(lines: PaymentLineInput[]) => {
          setBusy(true);
          setTimeout(() => {
            setBusy(false);
            setOpen(false);
            toast.success("Đã ghi nhận thanh toán", lines.map((l) => `${l.method === "cash" ? "TM" : "CK"} ${formatVnd(l.amount)}`).join(" + "));
          }, 800);
        }}
      />
    </Sec>
  );
}

function States() {
  const [offline, setOffline] = useState(false);
  const [tries, setTries] = useState(0);
  return (
    <Sec id="s-state" title="Rỗng · Lỗi · Skeleton · Mất mạng">
      <div className="wf-dev-grid">
        <GlassCard padded>
          <Cap>EmptyState — hướng dẫn bắt đầu</Cap>
          <EmptyState title="Bạn chưa có phiếu giữ hàng" description="Bắt đầu bằng việc giữ một chiếc cho khách đặt cọc." icon={<Lock size={24} />} action={{ label: "Giữ hàng mới", href: "/giu-hang?moi=1" }} />
        </GlassCard>
        <GlassCard padded>
          <Cap>EmptyState — không có kết quả (Lucian #092)</Cap>
          <EmptyState
            variant="search"
            title="Không có “Seiko” với các bộ lọc này"
            description="Bỏ bớt một bộ lọc để xem kết quả"
            suggestions={[{ removed: "Đang ở CTV", count: 6, onClick: () => {} }, { removed: "Dưới 5 triệu", count: 2, onClick: () => {} }]}
          />
        </GlassCard>
        <GlassCard padded>
          <Cap>ErrorState — tự thử lại (Lucian #090); lần thử thứ 3 mới thành công</Cap>
          {tries >= 2 ? (
            <p role="status" style={{ padding: 24, textAlign: "center", fontWeight: 600 }}>
              Đã kết nối lại.{" "}
              <Button sm onClick={() => setTries(0)}>
                Chạy lại demo
              </Button>
            </p>
          ) : (
            <ErrorState
              autoRetrySeconds={5}
              details={"GET /api/v1/reports/sales\n503 Dịch vụ tạm ngừng\nMã yêu cầu 7f3a-c21e"}
              onRetry={async () => {
                await new Promise((r) => setTimeout(r, 900));
                setTries((n) => n + 1);
                return tries + 1 >= 2;
              }}
            />
          )}
        </GlassCard>
        <GlassCard padded>
          <Cap>Skeleton (Lucian #079)</Cap>
          <SkeletonKpis />
          <div style={{ height: 12 }} />
          <SkeletonList rows={3} />
          <div className="wf-dev-row" style={{ marginTop: 12 }}>
            <Skeleton w={42} h={42} circle />
            <Skeleton w={160} h={14} />
          </div>
        </GlassCard>
        <GlassCard padded>
          <Cap>OfflineBanner (mất mạng thật cũng tự hiện)</Cap>
          <Switch checked={offline} onChange={setOffline} label="Giả lập mất kết nối" />
          {offline && <OfflineBanner force />}
        </GlassCard>
      </div>
    </Sec>
  );
}

function Content() {
  return (
    <>
      <PageHeader title="Mẫu giao diện" context="Chỉ cho dev · /dev/design" description="Mọi thành phần Glass ở mọi trạng thái" />
      <Tokens />
      <Chips />
      <Buttons />
      <Fields />
      <Nav />
      <Data />
      <Charts />
      <Overlays />
      <GuardsDemo />
      <Toasts />
      <LucianBits />
      <PaymentDemo />
      <States />
    </>
  );
}

export function DesignShowcase() {
  const [role, setRole] = useState("owner");
  const demo = useMemo<DemoUser>(() => {
    const r = ROLE_PERMS[role]!;
    return { ...r.user, perms: r.perms };
  }, [role]);
  return (
    <ToastProvider>
      <AppShell demoUser={demo} unread>
        <GlassCard padded className="wf-dev-sec" style={{ marginTop: 8 }}>
          <Cap>Giao diện — Sáng / Tối / Theo hệ thống (lưu trên thiết bị)</Cap>
          <ThemeSwitch />
          <Cap>Vai trò demo — đổi để xem dock, menu, nút “+” theo quyền</Cap>
          <SegmentedControl
            ariaLabel="Vai trò demo"
            value={role}
            onChange={setRole}
            options={Object.entries(ROLE_PERMS).map(([value, v]) => ({ value, label: v.label.replace("Nhân viên bán hàng", "NV bán").replace("Cộng tác viên", "CTV").replace("Quản lý kho", "Kho").replace("Chủ cửa hàng", "Chủ") }))}
          />
        </GlassCard>
        <Content />
      </AppShell>
    </ToastProvider>
  );
}
