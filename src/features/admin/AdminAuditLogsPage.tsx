import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useAuditLogs } from "@/features/admin/queries"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import type { AuditLog } from "@/types"

function AuditRow({ entry }: { entry: AuditLog }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 px-3 py-2.5 last:border-0">
      <div className="relative mt-0.5">
        <AvatarWithFallback name={entry.actorName} src={null} size="sm" />
        <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-brand" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-ink">{entry.actorName}</p>
          <Badge variant="outline" className="border-transparent bg-violet-soft font-mono text-[10px] text-violet">
            {entry.action}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {entry.target && (
            <span className="font-mono text-[10px] text-mut">
              target: {entry.target}
            </span>
          )}
          {entry.ip && (
            <span className="font-mono text-[10px] text-mut">ip: {entry.ip}</span>
          )}
          {entry.meta &&
            Object.entries(entry.meta).map(([k, v]) => (
              <span key={k} className="font-mono text-[10px] text-mut">
                {k}: {v}
              </span>
            ))}
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-mut">
        {formatRelativeTime(entry.createdAt)}
      </span>
    </div>
  )
}

export default function AdminAuditLogsPage() {
  const { data, isLoading } = useAuditLogs()
  const parentRef = React.useRef<HTMLDivElement>(null)

  const logs = data ?? []

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Audit logs"
        subtitle="Every administrative action, in order"
      />

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-mut">No audit events.</p>
          ) : (
            <div ref={parentRef} className="max-h-[520px] overflow-y-auto">
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const entry = logs[item.index]
                  return (
                    <div
                      key={entry.id}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <AuditRow entry={entry} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
