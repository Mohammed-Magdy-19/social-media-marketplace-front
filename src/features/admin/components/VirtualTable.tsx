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
  { regex: /min-w-(\d+)/, track: (n) => `minmax(${n / 4}rem, auto)` },
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
 * the visible rows are painted (§10.2 virtualization matrix). The spacer div
 * inside the tbody gives the scroll container its full height, keeping the
 * header sticky and the virtual rows in their own slots.
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
  })

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
        className="relative overflow-auto rounded-card"
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
                    "truncate px-3 text-[11px] font-semibold uppercase tracking-wider text-mut",
                    ALIGN_CLASSES[col.align ?? "left"]
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="relative">
            <div style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index]
                return (
                  <TableRow
                    key={rowKey(row)}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    className="absolute top-0 left-0 grid w-full items-center border-b border-line-2 hover:bg-soft"
                    style={{
                      gridTemplateColumns,
                      height: item.size,
                      transform: `translateY(${item.start}px)`,
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "flex min-w-0 items-center overflow-hidden px-3",
                          ALIGN_CLASSES[col.align ?? "left"]
                        )}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </div>
          </TableBody>
        </Table>
      </div>
    </ErrorBoundary>
  )
}
