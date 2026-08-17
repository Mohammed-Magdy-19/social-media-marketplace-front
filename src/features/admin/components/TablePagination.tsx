import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Prev/Next pager for the offset-paginated admin tables. The backend signals
 * "has more" via `limit + 1` rows in the pagination meta — the Next button
 * is simply disabled when `hasMore` is false.
 */
export function TablePagination({
  page,
  hasMore,
  onPageChange,
}: {
  page: number
  hasMore: boolean
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-2">
      <span className="font-mono text-xs text-muted-foreground">
        Page {page}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
