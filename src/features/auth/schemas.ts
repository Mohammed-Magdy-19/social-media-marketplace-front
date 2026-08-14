import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, "At least 2 characters").max(60),
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(24)
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscores only"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
