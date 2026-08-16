import { useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Bookmark } from "lucide-react"
import { useSavedPosts } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { Badge } from "@/components/ui/badge"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { Skeleton } from "@/components/ui/skeleton"

function SavedGrid() {
  const { data, isLoading } = useSavedPosts()
  const parentRef = useRef<HTMLDivElement>(null)

  const posts = useMemo(() => data?.data ?? [], [data])
  const COLUMNS = 3
  const rows = Math.ceil(posts.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 4,
  })

  if (isLoading) {
    return (
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-card" />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-card bg-card p-10 text-center ring-1 ring-foreground/10">
        <Bookmark className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No saved posts yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tap the bookmark on any listing to keep it here for later.
        </p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="mt-4 max-h-[calc(100svh-10rem)] overflow-y-auto pr-1">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const rowStart = item.index * COLUMNS
          const rowPosts = posts.slice(rowStart, rowStart + COLUMNS)
          return (
            <div
              key={`row-${item.index}`}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {rowPosts.map((post) => (
                <ProductCard key={post.id} post={post} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SavedPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className=" mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
          Saved posts
        </h1>
        <p className="text-sm text-muted-foreground">
          Listings you&apos;ve bookmarked for later.
        </p>
      </div>
      <ErrorBoundary fallback={<SectionFallback />}>
        <SavedGrid />
      </ErrorBoundary>
    </div>
  )
}
