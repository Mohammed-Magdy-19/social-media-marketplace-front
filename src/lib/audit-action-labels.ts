import type { AuditAction } from "@/types"

/**
 * Human-readable labels for audit log actions (admin spec §6.2). The raw
 * enum values are backend-shaped constants — always render through this map,
 * and build the audit filter dropdown options from `AUDIT_ACTIONS` so the
 * full enum stays the single source of truth.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_BAN: "Banned user",
  USER_SUSPEND: "Suspended user",
  USER_REACTIVATE: "Reactivated user",
  ROLE_CHANGE: "Changed role",
  CATEGORY_CREATE: "Created category",
  CATEGORY_UPDATE: "Updated category",
  CATEGORY_DELETE: "Deleted category",
  REPORT_RESOLVE: "Resolved report",
  REPORT_DISMISS: "Dismissed report",
  POST_DELETE: "Deleted post",
  COMMENT_DELETE: "Deleted comment",
}

export const AUDIT_ACTIONS = Object.keys(
  AUDIT_ACTION_LABELS
) as AuditAction[]
