import { api } from "@/server/http";

// Thông tin cửa hàng in trên phiếu + tài khoản nhận chuyển khoản (để hiện VietQR). Mọi người đã đăng nhập đọc được:
// bán hàng cần các giá trị này dù không có settings.view; không có bí mật nào ở đây (chính là nội dung in trên phiếu/hiện cho khách).
// Mã VietQR được vẽ ở trình duyệt — không gọi dịch vụ ngoài và không ghi nhận tiền (BR-PAY-02).
const KEYS = [
  "store.name", "store.address", "store.phone", "store.tax_code", "store.receipt_footer", "store.warranty_terms", "store.repair_terms",
  "payment.bank_bin", "payment.account_no", "payment.account_name", "payment.transfer_template",
] as const;

export const GET = api({}, async ({ db }) => {
  const rows = await db((tx) => tx.q<{ key: string; value: unknown }>(`SELECT key, value FROM public.settings WHERE key = ANY($1)`, [KEYS as unknown as string[]]));
  const v = (k: string) => {
    const x = rows.find((r) => r.key === k)?.value;
    return typeof x === "string" ? x : "";
  };
  const bankBin = v("payment.bank_bin");
  const accountNo = v("payment.account_no").replace(/\s/g, "");
  return {
    store: {
      name: v("store.name"), address: v("store.address"), phone: v("store.phone"), taxCode: v("store.tax_code"),
      receiptFooter: v("store.receipt_footer"), warrantyTerms: v("store.warranty_terms"), repairTerms: v("store.repair_terms"),
    },
    payment: {
      configured: /^\d{6}$/.test(bankBin) && /^[0-9A-Za-z]{4,19}$/.test(accountNo),
      bankBin, accountNo, accountName: v("payment.account_name"), transferTemplate: v("payment.transfer_template") || "{code}",
    },
  };
});
