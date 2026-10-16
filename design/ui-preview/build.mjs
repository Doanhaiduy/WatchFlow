// Đóng gói bản xem thử thành MỘT file HTML duy nhất để gửi khách (không cần kèm thư mục).
// Chạy:  node build.mjs   →  dist/watchflow-ui-preview.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(root, f), 'utf8');
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const CLOSE = new RegExp('<' + '/script', 'gi');
const esc = (s) => s.replace(CLOSE, '<' + '\\/script').split(LS).join('\\u2028').split(PS).join('\\u2029');

const designs = ['v1-horologe.html', 'v2-clarity.html', 'v3-bento.html', 'v4-command.html', 'v5-quay.html', 'v6-glass.html'];
const sharedTag = '<script src="assets/shared.js"></script>';
const shared = esc(read('assets/shared.js'));

const bundle = {};
for (const f of designs) {
  const html = read(f);
  if (!html.includes(sharedTag)) throw new Error(f + ': thiếu thẻ shared.js');
  bundle[f] = html.replace(sharedTag, () => '<script>' + shared + '</script>');
}

let hub = read('index.html');
const payload = '<script>window.WF_BUNDLE=' + esc(JSON.stringify(bundle)) + ';</script>\n';
const at = hub.lastIndexOf('<script>'); // script chính của trang chọn mẫu nằm cuối file
if (at < 0) throw new Error('Không tìm thấy điểm chèn trong index.html');
hub = hub.slice(0, at) + payload + hub.slice(at);

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'watchflow-ui-preview.html');
writeFileSync(out, hub);
console.log('OK ->', out, (Buffer.byteLength(hub) / 1024).toFixed(0) + ' KB');
