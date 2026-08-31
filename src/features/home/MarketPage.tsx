import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowUp, Hash, Loader2, Search, ShoppingBag, Sparkles, Tag, X } from "lucide-react"
import { useFilterStore } from "@/stores/filterStore"
import { useCategories } from "@/features/categories/queries"
import { usePostsInfinite } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const [searchParams, setSearchParams] = useSearchParams()
  const storeCategory = useFilterStore((s) => s.category)
  const setStoreCategory = useFilterStore((s) => s.setCategory)
  const storeTag = useFilterStore((s) => s.tag)
  const setStoreTag = useFilterStore((s) => s.setTag)
  const sort = useFilterStore((s) => s.sort)

  const urlTag = searchParams.get("tag")?.trim() || null
  const urlSearch = (searchParams.get("q") || searchParams.get("search"))?.trim() || null
  const activeCategory = storeCategory
  const activeTag = urlTag || storeTag
  const activeSearch = urlSearch

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    usePostsInfinite({
      category: activeCategory,
      tag: activeTag,
      search: activeSearch,
      sort,
    })

  const parentRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const clearTagFilter = () => {
    setStoreTag(null)
    if (searchParams.has("tag")) {
      const next = new URLSearchParams(searchParams)
      next.delete("tag")
      setSearchParams(next, { replace: true })
    }
  }

  const clearSearchFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("q")
    next.delete("search")
    setSearchParams(next, { replace: true })
  }

  const clearAllFilters = () => {
    setStoreCategory(null)
    clearTagFilter()
    clearSearchFilter()
  }

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

          {/* Active Search / Tag Filters Bar */}
          {(activeTag || activeSearch) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2.5 ring-1 ring-border/50 text-xs">
              <span className="text-muted-foreground font-medium">Filtering by:</span>
              {activeTag && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 rounded-full bg-brand/10 text-brand border border-brand/20 py-0.5 px-2.5"
                >
                  <Hash className="size-3" />
                  <span>{activeTag}</span>
                  <button
                    type="button"
                    onClick={clearTagFilter}
                    className="ml-1 rounded-full p-0.5 hover:bg-brand/20"
                    aria-label="Remove tag filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              {activeSearch && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 rounded-full bg-soft text-foreground border border-border/80 py-0.5 px-2.5"
                >
                  <Search className="size-3" />
                  <span>&ldquo;{activeSearch}&rdquo;</span>
                  <button
                    type="button"
                    onClick={clearSearchFilter}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove search query"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={clearAllFilters}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          )}

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
                  {activeTag
                    ? `No listings matching tag #${activeTag}.`
                    : activeSearch
                    ? `No listings matching "${activeSearch}".`
                    : activeCategory
                    ? "There are no listings in this category yet."
                    : "No listings are currently available in the marketplace."}
                </p>
              </div>
              {(activeCategory || activeTag || activeSearch) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="mt-1 rounded-full"
                >
                  Clear filters & view all
                </Button>
              )}
            </div>
          ) : (
            <ErrorBoundary fallback={<SectionFallback />}>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const rowStart = item.index * COLUMNS
                  const rowPosts = posts.slice(rowStart, rowStart + COLUMNS)
                  if (rowPosts.length === 0) {
                    return (
                      <div
                        key={`load-${item.index}`}
                        ref={virtualizer.measureElement}
                        data-index={item.index}
                        className="absolute top-0 left-0 w-full flex justify-center py-4"
                        style={{ transform: `translateY(${item.start}px)` }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchNextPage()}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? (
                            <>
                              <Loader2 className="mr-2 size-3.5 animate-spin" />
                              Loading more…
                            </>
                          ) : (
                            "Load more"
                          )}
                        </Button>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={`row-${item.index}`}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute top-0 left-0 grid w-full grid-cols-1 gap-3 pb-3 sm:grid-cols-2 lg:grid-cols-3"
                      style={{ transform: `translateY(${item.start}px)` }}
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

