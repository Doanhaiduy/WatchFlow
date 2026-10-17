// Chống bấm lặp cho nút gửi/xác nhận (thuần, kiểm thử được). Dùng bởi Button (`guard`) và `useSubmitOnce`.

/** Cửa chặn theo thời gian: lần bấm thứ hai trong `ms` mili-giây sau lần được qua thì bị bỏ. */
export function createClickGuard(ms = 600, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY;
  return {
    /** true = cho qua (và ghi nhận lần bấm này); false = bấm lặp, bỏ qua */
    pass(): boolean {
      const t = now();
      if (t - last < ms) return false;
      last = t;
      return true;
    },
    reset() {
      last = Number.NEGATIVE_INFINITY;
    },
  };
}

/**
 * Bọc hành động bất đồng bộ: đang chạy hoặc vừa chạy trong `ms` thì bỏ lần gọi thêm.
 * `run` trả `undefined` khi bị bỏ; còn lại trả kết quả (hoặc ném lỗi như hàm gốc, sau đó nhả khóa).
 */
export function createSubmitGuard(ms = 600, now: () => number = Date.now) {
  const click = createClickGuard(ms, now);
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    async run<T>(fn: () => Promise<T> | T): Promise<T | undefined> {
      if (pending || !click.pass()) return undefined;
      pending = true;
      try {
        return await fn();
      } finally {
        pending = false;
      }
    },
  };
}
