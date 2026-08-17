import { z } from "zod"

const objectIdRegex = /^[0-9a-fA-F]{24}$/

/**
 * Create-report form. `targetType`/`targetId` are fixed per mount point
 * (passed as props, never user-editable); only `reason` is an actual input.
 * The status is always `pending` on create — never sent by the client.
 */
export const createReportFormSchema = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.string().regex(objectIdRegex, "Invalid target ID format"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(1000, "Reason cannot exceed 1000 characters"),
})
export type CreateReportFormValues = z.infer<typeof createReportFormSchema>

/**
 * Admin status-change form. Mirrors the backend's `updateReportSchema`
 * enum exactly — `pending` is a valid *stored* status but is not settable
 * via PATCH, so it is deliberately excluded from this form's options.
 * `resolutionNotes` is optional-but-encouraged (backend accepts "").
 */
export const updateReportFormSchema = z.object({
  status: z.enum(["reviewed", "dismissed", "resolved"]),
  resolutionNotes: z
    .string()
    .trim()
    .max(2000, "Resolution notes cannot exceed 2000 characters")
    .optional()
    .or(z.literal("")),
})
export type UpdateReportFormValues = z.infer<typeof updateReportFormSchema>
