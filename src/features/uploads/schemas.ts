import { z } from "zod"

export const avatarUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Avatar must be 2MB or smaller"),
})

export const postMediaUploadSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .max(5, "Max 5 files")
    .refine(
      (files) => files.every((f) => f.size <= 10 * 1024 * 1024),
      "Each file must be 10MB or smaller"
    ),
})
