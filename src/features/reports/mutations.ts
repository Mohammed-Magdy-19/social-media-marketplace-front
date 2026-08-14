import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import type { z } from "zod"
import type { reportSchema } from "./schemas"

type ReportInput = z.infer<typeof reportSchema> & { targetType: "post" | "user" | "message"; targetId: string }

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: ReportInput) =>
      apiPost<{ id: string }>("/reports", input),
  })
}
