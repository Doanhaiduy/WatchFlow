import { z } from "zod";
import { api } from "@/server/http";
import { ApiError } from "@/server/errors";
import { FILE_KINDS, processUpload, type FileKind } from "@/server/files";
import { hitDb } from "@/server/ratelimit";
import type { Permission } from "@/lib/permissions";

const ENTITY_TABLES = ["watch_units", "watch_models", "repair_orders", "purchase_receipts", "customers", "settings", "sales"] as const;

// POST multipart: file, kind, entityTable?, entityId?
export const POST = api({ perm: ["catalog.manage", "repair.update", "repair.create", "purchase.create", "settings.manage", "customer.manage", "sale.create_draft"] }, async ({ req, user, db, can }) => {
  await hitDb("upload", user.userId);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new ApiError(422, "WF-VALIDATION", "Chưa chọn tệp.");
  const meta = z
    .object({
      kind: z.enum(FILE_KINDS),
      entityTable: z.enum(ENTITY_TABLES).optional(),
      entityId: z.string().uuid().optional(),
    })
    .safeParse({ kind: form.get("kind"), entityTable: form.get("entityTable") || undefined, entityId: form.get("entityId") || undefined });
  if (!meta.success) throw new ApiError(422, "WF-VALIDATION", "Thông tin tệp không hợp lệ.");
  const kind = meta.data.kind as FileKind;
  const need: Record<FileKind, Permission[]> = {
    product: ["catalog.manage"], condition: ["catalog.manage", "purchase.create", "repair.create", "sale.create_draft"], other: ["catalog.manage"],
    intake: ["repair.create", "repair.update"], evidence: ["purchase.create", "repair.update"],
    id_document: ["purchase.create", "customer.manage", "sale.create_draft"], logo: ["settings.manage"],
  };
  if (!can(need[kind])) throw new ApiError(403, "WF-AUTH-FORBIDDEN", "Bạn không có quyền tải loại tệp này.");
  // Ngày chụp từ trình duyệt ("YYYY:MM:DD HH:MM:SS", giờ địa phương của máy chụp ⇒ coi là giờ Việt Nam) — ảnh đã nén ở client mất EXIF
  const ex = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(form.get("exifDate") ?? ""));
  const clientTakenAt = ex && !Number.isNaN(Date.parse(`${ex[1]}-${ex[2]}-${ex[3]}T${ex[4]}:${ex[5]}:${ex[6]}+07:00`))
    ? new Date(`${ex[1]}-${ex[2]}-${ex[3]}T${ex[4]}:${ex[5]}:${ex[6]}+07:00`).toISOString() : null;
  const p = await processUpload(Buffer.from(await file.arrayBuffer()), kind, clientTakenAt);
  const immutable = kind === "intake" || kind === "evidence" || kind === "id_document";
  const row = await db((tx) =>
    tx.one<{ id: string }>(
      `INSERT INTO public.files (bucket, path, original_name, mime, size_bytes, sha256, width, height, thumb_path, kind, entity_table, entity_id, is_immutable, taken_at, thumb_size_bytes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, app.current_user_id()) RETURNING id`,
      [p.bucket, p.path, file.name.slice(0, 200), p.mime, p.size, p.sha256, p.width, p.height, p.thumbPath, kind,
       meta.data.entityTable ?? null, meta.data.entityId ?? null, immutable, p.takenAt, p.thumbSize],
    ),
  );
  return { id: row!.id, url: `/api/v1/files/${row!.id}`, thumbUrl: p.thumbPath ? `/api/v1/files/${row!.id}/thumb` : null, width: p.width, height: p.height };
});
