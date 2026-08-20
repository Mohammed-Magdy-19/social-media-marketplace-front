import { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { ArrowUp, ImagePlus, Loader2, Plus, X } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useCategories } from "@/features/categories/queries"
import { useFeedInfinite } from "@/features/feed/queries"
import { useCreatePost, type CreatePostInput } from "@/features/posts/mutations"
import { postComposerSchema, type PostComposerValues } from "@/features/posts/schemas"
import { getErrorMessage } from "@/lib/api/errors"
import {
  POST_MEDIA_MAX_BYTES,
  POST_MEDIA_MAX_FILES,
  uploadPostMedia,
} from "@/lib/api/client"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { PostCard } from "@/features/posts/components/PostCard"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ComposerValues = PostComposerValues

function Composer() {
  const user = useAuthStore((s) => s.user)
  const { data: categories } = useCategories()
  const createPost = useCreatePost()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<{ file: File; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const form = useForm<ComposerValues>({
    resolver: zodResolver(postComposerSchema),
    defaultValues: { title: "", content: "", categoryId: "", price: undefined, tags: [] },
  })

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return
    const oversized = incoming.find((f) => f.size > POST_MEDIA_MAX_BYTES)
    if (oversized) {
      toast.error("Each photo must be 10MB or smaller")
      return
    }
    const room = POST_MEDIA_MAX_FILES - media.length
    const accepted = incoming.slice(0, room)
    if (accepted.length === 0) {
      toast.error(`Up to ${POST_MEDIA_MAX_FILES} photos per post`)
      return
    }
    if (accepted.length < incoming.length) {
      toast.error(`Up to ${POST_MEDIA_MAX_FILES} photos per post`)
    }
    const next = accepted.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setMedia((prev) => [...prev, ...next])
  }

  const removeFile = (index: number) => {
    setMedia((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].url)
      next.splice(index, 1)
      return next
    })
  }

  if (!user) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-card bg-card p-4 ring-1 ring-foreground/10">
        <AvatarWithFallback name="Guest" src={null} />
        <p className="flex-1 text-sm text-muted-foreground">
          Share a listing with the community.
        </p>
        <Button size="sm" render={<Link to="/register" />}>
          <Plus />
          Create post
        </Button>
      </div>
    )
  }

  const onSubmit = async (values: ComposerValues) => {
    const payload: CreatePostInput = {
      title: values.title,
      content: values.content,
      categoryId: values.categoryId,
      price: values.price,
      tags: values.tags.filter(Boolean),
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await createPost.mutateAsync(payload)
      const postId = res.data.post.id
      if (media.length > 0) {
        await uploadPostMedia(postId, media.map((m) => m.file), undefined, setUploadProgress)
      }
      toast.success("Post created")
      form.reset({ title: "", content: "", categoryId: "", price: undefined, tags: [] })
      media.forEach((m) => URL.revokeObjectURL(m.url))
      setMedia([])
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-4 flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-foreground/10"
      >
        <div className="flex items-center gap-3">
          <AvatarWithFallback name={user.name} src={user.avatar} />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="grid flex-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Post title"
                    aria-label="Post title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem className="grid">
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="What are you selling?"
                  aria-label="Post content"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {media.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {media.map((m, i) => (
              <div
                key={m.url}
                className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10"
              >
                <img
                  src={m.url}
                  alt={`Uploaded photo ${i + 1}`}
                  className="size-full object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                  onClick={() => removeFile(i)}
                  disabled={uploading}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || media.length >= POST_MEDIA_MAX_FILES}
          >
            <ImagePlus />
            {media.length > 0
              ? `${media.length}/${POST_MEDIA_MAX_FILES} photos`
              : "Add photos"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label="Upload photos"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ""
            }}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem className="grid">
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    itemToStringLabel={(id) =>
                      categories?.find((c) => c.id === id)?.name ?? ""
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Category">
                        {(val) =>
                          categories?.find((c) => c.id === val)?.name ?? "Category"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id} label={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem className="grid">
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Price (USD)"
                    aria-label="Post price"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem className="grid min-w-40 flex-1">
                <FormControl>
                  <Input
                    value={field.value.join(", ")}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Tags, comma separated"
                    aria-label="Post tags"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="sm"
            disabled={createPost.isPending || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" />
                Uploading {uploadProgress}%
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function FeedColumn() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFeedInfinite()
  const parentRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const posts = data?.pages.flatMap((p) => p.data) ?? []

  const virtualizer = useVirtualizer({
    count: posts.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 420,
    overscan: 4,
  })

  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1)
    if (last && last.index >= posts.length - 2 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [virtualizer, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleScroll = () => {
    if (parentRef.current) {
      setShowScrollTop(parentRef.current.scrollTop > 320)
    }
  }

  const scrollToTop = () => {
    parentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="relative">
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="max-h-[calc(100svh-5rem)] overflow-y-auto no-scrollbar"
      >
        <div className="flex flex-col gap-3 pb-6">
          <ErrorBoundary fallback={<SectionFallback />}>
            <Composer />
          </ErrorBoundary>

          <ErrorBoundary fallback={<SectionFallback />}>
            <div
              className="relative flex flex-col gap-3"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const post = posts[item.index]
                if (!post) {
                  return (
                    <div
                      key={`load-${item.index}`}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="flex justify-center py-4"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchNextPage()}
                        disabled={isFetchingNextPage}
                      >
                        Load more
                      </Button>
                    </div>
                  )
                }
                return (
                  <div
                    key={post.id || (post as unknown as { _id?: string })._id || item.index}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                  >
                    <PostCard post={post} />
                  </div>
                )
              })}
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {showScrollTop && (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg ring-1 ring-foreground/15 hover:bg-brand hover:text-brand-foreground transition-all duration-200"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <FeedColumn />
    </div>
  )
}
