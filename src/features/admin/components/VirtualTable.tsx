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
  /** Optional fixed width class; without it the cell flexes naturally. */
  className?: string
  cell: (row: T) => React.ReactNode
}

const ROW_HEIGHT = 48

/**
 * Windowed admin table. Even though admin lists are not cursor-infinite yet
 * (spec §2.1), rows are virtualized now so production-scale tables don't
 * paint thousands of DOM rows (§10.2 virtualization matrix).
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
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={cn("text-[11px] font-semibold uppercase tracking-wider", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="relative">
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]
              return (
                <TableRow
                  key={rowKey(row)}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute top-0 left-0 w-full border-line-2 hover:bg-soft"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </ErrorBoundary>
  )
}
