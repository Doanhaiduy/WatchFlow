// Đăng ký điều hướng (ui-design-system §4.3). Hiển thị theo QUYỀN, không theo tên vai trò (BR-SEC-01).
// Chỉ là UX: ẩn/hiện mục. Máy chủ & DB luôn kiểm lại quyền.
import {
  BarChart3, BookOpen, FileSpreadsheet, Bell, Bookmark, Boxes, ClipboardCheck, ClipboardList, Handshake, Home, Inbox, MapPin, Package, PackagePlus, QrCode, Search,
  Settings, ShieldCheck, ShoppingBag, Truck, UserPlus, UserRound, Users, Watch, Wrench, type LucideIcon,
} from "lucide-react";
import { can as hasPerm, type Permission } from "@/lib/permissions";
import type { Tone } from "../ui/cx";

export type CanFn = (p: Permission | Permission[]) => boolean;
export type NavGroupId = "ops" | "partners" | "system" | "ctv" | "me";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  /** Nhãn ngắn dưới biểu tượng ở dock */
  short?: string;
  icon: LucideIcon;
  /** Bỏ trống = mọi người dùng đã đăng nhập. Mảng = có BẤT KỲ quyền nào */
  permission?: Permission | Permission[];
  group: NavGroupId;
  order: number;
  tone?: Tone;
  /** Chỉ sáng khi đúng đường dẫn (không sáng cho đường con) */
  exact?: boolean;
  /** false = có trong sidebar/menu? (mặc định true) — POS chỉ vào từ "+" */
  inMenu?: boolean;
};

export const NAV_GROUPS: Record<NavGroupId, { label: string; order: number }> = {
  ops: { label: "Vận hành", order: 1 },
  partners: { label: "Khách & đối tác", order: 2 },
  system: { label: "Kho & hệ thống", order: 3 },
  ctv: { label: "Cộng tác viên", order: 4 },
  me: { label: "Tài khoản", order: 5 },
};

export const NAV: NavItem[] = [
  // Vận hành
  { id: "home", href: "/", label: "Tổng quan", icon: Home, group: "ops", order: 10, tone: "info", exact: true },
  { id: "sales", href: "/ban-hang", label: "Bán hàng", icon: ShoppingBag, group: "ops", order: 20, tone: "ok", permission: ["sale.view", "sale.view_own", "sale.create_draft"] },
  { id: "units", href: "/dong-ho", label: "Đồng hồ", icon: Watch, group: "ops", order: 30, tone: "check", permission: "catalog.view" },
  { id: "purchases", href: "/nhap-hang", label: "Nhập hàng", icon: PackagePlus, group: "ops", order: 40, tone: "info", permission: "purchase.view" },
  { id: "repairs", href: "/sua-chua", label: "Sửa chữa", icon: Wrench, group: "ops", order: 50, tone: "repair", permission: "repair.view" },
  { id: "pos", href: "/ban-hang/moi", label: "Bán nhanh (POS)", icon: ShoppingBag, group: "ops", order: 25, tone: "ok", permission: "sale.create_draft", inMenu: false },
  // Khách & đối tác
  { id: "customers", href: "/khach-hang", label: "Khách hàng", short: "Khách", icon: Users, group: "partners", order: 10, tone: "info", permission: ["customer.view", "customer.view_own"] },
  { id: "reservations", href: "/giu-hang", label: "Giữ hàng", icon: Bookmark, group: "partners", order: 20, tone: "hold", permission: "reservation.manage" },
  { id: "warranties", href: "/bao-hanh", label: "Bảo hành", icon: ShieldCheck, group: "partners", order: 30, tone: "ok", permission: "warranty.view" },
  { id: "collaborators", href: "/cong-tac-vien", label: "Cộng tác viên", short: "CTV", icon: Handshake, group: "partners", order: 40, tone: "check", permission: "collab.view" },
  // Kho & hệ thống
  { id: "parts", href: "/linh-kien", label: "Linh kiện", icon: Boxes, group: "system", order: 10, tone: "repair", permission: "part.view" },
  { id: "locations", href: "/vi-tri-kho", label: "Vị trí kho", icon: MapPin, group: "system", order: 15, tone: "check", permission: "location.manage" },
  { id: "import", href: "/nhap-excel", label: "Nhập từ Excel", short: "Excel", icon: FileSpreadsheet, group: "system", order: 17, tone: "ok", permission: ["customer.create", "purchase.create"] },
  { id: "stocktakes", href: "/kiem-ke", label: "Kiểm kê", icon: ClipboardCheck, group: "system", order: 20, tone: "check", permission: "stocktake.manage" },
  { id: "reports", href: "/bao-cao", label: "Báo cáo", icon: BarChart3, group: "system", order: 30, tone: "info", permission: ["report.sales", "report.inventory"] },
  { id: "admin", href: "/quan-tri", label: "Quản trị", icon: Settings, group: "system", order: 40, tone: "neutral", permission: ["user.manage", "role.manage", "settings.view", "audit.view", "system.health"] },
  // Cộng tác viên (màn hình của CTV)
  { id: "ctv-stock", href: "/ctv", label: "Hàng đang giữ", short: "Hàng", icon: Package, group: "ctv", order: 10, tone: "info", permission: "collab.view_own", exact: true },
  { id: "ctv-sales", href: "/ctv/don", label: "Đơn của tôi", icon: ClipboardList, group: "ctv", order: 20, tone: "ok", permission: "collab.view_own" },
  { id: "ctv-stats", href: "/ctv/thong-ke", label: "Thống kê", icon: BarChart3, group: "ctv", order: 30, tone: "check", permission: "collab.view_own" },
  { id: "ctv-me", href: "/ctv/toi", label: "Tài khoản của tôi", short: "Tôi", icon: UserRound, group: "ctv", order: 40, tone: "neutral", permission: "collab.view_own" },
  // Tài khoản
  { id: "guide", href: "/huong-dan", label: "Hướng dẫn", icon: BookOpen, group: "me", order: 15, tone: "info" },
  { id: "me", href: "/cai-dat", label: "Tài khoản", short: "Tôi", icon: UserRound, group: "me", order: 10, tone: "neutral" },
  { id: "notifications", href: "/thong-bao", label: "Thông báo", icon: Bell, group: "me", order: 20, tone: "hold", inMenu: false },
];

/** Các tab con của Quản trị (hiện trong sidebar khi đang ở /admin) */
export const ADMIN_TABS: Array<{ href: string; label: string; permission?: Permission | Permission[] }> = [
  { href: "/quan-tri/nguoi-dung", label: "Người dùng", permission: "user.manage" },
  { href: "/quan-tri/vai-tro", label: "Vai trò & quyền", permission: "role.manage" },
  { href: "/quan-tri/cai-dat", label: "Cài đặt", permission: "settings.view" },
  { href: "/quan-tri/nhat-ky", label: "Nhật ký", permission: "audit.view" },
  { href: "/quan-tri/hoat-dong", label: "Hoạt động", permission: "audit.view" },
  { href: "/quan-tri/he-thong", label: "Hệ thống & sao lưu", permission: ["system.health", "system.backup"] },
  { href: "/quan-tri/phien-ban", label: "Phiên bản" },
];

const byId = new Map(NAV.map((n) => [n.id, n]));
export const navItem = (id: string) => byId.get(id);

export function allowed(item: { permission?: Permission | Permission[] }, can: CanFn): boolean {
  return item.permission === undefined || can(item.permission);
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Mục nav khớp nhất với đường dẫn (dùng lấy tiêu đề thanh trên) */
export function matchNav(pathname: string): NavItem | undefined {
  return [...NAV].filter((n) => isActive(n, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
}

export type MenuGroup = { id: NavGroupId; label: string; items: NavItem[] };

/** Nhóm + mục hiển thị trong Menu/Sidebar cho người dùng này (đã lọc quyền, sắp thứ tự) */
/** CTV có điều hướng riêng (/ctv): ẩn các mục chung trùng chức năng */
const CTV_HIDDEN = new Set(["home", "me"]);
export function menuGroups(can: CanFn): MenuGroup[] {
  const ctvOnly = detectProfile(can) === "ctv";
  return (Object.keys(NAV_GROUPS) as NavGroupId[])
    .sort((a, b) => NAV_GROUPS[a].order - NAV_GROUPS[b].order)
    .map((g) => ({
      id: g,
      label: NAV_GROUPS[g].label,
      items: NAV.filter((n) => n.group === g && n.inMenu !== false && allowed(n, can) && !(ctvOnly && (CTV_HIDDEN.has(n.id) || n.group === "ops" || n.group === "partners" || n.group === "system"))).sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.items.length > 0);
}

// ---------- Hồ sơ vai trò (suy từ quyền) → dock & hành động "+" ----------
export type Profile = "owner" | "sales" | "warehouse" | "ctv" | "general";

/** Suy ra "dáng" người dùng từ quyền (không dùng tên vai trò). Chỉ để chọn bố cục dock mặc định. */
export function detectProfile(can: CanFn): Profile {
  if (can("collab.view_own") && !can("collab.view")) return "ctv";
  if (can(["cost.view", "profit.view"])) return "owner";
  if (can("stocktake.manage") && !can("sale.create_draft")) return "warehouse";
  if (can("sale.create_draft")) return "sales";
  return "general";
}

// 2 mục trái + 1 mục phải (mục phải thứ 2 luôn là Menu, hoặc "Tôi" với CTV)
const DOCK: Record<Profile, { left: string[]; right: string[] }> = {
  owner: { left: ["home", "units"], right: ["sales"] },
  sales: { left: ["sales", "units"], right: ["customers"] },
  warehouse: { left: ["home", "units"], right: ["parts"] },
  ctv: { left: ["ctv-stock", "ctv-sales"], right: ["ctv-stats"] },
  general: { left: ["home", "units"], right: ["sales"] },
};
const DOCK_FALLBACK = ["home", "units", "sales", "customers", "parts", "repairs", "reservations", "reports"];

export type DockLayout = { profile: Profile; left: NavItem[]; right: NavItem[]; last: "menu" | NavItem };

/** Dock theo quyền: lọc mục không được phép rồi bù bằng mục kế tiếp để luôn đủ 2 trái + 1 phải */
export function resolveDock(can: CanFn): DockLayout {
  const profile = detectProfile(can);
  const pick = (ids: string[]) => ids.map(navItem).filter((n): n is NavItem => !!n && allowed(n, can));
  const preset = DOCK[profile];
  const used = new Set<string>();
  const take = (ids: string[], n: number): NavItem[] => {
    const out: NavItem[] = [];
    for (const it of [...pick(ids), ...(profile === "ctv" ? [] : pick(DOCK_FALLBACK))]) {
      if (out.length >= n) break;
      if (!used.has(it.id)) {
        used.add(it.id);
        out.push(it);
      }
    }
    return out;
  };
  const left = take(preset.left, 2);
  const right = take(preset.right, 1);
  return { profile, left, right, last: profile === "ctv" ? (navItem("ctv-me") as NavItem) : "menu" };
}

// ---------- Hành động nhanh của nút "+" ----------
export type QuickAction = { id: string; label: string; icon: LucideIcon; href: string; permission: Permission | Permission[]; tone: Tone };

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "sell", label: "Bán hàng", icon: ShoppingBag, href: "/ban-hang/moi", permission: "sale.create_draft", tone: "ok" },
  { id: "purchase", label: "Nhập hàng", icon: PackagePlus, href: "/nhap-hang/moi", permission: "purchase.create", tone: "info" },
  { id: "repair", label: "Nhận máy sửa", icon: Wrench, href: "/sua-chua/moi", permission: "repair.create", tone: "repair" },
  { id: "reserve", label: "Giữ hàng / đặt cọc", icon: Bookmark, href: "/giu-hang?moi=1", permission: "reservation.manage", tone: "hold" },
  { id: "deliver-ctv", label: "Giao hàng cho CTV", icon: Truck, href: "/cong-tac-vien/giao-hang/moi", permission: "collab.manage", tone: "check" },
  { id: "add-customer", label: "Thêm khách", icon: UserPlus, href: "/khach-hang?moi=1", permission: "customer.create", tone: "info" },
  { id: "ctv-pending", label: "Đơn CTV chờ xác nhận", icon: Inbox, href: "/ban-hang?trang-thai=ctv_draft", permission: "sale.confirm", tone: "hold" },
  { id: "quick-unit", label: "Nhập nhanh một chiếc", icon: Watch, href: "/dong-ho/moi", permission: "catalog.manage", tone: "ok" },
  { id: "stocktake", label: "Kiểm kê", icon: ClipboardCheck, href: "/kiem-ke", permission: "stocktake.manage", tone: "check" },
  { id: "print-qr", label: "In tem QR", icon: QrCode, href: "/dong-ho?in=qr", permission: "catalog.view", tone: "neutral" },
  { id: "ctv-new", label: "Tạo đơn bán", icon: ShoppingBag, href: "/ctv/tao-don", permission: "collab.view_own", tone: "ok" },
  { id: "ctv-find", label: "Tìm chiếc đang giữ", icon: Search, href: "/ctv?tim=1", permission: "collab.view_own", tone: "info" },
];

const QUICK: Record<Profile, string[]> = {
  owner: ["sell", "purchase", "repair", "reserve", "deliver-ctv"],
  sales: ["sell", "reserve", "add-customer", "ctv-pending"],
  warehouse: ["purchase", "quick-unit", "stocktake", "print-qr"],
  ctv: ["ctv-new", "ctv-find"],
  general: ["sell", "purchase", "repair", "reserve", "add-customer"],
};

/** Hành động nhanh cho "+" (đã lọc quyền, đúng thứ tự §4.3) */
export function quickActions(can: CanFn): QuickAction[] {
  const ids = QUICK[detectProfile(can)];
  return ids
    .map((id) => QUICK_ACTIONS.find((a) => a.id === id))
    .filter((a): a is QuickAction => !!a && can(a.permission));
}

const ROLE_LABELS: Record<string, string> = { owner: "Chủ cửa hàng", sales: "Nhân viên bán hàng", warehouse: "Quản lý kho", collaborator: "Cộng tác viên" };
/** Tên hiển thị của vai trò hệ thống (mã lạ giữ nguyên) */
export function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

/** Tạo `can` từ danh sách quyền (dùng cho bản demo/test) */
export function canFromPerms(perms: readonly string[]): CanFn {
  return (p) => hasPerm(perms, p);
}
