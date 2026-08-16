import { z } from "zod"

/**
 * Mirrors payment.validator.js exactly (api-docs §5.8). Amount is the smallest
 * currency unit (e.g. cents), never a decimal dollar float — dollars are
 * converted to cents at the form boundary only, never in this schema.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const createPaymentIntentSchema = z.object({
  amount: z
    .number({ required_error: "amount is required." })
    .int(
      "amount must be an integer in the smallest currency unit (e.g. cents)."
    )
    .positive(
      "A positive amount (in the smallest currency unit) is required."
    ),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Currency must be a valid 3-letter ISO code.")
    .optional()
    .default("usd"),
  postId: z
    .string()
    .regex(objectIdRegex, "postId must be a valid post ID.")
    .optional(),
})

export type CreatePaymentIntentFormValues = z.infer<
  typeof createPaymentIntentSchema
>

export const checkoutSchema = z.object({
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
