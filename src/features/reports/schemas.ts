import { z } from "zod"

export const reportSchema = z.object({
  reason: z.enum(
    [
      "Spam",
      "Harassment",
      "Misleading",
      "Prohibited item",
      "Counterfeit",
      "Other",
    ],
    { errorMap: () => ({ message: "Choose a reason" }) }
  ),
  detail: z.string().max(600).optional(),
})
