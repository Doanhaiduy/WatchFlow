"use client";
// Cài đặt → Tài khoản → Thông báo trên thiết bị: công tắc bật/tắt đẩy cho THIẾT BỊ NÀY, giờ yên tĩnh, "Gửi thử".
// Bật công tắc mới xin quyền Notification và đăng ký đẩy (usePushDevice.enable) — không tự đăng ký lúc mở trang.
import { BellRing, Send } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { errMsg } from "@/components/auth/helpers";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { api, swrFetcher } from "@/lib/api-client";
import { usePushDevice, useDeviceEnv } from "@/lib/pwa";
import "./pwa.css";

type Config = {
  enabled: boolean;
  publicKey: string | null;
  quiet: { enabled: boolean; start: number; end: number };
  devices: { id: string; endpoint: string; userAgent: string | null; createdAt: string; lastOkAt: string | null; disabledAt: string | null }[];
};
const KEY = "/api/v1/me/push-config";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** Mốc giờ cách nhau 30 phút (+ giá trị hiện có nếu không nằm trên lưới) */
function timeOptions(...extra: number[]): SelectOption[] {
  const set = new Set<number>(extra);
  for (let m = 0; m < 1440; m += 30) set.add(m);
  return [...set].sort((a, b) => a - b).map((m) => ({ value: String(m), label: hhmm(m) }));
}

export function PushSettings() {
  const toast = useToast();
  const env = useDeviceEnv();
  const { data, error, mutate } = useSWR<Config>(KEY, swrFetcher, { shouldRetryOnError: false });
  const device = usePushDevice(data?.publicKey);
  const [testing, setTesting] = useState(false);
  const [savingQuiet, setSavingQuiet] = useState(false);

  const registered = !!device.endpoint && !!data?.devices.some((d) => d.endpoint === device.endpoint && !d.disabledAt);
  const active = data?.devices.filter((d) => !d.disabledAt).length ?? 0;
  const q = data?.quiet ?? { enabled: false, start: 1320, end: 420 };
  const opts = useMemo(() => timeOptions(q.start, q.end), [q.start, q.end]);

  const toggle = async (on: boolean) => {
    try {
      if (on) {
        await device.enable();
        toast.success("Đã bật thông báo trên thiết bị này");
      } else {
        await device.disable();
        toast.success("Đã tắt thông báo trên thiết bị này");
      }
      await mutate();
    } catch (e) {
      toast.error(on ? "Không bật được thông báo" : "Không tắt được thông báo", errMsg(e));
    }
  };
  const saveQuiet = async (next: { enabled: boolean; start: number; end: number }) => {
    setSavingQuiet(true);
    try {
      await api(KEY, { method: "PUT", body: { quietEnabled: next.enabled, quietStart: next.start, quietEnd: next.end } });
      await mutate({ ...(data as Config), quiet: next }, { revalidate: false });
    } catch (e) {
      toast.error("Không lưu được giờ yên tĩnh", errMsg(e));
    } finally {
      setSavingQuiet(false);
    }
  };
  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api<{ devices: number; sent: number; failed: number }>("/api/v1/me/push-subscriptions/test", { method: "POST" });
      if (r.sent > 0) toast.success("Đã gửi thông báo thử", `${r.sent}/${r.devices} thiết bị. Vài giây nữa sẽ hiện trên thiết bị.`);
      else toast.error("Chưa gửi được thông báo thử", "Thiết bị không nhận được. Hãy tắt rồi bật lại thông báo.");
      await mutate();
    } catch (e) {
      toast.error("Không gửi thử được", errMsg(e));
    } finally {
      setTesting(false);
    }
  };

  const heading = (
    <h2 className="wf-g-h" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
      Thông báo trên thiết bị
    </h2>
  );

  if (error || !data) {
    return (
      <section className="g wf-pad" aria-label="Thông báo trên thiết bị">
        {heading}
        <p className="wf-mute" style={{ fontSize: 12.5 }}>{error ? "Không tải được cài đặt thông báo." : "Đang tải…"}</p>
      </section>
    );
  }

  let blocked: string | null = null;
  if (!data.enabled) blocked = "Máy chủ chưa bật thông báo đẩy. Thông báo vẫn hiện trong ứng dụng (biểu tượng chuông).";
  else if (env.inApp) blocked = `Bạn đang mở trong ${env.inApp.label}: ở đây không nhận được thông báo. Hãy mở bằng ${env.ios ? "Safari" : "Chrome"}.`;
  else if (device.state === "unsupported") blocked = env.ios && !env.standalone
    ? "Trên iPhone/iPad, hãy thêm WatchFlow vào màn hình chính (mục “Ứng dụng trên màn hình chính” bên trên) rồi mở từ biểu tượng để bật thông báo."
    : "Trình duyệt này không hỗ trợ thông báo đẩy.";
  else if (device.state === "denied") blocked = "Bạn đã chặn thông báo cho trang này. Hãy cho phép trong cài đặt trình duyệt (biểu tượng ổ khóa cạnh địa chỉ) rồi tải lại trang.";

  return (
    <section className="g wf-pad" aria-label="Thông báo trên thiết bị">
      {heading}
      <div className="wf-pwa-set">
        {blocked ? (
          <p className="note" role="status">{blocked}</p>
        ) : (
          <>
            <Switch
              checked={registered && device.state === "on"}
              onChange={(v) => void toggle(v)}
              disabled={device.busy}
              label="Nhận thông báo trên thiết bị này"
              description={active > 0 ? `Đang bật trên ${active} thiết bị của bạn.` : "Nhận nhắc việc ngay cả khi không mở ứng dụng."}
            />
            <Switch
              checked={q.enabled}
              onChange={(v) => void saveQuiet({ ...q, enabled: v })}
              disabled={savingQuiet}
              label="Giờ yên tĩnh"
              description="Trong khoảng này thông báo được giữ lại, gửi sau khi hết giờ yên tĩnh (giờ Việt Nam)."
            />
            {q.enabled && (
              <div className="wf-pwa-quiet">
                <Field label="Từ">
                  <Select value={String(q.start)} options={opts} disabled={savingQuiet} onValueChange={(v) => void saveQuiet({ ...q, start: Number(v) })} />
                </Field>
                <Field label="Đến">
                  <Select value={String(q.end)} options={opts} disabled={savingQuiet} onValueChange={(v) => void saveQuiet({ ...q, end: Number(v) })} />
                </Field>
              </div>
            )}
            <div>
              <Button icon={<Send size={18} aria-hidden="true" />} loading={testing} disabled={!registered || device.state !== "on"} onClick={() => void sendTest()}>
                Gửi thử
              </Button>
            </div>
            <p className="note">
              <BellRing size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              Thông báo đẩy chỉ nhắc ngắn; chi tiết luôn xem trong ứng dụng (biểu tượng chuông).
            </p>
          </>
        )}
      </div>
    </section>
  );
}
