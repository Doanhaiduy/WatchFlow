// UT-storage-monitor — tính dung lượng, tăng trưởng/ngày, ước tính ngày đầy, mức cảnh báo; fitSize của nén ảnh phía trình duyệt.
import { describe, expect, it } from "vitest";
import { daysUntilFull, formatBytes, formatDaysLeft, growthPerDay, levelOf, percentOf, summarizeStorage, type StorageUsageRaw } from "@/lib/storage-monitor";
import { fitSize } from "@/lib/image-optimize";

const MB = 1024 * 1024;

describe("storage-monitor", () => {
  it("formatBytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * MB)).toBe("5.0 MB");
    expect(formatBytes(null)).toBe("—");
  });
  it("percentOf / levelOf theo ngưỡng cài đặt", () => {
    expect(percentOf(512 * MB, 1024 * MB)).toBe(50);
    expect(percentOf(1, 0)).toBeNull();
    const lim = { warnPercent: 80, criticalPercent: 95 };
    expect(levelOf(79.9, lim)).toBe("ok");
    expect(levelOf(80, lim)).toBe("warn");
    expect(levelOf(95, lim)).toBe("critical");
    expect(levelOf(null, lim)).toBe("unknown");
  });
  it("daysUntilFull: đầy = 0, không tăng = null, làm tròn lên", () => {
    expect(daysUntilFull(1000, 1000, 10)).toBe(0);
    expect(daysUntilFull(100, 1000, 0)).toBeNull();
    expect(daysUntilFull(100, 1000, null)).toBeNull();
    expect(daysUntilFull(100, 1000, 100)).toBe(9);
    expect(daysUntilFull(100, 1000, 70)).toBe(13); // 900/70 = 12.86
  });
  it("formatDaysLeft", () => {
    expect(formatDaysLeft(null)).toMatch(/chưa đủ dữ liệu/);
    expect(formatDaysLeft(0)).toBe("đã đầy");
    expect(formatDaysLeft(20)).toBe("~20 ngày");
    expect(formatDaysLeft(90)).toBe("~3 tháng");
    expect(formatDaysLeft(1500)).toBe("hơn 3 năm");
  });
  it("growthPerDay: cần >= 3 ngày dữ liệu; chia cho số ngày từ tệp đầu tiên (tối đa cửa sổ)", () => {
    expect(growthPerDay([], "2026-10-17")).toBeNull();
    expect(growthPerDay([{ day: "2026-10-16", bytes: 100 }, { day: "2026-10-17", bytes: 100 }], "2026-10-17")).toBeNull(); // 2 ngày
    // 5 ngày từ 10-13 đến 10-17: 1000 byte ⇒ 200/ngày
    expect(growthPerDay([{ day: "2026-10-13", bytes: 400 }, { day: "2026-10-17", bytes: 600 }], "2026-10-17")).toBe(200);
    // ngoài cửa sổ 30 ngày bị bỏ qua
    expect(growthPerDay([{ day: "2026-08-01", bytes: 9999 }], "2026-10-17")).toBeNull();
    // qua tháng/năm vẫn đúng (không dùng new Date theo giờ máy)
    expect(growthPerDay([{ day: "2026-12-30", bytes: 300 }], "2027-01-01")).toBe(100);
  });
  it("summarizeStorage: gộp bucket, % và ngày đầy", () => {
    const raw: StorageUsageRaw = {
      buckets: [{ bucket: "unit-photos", files: 10, bytes: 600 * MB }, { bucket: "documents", files: 5, bytes: 300 * MB }],
      pending: { files: 0, bytes: 0 }, purged: { files: 0, bytes: 0 },
      daily: [{ day: "2026-10-01", bytes: 300 * MB }, { day: "2026-10-10", bytes: 300 * MB }],
      quotaMb: 1024, warnPercent: 80, criticalPercent: 95, today: "2026-10-17",
    };
    const s = summarizeStorage(raw);
    expect(s.totalBytes).toBe(900 * MB);
    expect(s.totalFiles).toBe(15);
    expect(s.level).toBe("warn"); // 87.9%
    expect(s.bytesPerDay).toBeCloseTo((600 * MB) / 17, 0);
    expect(s.daysLeft).toBe(Math.ceil((124 * MB) / ((600 * MB) / 17)));
  });
});

describe("image-optimize.fitSize", () => {
  it("thu nhỏ cạnh dài về 2000, giữ tỉ lệ; ảnh nhỏ giữ nguyên", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 2000, height: 1500, scale: 0.5 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1500, height: 2000, scale: 0.5 });
    expect(fitSize(1200, 800)).toEqual({ width: 1200, height: 800, scale: 1 });
    expect(fitSize(1, 1).width).toBe(1);
  });
});
