import { useEffect, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useFilterStore } from "@/stores/filterStore"
import { useCategories } from "@/features/categories/queries"
import { usePostsInfinite } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { Button } from "@/components/ui/button"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { cn } from "@/lib/utils"

function CategoryPills() {
  const { data: categories } = useCategories()
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)

  return (
    <div className="mt-4 no-scrollbar flex items-center gap-1.5 overflow-x-auto py-2">
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

export default function MarketPage() {
  return (
    <div className="flex flex-col">
      <ErrorBoundary fallback={<SectionFallback />}>
        <CategoryPills />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SectionFallback />}>
        <MarketplaceColumn />
      </ErrorBoundary>
    </div>
  )
}
