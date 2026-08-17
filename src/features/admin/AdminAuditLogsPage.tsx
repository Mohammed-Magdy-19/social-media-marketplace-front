import * as React from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useAuditLogs } from "@/features/admin/queries"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { TablePagination } from "@/features/admin/components/TablePagination"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from "@/lib/audit-action-labels"
import type { AuditAction, AuditLog, AuditTargetType } from "@/types"

const ACTION_FILTER_OPTIONS: { value: "all" | AuditAction; label: string }[] = [
  { value: "all", label: "All actions" },
  ...AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: AUDIT_ACTION_LABELS[action],
  })),
]

const TARGET_ROUTES: Partial<Record<AuditTargetType, (id: string) => string>> = {
  post: (id) => `/posts/${id}`,
}

function actorName(entry: AuditLog): string {
  return typeof entry.actor === "string" ? entry.actor : entry.actor.name
}

function actorAvatar(entry: AuditLog): string | null {
  return typeof entry.actor === "string" ? null : (entry.actor.avatar ?? null)
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

/**
 * Render `details` (Schema.Types.Mixed) per spec §6.3: formatted sentences
 * only for the shapes confirmed from this doc set, raw JSON fallback for
 * anything else — never guess at unconfirmed action shapes.
 */
function AuditDetails({ entry }: { entry: AuditLog }) {
  const [open, setOpen] = React.useState(false)
  const details = entry.details
  if (!details || Object.keys(details).length === 0) return null

  let formatted: React.ReactNode = (
    <pre className="whitespace-pre-wrap break-all rounded-lg bg-soft p-2 font-mono text-[10px] text-muted-foreground">
      {JSON.stringify(details, null, 2)}
    </pre>
  )

  switch (entry.action) {
    case "ROLE_CHANGE":
      formatted = (
        <span className="text-xs text-muted-foreground">
          Changed role from{" "}
          <b className="text-foreground">{String(details.previousRole ?? "—")}</b>{" "}
          to <b className="text-foreground">{String(details.newRole ?? "—")}</b>
        </span>
      )
      break
    case "USER_BAN":
    case "USER_SUSPEND":
    case "USER_REACTIVATE":
      formatted = (
        <span className="text-xs text-muted-foreground">
          Status changed from{" "}
          <b className="text-foreground">{String(details.previousStatus ?? "—")}</b>{" "}
          to <b className="text-foreground">{String(details.newStatus ?? "—")}</b>
        </span>
      )
      break
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="xs"
        className="w-fit text-brand"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide details" : "View details"}
      </Button>
      {open && formatted}
    </div>
  )
}

function TargetCell({ entry }: { entry: AuditLog }) {
  if (!entry.targetId) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const route = TARGET_ROUTES[entry.targetType]
  const idEl = (
    <span className="font-mono text-xs">{shortId(entry.targetId)}</span>
  )
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="border-transparent bg-soft font-mono text-[10px]">
        {entry.targetType}
      </Badge>
      {route ? (
        <Link to={route(entry.targetId)} className="text-brand hover:underline">
          {idEl}
        </Link>
      ) : (
        <span className="text-muted-foreground">{idEl}</span>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLog }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 px-3 py-2.5 last:border-0">
      <div className="relative mt-0.5">
        <AvatarWithFallback name={actorName(entry)} src={actorAvatar(entry)} size="sm" />
        <span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-brand" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{actorName(entry)}</p>
          <Badge variant="outline" className="border-transparent bg-violet-soft text-[10px] text-violet">
            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <TargetCell entry={entry} />
          {entry.ipAddress && (
            <span className="font-mono text-[10px] text-muted-foreground">
              ip: {entry.ipAddress}
            </span>
          )}
          <AuditDetails entry={entry} />
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {formatRelativeTime(entry.createdAt)}
      </span>
    </div>
  )
}

export default function AdminAuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const parentRef = React.useRef<HTMLDivElement>(null)

  const rawPage = Number(searchParams.get("page"))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const activeAction = ACTION_FILTER_OPTIONS.some(
    (o) => o.value === searchParams.get("action")
  )
    ? (searchParams.get("action") as AuditAction)
    : "all"
  const actorFromUrl = searchParams.get("actor") ?? ""
  const [actor, setActor] = React.useState(actorFromUrl)

  React.useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (actor.trim()) next.set("actor", actor.trim())
      else next.delete("actor")
      next.delete("page")
      setSearchParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor])

  const setActionFilter = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === "all") next.delete("action")
    else next.set("action", value)
    next.delete("page")
    setSearchParams(next, { replace: true })
  }

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set("page", String(p))
    setSearchParams(next, { replace: true })
  }

  const { data, isLoading } = useAuditLogs(page, {
    actor: actorFromUrl || undefined,
    action: activeAction === "all" ? undefined : activeAction,
  })

  const logs = data?.data ?? []
  const hasMore = data?.pagination.hasMore ?? false

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

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Filter by actor…"
          className="h-8 w-48"
          aria-label="Filter by actor"
        />
        <Select
          value={activeAction}
          onValueChange={(value) => {
            if (value) setActionFilter(value)
          }}
        >
          <SelectTrigger size="sm" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-muted-foreground">
          {logs.length} event{logs.length === 1 ? "" : "s"}
          {activeAction !== "all" && ` · ${AUDIT_ACTION_LABELS[activeAction]}`}
          {actorFromUrl && ` · actor “${actorFromUrl}”`}
        </span>
      </div>

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No audit events.</p>
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

      <TablePagination page={page} hasMore={hasMore} onPageChange={goToPage} />
    </div>
  )
}
