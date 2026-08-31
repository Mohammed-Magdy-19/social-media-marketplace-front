import { z } from "zod"

/** Convert a dollar-denominated input to integer cents before it hits the API. */
export const toCents = (v: number) => Math.round(v * 100)

export const createOfferFormSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter an offer price" })
    .positive("Offer must be positive")
    .transform(toCents),
})
export type CreateOfferInput = z.input<typeof createOfferFormSchema>
export type CreateOfferFormValues = z.output<typeof createOfferFormSchema>

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
export type RespondOfferInput = z.input<typeof respondOfferFormSchema>
export type RespondOfferFormValues = z.output<typeof respondOfferFormSchema>
