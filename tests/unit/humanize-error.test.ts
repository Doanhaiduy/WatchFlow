import { describe, expect, it } from "vitest";
import { MSG, humanizeError, humanizeHttpStatus } from "@/lib/humanize-error";
import { isNoiseError, normalizeRoute, scrubErrorText, topStackFrame } from "@/lib/client-error";

describe("humanizeError", () => {
  it("giữ nguyên thông điệp WF-* của máy chủ (có status + detail)", () => {
    const e = Object.assign(new Error("x"), { status: 409, code: "WF-STOCK-BUSY", detail: "Chiếc này vừa được người khác giữ." });
    expect(humanizeError(e)).toBe("Chiếc này vừa được người khác giữ.");
  });
  it("lỗi 5xx có detail của máy chủ vẫn giữ nguyên (kèm mã yêu cầu)", () => {
    const e = { status: 500, code: "WF-INTERNAL", detail: "Có lỗi xảy ra. Vui lòng thử lại; nếu lặp lại hãy báo mã ab12cd34." };
    expect(humanizeError(e)).toContain("ab12cd34");
  });
  it("TypeError: Failed to fetch ⇒ lỗi mạng, có gợi ý", () => {
    expect(humanizeError(new TypeError("Failed to fetch"))).toBe(MSG.network);
    expect(humanizeError(new TypeError("Load failed"))).toBe(MSG.network);
    expect(humanizeError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(MSG.network);
  });
  it("AbortError / TimeoutError", () => {
    expect(humanizeError(new DOMException("The user aborted a request.", "AbortError"))).toBe(MSG.aborted);
    expect(humanizeError(new DOMException("signal timed out", "TimeoutError"))).toBe(MSG.timeout);
  });
  it("JSON hỏng ⇒ dữ liệu không đọc được", () => {
    expect(humanizeError(new SyntaxError("Unexpected token < in JSON at position 0"))).toBe(MSG.badResponse);
  });
  it("lỗi lạ tiếng Anh ⇒ câu chung; câu tiếng Việt / WF-* giữ nguyên", () => {
    expect(humanizeError(new Error("Cannot read properties of undefined (reading 'x')"))).toBe(MSG.generic);
    expect(humanizeError(undefined)).toBe(MSG.generic);
    expect(humanizeError(new Error("Chưa chọn khách hàng."))).toBe("Chưa chọn khách hàng.");
    expect(humanizeError(new Error("WF-VALIDATION: sai dữ liệu"))).toBe("WF-VALIDATION: sai dữ liệu");
  });
  it("mã HTTP không có detail", () => {
    expect(humanizeHttpStatus(502)).toBe(MSG.unavailable);
    expect(humanizeHttpStatus(504)).toBe(MSG.timeout);
    expect(humanizeHttpStatus(500)).toBe(MSG.server);
    expect(humanizeHttpStatus(429)).toBe(MSG.tooMany);
    expect(humanizeHttpStatus(412)).toMatch(/tải lại/);
    expect(humanizeHttpStatus(409)).toMatch(/tải lại/);
    expect(humanizeError({ status: 503, code: "WF-UNKNOWN" })).toBe(MSG.unavailable);
  });
});

describe("làm sạch lỗi trình duyệt (không PII)", () => {
  it("che email, số dài, UUID, token, query", () => {
    const s = scrubErrorText("Lỗi với khach@abc.vn sdt 0901 234 567 cccd 012345678901 id 123e4567-e89b-12d3-a456-426614174000 /ban-hang?q=Nguyen+Van+A");
    expect(s).not.toMatch(/khach@|0901|012345678901|123e4567|Nguyen/);
    expect(s).toContain("/ban-hang");
  });
  it("không phá số nhỏ", () => {
    expect(scrubErrorText("dòng 12, cột 34")).toBe("dòng 12, cột 34");
  });
  it("normalizeRoute bỏ query/hash và gộp id", () => {
    expect(normalizeRoute("/ban-hang/123e4567-e89b-12d3-a456-426614174000?x=1#h")).toBe("/ban-hang/:id");
    expect(normalizeRoute("/dong-ho/42")).toBe("/dong-ho/:id");
    expect(normalizeRoute("")).toBe("/");
  });
  it("topStackFrame + nhiễu", () => {
    expect(topStackFrame("Error: x\n    at foo (https://a/_next/static/chunks/app.js:1:2)")).toContain("_next");
    expect(isNoiseError("ResizeObserver loop completed")).toBe(true);
    expect(isNoiseError("TypeError: x is undefined")).toBe(false);
  });
});
