import * as React from "react"
import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { cn } from "@/lib/utils"

export interface VirtualColumn<T> {
  key: string
  header: React.ReactNode
  /** Tailwind width class (e.g. `min-w-56`, `w-24`). Optional; defaults to grow. */
  className?: string
  /** Horizontal alignment of header + cells. Defaults to `left`. */
  align?: "left" | "center" | "right"
  cell: (row: T) => React.ReactNode
}

const ROW_HEIGHT = 52

const ALIGN_CLASSES: Record<NonNullable<VirtualColumn<never>["align"]>, string> = {
  left: "justify-start text-left",
  center: "justify-center text-center",
  right: "justify-end text-right",
}

const WIDTH_CLASSES: { regex: RegExp; track: (n: number) => string }[] = [
  { regex: /min-w-(\d+)/, track: (n) => `minmax(${n / 4}rem, 1fr)` },
  { regex: /w-(\d+)/, track: (n) => `${n / 4}rem` },
]

function columnTrack(className: string | undefined): string {
  for (const { regex, track } of WIDTH_CLASSES) {
    const m = className?.match(regex)
    if (m) return track(Number(m[1]))
  }
  return "minmax(0, 1fr)"
}

/**
 * Windowed admin table. Header and body share one `gridTemplateColumns`
 * built from the column width classes, so cells align perfectly while only
 * the visible rows are painted (§10.2 virtualization matrix).
 *
 * Virtualization uses the "padding rows" pattern: only the visible `<tr>`
 * rows render as direct children of `<tbody>` (valid HTML), and two spacer
 * `<tr>` elements fill the space of the scrolled-out rows. No absolute-
 * positioned `<div>`s inside `<tbody>`, which the browser would reparent and
 * which cause hydration mismatches.
 */
export function VirtualTable<T>({
  rows,
  columns,
  rowKey,
  maxHeight = "520px",
  emptyState,
}: {
  rows: T[]
  columns: VirtualColumn<T>[]
  rowKey: (row: T) => string
  maxHeight?: string
  emptyState?: React.ReactNode
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const gridTemplateColumns = React.useMemo(
    () => columns.map((col) => columnTrack(col.className)).join(" "),
    [columns]
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: rows.length > 0,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? Math.max(0, totalSize - virtualRows[virtualRows.length - 1].end)
      : 0

  if (import.meta.env.DEV && Number.isNaN(totalSize)) {
    console.warn(
      "[VirtualTable] totalSize resolved to NaN — check rows.length and estimateSize()"
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        {emptyState ?? "No rows."}
      </div>
    )
  }

  return (
    <ErrorBoundary fallback={<SectionFallback />}>
      <div
        ref={parentRef}
        className="relative overflow-auto no-scrollbar rounded-card"
        style={{ maxHeight }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--line-2)]">
            <TableRow
              className="grid items-center hover:bg-transparent"
              style={{ gridTemplateColumns }}
            >
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "min-w-0 max-w-full truncate overflow-hidden text-ellipsis whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    ALIGN_CLASSES[col.align ?? "left"]
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr aria-hidden style={{ height: paddingTop }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <TableRow
                  key={rowKey(row) ?? `pending-${virtualRow.index}`}
                  data-index={virtualRow.index}
                  className="grid w-full items-center border-b border-line-2 hover:bg-soft"
                  style={{ gridTemplateColumns, height: virtualRow.size }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "flex min-w-0 max-w-full items-center overflow-hidden truncate px-3",
                        ALIGN_CLASSES[col.align ?? "left"]
                      )}
                    >
                      <div className="min-w-0 max-w-full w-full overflow-hidden truncate">
                        {col.cell(row)}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden style={{ height: paddingBottom }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>
    </ErrorBoundary>
  )
}
