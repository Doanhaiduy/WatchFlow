import "server-only";
// Outbox (domain_events): fn_* chèn sự kiện cùng transaction; worker xử lý sau (extensibility). Mỗi loại một handler;
// handler phải idempotent (có thể chạy lại khi lỗi). Lỗi ⇒ tăng attempts, lùi available_at (tối đa 10 lần).
import { withWorker, type Tx } from "./db";
import { recordErrorEvent } from "./ops";

export type DomainEvent = { id: string; type: string; payload: Record<string, unknown>; attempts: number };
type Handler = (ev: DomainEvent, tx: Tx) => Promise<void>;

const handlers = new Map<string, Handler[]>();

export function onEvent(type: string, h: Handler) {
  handlers.set(type, [...(handlers.get(type) ?? []), h]);
}

export async function dispatchEvents(limit = 100): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  const batch = await withWorker((tx) =>
    tx.q<DomainEvent>(
      `SELECT id, type, payload, attempts FROM public.domain_events
       WHERE processed_at IS NULL AND available_at <= now() AND attempts < 10 ORDER BY occurred_at LIMIT $1`,
      [limit],
    ),
  );
  for (const ev of batch) {
    try {
      await withWorker(async (tx) => {
        const locked = await tx.one("SELECT id FROM public.domain_events WHERE id = $1 AND processed_at IS NULL FOR UPDATE SKIP LOCKED", [ev.id]);
        if (!locked) return;
        for (const h of handlers.get(ev.type) ?? []) await h(ev, tx);
        await tx.q("UPDATE public.domain_events SET processed_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1", [ev.id]);
      });
      processed++;
    } catch (e) {
      failed++;
      const msg = (e as Error).message?.slice(0, 300) ?? "lỗi";
      await withWorker((tx) =>
        tx.q(
          "UPDATE public.domain_events SET attempts = attempts + 1, last_error = $2, available_at = now() + make_interval(mins => least(60, power(2, attempts)::int)) WHERE id = $1",
          [ev.id, msg],
        ),
      ).catch(() => {});
      await recordErrorEvent({ source: "outbox", code: ev.type, message: msg });
    }
  }
  return { processed, failed };
}

let kickTimer: ReturnType<typeof setTimeout> | null = null;
/** Đẩy outbox sau request ghi (gộp trong 500 ms). Cron vẫn là đường bảo đảm — lỗi ở đây bỏ qua. */
export function kickOutbox() {
  if (kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    void import("./event-handlers").then((m) => m.registerEventHandlers()).then(() => dispatchEvents(50)).then(() => import("./push")).then((m) => m.dispatchPendingPush()).catch(() => {});
  }, 500);
}
