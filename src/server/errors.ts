// Mã lỗi nghiệp vụ WF-* (api-conventions §1.2). Thêm mã mới: thêm ở đây + bảng docs + test.
export const ERROR_STATUS: Record<string, number> = {
  "WF-AUTH-UNAUTHENTICATED": 401, "WF-AUTH-FORBIDDEN": 403, "WF-AUTH-MUST-CHANGE-PASSWORD": 403, "WF-AUTH-MFA-REQUIRED": 403,
  "WF-AUTH-LOCKED": 423, "WF-AUTH-INVALID": 401, "WF-AUTH-CSRF": 403, "WF-AUTH-MFA-INVALID": 401, "WF-VALIDATION": 422, "WF-NOT-FOUND": 404,
  "WF-CONFLICT-VERSION": 412, "WF-CONFLICT": 409, "WF-IDEMPOTENCY-MISMATCH": 422, "WF-IDEMPOTENCY-REQUIRED": 428, "WF-RATE-LIMIT": 429,
  "WF-BUSY": 409, "WF-REASON-REQUIRED": 422, "WF-DOC-NOT-DRAFT": 409, "WF-DOC-BACKDATE": 422, "WF-DOC-FUTURE": 422, "WF-IMMUTABLE": 409,
  "WF-USER-EMAIL-DUPLICATE": 409, "WF-PASSWORD-WEAK": 422, "WF-FILE-INVALID": 422, "WF-FILE-TOO-LARGE": 413,
  "WF-UNIT-SERIAL-DUPLICATE": 409, "WF-UNIT-INVALID-TRANSITION": 409, "WF-UNIT-PHOTO-REQUIRED": 422, "WF-UNIT-GRADE-REQUIRED": 422,
  "WF-PUR-HAS-DEPENDENTS": 409, "WF-PUR-SELLER-ID-REQUIRED": 422, "WF-PUR-COST-ALLOCATION": 422, "WF-COST-NOT-ADJUSTABLE": 409,
  "WF-SALE-UNIT-UNAVAILABLE": 409, "WF-SALE-STOCK-INSUFFICIENT": 409, "WF-SALE-DISCOUNT-LIMIT": 403, "WF-SALE-BELOW-COST": 403,
  "WF-SALE-CUSTOMER-REQUIRED": 422, "WF-SALE-TRADEIN-EXCEEDS": 422, "WF-SALE-VOID-EXPIRED": 409, "WF-SALE-VOID-NOT-ALLOWED": 409,
  "WF-PAY-OVERPAY": 422, "WF-PAY-DOC-INVALID": 422, "WF-PAY-VOIDED": 409,
  "WF-RSV-UNIT-HELD": 409, "WF-RSV-DEPOSIT-TOO-LOW": 422, "WF-RSV-NOT-ACTIVE": 409, "WF-RSV-SETTLE-MISMATCH": 422,
  "WF-WAR-NOT-FOUND": 404, "WF-WAR-EXPIRED": 409,
  "WF-COL-UNIT-NOT-HELD": 409, "WF-COL-UNIT-ASSIGNED": 409, "WF-COL-PRICE-REQUIRED": 422, "WF-COL-ALREADY-SETTLED": 409,
  "WF-COL-HAS-SOLD": 409, "WF-COL-NOT-OWN": 403,
  "WF-REP-INVALID-STATUS": 409, "WF-REP-QUOTE-NOT-APPROVED": 409, "WF-REP-PART-INSUFFICIENT": 409, "WF-REP-LOCKED": 409,
  "WF-INV-STOCKTAKE-CLOSED": 409, "WF-CUS-PHONE-DUPLICATE": 409,
  "WF-SEC-LAST-OWNER": 409, "WF-SEC-PII-REASON": 422, "WF-SEC-REAUTH": 401,
  "WF-INTERNAL": 500,
};

export const ERROR_TITLES: Record<string, string> = {
  "WF-AUTH-UNAUTHENTICATED": "Cần đăng nhập", "WF-AUTH-FORBIDDEN": "Không có quyền", "WF-VALIDATION": "Dữ liệu chưa hợp lệ",
  "WF-NOT-FOUND": "Không tìm thấy", "WF-RATE-LIMIT": "Thao tác quá nhanh", "WF-INTERNAL": "Lỗi hệ thống",
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string,
    public errors?: { path: string; message: string }[],
    public headers?: Record<string, string>,
  ) {
    super(detail);
  }
  static of(code: string, detail: string, errors?: { path: string; message: string }[]) {
    return new ApiError(ERROR_STATUS[code] ?? 400, code, detail, errors);
  }
}

type PgErr = { code?: string; message?: string; constraint?: string; detail?: string; column?: string };

/** Lỗi đáng thử lại (serialization / deadlock) */
export function isRetryable(e: unknown): boolean {
  const c = (e as PgErr)?.code;
  return c === "40001" || c === "40P01";
}

/**
 * to_char(…, 'FM999G999…') trong hàm DB phân nhóm theo locale của máy chủ DB (thường ra dấu phẩy: 550,000).
 * Chuẩn hóa về kiểu Việt Nam (550.000) cho mọi câu hiển thị lấy từ DB.
 */
export function viGrouping(s: string): string {
  return s.replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/g, (m) => m.replace(/,/g, "."));
}

/** Ánh xạ lỗi DB → ApiError (mã WF-* nguyên vẹn; ràng buộc → câu tiếng Việt). Không lộ chi tiết kỹ thuật. */
export function mapDbError(e: unknown): ApiError | null {
  const pe = e as PgErr;
  if (!pe || typeof pe !== "object" || !pe.code) return null;
  if (pe.code === "P0001" && pe.message?.startsWith("{")) {
    try {
      const j = JSON.parse(pe.message) as { code: string; vi: string };
      return new ApiError(ERROR_STATUS[j.code] ?? 409, j.code, viGrouping(j.vi));
    } catch { /* rơi xuống */ }
  }
  switch (pe.code) {
    case "55P03": case "57014":
      return new ApiError(409, "WF-BUSY", "Dữ liệu đang được người khác xử lý. Vui lòng thử lại sau giây lát.");
    case "42501":
      return new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    case "23505":
      return new ApiError(409, "WF-CONFLICT", humanizeConstraint(pe.constraint) ?? "Dữ liệu bị trùng với bản ghi đã có.");
    case "23503":
      return new ApiError(409, "WF-CONFLICT", "Dữ liệu đang được tham chiếu hoặc tham chiếu không tồn tại.");
    case "23514": case "23502": case "22P02": case "22003": case "22007": case "22008":
      return new ApiError(422, "WF-VALIDATION", humanizeConstraint(pe.constraint) ?? "Dữ liệu chưa hợp lệ.");
    case "25006":
      return new ApiError(500, "WF-INTERNAL", "Có lỗi xảy ra. Vui lòng thử lại.");
  }
  return null;
}

const CONSTRAINT_VI: Record<string, string> = {
  users_email_key: "Email này đã được dùng cho tài khoản khác.",
};
function humanizeConstraint(c?: string): string | undefined {
  return c ? CONSTRAINT_VI[c] : undefined;
}
