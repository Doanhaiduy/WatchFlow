"use client";
// Minh họa giao diện trong hướng dẫn: dựng bằng chính lớp Glass của ứng dụng (chip trạng thái, viên số việc, dòng phiếu…) với dữ liệu giả.
// Mọi khung là hình tĩnh (aria-hidden) kèm chú thích chữ; số liệu chỉ là ví dụ.
import { Bell, Home, Menu, Plus, ScanLine, Search, ShoppingBag, Watch } from "lucide-react";
import type { ReactNode } from "react";
import type { GuideDemo } from "@/content/guide";
import { StatusChip } from "../ui/StatusChip";
import "../layout/shell-extras.css";

function Frame({ caption, children, label }: { caption?: string; children: ReactNode; label: string }) {
  return (
    <figure className="wf-gd-demo" aria-label={label}>
      <div className="wf-gd-demo-in" aria-hidden="true">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Mk({ n, style }: { n: number; style: React.CSSProperties }) {
  return <span className="mk" style={style}>{n}</span>;
}

function LayoutDesktop({ caption }: { caption?: string }) {
  const items = ["Tổng quan", "Bán hàng", "Đồng hồ", "Sửa chữa", "Cộng tác viên"];
  return (
    <Frame label="Minh họa giao diện máy tính: thanh bên, ô tìm nhanh, quét QR và chuông, nút hành động chính" caption={caption}>
      <div className="wf-gd-dk">
        <div className="isl g-flat">
          <div className="brand"><i><Watch size={13} /></i><b>WatchFlow</b></div>
          {items.map((t, i) => (
            <div key={t} className={i === 1 ? "it on" : "it"}>
              <span className="ic" />
              <span>{t}</span>
              {t === "Cộng tác viên" && <span className="wf-nb warn wf-nb-row">2</span>}
            </div>
          ))}
          <div className="me"><span className="av">A</span><span className="tx"><b>Tên bạn</b><small>Vai trò</small></span></div>
          <Mk n={1} style={{ left: -6, top: 36 }} />
        </div>
        <div className="main">
          <div className="tb g-flat">
            <b>Bán hàng</b>
            <span className="ttl" />
            <span className="s"><Search size={11} /> Tìm mã, serial, khách… <kbd>Ctrl K</kbd></span>
            <span className="cb"><ScanLine size={12} /></span>
            <span className="cb"><Bell size={12} /></span>
            <span className="pri"><ShoppingBag size={11} /> Bán hàng</span>
            <Mk n={2} style={{ left: "26%", top: -9 }} />
            <Mk n={3} style={{ right: 88, top: -9 }} />
            <Mk n={4} style={{ right: -6, top: -9 }} />
          </div>
          <div className="body">
            <span className="blk w60" />
            <span className="blk w40" />
            <span className="blk w100 h" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function LayoutMobile({ caption }: { caption?: string }) {
  return (
    <Frame label="Minh họa giao diện điện thoại: tiêu đề, nội dung, thanh dưới cùng với nút cộng ở giữa" caption={caption}>
      <div className="wf-gd-ph">
        <div className="top"><small>Quay lại</small><span className="cb"><Search size={12} /></span><span className="cb"><Bell size={12} /></span></div>
        <b className="h">Bán hàng</b>
        <span className="blk w100" />
        <span className="blk w60" />
        <span className="blk w100 h" />
        <div className="dock g-flat">
          <span className="d on"><Home size={15} />Tổng quan</span>
          <span className="d"><Watch size={15} />Đồng hồ</span>
          <span className="d plus"><i><Plus size={18} /></i></span>
          <span className="d"><ShoppingBag size={15} />Bán hàng</span>
          <span className="d"><Menu size={15} />Menu</span>
        </div>
      </div>
    </Frame>
  );
}

function Badges() {
  return (
    <Frame label="Minh họa viên số việc cần xử lý: vàng là đang chờ, đỏ là có việc quá hạn">
      <div className="wf-gd-badges">
        <div className="row"><span className="ic" /><b>Cộng tác viên</b><small>Vàng: đang chờ xử lý</small><span className="wf-nb warn wf-nb-row">3</span></div>
        <div className="row"><span className="ic" /><b>Sửa chữa</b><small>Đỏ: có việc quá hạn</small><span className="wf-nb bad wf-nb-row">1</span></div>
      </div>
    </Frame>
  );
}

function Shortcuts() {
  const rows: [string[], string][] = [
    [["Ctrl", "K"], "Mở ô tìm nhanh (Mac: ⌘K)"],
    [["/"], "Mở ô tìm nhanh khi không đang gõ"],
    [["↑", "↓"], "Chọn kết quả"],
    [["Enter"], "Mở kết quả đang chọn"],
    [["Esc"], "Đóng"],
  ];
  return (
    <Frame label="Phím tắt của ô tìm nhanh">
      <div className="wf-gd-keys">
        {rows.map(([k, t]) => (
          <div key={t} className="r"><span className="k">{k.map((x) => <kbd key={x}>{x}</kbd>)}</span><span>{t}</span></div>
        ))}
      </div>
    </Frame>
  );
}

const UNIT_STATES: [string, string][] = [
  ["in_stock", "Có thể bán ngay — kể cả khi đang giao cho CTV"],
  ["inspecting", "Hàng cũ chờ chụp ảnh và kiểm tra đạt"],
  ["in_repair", "Máy của cửa hàng đang sửa"],
  ["sold", "Đã bán cho khách (hoặc CTV bán, cửa hàng đã xác nhận)"],
  ["written_off", "Đã ghi mất hoặc thanh lý"],
];

function UnitStates() {
  return (
    <Frame label="Các trạng thái của một chiếc đồng hồ">
      <div className="wf-gd-states">
        {UNIT_STATES.map(([s, t]) => (
          <div key={s} className="r"><StatusChip kind="unit" status={s} /><span>{t}</span></div>
        ))}
      </div>
    </Frame>
  );
}

/** Một chiếc giao cho 3 CTV: ai báo "Đã bán" trước được giữ, hai người còn lại tự mất quyền */
function MultiCtv({ caption }: { caption?: string }) {
  const rows: { name: string; chip: ReactNode; note: string }[] = [
    { name: "CTV An", chip: <StatusChip tone="hold">Báo “Đã bán” — chờ xác nhận</StatusChip>, note: "Báo trước ⇒ được giữ chiếc" },
    { name: "CTV Bình", chip: <StatusChip tone="neutral">Mất chiếc này</StatusChip>, note: "Báo sau, hoặc chiếc đã bán" },
    { name: "CTV Chi", chip: <StatusChip tone="info">Chưa báo</StatusChip>, note: "Vẫn thấy chiếc trong Hàng của tôi" },
  ];
  return (
    <Frame label="Ví dụ một đồng hồ giao cho ba cộng tác viên: người báo đã bán trước được giữ, người khác mất quyền" caption={caption}>
      <div className="wf-gd-states">
        <div className="r"><Watch size={18} /><span><b>Seiko 5 Sports SRPD55</b> · DH-000010 · còn trong kho</span></div>
        {rows.map((x) => (
          <div key={x.name} className="r"><b style={{ minWidth: 72 }}>{x.name}</b>{x.chip}<span>{x.note}</span></div>
        ))}
      </div>
    </Frame>
  );
}

export function DemoView({ name, caption }: { name: GuideDemo; caption?: string }) {
  switch (name) {
    case "layout-desktop": return <LayoutDesktop caption={caption} />;
    case "layout-mobile": return <LayoutMobile caption={caption} />;
    case "badges": return <Badges />;
    case "shortcuts": return <Shortcuts />;
    case "unit-states": return <UnitStates />;
    case "multi-ctv": return <MultiCtv caption={caption} />;
  }
}
