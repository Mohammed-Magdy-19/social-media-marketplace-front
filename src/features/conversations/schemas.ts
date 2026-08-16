import { z } from "zod"

/** Convert a dollar-denominated input to integer cents before it hits the API. */
export const toCents = (v: number) => Math.round(v * 100)

export const createOfferFormSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter an offer price" })
    .positive("Offer must be positive")
    .transform(toCents),
})
export type CreateOfferFormValues = z.infer<typeof createOfferFormSchema>

export const respondOfferFormSchema = z
  .object({
    action: z.enum(["accept", "reject", "counter"]),
    amount: z.coerce
      .number({ invalid_type_error: "Enter a counter offer" })
      .positive("Counter offer must be positive")
      .transform(toCents)
      .optional(),
  })
  .refine((d) => d.action !== "counter" || typeof d.amount === "number", {
    message: "A counter offer requires an amount",
    path: ["amount"],
  })
export type RespondOfferFormValues = z.infer<typeof respondOfferFormSchema>
