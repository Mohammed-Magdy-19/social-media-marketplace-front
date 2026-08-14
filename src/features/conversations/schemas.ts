import { z } from "zod"

export const negotiationOfferSchema = z.object({
  price: z.coerce
    .number({ invalid_type_error: "Enter an offer price" })
    .positive("Offer must be positive"),
  message: z.string().min(1, "Add a short message").max(500),
})
