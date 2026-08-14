import { z } from "zod"
import { searchSchema } from "@/features/search/schemas"

export const adminCategoryCreateSchema = z.object({
  name: z.string().min(2).max(40),
})

export const adminUserStatusSchema = z.object({
  status: z.enum(["Active", "Suspended", "Banned"]),
})

export const adminReportActionSchema = z.object({
  action: z.enum(["Resolved", "Dismissed"]),
  note: z.string().max(300).optional(),
})

export const adminGlobalSearchSchema = searchSchema

export type AdminCategoryCreate = z.infer<typeof adminCategoryCreateSchema>
