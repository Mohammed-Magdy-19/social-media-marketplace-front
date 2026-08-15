import { useEffect, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { Plus } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useLayoutStore } from "@/stores/layoutStore"
import { useFilterStore } from "@/stores/filterStore"
import { useCategories } from "@/features/categories/queries"
import { useFeedInfinite } from "@/features/feed/queries"
import { usePostsInfinite } from "@/features/posts/queries"
import { useCreatePost } from "@/features/posts/mutations"
import { postComposerSchema } from "@/features/posts/schemas"
import { PostCard } from "@/features/posts/components/PostCard"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ComposerValues = z.infer<typeof postComposerSchema>

function CategoryPills() {
  const { data: categories } = useCategories()
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)

  return (
    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-2">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className={cn(
          "shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
          category === null
            ? "bg-brand text-white"
            : "bg-soft text-mut hover:bg-muted"
        )}
      >
        All
      </button>
      {(categories ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCategory(category === c.id ? null : c.id)}
          className={cn(
            "shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
            category === c.id
              ? "bg-brand text-white"
              : "bg-soft text-mut hover:bg-muted"
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

function Composer() {
  const user = useAuthStore((s) => s.user)
  const { data: categories } = useCategories()
  const createPost = useCreatePost()

  const form = useForm<ComposerValues>({
    resolver: zodResolver(postComposerSchema),
    defaultValues: { caption: "", categoryId: "", tags: [] },
  })

  if (!user) {
    return (
      <div className="flex items-center gap-3 rounded-card bg-card p-4 ring-1 ring-foreground/10">
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

  const onSubmit = (values: ComposerValues) => {
    createPost.mutate(
      { ...values, tags: values.tags.filter(Boolean) },
      {
        onSuccess: () => {
          toast.success("POST /posts — post created")
          form.reset({ caption: "", categoryId: "", tags: [] })
        },
        onError: () => toast.error("Failed to create post"),
      }
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-foreground/10"
      >
        <div className="flex items-center gap-3">
          <AvatarWithFallback name={user.name} src={user.avatar} />
          <FormField
            control={form.control}
            name="caption"
            render={({ field }) => (
              <FormItem className="grid flex-1">
                <FormControl>
                  <Input
                    {...field}
                    placeholder="What are you selling?"
                    aria-label="Post caption"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem className="grid">
                <FormControl>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
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
          <Button type="submit" size="sm" disabled={createPost.isPending}>
            Publish
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

  return (
    <div className="flex flex-col gap-3">
      <Composer />
      <div ref={parentRef} className="max-h-[calc(100svh-8rem)] overflow-y-auto pr-1">
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
                key={post.id}
                ref={virtualizer.measureElement}
                data-index={item.index}
              >
                <PostCard post={post} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MarketplaceColumn() {
  const category = useFilterStore((s) => s.category)
  const sort = useFilterStore((s) => s.sort)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    usePostsInfinite({ category, tag: null, author: null, sort })

  const parentRef = useRef<HTMLDivElement>(null)

  const posts = data?.pages.flatMap((p) => p.data) ?? []
  const COLUMNS = 2
  const rows = Math.ceil(posts.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rows + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 4,
  })

  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1)
    if (last && last.index >= rows - 1 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [virtualizer, rows, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex flex-col gap-3">
      <div ref={parentRef} className="max-h-[calc(100svh-8rem)] overflow-y-auto pr-1">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const rowStart = item.index * COLUMNS
            const rowPosts = posts.slice(rowStart, rowStart + COLUMNS)
            if (rowPosts.length === 0) {
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
                key={`row-${item.index}`}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className="grid grid-cols-2 gap-3"
              >
                {rowPosts.map((post) => (
                  <ProductCard key={post.id} post={post} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MobileSegmented() {
  const activeTab = useLayoutStore((s) => s.activeMobileTab)
  const setActiveMobileTab = useLayoutStore((s) => s.setActiveMobileTab)

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveMobileTab(v as "social" | "marketplace")}
    >
      <TabsList className="w-full">
        <TabsTrigger value="social" className="flex-1">
          Feed
        </TabsTrigger>
        <TabsTrigger value="marketplace" className="flex-1">
          Shop
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export default function HomePage() {
  const activeTab = useLayoutStore((s) => s.activeMobileTab)

  return (
    <div className="flex flex-col">
      <div className="hidden md:block">
        <CategoryPills />
      </div>
      <div className="md:hidden">
        <MobileSegmented />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={activeTab === "social" ? "" : "hidden md:block"}>
          <FeedColumn />
        </div>
        <div className={activeTab === "marketplace" ? "" : "hidden md:block"}>
          <MarketplaceColumn />
        </div>
      </div>
    </div>
  )
}
