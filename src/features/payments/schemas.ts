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

export const shippingAddressSchema = z.object({
  street: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State/Province is required"),
  postalCode: z.string().trim().min(1, "Postal/ZIP code is required"),
  country: z.string().trim().min(1, "Country is required"),
})

export type ShippingAddressFormValues = z.infer<typeof shippingAddressSchema>

export const checkoutSchema = z.object({
  phoneNumber: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .min(7, "Phone number must be at least 7 digits")
    .max(20, "Phone number cannot exceed 20 characters")
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Please provide a valid phone number"),
  street: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State/Province is required"),
  postalCode: z.string().trim().min(1, "Postal/ZIP code is required"),
  country: z.string().trim().min(1, "Country is required"),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>
