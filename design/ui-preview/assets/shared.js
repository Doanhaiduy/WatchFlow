/* WatchFlow — bản xem thử giao diện (UI tĩnh). Dữ liệu minh họa, không phải dữ liệu thật.
   Dùng chung cho mọi mẫu: dữ liệu, đồng hồ vẽ bằng SVG, icon, biểu đồ, định tuyến tab. */
(function () {
  'use strict';
  var WF = (window.WF = {});
  var D = document;

  /* ---------- tiện ích ---------- */
  WF.$ = function (s, r) { return (r || D).querySelector(s); };
  WF.$$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  WF.num = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  WF.vnd = function (n) { return (n < 0 ? '-' : '') + WF.num(Math.abs(n)) + ' ₫'; };
  WF.short = function (n) {
    var a = Math.abs(n), s;
    if (a >= 1e9) s = (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
    else if (a >= 1e6) s = (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' tr';
    else if (a >= 1e3) s = Math.round(n / 1e3) + 'k';
    else s = String(n);
    return s.replace('.', ',');
  };
  WF.plain = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); };
  WF.initials = function (name) { var p = name.trim().split(/\s+/); return (p.length > 1 ? p[p.length - 2][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase(); };
  WF.chip = function (text, tone) { return '<span class="wf-chip" data-tone="' + (tone || 'info') + '">' + text + '</span>'; };

  /* ---------- dữ liệu minh họa ---------- */
  WF.store = { name: 'Minh Châu Watch', user: 'Anh Minh', role: 'Chủ cửa hàng', date: '16/10/2026', weekday: 'Thứ Sáu' };
  WF.statusMeta = {
    in_stock: { label: 'Sẵn sàng bán', tone: 'ok' }, reserved: { label: 'Đã giữ', tone: 'hold' },
    sold: { label: 'Đã bán', tone: 'sold' }, in_repair: { label: 'Đang sửa', tone: 'repair' },
    inspecting: { label: 'Chờ kiểm tra', tone: 'check' }
  };
  WF.repairMeta = {
    received: { label: 'Đã nhận', tone: 'info' }, inspecting: { label: 'Đang kiểm tra', tone: 'check' },
    repairing: { label: 'Đang sửa', tone: 'repair' }, waiting_parts: { label: 'Chờ linh kiện', tone: 'hold' },
    completed: { label: 'Hoàn thành', tone: 'ok' }, delivered: { label: 'Đã giao', tone: 'sold' }
  };
  WF.kpi = {
    revMonth: 486350000, revDelta: 12.4, revToday: 37800000, ordersToday: 3,
    profit: 118420000, margin: 24.3, profitDelta: 8.1,
    cashIn: 412900000, cashOut: 298150000,
    stockCount: 87, stockReady: 68, stockValue: 1268400000, sold: 23, soldDelta: 4,
    debtIn: 37600000, debtOut: 70200000, deposit: 10000000, fundTotal: 237600000
  };
  WF.series = {
    rev16: [14.2, 22.8, 20.1, 31.4, 27.9, 18.3, 41.2, 45.0, 12.7, 28.4, 40.2, 24.6, 39.8, 21.5, 60.45, 37.8],
    days16: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'],
    rev12: [356, 412, 298, 331, 384, 402, 377, 441, 468, 495, 523, 486.35],
    months12: ['T11', 'T12', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10']
  };
  (function () {
    var r = [0, 0.02, -0.03, 0.01, 0, 0.025, -0.02, 0.015, -0.04, 0.02, 0, 0.01, -0.01, 0.03, -0.005, 0];
    WF.series.profit16 = WF.series.rev16.map(function (v, i) { return +(v * (0.2435 + r[i])).toFixed(2); });
    WF.series.profit12 = WF.series.rev12.map(function (v, i) { return +(v * (0.225 + ((i * 7) % 5) * 0.008)).toFixed(1); });
  })();

  /* art: shape round|cushion|rect · dial/dial2 · metal steel|gold|rose|black · strap · idx baton|dots|arabic|roman */
  WF.watches = [
    { id: 'DH-0232', brand: 'Tissot', model: 'PRX Powermatic 80 40mm', serial: 'T137.407 · 5A2210', cond: 'Mới', cg: 'new', st: 'sold', price: 15800000, cost: 12400000, loc: 'Quầy trưng bày', since: '2026-08-30', size: '40mm', mov: 'Automatic Powermatic 80', wr: 'Hãng 24 tháng', art: { shape: 'cushion', dial: '#1f6f6a', dial2: '#0d3b3a', metal: 'steel', strap: 'bracelet', idx: 'baton', date: true } },
    { id: 'DH-0231', brand: 'Seiko', model: '5 Sports SRPD55K1', serial: '4R36 · 8H2291', cond: 'Mới', cg: 'new', st: 'sold', price: 6950000, cost: 5100000, loc: 'Tủ A · Ngăn 2', since: '2026-09-28', size: '40mm', mov: 'Automatic 4R36', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#1f3a5f', dial2: '#0c1f38', metal: 'steel', strap: 'bracelet', idx: 'baton', date: true } },
    { id: 'DH-0219', brand: 'Hamilton', model: 'Khaki Field Mechanical H69439', serial: 'H69439 · 7K1180', cond: 'Mới', cg: 'new', st: 'sold', price: 14200000, cost: 11000000, loc: 'Tủ B · Ngăn 1', since: '2026-09-20', size: '38mm', mov: 'Lên cót tay H-50', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#17191c', dial2: '#0a0b0d', metal: 'steel', strap: 'nato-green', idx: 'arabic' } },
    { id: 'DH-0198', brand: 'Orient', model: 'Bambino Gen 2 RA-AC0E', serial: 'RA-AC0E · 2J0044', cond: 'Mới', cg: 'new', st: 'reserved', price: 7200000, cost: 5300000, loc: 'Két · Giữ hàng', since: '2026-09-02', size: '40.5mm', mov: 'Automatic F6724', wr: 'Hãng 36 tháng', art: { shape: 'round', dial: '#efe6d2', dial2: '#cfc3a6', metal: 'steel', strap: 'leather-brown', idx: 'roman' } },
    { id: 'DH-0225', brand: 'Seiko', model: 'Presage Cocktail Time SRPB41', serial: 'SRPB41 · 6C0907', cond: 'Mới', cg: 'new', st: 'reserved', price: 11900000, cost: 9200000, loc: 'Két · Giữ hàng', since: '2026-09-11', size: '40.5mm', mov: 'Automatic 4R35', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#2a5db0', dial2: '#0b2a5b', metal: 'steel', strap: 'leather-black', idx: 'baton', date: true } },
    { id: 'DH-0203', brand: 'Longines', model: 'DolceVita L5.512', serial: 'L5.512 · 3X8812', cond: 'Cũ 97%', cg: 'used', st: 'reserved', price: 21800000, cost: 17400000, loc: 'Két · Giữ hàng', since: '2026-08-05', size: '23×37mm', mov: 'Quartz', wr: 'Cửa hàng 3 tháng', art: { shape: 'rect', dial: '#f4efe4', dial2: '#dcd3bd', metal: 'steel', strap: 'leather-black', idx: 'roman' } },
    { id: 'DH-0240', brand: 'Casio', model: 'G-Shock GA-2100-1A1', serial: 'GA-2100 · 4D7702', cond: 'Mới', cg: 'new', st: 'in_stock', price: 3450000, cost: 2600000, loc: 'Tủ A · Ngăn 1', since: '2026-10-02', size: '45mm', mov: 'Quartz', wr: 'Hãng 12 tháng', art: { shape: 'cushion', dial: '#202226', dial2: '#0b0c0e', metal: 'black', strap: 'rubber-black', idx: 'dots' } },
    { id: 'DH-0155', brand: 'Longines', model: 'Master Collection L2.793', serial: 'L2.793 · 1A5521', cond: 'Cũ 98%', cg: 'used', st: 'in_stock', price: 38500000, cost: 31000000, loc: 'Tủ khóa C', since: '2026-06-18', size: '40mm', mov: 'Automatic L888', wr: 'Cửa hàng 3 tháng', art: { shape: 'round', dial: '#f1f1ec', dial2: '#d4d4cb', metal: 'steel', strap: 'leather-black', idx: 'roman', date: true } },
    { id: 'DH-0142', brand: 'Omega', model: 'Seamaster Diver 300M', serial: '210.30 · 8841207', cond: 'Cũ 95%', cg: 'used', st: 'in_stock', price: 112000000, cost: 94500000, loc: 'Két sắt', since: '2026-07-09', size: '42mm', mov: 'Co-Axial 8800', wr: 'Cửa hàng 3 tháng', art: { shape: 'round', dial: '#1b4f9c', dial2: '#0a2a5a', metal: 'steel', strap: 'bracelet', idx: 'baton', date: true, bezel: '#12335f' } },
    { id: 'DH-0127', brand: 'Rolex', model: 'Datejust 36 126234', serial: '126234 · Z81K22', cond: 'Cũ 92%', cg: 'used', st: 'inspecting', price: 245000000, cost: 218000000, loc: 'Két sắt', since: '2026-10-14', size: '36mm', mov: 'Automatic 3235', wr: 'Cửa hàng 3 tháng', art: { shape: 'round', dial: '#ecd9a6', dial2: '#c9ae6b', metal: 'gold', strap: 'bracelet', idx: 'baton', date: true } },
    { id: 'DH-0188', brand: 'Tissot', model: 'Le Locle Powermatic 80', serial: 'T006.407 · 2L0931', cond: 'Đã sửa', cg: 'refurb', st: 'in_repair', price: 13500000, cost: 10200000, loc: 'Xưởng · Bàn 2', since: '2026-05-21', size: '39.3mm', mov: 'Automatic Powermatic 80', wr: 'Sau sửa 90 ngày', art: { shape: 'round', dial: '#f3f1ea', dial2: '#dad6c8', metal: 'steel', strap: 'leather-brown', idx: 'arabic', date: true } },
    { id: 'DH-0099', brand: 'Casio', model: 'Vintage A168WG-9', serial: 'A168 · 9F3011', cond: 'Mới', cg: 'new', st: 'in_stock', price: 1650000, cost: 1150000, loc: 'Tủ A · Ngăn 3', since: '2026-05-10', size: '36×33mm', mov: 'Quartz', wr: 'Hãng 12 tháng', art: { shape: 'rect', dial: '#bcc6a9', dial2: '#a4af92', metal: 'gold', strap: 'bracelet', digital: true } },
    { id: 'DH-0250', brand: 'Orient Star', model: 'Classic Semi-Skeleton', serial: 'RE-AT0001 · 6P2140', cond: 'Mới', cg: 'new', st: 'in_stock', price: 17900000, cost: 13800000, loc: 'Tủ B · Ngăn 3', since: '2026-10-08', size: '39mm', mov: 'Automatic F6N47', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#e9e4d6', dial2: '#c8c0a8', metal: 'rose', strap: 'leather-brown', idx: 'roman' } },
    { id: 'DH-0251', brand: 'Seiko', model: 'Prospex "Turtle" SRP777', serial: 'SRP777 · 5M4417', cond: 'Cũ 96%', cg: 'used', st: 'in_stock', price: 8500000, cost: 6200000, loc: 'Tủ A · Ngăn 2', since: '2026-04-30', size: '44mm', mov: 'Automatic 4R36', wr: 'Cửa hàng 3 tháng', art: { shape: 'cushion', dial: '#15171a', dial2: '#050607', metal: 'steel', strap: 'rubber-black', idx: 'dots', date: true, bezel: '#2a2d33' } },
    { id: 'DH-0252', brand: 'Citizen', model: 'Promaster Diver NY0040', serial: 'NY0040 · 3B1809', cond: 'Mới', cg: 'new', st: 'in_stock', price: 5600000, cost: 4200000, loc: 'Tủ A · Ngăn 2', since: '2026-09-30', size: '42mm', mov: 'Automatic 8203', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#e5772c', dial2: '#a84d12', metal: 'steel', strap: 'rubber-black', idx: 'baton', date: true, bezel: '#1c1d20' } },
    { id: 'DH-0253', brand: 'Casio', model: 'Edifice EFR-556DB', serial: 'EFR-556 · 7A9930', cond: 'Mới', cg: 'new', st: 'in_stock', price: 3900000, cost: 2900000, loc: 'Tủ A · Ngăn 1', since: '2026-10-11', size: '44mm', mov: 'Quartz', wr: 'Hãng 12 tháng', art: { shape: 'round', dial: '#2c3038', dial2: '#14161a', metal: 'steel', strap: 'bracelet', idx: 'baton', date: true } },
    { id: 'DH-0176', brand: 'Citizen', model: 'Eco-Drive Chandler BM8180', serial: 'BM8180 · 2C6615', cond: 'Mới', cg: 'new', st: 'sold', price: 4900000, cost: 3600000, loc: '—', since: '2026-07-22', size: '40mm', mov: 'Eco-Drive', wr: 'Hãng 24 tháng', art: { shape: 'round', dial: '#566a3b', dial2: '#33421f', metal: 'steel', strap: 'nato-green', idx: 'arabic' } }
  ];
  WF.watch$ = function (id) { return WF.watches.filter(function (w) { return w.id === id; })[0]; };
  WF.accessories = [
    { id: 'PK-01', name: 'Dây da bò 20mm', price: 450000, ic: 'tag' },
    { id: 'PK-02', name: 'Dây NATO 20mm', price: 400000, ic: 'tag' },
    { id: 'PK-03', name: 'Pin SR626SW (thay)', price: 80000, ic: 'box' },
    { id: 'PK-04', name: 'Hộp đựng da', price: 120000, ic: 'box' }
  ];
  WF.customers = [
    { id: 'KH-0041', name: 'Lê Văn Phúc', phone: '0987 *** 301', tier: 'VIP', orders: 7, total: 310000000, debt: 25000000, due: '25/10', last: '15/10' },
    { id: 'KH-0012', name: 'Nguyễn Hoàng Long', phone: '0903 *** 128', tier: 'VIP', orders: 5, total: 186400000, debt: 0, last: '16/10' },
    { id: 'KH-0034', name: 'Trần Thị Mai Anh', phone: '0912 *** 567', tier: 'Thân thiết', orders: 2, total: 22100000, debt: 8000000, due: '20/10', last: '11/10' },
    { id: 'KH-0063', name: 'Võ Ngọc Hân', phone: '0968 *** 440', tier: 'Mới', orders: 1, total: 14600000, debt: 4600000, due: '23/10', last: '16/10' },
    { id: 'KH-0057', name: 'Phạm Quốc Bảo', phone: '0935 *** 774', tier: 'Thân thiết', orders: 3, total: 41800000, debt: 0, last: '14/10' },
    { id: 'KH-0070', name: 'Đặng Minh Khoa', phone: '0977 *** 092', tier: 'Mới', orders: 1, total: 0, debt: 0, last: '09/10' },
    { id: 'KH-0075', name: 'Bùi Thanh Tâm', phone: '0902 *** 615', tier: 'Mới', orders: 0, total: 0, debt: 0, last: '12/10' },
    { id: 'KH-0081', name: 'Cty TNHH Đông Á (quà tặng)', phone: '028 *** 5521', tier: 'Doanh nghiệp', orders: 2, total: 96000000, debt: 0, last: '03/10' }
  ];
  WF.sales = [
    { code: 'HD-1016-003', date: '16/10', time: '14:05', cust: 'Võ Ngọc Hân', items: 'Hamilton Khaki Field + Dây NATO', total: 14600000, paid: 10000000, state: 'debt', by: 'Chị Lan', note: 'Hẹn trả 23/10', w: 'DH-0219' },
    { code: 'HD-1016-002', date: '16/10', time: '11:20', cust: 'Khách lẻ', items: 'Seiko 5 Sports SRPD55K1 + Dây da 20mm', total: 7400000, paid: 7400000, state: 'paid', by: 'Chị Lan', note: 'Tiền mặt', w: 'DH-0231' },
    { code: 'HD-1016-001', date: '16/10', time: '09:48', cust: 'Nguyễn Hoàng Long', items: 'Tissot PRX Powermatic 80', total: 15800000, paid: 15800000, state: 'paid', by: 'Anh Minh', note: 'Chuyển khoản', w: 'DH-0232' },
    { code: 'HD-1015-003', date: '15/10', time: '16:12', cust: 'Lê Văn Phúc', items: 'Longines Hydroconquest L3.781', total: 42000000, paid: 17000000, state: 'debt', by: 'Anh Minh', note: 'Hẹn trả 25/10' },
    { code: 'HD-1015-002', date: '15/10', time: '10:30', cust: 'Trần Thị Mai Anh', items: 'Citizen Eco-Drive BM8180', total: 4900000, paid: 4900000, state: 'paid', by: 'Chị Lan', note: 'Tiền mặt', w: 'DH-0176' },
    { code: 'HD-1014-005', date: '14/10', time: '15:02', cust: 'Phạm Quốc Bảo', items: 'Seiko Presage SRPE + thu cũ Casio MTP', total: 9800000, paid: 9800000, state: 'paid', by: 'Chị Lan', note: 'Thu cũ đổi mới −1.200.000' },
    { code: 'HD-1013-002', date: '13/10', time: '11:40', cust: 'Khách của CTV Hương', items: 'Citizen NJ0150 (đơn CTV)', total: 6300000, paid: 6300000, state: 'paid', by: 'CTV Hương', note: 'Hoa hồng 3%' },
    { code: 'HD-1012-001', date: '12/10', time: '09:15', cust: 'Khách lẻ', items: 'Casio Edifice EFR-556', total: 3900000, paid: 0, state: 'void', by: 'Chị Lan', note: 'Đã hủy — nhập nhầm giá' }
  ];
  WF.saleState = { paid: ['Đã thu đủ', 'ok'], debt: ['Còn nợ', 'bad'], void: ['Đã hủy', 'sold'], draft: ['Nháp', 'draft'] };
  WF.repairs = [
    { code: 'SC-0415', cust: 'Phạm Thị Thu', watch: 'Casio Edifice EFB-530', issue: 'Đứt dây, thay dây kim loại', st: 'received', tech: '— chưa gán', due: '19/10', quote: 0, deposit: 200000, age: 'Hôm nay' },
    { code: 'SC-0414', cust: 'Nội bộ · DH-0188', watch: 'Tissot Le Locle Powermatic 80', issue: 'Thay bộ máy, đánh bóng vỏ (vốn hóa vào giá vốn)', st: 'repairing', tech: 'Thợ Sơn', due: '20/10', quote: 1850000, deposit: 0, internal: true },
    { code: 'SC-0413', cust: 'Trần Văn Nam', watch: 'Citizen NH8350', issue: 'Vào nước, mờ kính. Thay ron + kính sapphire', st: 'waiting_parts', tech: 'Thợ Sơn', due: '22/10', quote: 1250000, deposit: 500000 },
    { code: 'SC-0412', cust: 'Lê Thị Hạnh', watch: 'Seiko 5 SNK809', issue: 'Chạy chậm ~3 phút/ngày. Vệ sinh, chỉnh máy', st: 'repairing', tech: 'Thợ Hùng', due: '18/10', quote: 650000, deposit: 200000 },
    { code: 'SC-0411', cust: 'Hoàng Minh Tuấn', watch: 'Longines Conquest L3.7', issue: 'Kiểm tra bộ máy, khách đang cân nhắc báo giá', st: 'inspecting', tech: 'Thợ Hùng', due: '21/10', quote: 2800000, deposit: 0 },
    { code: 'SC-0409', cust: 'Ngô Bảo Châu', watch: 'Orient Star RE-AU', issue: 'Thay pin + ron. Đã xong, chờ khách lấy (3 ngày)', st: 'completed', tech: 'Thợ Hùng', due: '13/10', quote: 380000, deposit: 0, late: true },
    { code: 'SC-0405', cust: 'Đỗ Văn Khánh', watch: 'Seiko Alpinist SARB017', issue: 'Chỉnh độ chính xác. Bảo hành 90 ngày', st: 'delivered', tech: 'Thợ Hùng', due: '14/10', quote: 450000, deposit: 0 }
  ];
  WF.funds = [
    { id: 'cash', name: 'Tiền mặt (két)', sub: 'Quỹ tiền mặt', bal: 48350000, ic: 'cash' },
    { id: 'vcb', name: 'Vietcombank', sub: '•• 1234', bal: 126800000, ic: 'bank' },
    { id: 'tcb', name: 'Techcombank', sub: '•• 5678', bal: 62450000, ic: 'bank' }
  ];
  WF.ledger = [
    { d: '16/10', t: '14:05', dir: 'in', title: 'Thu bán hàng HD-1016-003', fund: 'Vietcombank', amt: 10000000 },
    { d: '16/10', t: '11:20', dir: 'in', title: 'Thu bán hàng HD-1016-002', fund: 'Tiền mặt', amt: 7400000 },
    { d: '16/10', t: '10:30', dir: 'out', title: 'Mua linh kiện (Anh Tâm)', fund: 'Tiền mặt', amt: 1850000 },
    { d: '16/10', t: '09:48', dir: 'in', title: 'Thu bán hàng HD-1016-001', fund: 'Techcombank', amt: 15800000 },
    { d: '16/10', t: '09:05', dir: 'in', title: 'Nhận cọc sửa SC-0415', fund: 'Tiền mặt', amt: 200000 },
    { d: '15/10', t: '18:00', dir: 'out', title: 'Trả NCC Thế Giới Đồng Hồ', fund: 'Vietcombank', amt: 18000000 },
    { d: '15/10', t: '16:12', dir: 'in', title: 'Thu bán hàng HD-1015-003 (đợt 1)', fund: 'Vietcombank', amt: 17000000 },
    { d: '15/10', t: '12:40', dir: 'out', title: 'Chi phí cửa hàng (điện, nước)', fund: 'Tiền mặt', amt: 2340000 },
    { d: '15/10', t: '10:20', dir: 'out', title: 'Chi hoa hồng CTV Hương', fund: 'Tiền mặt', amt: 2520000 }
  ];
  WF.debts = {
    customers: [
      { name: 'Lê Văn Phúc', ref: 'HD-1015-003', amt: 25000000, due: '25/10', left: 9 },
      { name: 'Trần Thị Mai Anh', ref: 'HD-1011-001', amt: 8000000, due: '20/10', left: 4 },
      { name: 'Võ Ngọc Hân', ref: 'HD-1016-003', amt: 4600000, due: '23/10', left: 7 }
    ],
    suppliers: [
      { name: 'Cty Thế Giới Đồng Hồ', ref: 'PN-1015-002', amt: 64000000, due: '30/10', left: 14 },
      { name: 'Anh Tâm (linh kiện)', ref: 'PN-1010-001', amt: 6200000, due: '18/10', left: 2 }
    ]
  };
  WF.purchases = [
    { code: 'PN-1016-001', date: '16/10', src: 'Cty Thế Giới Đồng Hồ', kind: 'ncc', units: 3, total: 41200000, state: 'draft', debt: 0 },
    { code: 'PN-1015-002', date: '15/10', src: 'Cty Thế Giới Đồng Hồ', kind: 'ncc', units: 4, total: 82400000, state: 'confirmed', debt: 64000000 },
    { code: 'PN-1014-001', date: '14/10', src: 'Thu mua: Nguyễn Văn Thành', kind: 'buyin', units: 1, total: 218000000, state: 'confirmed', debt: 0, pii: true },
    { code: 'PN-1014-000', date: '14/10', src: 'Thu cũ đổi mới · HD-1014-005', kind: 'trade', units: 1, total: 1200000, state: 'confirmed', debt: 0 },
    { code: 'PN-1010-001', date: '10/10', src: 'Anh Tâm · linh kiện', kind: 'part', units: 38, total: 6200000, state: 'confirmed', debt: 6200000 },
    { code: 'PN-0901-000', date: '01/09', src: 'Tồn đầu kỳ', kind: 'open', units: 61, total: 1020000000, state: 'confirmed', debt: 0 }
  ];
  WF.purchaseKind = { ncc: ['Nhà cung cấp', 'info'], buyin: ['Thu mua khách', 'check'], trade: ['Thu cũ đổi mới', 'hold'], part: ['Linh kiện', 'repair'], open: ['Tồn đầu kỳ', 'sold'] };
  WF.reservations = [
    { code: 'GH-0019', w: 'DH-0225', cust: 'Đặng Minh Khoa', dep: 3000000, due: '15/10', left: -1 },
    { code: 'GH-0021', w: 'DH-0198', cust: 'Phạm Quốc Bảo', dep: 2000000, due: '19/10', left: 3 },
    { code: 'GH-0022', w: 'DH-0203', cust: 'Bùi Thanh Tâm', dep: 5000000, due: '21/10', left: 5 }
  ];
  WF.parts = [
    { id: 'LK-014', name: 'Ron chống nước 28mm (bộ 10)', stock: 2, min: 5, avg: 95000 },
    { id: 'LK-031', name: 'Pin SR626SW', stock: 3, min: 10, avg: 22000 },
    { id: 'LK-001', name: 'Kính sapphire 31.5mm', stock: 6, min: 5, avg: 185000 },
    { id: 'LK-052', name: 'Bộ máy NH35A', stock: 4, min: 3, avg: 780000 },
    { id: 'LK-040', name: 'Núm vặn Seiko NH35', stock: 9, min: 4, avg: 64000 },
    { id: 'LK-022', name: 'Dây da đen 20mm', stock: 14, min: 6, avg: 120000 }
  ];
  WF.returns = [
    { code: 'DT-0007', sale: 'HD-1009-002', w: 'Seiko Presage SRPD37', why: 'Khách đổi ý trong 7 ngày', amt: 11200000, st: 'Chờ kiểm tra', tone: 'check' },
    { code: 'DT-0006', sale: 'HD-1002-004', w: 'Casio G-Shock GA-110', why: 'Lỗi dây đeo, đổi chiếc khác', amt: 0, st: 'Đã hoàn tất', tone: 'ok' }
  ];
  WF.collabs = [
    { name: 'Hương', mode: '3% giá bán', orders: 6, accrued: 4620000, ready: 2100000, paid: 2520000, draft: 2 },
    { name: 'Dũng', mode: '20% lãi gộp', orders: 3, accrued: 3180000, ready: 3180000, paid: 0, draft: 0 },
    { name: 'Quỳnh', mode: '300.000 ₫/chiếc', orders: 4, accrued: 1200000, ready: 600000, paid: 600000, draft: 1 }
  ];
  WF.users = [
    { name: 'Anh Minh', role: 'Chủ cửa hàng', mfa: true, on: 'Đang online' },
    { name: 'Chị Lan', role: 'Nhân viên bán hàng', mfa: false, on: '14:05' },
    { name: 'Bạn Tuấn', role: 'Quản lý kho', mfa: false, on: '11:40' },
    { name: 'Thợ Hùng', role: 'Thợ sửa chữa', mfa: false, on: '16:02' },
    { name: 'Thợ Sơn', role: 'Thợ sửa chữa', mfa: false, on: 'Hôm qua' },
    { name: 'Hương', role: 'Cộng tác viên', mfa: false, on: '13/10' }
  ];
  WF.audit = [
    { t: '14:05', who: 'Chị Lan', act: 'Xác nhận phiếu bán HD-1016-003', tone: 'ok' },
    { t: '11:52', who: 'Bạn Tuấn', act: 'Chuyển DH-0127 sang "Chờ kiểm tra"', tone: 'check' },
    { t: '10:30', who: 'Anh Minh', act: 'Chi 1.850.000 ₫ mua linh kiện', tone: 'info' },
    { t: '09:12', who: 'Anh Minh', act: 'Xem CCCD người bán PN-1014-001 (lý do: đối chiếu)', tone: 'bad' },
    { t: '08:03', who: 'Hệ thống', act: 'Sao lưu 03:00 thành công · 142 MB', tone: 'ok' }
  ];
  WF.tasks = [
    { ic: 'tag', tone: 'bad', title: 'Giữ hàng quá hạn', sub: 'GH-0019 · Đặng Minh Khoa · quá 1 ngày', n: 1, go: 'reserve' },
    { ic: 'wallet', tone: 'hold', title: 'Nợ đến hạn trong 7 ngày', sub: '3 khoản · 37.600.000 ₫', n: 3, go: 'cash' },
    { ic: 'wrench', tone: 'ok', title: 'Sửa xong, khách chưa lấy', sub: 'SC-0409 · Ngô Bảo Châu · 3 ngày', n: 1, go: 'repair' },
    { ic: 'box', tone: 'hold', title: 'Linh kiện sắp hết', sub: 'Ron 28mm (2) · Pin SR626SW (3)', n: 2, go: 'parts' },
    { ic: 'clock', tone: 'info', title: 'Hàng tồn quá 90 ngày', sub: 'Longines Master Collection · 120 ngày…', n: 4, go: 'stock' },
    { ic: 'shield', tone: 'info', title: 'Bảo hành sắp hết hạn', sub: '2 phiếu trong 14 ngày tới', n: 2, go: 'repair' }
  ];
  WF.modules = [
    { id: 'home', label: 'Tổng quan', ic: 'dash' }, { id: 'stock', label: 'Đồng hồ', ic: 'watch' },
    { id: 'pos', label: 'Bán hàng', ic: 'cart' }, { id: 'repair', label: 'Sửa chữa', ic: 'wrench' },
    { id: 'cash', label: 'Thu chi & công nợ', ic: 'wallet' }, { id: 'buy', label: 'Nhập hàng', ic: 'truck' },
    { id: 'cust', label: 'Khách hàng', ic: 'users' }, { id: 'reserve', label: 'Giữ hàng / cọc', ic: 'tag' },
    { id: 'returns', label: 'Đổi trả', ic: 'undo' }, { id: 'parts', label: 'Linh kiện', ic: 'box' },
    { id: 'stocktake', label: 'Kiểm kê', ic: 'list' }, { id: 'report', label: 'Báo cáo', ic: 'chart' },
    { id: 'collab', label: 'Cộng tác viên', ic: 'percent' }, { id: 'admin', label: 'Quản trị', ic: 'shield' }
  ];
  WF.title = {}; WF.modules.forEach(function (m) { WF.title[m.id] = m.label; });
  WF.title.unit = 'Chi tiết đồng hồ'; WF.title.sales = 'Phiếu bán hàng';
  WF.module$ = function (id) { return WF.modules.filter(function (m) { return m.id === id; })[0]; };

  /* ---------- icon ---------- */
  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="16" width="7" height="5" rx="1.6"/>',
    watch: '<circle cx="12" cy="12" r="5.5"/><path d="M9 6.6 9.6 3h4.8l.6 3.6M9 17.4 9.6 21h4.8l.6-3.6M12 9.6V12l1.8 1.2"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    cart: '<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 14h2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',
    trendup: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    trenddown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>', chevL: '<path d="m15 6-6 6 6 6"/>', chevD: '<path d="m6 9 6 6 6-6"/>', chevU: '<path d="m6 15 6-6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12 5 5 9-10"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17.5v.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 20h16"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
    heart: '<path d="M12 20s-8-4.5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    kanban: '<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/>',
    command: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    store: '<path d="M3 9 5 4h14l2 5M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>', arrowDR: '<path d="M7 7l10 10M17 8v9H8"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2 0-4-1-4-3a2 2 0 0 1 4 0c0 2 0 3 0 3Zm0 0c2 0 4-1 4-3a2 2 0 0 0-4 0"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  WF.icon = function (n, s, w) {
    return '<svg class="ic" viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="' + (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || '') + '</svg>';
  };
  WF.ic = WF.icon;

  /* ---------- đồng hồ vẽ bằng SVG ---------- */
  var uid = 0;
  function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h, t, p) { var a = rgb(h), b = rgb(t); return '#' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * p).toString(16).padStart(2, '0'); }).join(''); }
  function lum(h) { var c = rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function pol(cx, cy, len, deg) { var r = deg * Math.PI / 180; return [(cx + len * Math.sin(r)).toFixed(1), (cy - len * Math.cos(r)).toFixed(1)]; }

  WF.watch = function (a, label, o) {
    o = o || {};
    var id = 'w' + (++uid);
    var M = { steel: ['#f7f9fb', '#b4bcc6', '#6f7984'], gold: ['#fff3c4', '#d8b25a', '#86601f'], rose: ['#fbe3d4', '#d9a387', '#8f563d'], black: ['#7d8591', '#363c46', '#14171c'] }[a.metal || 'steel'];
    var shape = a.shape || 'round', dial = a.dial || '#222', dial2 = a.dial2 || mix(dial, '#000000', 0.38);
    var light = lum(dial) > 0.55, ink = light ? '#23272e' : (a.metal === 'gold' ? '#f3dca0' : '#f2eee3');
    var sw = shape === 'round' ? 50 : shape === 'cushion' ? 48 : 40;
    var st = a.strap || 'leather-brown';
    var SC = { 'leather-brown': ['#9a6a3f', '#5a3419'], 'leather-black': ['#38383d', '#131316'], 'rubber-black': ['#2e2f35', '#0e0f12'], 'nato-green': ['#5d7340', '#3b4b28'], bracelet: [M[0], M[2]] }[st];
    var s = '<svg class="wsvg" viewBox="' + (o.crop === 'head' ? '28 58 144 144' : '0 0 200 260') + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (label || 'Đồng hồ') + '">';
    s += '<defs><linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + M[0] + '"/><stop offset=".5" stop-color="' + M[1] + '"/><stop offset="1" stop-color="' + M[2] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'r" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + M[0] + '"/><stop offset=".55" stop-color="' + M[1] + '"/><stop offset="1" stop-color="' + M[2] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'd" cx=".4" cy=".32" r=".9"><stop offset="0" stop-color="' + dial + '"/><stop offset="1" stop-color="' + dial2 + '"/></radialGradient>' +
      '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + SC[1] + '"/><stop offset=".35" stop-color="' + SC[0] + '"/><stop offset=".65" stop-color="' + SC[0] + '"/><stop offset="1" stop-color="' + SC[1] + '"/></linearGradient></defs>';
    /* dây */
    var tl = 100 - sw * 0.42, tr = 100 + sw * 0.42, bl = 100 - sw / 2, br = 100 + sw / 2;
    s += '<path d="M' + tl + ' 4 L' + tr + ' 4 L' + br + ' 90 L' + bl + ' 90Z" fill="url(#' + id + 's)" stroke="' + SC[1] + '" stroke-width=".8" stroke-linejoin="round"/>';
    s += '<path d="M' + bl + ' 170 L' + br + ' 170 L' + tr + ' 256 L' + tl + ' 256Z" fill="url(#' + id + 's)" stroke="' + SC[1] + '" stroke-width=".8" stroke-linejoin="round"/>';
    var y, hw;
    if (st === 'bracelet') { for (y = 14; y < 84; y += 11) { hw = sw * 0.42 + sw * 0.08 * ((y - 4) / 86); s += '<path d="M' + (100 - hw) + ' ' + y + ' H' + (100 + hw) + '" stroke="' + M[2] + '" stroke-width=".9" opacity=".55"/>'; } for (y = 178; y < 250; y += 11) { hw = sw * 0.5 - sw * 0.08 * ((y - 170) / 86); s += '<path d="M' + (100 - hw) + ' ' + y + ' H' + (100 + hw) + '" stroke="' + M[2] + '" stroke-width=".9" opacity=".55"/>'; } s += '<path d="M' + (100 - sw * .16) + ' 8 V86M' + (100 + sw * .16) + ' 8 V86M' + (100 - sw * .16) + ' 174 V252M' + (100 + sw * .16) + ' 174 V252" stroke="' + M[2] + '" stroke-width=".7" opacity=".4"/>'; }
    else if (st.indexOf('leather') === 0) { var sc2 = st === 'leather-brown' ? '#e4c39a' : '#9a9aa2'; s += '<path d="M' + (100 - sw * .36) + ' 10 L' + (100 - sw * .43) + ' 84M' + (100 + sw * .36) + ' 10 L' + (100 + sw * .43) + ' 84M' + (100 - sw * .43) + ' 176 L' + (100 - sw * .36) + ' 250M' + (100 + sw * .43) + ' 176 L' + (100 + sw * .36) + ' 250" stroke="' + sc2 + '" stroke-width="1" stroke-dasharray="3 3" opacity=".75"/>'; }
    else if (st === 'rubber-black') { for (y = 16; y < 84; y += 8) { hw = sw * 0.42 + sw * 0.08 * ((y - 4) / 86); s += '<path d="M' + (100 - hw + 3) + ' ' + y + ' H' + (100 + hw - 3) + '" stroke="#000" stroke-width="1.4" opacity=".35"/>'; } for (y = 180; y < 252; y += 8) { hw = sw * 0.5 - sw * 0.08 * ((y - 170) / 86); s += '<path d="M' + (100 - hw + 3) + ' ' + y + ' H' + (100 + hw - 3) + '" stroke="#000" stroke-width="1.4" opacity=".35"/>'; } }
    else { s += '<path d="M100 6V88M100 172V254" stroke="#25301a" stroke-width="3" opacity=".3"/><path d="M' + (100 - sw * .3) + ' 6V88M' + (100 + sw * .3) + ' 6V88M' + (100 - sw * .3) + ' 172V254M' + (100 + sw * .3) + ' 172V254" stroke="#d9e3c4" stroke-width="1" opacity=".5"/>'; }
    /* vỏ + mặt */
    var cx = 100, cy = 130, i, ang, p, q;
    if (shape === 'round') {
      s += '<rect x="161" y="123" width="10" height="14" rx="3" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".6"/>';
      s += '<circle cx="100" cy="130" r="64" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".8"/>';
      s += '<circle cx="100" cy="130" r="58" fill="' + (a.bezel || 'url(#' + id + 'r)') + '"/>';
      if (a.bezel) { for (i = 0; i < 12; i++) { p = pol(100, 130, 55.5, i * 30); s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 === 0 ? 1.6 : 1) + '" fill="#f2eee3" opacity=".85"/>'; } }
      s += '<circle cx="100" cy="130" r="52" fill="#000" opacity=".28"/><circle cx="100" cy="130" r="50.5" fill="url(#' + id + 'd)"/>';
    } else if (shape === 'cushion') {
      s += '<rect x="162" y="123" width="10" height="14" rx="3" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".6"/>';
      s += '<rect x="36" y="66" width="128" height="128" rx="38" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".8"/>';
      s += '<rect x="43" y="73" width="114" height="114" rx="32" fill="' + (a.bezel || 'url(#' + id + 'r)') + '"/>';
      s += '<rect x="49" y="79" width="102" height="102" rx="27" fill="#000" opacity=".28"/><rect x="50.5" y="80.5" width="99" height="99" rx="26" fill="url(#' + id + 'd)"/>';
    } else {
      s += '<rect x="143" y="124" width="8" height="14" rx="2.5" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".6"/>';
      s += '<rect x="56" y="72" width="88" height="116" rx="13" fill="url(#' + id + 'm)" stroke="' + M[2] + '" stroke-width=".8"/>';
      s += '<rect x="62" y="78" width="76" height="104" rx="9" fill="url(#' + id + 'r)"/><rect x="67" y="83" width="66" height="94" rx="6" fill="#000" opacity=".28"/><rect x="68.5" y="84.5" width="63" height="91" rx="5" fill="url(#' + id + 'd)"/>';
    }
    /* chỉ số */
    if (a.digital) {
      s += '<text x="100" y="104" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="1.4" fill="#2c3324" font-family="Arial,sans-serif">' + (label || 'CASIO').toUpperCase() + '</text>';
      s += '<text x="100" y="140" text-anchor="middle" font-size="25" font-weight="700" fill="#2c3324" font-family="Consolas,Menlo,monospace">10:08</text><text x="100" y="118" text-anchor="middle" font-size="8" fill="#2c3324" font-family="Consolas,Menlo,monospace" opacity=".8">FRI 16</text><path d="M78 152h44" stroke="#2c3324" stroke-width="1" opacity=".4"/><text x="100" y="164" text-anchor="middle" font-size="6" fill="#2c3324" opacity=".75" font-family="Arial">ALARM  CHRONO</text>';
    } else if (shape === 'rect') {
      [['XII', 100, 100], ['VI', 100, 168], ['III', 124, 134], ['IX', 76, 134]].forEach(function (t) { s += '<text x="' + t[1] + '" y="' + t[2] + '" text-anchor="middle" font-size="9" font-family="Georgia,serif" fill="' + ink + '">' + t[0] + '</text>'; });
      s += '<text x="100" y="120" text-anchor="middle" font-size="5.5" font-weight="700" letter-spacing="1" fill="' + ink + '" opacity=".8" font-family="Arial">' + (label || '').toUpperCase() + '</text>';
      p = pol(cx, cy, 15, 304); q = pol(cx, cy, 26, 48);
      s += '<path d="M100 130L' + p[0] + ' ' + p[1] + '" stroke="' + ink + '" stroke-width="3.4" stroke-linecap="round"/><path d="M100 130L' + q[0] + ' ' + q[1] + '" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/><circle cx="100" cy="130" r="2.6" fill="' + ink + '"/>';
    } else {
      var R = shape === 'round' ? 42 : 43;
      for (i = 0; i < 12; i++) {
        ang = i * 30; if (a.date && i === 3) continue;
        var idx = a.idx || 'baton';
        if (idx === 'baton') s += '<rect x="-1.7" y="' + (-R - 4) + '" width="3.4" height="' + (i % 3 === 0 ? 10 : 8) + '" rx=".7" fill="' + ink + '" transform="translate(100 130) rotate(' + ang + ')"/>';
        else if (idx === 'dots') s += '<circle cx="' + pol(100, 130, R, ang)[0] + '" cy="' + pol(100, 130, R, ang)[1] + '" r="' + (i % 3 === 0 ? 3.1 : 1.9) + '" fill="' + ink + '"/>';
        else if (i % 3 === 0) { p = pol(100, 130, R - 8, ang); s += '<text x="' + p[0] + '" y="' + (+p[1] + 3.6) + '" text-anchor="middle" font-size="' + (idx === 'roman' ? 9 : 12) + '" font-family="Georgia,serif" fill="' + ink + '">' + (idx === 'roman' ? ['XII', 'III', 'VI', 'IX'][i / 3] : [12, 3, 6, 9][i / 3]) + '</text>'; }
        else s += '<rect x="-.8" y="' + (-R - 4) + '" width="1.6" height="5" fill="' + ink + '" transform="translate(100 130) rotate(' + ang + ')"/>';
      }
      s += '<text x="100" y="' + (a.idx === 'roman' || a.idx === 'arabic' ? 113 : 108) + '" text-anchor="middle" font-size="6" font-weight="700" letter-spacing="1.3" fill="' + ink + '" opacity=".82" font-family="Arial,sans-serif">' + (label || '').toUpperCase() + '</text>';
      if (a.date) s += '<rect x="125" y="125" width="15" height="10" rx="1.4" fill="#fbfbf8" stroke="' + M[2] + '" stroke-width=".6"/><text x="132.5" y="133" text-anchor="middle" font-size="8" font-weight="700" fill="#222" font-family="Arial">16</text>';
      p = pol(cx, cy, 24, 304); q = pol(cx, cy, 37, 48); var r2 = pol(cx, cy, 41, 168), r3 = pol(cx, cy, -9, 168);
      s += '<path d="M100 130L' + p[0] + ' ' + p[1] + '" stroke="' + ink + '" stroke-width="4.2" stroke-linecap="round"/><path d="M100 130L' + q[0] + ' ' + q[1] + '" stroke="' + ink + '" stroke-width="2.8" stroke-linecap="round"/><path d="M' + r3[0] + ' ' + r3[1] + 'L' + r2[0] + ' ' + r2[1] + '" stroke="#e2452f" stroke-width="1.1" stroke-linecap="round"/><circle cx="100" cy="130" r="3.4" fill="' + ink + '"/><circle cx="100" cy="130" r="1.4" fill="#e2452f"/>';
    }
    /* phản chiếu kính */
    s += '<ellipse cx="86" cy="106" rx="32" ry="16" transform="rotate(-35 86 106)" fill="#fff" opacity=".09"/>';
    return s + '</svg>';
  };
  WF.img = function (w, o) { o = o || {}; return '<span class="wf-img" style="' + (o.style || '') + '">' + WF.watch(w.art, w.brand, o) + '</span>'; };

  /* ---------- biểu đồ ---------- */
  function smooth(pts) {
    if (pts.length < 3) return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }
  WF.chart = {
    scale: function (series, o) {
      o = o || {};
      var w = o.w || 400, h = o.h || 160, pad = o.pad == null ? 6 : o.pad, n = series[0].length;
      var max = o.max || Math.max.apply(null, [].concat.apply([], series)) * 1.12;
      return {
        w: w, h: h, n: n, x: function (i) { return pad + i * (w - 2 * pad) / (n - 1); },
        y: function (v) { return h - pad - v / max * (h - 2 * pad); }
      };
    },
    /* series: [[...],[...]] · colors: [] · fills: [] (id gradient) */
    area: function (series, o) {
      o = o || {}; var sc = WF.chart.scale(series, o), id = 'ca' + (++uid), colors = o.colors || ['#2563eb', '#16a34a'];
      var s = '<svg class="wf-area" viewBox="0 0 ' + sc.w + ' ' + sc.h + '" preserveAspectRatio="none" style="width:100%;height:' + (o.ch || '100%') + ';display:block;overflow:visible"><defs>';
      series.forEach(function (_, k) { s += '<linearGradient id="' + id + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + colors[k] + '" stop-opacity="' + (o.fillOp == null ? 0.28 : o.fillOp) + '"/><stop offset="1" stop-color="' + colors[k] + '" stop-opacity="0"/></linearGradient>'; });
      s += '</defs>';
      if (o.grid !== false) for (var g = 1; g <= 3; g++) { var gy = sc.h * g / 4; s += '<line x1="0" x2="' + sc.w + '" y1="' + gy + '" y2="' + gy + '" stroke="' + (o.gridColor || 'currentColor') + '" stroke-opacity=".10" stroke-width="1" vector-effect="non-scaling-stroke"' + (o.dash ? ' stroke-dasharray="3 4"' : '') + '/>'; }
      series.forEach(function (d, k) {
        var pts = d.map(function (v, i) { return [+sc.x(i).toFixed(1), +sc.y(v).toFixed(1)]; }), line = o.straight ? 'M' + pts.map(function (p) { return p.join(' '); }).join('L') : smooth(pts);
        if (o.fill !== false) s += '<path d="' + line + ' L' + pts[pts.length - 1][0] + ' ' + sc.h + ' L' + pts[0][0] + ' ' + sc.h + 'Z" fill="url(#' + id + k + ')"/>';
        s += '<path d="' + line + '" fill="none" stroke="' + colors[k] + '" stroke-width="' + (o.sw || 2.4) + '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"' + (k > 0 && o.dash2 ? ' stroke-dasharray="5 5"' : '') + '/>';
      });
      return s + '</svg>';
    },
    /* cột HTML: data [[a,b],..] hoặc [a,b,..] */
    bars: function (data, o) {
      o = o || {}; var max = o.max || Math.max.apply(null, [].concat.apply([], data)) * 1.08, s = '<div class="wf-bars" style="--h:' + (o.h || 120) + 'px;--gap:' + (o.gap || 6) + 'px;--r:' + (o.r == null ? 5 : o.r) + 'px;--c1:' + ((o.colors || [])[0] || '#2563eb') + ';--c2:' + ((o.colors || [])[1] || '#93c5fd') + '">';
      data.forEach(function (d, i) {
        var arr = Array.isArray(d) ? d : [d];
        s += '<div class="c' + (o.hl === i ? ' hl' : '') + '"><div class="stack">' + arr.map(function (v, k) { return '<i class="b b' + (k + 1) + '" style="height:' + Math.max(2, v / max * 100).toFixed(1) + '%"></i>'; }).join('') + '</div>' + (o.labels ? '<span class="l">' + o.labels[i] + '</span>' : '') + '</div>';
      });
      return s + '</div>';
    },
    /* parts: [{v,color}] */
    donut: function (parts, o) {
      o = o || {}; var size = o.size || 120, th = o.th || 16, r = (size - th) / 2, c = 2 * Math.PI * r, tot = parts.reduce(function (a, b) { return a + b.v; }, 0), off = 0, gap = o.gap == null ? 3 : o.gap;
      var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="transform:rotate(-90deg);display:block"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.track || 'rgba(0,0,0,.06)') + '" stroke-width="' + th + '"/>';
      parts.forEach(function (p) { var len = p.v / tot * c; s += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + p.color + '" stroke-width="' + th + '" stroke-dasharray="' + Math.max(0, len - gap) + ' ' + (c - Math.max(0, len - gap)) + '" stroke-dashoffset="' + (-off) + '" stroke-linecap="' + (o.cap || 'butt') + '"/>'; off += len; });
      return s + '</svg>';
    },
    ring: function (pct, o) {
      o = o || {}; var size = o.size || 56, th = o.th || 6, r = (size - th) / 2, c = 2 * Math.PI * r;
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" style="transform:rotate(-90deg);display:block"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.track || 'rgba(0,0,0,.08)') + '" stroke-width="' + th + '"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.color || '#2563eb') + '" stroke-width="' + th + '" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100) + ' ' + c + '"/></svg>';
    },
    gauge: function (pct, o) {
      o = o || {}; var w = o.w || 160, th = o.th || 14, r = (w - th) / 2, c = Math.PI * r;
      return '<svg viewBox="0 0 ' + w + ' ' + (w / 2 + th / 2) + '" width="' + w + '" style="display:block"><path d="M' + th / 2 + ' ' + w / 2 + ' A' + r + ' ' + r + ' 0 0 1 ' + (w - th / 2) + ' ' + w / 2 + '" fill="none" stroke="' + (o.track || 'rgba(0,0,0,.07)') + '" stroke-width="' + th + '" stroke-linecap="round"/><path d="M' + th / 2 + ' ' + w / 2 + ' A' + r + ' ' + r + ' 0 0 1 ' + (w - th / 2) + ' ' + w / 2 + '" fill="none" stroke="' + (o.color || '#2563eb') + '" stroke-width="' + th + '" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100) + ' ' + c + '"/></svg>';
    },
    spark: function (data, o) { o = o || {}; return WF.chart.area([data], { w: 100, h: 32, pad: 2, colors: [o.color || '#2563eb'], grid: false, sw: o.sw || 1.8, fillOp: o.fillOp == null ? 0.25 : o.fillOp, ch: (o.h || 32) + 'px' }); }
  };

  /* ---------- giỏ hàng (POS) ---------- */
  var C = (WF.cart = { items: [{ k: 'u', id: 'DH-0240' }, { k: 'a', id: 'PK-01', q: 1 }], discount: 200000, tradeIn: 0, cb: null });
  C.line = function (it) { if (it.k === 'u') { var w = WF.watch$(it.id); return { name: w.brand + ' ' + w.model, sub: it.id + ' · ' + w.cond, price: w.price, q: 1, w: w, kind: 'unit' }; } var a = WF.accessories.filter(function (x) { return x.id === it.id; })[0]; return { name: a.name, sub: 'Phụ kiện', price: a.price, q: it.q, kind: 'acc', ic: a.ic }; };
  C.lines = function () { return C.items.map(function (it) { var l = C.line(it); l.id = it.id; return l; }); };
  C.sub = function () { return C.lines().reduce(function (s, l) { return s + l.price * l.q; }, 0); };
  C.total = function () { return Math.max(0, C.sub() - C.discount - C.tradeIn); };
  C.count = function () { return C.items.reduce(function (s, it) { return s + (it.q || 1); }, 0); };
  C.has = function (id) { return C.items.some(function (it) { return it.id === id; }); };
  C.add = function (id) { var it = C.items.filter(function (x) { return x.id === id; })[0]; if (it) { if (it.k === 'a') it.q++; } else C.items.push(id.indexOf('PK') === 0 ? { k: 'a', id: id, q: 1 } : { k: 'u', id: id }); C.fire(); };
  C.rm = function (id) { C.items = C.items.filter(function (x) { return x.id !== id; }); C.fire(); };
  C.inc = function (id, d) { var it = C.items.filter(function (x) { return x.id === id; })[0]; if (!it) return; it.q = (it.q || 1) + d; if (it.q < 1) C.rm(id); else C.fire(); };
  C.clear = function () { C.items = []; C.discount = 0; C.tradeIn = 0; C.fire(); };
  C.fire = function () { if (C.cb) C.cb(); };
  C.calc = function (received) { var t = C.total(); return { total: t, change: Math.max(0, received - t), debt: Math.max(0, t - received) }; };

  var P = (WF.pay = { method: 'cash', recv: null });
  P.val = function () { if (P.recv === null) P.recv = C.total(); return P.recv; };
  P.reset = function () { P.recv = null; P.method = 'cash'; };
  P.html = function () { var r = C.calc(P.val()); return r.debt ? '<span>Còn nợ khách (hẹn trả)</span><b class="bad">' + WF.vnd(r.debt) + '</b>' : '<span>Tiền thừa trả khách</span><b class="ok">' + WF.vnd(r.change) + '</b>'; };
  P.upd = function () { WF.$$('[data-calc]').forEach(function (el) { el.innerHTML = P.html(); }); };

  /* ---------- trang dùng chung (kiểu danh sách, mỗi mẫu tự tạo kiểu bằng class g-*) ---------- */
  function gchips(list, target) { return '<div class="g-chips" data-chips' + (target ? ' data-target="' + target + '"' : '') + '>' + list.map(function (c, i) { return '<button class="g-chip' + (i === 0 ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'; }
  function kpis(list) { return '<div class="g-kpis">' + list.map(function (k) { return '<div class="g-kpi"><span>' + k[0] + '</span><b>' + k[1] + '</b>' + (k[2] ? '<em>' + k[2] + '</em>' : '') + '</div>'; }).join('') + '</div>'; }
  function item(ico, title, sub, amt, sub2, cat, tone) { return '<div class="g-item"' + (cat ? ' data-cat="' + cat + '"' : '') + '><div class="g-ico" data-tone="' + (tone || 'info') + '">' + WF.icon(ico, 18) + '</div><div class="g-main"><div class="g-t">' + title + '</div><div class="g-s">' + sub + '</div></div><div class="g-end"><div class="g-amt">' + amt + '</div><div class="g-sub">' + (sub2 || '') + '</div></div></div>'; }
  WF.pages = {
    purchases: function () {
      return kpis([['Phiếu nhập tháng 10', '14', '+3 so với T9'], ['Giá trị nhập', '412 tr', '9 chiếc · 38 linh kiện'], ['Còn nợ NCC', WF.short(WF.kpi.debtOut), '2 nhà cung cấp']]) +
        gchips([['all', 'Tất cả'], ['ncc', 'Nhà cung cấp'], ['buyin', 'Thu mua khách'], ['trade', 'Thu cũ đổi mới'], ['open', 'Tồn đầu kỳ']]) +
        '<div class="g-list" data-filterable>' + WF.purchases.map(function (p) {
          var k = WF.purchaseKind[p.kind];
          return item(p.kind === 'part' ? 'box' : p.kind === 'buyin' ? 'user' : p.kind === 'trade' ? 'swap' : 'truck', p.code + ' ' + (p.state === 'draft' ? WF.chip('Nháp', 'draft') : ''), p.src + ' · ' + p.date + (p.pii ? ' · ' + WF.icon('lock', 11) + ' CCCD đã mã hóa' : ''), WF.vnd(p.total), p.units + (p.kind === 'part' ? ' món' : ' chiếc') + (p.debt ? ' · nợ ' + WF.short(p.debt) : ''), p.kind, k[1]);
        }).join('') + '</div>';
    },
    customers: function () {
      return kpis([['Khách hàng', '248', '+9 tháng này'], ['Khách đang nợ', '3', WF.short(WF.kpi.debtIn)], ['Khách VIP', '18', '≥ 100 tr']]) +
        gchips([['all', 'Tất cả'], ['VIP', 'VIP'], ['debt', 'Đang nợ'], ['Mới', 'Mới']]) +
        '<div class="g-list" data-filterable>' + WF.customers.map(function (c) {
          return '<div class="g-item" data-cat="' + (c.tier === 'VIP' ? 'VIP' : c.tier === 'Mới' ? 'Mới' : 'x') + (c.debt ? ' debt' : '') + '"><div class="g-ico g-av" data-tone="' + (c.tier === 'VIP' ? 'hold' : 'info') + '">' + WF.initials(c.name) + '</div><div class="g-main"><div class="g-t">' + c.name + ' ' + (c.tier === 'VIP' ? WF.chip('VIP', 'hold') : '') + '</div><div class="g-s">' + c.phone + ' · mua gần nhất ' + c.last + '</div></div><div class="g-end"><div class="g-amt">' + WF.short(c.total) + '</div><div class="g-sub">' + (c.debt ? '<span data-neg>Nợ ' + WF.short(c.debt) + ' · hạn ' + c.due + '</span>' : c.orders + ' lần mua') + '</div></div></div>';
        }).join('') + '</div>';
    },
    reserve: function () {
      return kpis([['Đang giữ', '3', 'tối đa 7 ngày'], ['Cọc đang giữ', WF.vnd(WF.kpi.deposit), 'không tính doanh thu'], ['Quá hạn', '1', 'cần xử lý']]) +
        '<div class="g-list">' + WF.reservations.map(function (r) {
          var w = WF.watch$(r.w);
          return '<div class="g-item g-res"><div class="g-thumb">' + WF.img(w, { crop: 'head' }) + '</div><div class="g-main"><div class="g-t">' + w.brand + ' ' + w.model + '</div><div class="g-s">' + r.code + ' · ' + r.cust + '</div><div class="g-s">Cọc ' + WF.vnd(r.dep) + ' · hạn ' + r.due + '</div></div><div class="g-end">' + (r.left < 0 ? WF.chip('Quá hạn ' + (-r.left) + ' ngày', 'bad') : WF.chip('Còn ' + r.left + ' ngày', r.left < 4 ? 'hold' : 'ok')) + '<div class="g-btns"><button class="g-btn" data-toast="Chuyển thành phiếu bán (bản xem thử)">Bán</button><button class="g-btn ghost" data-toast="Hủy giữ — hoàn / tịch thu cọc">Hủy giữ</button></div></div></div>';
        }).join('') + '</div>';
    },
    returns: function () {
      return kpis([['Đổi trả tháng 10', '2', '8,7% / đơn bán'], ['Đã hoàn tiền', WF.vnd(11200000), 'chờ kiểm tra'], ['Hạn đổi trả', '7 ngày', 'theo cấu hình']]) +
        '<div class="g-list">' + WF.returns.map(function (r) { return item('undo', r.code + ' ' + WF.chip(r.st, r.tone), r.w + ' · từ ' + r.sale + '<br>' + r.why, r.amt ? WF.vnd(r.amt) : 'Đổi hàng', r.amt ? 'hoàn tiền' : 'không hoàn', '', r.tone); }).join('') + '</div>' +
        '<button class="g-cta" data-toast="Tạo phiếu đổi trả (bản xem thử)">' + WF.icon('plus', 16) + ' Tạo phiếu đổi trả</button>';
    },
    parts: function () {
      return kpis([['Loại linh kiện', '64', '412 món'], ['Giá trị tồn', '38,6 tr', 'bình quân gia quyền'], ['Sắp hết', '2', 'dưới ngưỡng']]) +
        '<div class="g-list">' + WF.parts.map(function (p) {
          var low = p.stock < p.min, pct = Math.min(100, p.stock / (p.min * 2) * 100);
          return '<div class="g-item"><div class="g-ico" data-tone="' + (low ? 'bad' : 'ok') + '">' + WF.icon('box', 18) + '</div><div class="g-main"><div class="g-t">' + p.name + '</div><div class="g-s">' + p.id + ' · giá vốn bq ' + WF.vnd(p.avg) + '</div><div class="g-bar"><i style="width:' + pct + '%" data-tone="' + (low ? 'bad' : 'ok') + '"></i></div></div><div class="g-end"><div class="g-amt">' + p.stock + '</div><div class="g-sub">' + (low ? '<span data-neg>Sắp hết · min ' + p.min + '</span>' : 'min ' + p.min) + '</div></div></div>';
        }).join('') + '</div>';
    },
    stocktake: function () {
      return kpis([['Đợt đang mở', 'KK-1016', 'Tủ A · Ngăn 1–3'], ['Đã quét', '18 / 24', '75%'], ['Chênh lệch', '1', 'thiếu 1 chiếc']]) +
        '<div class="g-list">' + [['DH-0240', 'Casio G-Shock GA-2100', 'Đã quét 09:12', 'ok'], ['DH-0099', 'Casio Vintage A168WG', 'Đã quét 09:14', 'ok'], ['DH-0253', 'Casio Edifice EFR-556DB', 'Đã quét 09:15', 'ok'], ['DH-0087', 'Casio Baby-G BGA-255', 'CHƯA THẤY — kiểm tra lại', 'bad']].map(function (r) { return item(r[3] === 'ok' ? 'check' : 'alert', r[0] + ' · ' + r[1], r[2], r[3] === 'ok' ? 'Khớp' : 'Thiếu', '', '', r[3]); }).join('') + '</div>' +
        '<button class="g-cta" data-toast="Mở camera quét QR (bản xem thử)">' + WF.icon('scan', 16) + ' Quét tem QR để kiểm</button>';
    },
    collab: function () {
      return kpis([['CTV hoạt động', '3', ''], ['Hoa hồng phát sinh', WF.vnd(9000000), 'tháng 10'], ['Có thể chi', WF.vnd(5880000), 'phiếu đã thu đủ']]) +
        '<div class="g-list">' + WF.collabs.map(function (c) { return '<div class="g-item"><div class="g-ico g-av" data-tone="check">' + c.name[0] + '</div><div class="g-main"><div class="g-t">CTV ' + c.name + '</div><div class="g-s">' + c.mode + ' · ' + c.orders + ' đơn' + (c.draft ? ' · ' + WF.chip(c.draft + ' đơn nháp chờ xác nhận', 'hold') : '') + '</div><div class="g-s">Đã nhận ' + WF.short(c.paid) + '</div></div><div class="g-end"><div class="g-amt">' + WF.short(c.ready) + '</div><div class="g-sub">có thể nhận</div></div></div>'; }).join('') + '</div>';
    },
    admin: function () {
      return '<div class="g-block"><h4 class="g-h">Người dùng & vai trò</h4><div class="g-list">' + WF.users.map(function (u) { return '<div class="g-item"><div class="g-ico g-av" data-tone="info">' + WF.initials(u.name) + '</div><div class="g-main"><div class="g-t">' + u.name + '</div><div class="g-s">' + u.role + '</div></div><div class="g-end">' + (u.mfa ? WF.chip('MFA bật', 'ok') : WF.chip('Chưa MFA', 'sold')) + '<div class="g-sub">' + u.on + '</div></div></div>'; }).join('') + '</div></div>' +
        '<div class="g-block"><h4 class="g-h">Sao lưu & hệ thống</h4><div class="g-list">' + item('shield', 'Sao lưu 03:00 hôm nay', 'Mã hóa · 142 MB · lưu 30 ngày', WF.chip('Thành công', 'ok'), 'Diễn tập gần nhất 02/10', '', 'ok') + item('history', 'Phiên bản v0.1.0', 'Cập nhật 16/10/2026', '', 'Xem nhật ký thay đổi', '', 'info') + '</div></div>' +
        '<div class="g-block"><h4 class="g-h">Nhật ký hoạt động</h4><div class="g-list">' + WF.audit.map(function (a) { return item('history', a.act, a.who + ' · ' + a.t, '', '', '', a.tone); }).join('') + '</div></div>';
    },
    sales: function () {
      return kpis([['Phiếu hôm nay', '3', WF.vnd(WF.kpi.revToday)], ['Còn nợ', WF.short(WF.kpi.debtIn), '3 khoản'], ['Phiếu nháp CTV', '3', 'chờ xác nhận']]) +
        gchips([['all', 'Tất cả'], ['paid', 'Đã thu đủ'], ['debt', 'Còn nợ'], ['void', 'Đã hủy']]) +
        '<div class="g-list" data-filterable>' + WF.sales.map(function (s) { var st = WF.saleState[s.state]; return item('receipt', s.code + ' ' + WF.chip(st[0], st[1]), s.cust + ' · ' + s.items + '<br>' + s.date + ' ' + s.time + ' · ' + s.by + ' · ' + s.note, WF.vnd(s.total), s.state === 'debt' ? 'đã thu ' + WF.short(s.paid) : '', s.state, st[1]); }).join('') + '</div>';
    }
  };

  /* ---------- router + tương tác chung ---------- */
  var st = D.createElement('style');
  st.textContent = '[data-pane]:not(.on){display:none!important}[hidden]{display:none!important}.wf-img{display:block;position:relative}.wf-img svg,.wsvg{display:block;width:100%;height:100%}.ic{flex:none;display:inline-block;vertical-align:middle}' +
    '.wf-toast{position:fixed;left:50%;bottom:calc(96px + var(--safe-bottom,0px));transform:translateX(-50%);background:#161616;color:#fff;font:500 13px/1.35 system-ui,sans-serif;padding:10px 16px;border-radius:999px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.28);animation:wft .22s ease;max-width:86vw;text-align:center}@keyframes wft{from{opacity:0;transform:translate(-50%,8px)}}' +
    '.wf-bars{display:flex;align-items:flex-end;gap:var(--gap,6px);height:calc(var(--h,120px) + 20px)}.wf-bars .c{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:6px}.wf-bars .stack{flex:1;display:flex;align-items:flex-end;gap:2px;min-height:0}.wf-bars .b{flex:1;display:block;border-radius:var(--r,5px) var(--r,5px) 2px 2px;background:var(--c1)}.wf-bars .b2{background:var(--c2)}.wf-bars .l{font-size:10px;text-align:center;opacity:.6;line-height:1;height:10px}' +
    ':root{--safe-top:0px;--safe-bottom:0px}html.framed{--safe-top:48px;--safe-bottom:22px}*{-webkit-tap-highlight-color:transparent}button{font:inherit;color:inherit;cursor:pointer}';
  D.head.appendChild(st);

  WF.toast = function (msg) { var t = D.createElement('div'); t.className = 'wf-toast'; t.textContent = msg; D.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); };

  WF.app = function (cfg) {
    var view = typeof cfg.view === 'string' ? WF.$(cfg.view) : cfg.view, cur = null;
    function go(id, params) {
      if (!cfg.screens[id]) id = cfg.home || 'home';
      cur = id; var html;
      try { html = cfg.screens[id](params || {}); } catch (e) { html = '<pre style="padding:16px;color:#b00;white-space:pre-wrap;font-size:12px">' + (e && e.stack) + '</pre>'; if (window.console) console.error(e); }
      view.innerHTML = html;
      (cfg.scroller ? WF.$(cfg.scroller) : window).scrollTo(0, 0);
      if (cfg.onRoute) cfg.onRoute(id, params || {});
      try { history.replaceState(null, '', '#' + id + (params && params.id ? ':' + params.id : '')); } catch (e) { }
      try { if (window.parent !== window) window.parent.postMessage({ wf: 'route', id: id }, '*'); } catch (e) { }
    }
    D.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (t) { e.preventDefault(); go(t.dataset.go, t.dataset.id ? { id: t.dataset.id } : {}); return; }
      t = e.target.closest('[data-tab]');
      if (t) { var box = t.closest('[data-tabs]'); if (box) { var own = function (x) { return x.closest('[data-tabs]') === box; }; WF.$$('[data-tab]', box).filter(own).forEach(function (x) { x.classList.toggle('on', x.dataset.tab === t.dataset.tab); }); WF.$$('[data-pane]', box).filter(own).forEach(function (x) { x.classList.toggle('on', x.dataset.pane === t.dataset.tab); }); } return; }
      t = e.target.closest('[data-f]');
      if (t) {
        var wrap = t.closest('[data-chips]'); if (!wrap) return; WF.$$('[data-f]', wrap).forEach(function (x) { x.classList.toggle('on', x === t); });
        var list = wrap.dataset.target ? WF.$(wrap.dataset.target) : wrap.nextElementSibling; if (!list) return; var f = t.dataset.f;
        Array.prototype.forEach.call(list.children, function (el) { el.hidden = !(f === 'all' || (el.dataset.cat || '').split(' ').indexOf(f) > -1); }); return;
      }
      t = e.target.closest('[data-open]'); if (t) { var o = WF.$(t.dataset.open); if (o) o.classList.add('open'); return; }
      t = e.target.closest('[data-close]'); if (t) { var c = t.dataset.close ? WF.$(t.dataset.close) : t.closest('.open'); if (c) c.classList.remove('open'); return; }
      t = e.target.closest('[data-toggle]'); if (t) { var g = WF.$(t.dataset.toggle); if (g) g.classList.toggle('open'); return; }
      t = e.target.closest('[data-toast]'); if (t) { WF.toast(t.dataset.toast); return; }
      t = e.target.closest('[data-add]'); if (t) { C.add(t.dataset.add); return; }
      t = e.target.closest('[data-rm]'); if (t) { C.rm(t.dataset.rm); return; }
      t = e.target.closest('[data-inc]'); if (t) { C.inc(t.dataset.inc, +t.dataset.d || 1); return; }
      t = e.target.closest('[data-clear]'); if (t) { C.clear(); return; }
      t = e.target.closest('[data-sell]'); if (t) { C.add(t.dataset.sell); go('pos'); return; }
      t = e.target.closest('[data-method]'); if (t) { P.method = t.dataset.method; WF.$$('[data-method]').forEach(function (x) { x.classList.toggle('on', x === t); }); return; }
    });
    D.addEventListener('input', function (e) {
      if (e.target.matches && e.target.matches('[data-recv]')) { P.recv = +e.target.value.replace(/\D/g, '') || 0; P.upd(); return; }
      var t = e.target.closest('[data-search]'); if (!t) return; var list = WF.$(t.dataset.search); if (!list) return; var q = WF.plain(t.value.trim());
      Array.prototype.forEach.call(list.children, function (el) { el.hidden = q && WF.plain(el.textContent).indexOf(q) < 0; });
    });
    var h = (location.hash || '').replace('#', '').split(':'), start = h[0] && cfg.screens[h[0]] ? h[0] : (cfg.home || 'home');
    go(start, h[1] ? { id: h[1] } : {});
    WF._go = go;
    return { go: go, cur: function () { return cur; } };
  };

  /* ---------- khung điện thoại do trang xem thử bật ---------- */
  function setFrame(on) { D.documentElement.classList.toggle('framed', !!on); }
  if (/[?&]frame=1/.test(location.search)) setFrame(true);
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.wf === 'frame') setFrame(e.data.on);
    if (e.data.wf === 'go' && WF._go) WF._go(e.data.id, e.data.p || {});
  });
  try { if (window.parent !== window) window.parent.postMessage({ wf: 'ready' }, '*'); } catch (e) { }
})();
