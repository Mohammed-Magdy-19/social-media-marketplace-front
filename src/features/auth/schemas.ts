import { z } from "zod"

export const passwordRules = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password cannot exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

export const emailRules = z
  .string()
  .min(1, "Email is required")
  .email("Please provide a valid email address")
  .max(254, "Email cannot exceed 254 characters")
  .transform((val) => val.toLowerCase().trim())

export const usernameRules = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username cannot exceed 30 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  )
  .transform((val) => val.toLowerCase().trim())

export const registerSchema = z.object({
  username: usernameRules,
  email: emailRules,
  password: passwordRules,
})

export const loginSchema = z.object({
  email: emailRules,
  password: z.string().min(1, "Password is required"),
})

export const forgotPasswordSchema = z.object({
  email: emailRules,
})

export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    passwordConfirm: z.string().min(1, "Password confirmation is required"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  })

export const resendVerificationSchema = z.object({
  email: emailRules,
})
