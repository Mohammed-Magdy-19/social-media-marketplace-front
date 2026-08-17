import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import type { CreateReportFormValues } from "./schemas"

/**
 * File a report against a post, comment, or user. POST /api/reports is the
 * only endpoint open to non-admins. No cache invalidation on success — the
 * reporting user has no list of their own reports to keep fresh; the dialog
 * closes and shows a confirmation toast (§3.1).
 */
export function useCreateReport() {
  return useMutation({
    mutationFn: (input: CreateReportFormValues) =>
      apiPost<{ status: string; message: string }>("/reports", input),
  })
}
