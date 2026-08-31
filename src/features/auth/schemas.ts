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

export const firstNameRules = z
  .string({ required_error: "First name is required" })
  .trim()
  .min(1, "First name is required")
  .max(50, "First name cannot exceed 50 characters")

export const lastNameRules = z
  .string({ required_error: "Last name is required" })
  .trim()
  .min(1, "Last name is required")
  .max(50, "Last name cannot exceed 50 characters")

export const phoneNumberRules = z
  .string({ required_error: "Phone number is required" })
  .trim()
  .min(7, "Phone number must be at least 7 digits")
  .max(20, "Phone number cannot exceed 20 characters")
  .regex(
    /^\+?[0-9\s\-()]{7,20}$/,
    "Please provide a valid phone number"
  )

export const registerSchema = z.object({
  firstName: firstNameRules,
  lastName: lastNameRules,
  phoneNumber: phoneNumberRules,
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
