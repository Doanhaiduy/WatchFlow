import { z } from "zod";

export const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
});

export const CreateUserBody = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ").max(200),
  fullName: z.string().trim().min(1, "Nhập họ tên").max(120),
  phone: z.string().trim().max(20).optional(),
  roles: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).min(1, "Chọn ít nhất một vai trò"),
});
export const UpdateUserBody = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
});
export const SetStatusBody = z.object({
  status: z.enum(["active", "disabled"]),
  reason: z.string().trim().min(10, "Lý do ít nhất 10 ký tự").max(500),
});
export const SetRolesBody = z.object({ roles: z.array(z.string()).min(1), reason: z.string().trim().max(500).optional() });
export const RoleBody = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Mã chỉ gồm chữ thường, số, gạch dưới").optional(),
  nameVi: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  maxDiscountPct: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
export const RolePermsBody = z.object({ permissions: z.array(z.string()).max(200) });
export const SettingPatchBody = z.object({ key: z.string(), value: z.unknown() });
export const AuditQuery = Paging.extend({
  entity: z.string().max(60).optional(),
  entityId: z.string().max(60).optional(),
  actor: z.string().uuid().optional(),
  action: z.string().max(60).optional(),
});
