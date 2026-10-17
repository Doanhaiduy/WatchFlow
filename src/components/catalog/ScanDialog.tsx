"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { errMsg } from "../auth/helpers";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { InsetList, InsetRow } from "../ui/InsetList";
import { Modal } from "../ui/Modal";
import { StatusChip } from "../ui/StatusChip";
import { TextInput } from "../ui/TextInput";
import { unitTitle, type UnitDto } from "./types";

type Detector = { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * Quét QR / nhập mã → mở chiếc. Có BarcodeDetector + camera (chỉ https/localhost) thì quét bằng camera;
 * không có thì dùng ô nhập mã nội bộ/serial (máy quét mã vạch USB cũng gõ vào ô này).
 */
export function ScanDialog({ open, onClose, onFound, continuous }: { open: boolean; onClose: () => void; onFound?: (u: UnitDto) => void; /** Quét liên tục (kiểm kê): không đóng hộp thoại sau mỗi lần quét; cùng mã trong 3 giây bị bỏ qua. */ continuous?: boolean }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<UnitDto[]>([]);
  const [cam, setCam] = useState<"off" | "on" | "denied">("off");
  const busyRef = useRef(false);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const lookup = async (c: string) => {
    if (busyRef.current || !c.trim()) return;
    if (continuous && last.current.code === c.trim() && Date.now() - last.current.at < 3000) return;
    last.current = { code: c.trim(), at: Date.now() };
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    setCands([]);
    try {
      const r = await api<{ items: UnitDto[] }>(`/api/v1/catalog/units/lookup?code=${encodeURIComponent(c.trim())}`, { noRedirect: true });
      if (r.items.length === 1) {
        if (onFound) {
          onFound(r.items[0]!);
          if (continuous) setCode("");
        } else {
          onClose();
          router.push(`/dong-ho/${r.items[0]!.id}`);
        }
      } else if (r.items.length > 1) setCands(r.items);
      else setErr(`Không tìm thấy chiếc nào với mã “${c.trim()}”.`);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // Camera + BarcodeDetector
  useEffect(() => {
    if (!open) return;
    setCode(""); setErr(null); setCands([]);
    const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let dead = false;
    const det = new BD({ formats: ["qr_code", "code_128", "ean_13"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setCam("on");
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        void v.play().catch(() => {});
        timer = setInterval(async () => {
          if (busyRef.current || v.readyState < 2) return;
          try {
            const r = await det.detect(v);
            if (r[0]?.rawValue) void lookup(r[0].rawValue);
          } catch {}
        }, 400);
      })
      .catch(() => setCam("denied"));
    return () => {
      dead = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      setCam("off");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(code);
  };

  return (
    <Modal open={open} onClose={onClose} title={continuous ? "Quét để đếm" : "Quét mã QR"}>
      {cam === "on" && (
        <video ref={video} muted playsInline aria-label="Camera quét mã" style={{ width: "100%", borderRadius: 20, background: "var(--wf-dark-btn)", marginBottom: 12, maxHeight: 280, objectFit: "cover" }} />
      )}
      {cam === "denied" && <p className="wf-mute" style={{ marginBottom: 8 }}>Không mở được camera. Bạn có thể nhập mã bên dưới.</p>}
      <form onSubmit={submit} noValidate>
        <Field label="Mã nội bộ hoặc serial" hint="Quét bằng máy quét mã vạch hoặc gõ tay, ví dụ DH-000412" error={err}>
          <TextInput data-autofocus value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        </Field>
        <Button type="submit" variant="primary" block loading={busy} disabled={!code.trim()}>
          {continuous ? "Đếm chiếc" : onFound ? "Chọn chiếc" : "Mở chiếc"}
        </Button>
      </form>
      {cands.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="wf-mute" style={{ marginBottom: 6 }}>Có {cands.length} chiếc khớp, chọn một:</p>
          <InsetList>
            {cands.map((u) => (
              <InsetRow key={u.id} href={onFound ? undefined : `/dong-ho/${u.id}`} onClick={onFound ? () => onFound(u) : undefined} title={unitTitle(u)} subtitle={`${u.assetCode}${u.serialNo ? ` · ${u.serialNo}` : ""}`} end={<StatusChip kind="unit" status={u.status} />} />
            ))}
          </InsetList>
        </div>
      )}
    </Modal>
  );
}
