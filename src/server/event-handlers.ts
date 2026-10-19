import "server-only";
// Đăng ký handler outbox (extensibility: module giao tiếp qua domain_events). Import một lần ở jobs/dispatch.
// Bản gọn: thông báo "CTV báo đã bán" do chính hàm DB (fn_collab_claim) ghi cùng transaction — chưa có handler nào cần đăng ký.
// Muốn thêm handler: onEvent("tên.sự_kiện", async (ev, tx) => { … }) từ "./outbox".

let registered = false;
export function registerEventHandlers() {
  if (registered) return;
  registered = true;
}
