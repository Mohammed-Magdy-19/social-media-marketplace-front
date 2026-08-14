import { z } from "zod"

export const searchSchema = z.object({
  query: z.string().max(120),
})

export type SearchValues = z.infer<typeof searchSchema>
