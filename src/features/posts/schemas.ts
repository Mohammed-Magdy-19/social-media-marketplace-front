import { z } from "zod"

export const postComposerSchema = z.object({
  caption: z.string().min(1, "Say something about your listing").max(2000),
  categoryId: z.string().min(1, "Choose a category"),
  tags: z.array(z.string().min(1).max(24)).max(8, "Up to 8 tags"),
})

export const commentSchema = z.object({
  body: z.string().min(1, "Write a comment").max(500),
})

export const replySchema = commentSchema
