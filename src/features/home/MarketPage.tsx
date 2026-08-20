import { useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowUp, ShoppingBag, Sparkles, Tag } from "lucide-react"
import { useFilterStore } from "@/stores/filterStore"
import { useCategories } from "@/features/categories/queries"
import { usePostsInfinite } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { cn } from "@/lib/utils"

function CategoryPills() {
  const { data: categories } = useCategories()
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-0.5 no-scrollbar">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer",
          category === null
            ? "bg-brand text-white shadow-sm ring-1 ring-brand"
            : "bg-card text-muted-foreground hover:bg-soft hover:text-foreground ring-1 ring-foreground/10"
        )}
      >
        <Sparkles className="size-3.5" />
        All Items
      </button>
      {(categories ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCategory(category === c.id ? null : c.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer",
            category === c.id
              ? "bg-brand text-white shadow-sm ring-1 ring-brand"
              : "bg-card text-muted-foreground hover:bg-soft hover:text-foreground ring-1 ring-foreground/10"
          )}
        >
          <Tag className="size-3" />
          {c.name}
          {c.postCount != null && c.postCount > 0 && (
            <span
              className={cn(
                "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px]",
                category === c.id ? "bg-white/20 text-white" : "bg-soft text-muted-foreground"
              )}
            >
              {c.postCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function MarketplaceColumn() {
  const category = useFilterStore((s) => s.category)
  const setCategory = useFilterStore((s) => s.setCategory)
  const sort = useFilterStore((s) => s.sort)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    usePostsInfinite({ category, tag: null, author: null, sort })

  const parentRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const posts = data?.pages.flatMap((p) => p.data) ?? []
  const COLUMNS = useResponsiveColumns()
  const rows = Math.ceil(posts.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rows + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 4,
  })

  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1)
    if (last && last.index >= rows - 1 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [virtualizer, rows, hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleScroll = () => {
    if (parentRef.current) {
      setShowScrollTop(parentRef.current.scrollTop > 300)
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
        <div className="flex flex-col gap-3 pb-8">
          <ErrorBoundary fallback={<SectionFallback />}>
            <CategoryPills />
          </ErrorBoundary>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-card bg-card p-3 ring-1 ring-foreground/10"
                >
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-card bg-card p-12 text-center ring-1 ring-foreground/10 my-4">
              <div className="grid size-12 place-items-center rounded-full bg-soft text-muted-foreground">
                <ShoppingBag className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">No listings found</p>
                <p className="text-xs text-muted-foreground">
                  {category
                    ? "There are no listings in this category yet."
                    : "No listings are currently available in the marketplace."}
                </p>
              </div>
              {category && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCategory(null)}
                  className="mt-1"
                >
                  View all categories
                </Button>
              )}
            </div>
          ) : (
            <ErrorBoundary fallback={<SectionFallback />}>
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
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      {rowPosts.map((post) => (
                        <ProductCard key={post.id} post={post} />
                      ))}
                    </div>
                  )
                })}
              </div>
            </ErrorBoundary>
          )}
        </div>
      </div>

      {showScrollTop && (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg ring-1 ring-foreground/15 hover:bg-brand hover:text-brand-foreground transition-all duration-200 animate-in fade-in"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  )
}

export default function MarketPage() {
  return (
    <div className="flex flex-col">
      <MarketplaceColumn />
    </div>
  )
}

