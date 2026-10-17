/** Chuẩn hóa để tìm kiếm tiếng Việt không dấu: bỏ dấu, đ→d, chữ thường. */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}
