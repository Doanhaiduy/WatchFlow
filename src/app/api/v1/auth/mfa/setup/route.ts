import { api } from "@/server/http";
import { mfaSetup } from "@/server/auth/service";
import QRCode from "qrcode";

export const POST = api({ auth: "auth" }, async ({ user }) => {
  const { secret, uri } = await mfaSetup(user.userId, user.email);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 200 });
  return { secret, uri, qrSvg };
});
