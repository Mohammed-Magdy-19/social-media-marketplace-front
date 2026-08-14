import { z } from "zod"

export const checkoutSchema = z.object({
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
