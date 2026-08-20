import { z } from "zod"

export const postComposerSchema = z.object({
  title: z.string().min(1, "Post title is required").max(100, "Title cannot exceed 100 characters"),
  content: z.string().min(1, "Post content is required").max(2000, "Content cannot exceed 2000 characters"),
  categoryId: z.string().min(1, "Choose a category"),
  price: z.coerce.number().min(0, "Price cannot be negative").optional(),
  tags: z.array(z.string().min(1).max(24)).max(20, "Up to 20 tags"),
})

export type PostComposerValues = z.infer<typeof postComposerSchema>

export const commentSchema = z.object({
  text: z.string().min(1, "Write a comment").max(500),
})

export const replySchema = commentSchema
