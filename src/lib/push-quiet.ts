// Giờ yên tĩnh của thông báo đẩy (giờ Việt Nam, UTC+7, không đổi giờ mùa hè). Thuần hàm — có test đơn vị.

const VN_OFFSET_MIN = 7 * 60;

/** Số phút trong ngày (0–1439) theo giờ Việt Nam của một thời điểm. */
export function vnMinuteOfDay(at: Date): number {
  return (at.getUTCHours() * 60 + at.getUTCMinutes() + VN_OFFSET_MIN) % 1440;
}

/**
 * Đang trong giờ yên tĩnh [start, end) (có thể vắt qua nửa đêm, vd. 22:00–07:00) thì trả thời điểm HẾT giờ yên tĩnh (đầu phút);
 * không thì null. start == end ⇒ coi như không có giờ yên tĩnh.
 */
export function quietUntil(at: Date, quiet: { enabled: boolean; start: number; end: number }): Date | null {
  if (!quiet.enabled || quiet.start === quiet.end) return null;
  const m = vnMinuteOfDay(at);
  const inQuiet = quiet.start < quiet.end ? m >= quiet.start && m < quiet.end : m >= quiet.start || m < quiet.end;
  if (!inQuiet) return null;
  const waitMin = (quiet.end - m + 1440) % 1440;
  return new Date(Math.floor(at.getTime() / 60_000) * 60_000 + waitMin * 60_000);
}
