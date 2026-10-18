"use client";
// Minh họa giao diện trong hướng dẫn: dựng bằng chính lớp Glass của ứng dụng (chip trạng thái, viên số việc, dòng phiếu…) với dữ liệu giả.
// Mọi khung là hình tĩnh (aria-hidden) kèm chú thích chữ; số liệu chỉ là ví dụ.
import { Banknote, Bell, Home, Layers, Menu, Plus, QrCode, ScanLine, Search, ShoppingBag, Watch } from "lucide-react";
import type { ReactNode } from "react";
import { formatVnd } from "@/lib/money";
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
  const items = ["Tổng quan", "Bán hàng", "Đồng hồ", "Sửa chữa", "Giữ hàng"];
  return (
    <Frame label="Minh họa giao diện máy tính: thanh bên, ô tìm nhanh, quét QR và chuông, nút hành động chính" caption={caption}>
      <div className="wf-gd-dk">
        <div className="isl g-flat">
          <div className="brand"><i><Watch size={13} /></i><b>WatchFlow</b></div>
          {items.map((t, i) => (
            <div key={t} className={i === 1 ? "it on" : "it"}>
              <span className="ic" />
              <span>{t}</span>
              {t === "Giữ hàng" && <span className="wf-nb warn wf-nb-row">2</span>}
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
        <div className="row"><span className="ic" /><b>Giữ hàng</b><small>Vàng: đang chờ xử lý</small><span className="wf-nb warn wf-nb-row">3</span></div>
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
  ["in_stock", "Có thể thêm vào phiếu bán"],
  ["reserved", "Khách đã đặt cọc — không bán cho người khác"],
  ["with_collaborator", "Đã giao cho cộng tác viên"],
  ["in_repair", "Đang trong phiếu sửa nội bộ"],
  ["inspecting", "Hàng cũ/thu cũ chờ kiểm tra đạt"],
  ["sold", "Đã bán cho khách"],
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

function PosCart() {
  return (
    <Frame label="Ví dụ phiếu bán: tiền hàng, giảm giá, thu cũ và số còn phải thu" caption="Ví dụ minh họa">
      <div className="wf-gd-cart">
        <div className="wf-cart-line">
          <b>Seiko 5 Sports SRPD55</b>
          <span className="wf-mute">DH-000010 · giá niêm yết 8.400.000 ₫</span>
          <div className="price">{formatVnd(8_200_000)}</div>
        </div>
        <div className="wf-sum">
          <div><span>Tiền hàng (niêm yết)</span><b>{formatVnd(8_400_000)}</b></div>
          <div><span>Giảm giá (2,38%)</span><b>−{formatVnd(200_000)}</b></div>
          <div><span>Thu cũ</span><b>−{formatVnd(1_500_000)}</b></div>
          <div className="tot"><span>Còn phải thu</span><b>{formatVnd(6_700_000)}</b></div>
        </div>
      </div>
    </Frame>
  );
}

function MoneySplit({ caption }: { caption?: string }) {
  return (
    <Frame label="Ví dụ chia tiền đơn cộng tác viên: giá thu là doanh thu cửa hàng, phần chênh là của cộng tác viên" caption={caption}>
      <div className="wf-gd-split">
        <div className="bar">
          <span className="a" style={{ flexGrow: 8 }}>{formatVnd(8_000_000)}</span>
          <span className="b" style={{ flexGrow: 1 }}>{formatVnd(1_000_000)}</span>
        </div>
        <div className="lg">
          <span><i className="a" />Giá thu = doanh thu cửa hàng</span>
          <span><i className="b" />Phần CTV hưởng (giá bán − giá thu)</span>
        </div>
        <div className="tot">Khách trả <b>{formatVnd(9_000_000)}</b></div>
      </div>
    </Frame>
  );
}

function PaymentMethods() {
  const m = [
    { icon: <Banknote size={20} />, t: "Tiền mặt", d: "Nhập Khách đưa → thấy tiền thừa" },
    { icon: <QrCode size={20} />, t: "Chuyển khoản", d: "Hiện mã VietQR có sẵn số tiền" },
    { icon: <Layers size={20} />, t: "Kết hợp", d: "Một phần tiền mặt, một phần chuyển khoản" },
  ];
  return (
    <Frame label="Các hình thức thanh toán: tiền mặt, chuyển khoản, kết hợp">
      <div className="wf-gd-pay">
        {m.map((x) => (
          <div key={x.t} className="c"><span className="wf-ib" data-tone="ok">{x.icon}</span><b>{x.t}</b><small>{x.d}</small></div>
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
    case "pos-cart": return <PosCart />;
    case "money-split": return <MoneySplit caption={caption} />;
    case "payment-methods": return <PaymentMethods />;
  }
}
