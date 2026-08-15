import * as React from "react"
import { toast } from "sonner"
import { Check, Trash2, X } from "lucide-react"
import { useReports } from "@/features/admin/queries"
import {
  useDismissReport,
  useResolveReport,
  useDelRow,
} from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { FilterPills } from "@/features/admin/components/FilterPills"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { VirtualTable } from "@/features/admin/components/VirtualTable"
import { useAdminUiStore } from "@/stores/adminUiStore"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import type { Report } from "@/types"

const REPORT_PILLS = ["All", "pending", "resolved", "dismissed"] as const

export default function AdminReportsPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [deleteTarget, setDeleteTarget] = React.useState<Report | null>(null)

  const activePill = useAdminUiStore((s) => s.activeFilterPill.reports) ?? "All"
  const setFilterPill = useAdminUiStore((s) => s.setFilterPill)
  const resolveReport = useResolveReport()
  const dismissReport = useDismissReport()
  const delRow = useDelRow()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useReports({
    status: activePill === "All" ? undefined : activePill,
    search: debounced || undefined,
  })

  const rows = data?.data ?? []

  const columns = React.useMemo(
    () => [
      {
        key: "target",
        header: "Target",
        className: "min-w-56",
        cell: (r: Report) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback name={r.targetSummary ?? r.targetId} src={null} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {r.targetSummary ?? r.targetId}
              </p>
              <p className="font-mono text-[10px] text-mut">
                {r.targetType} · {r.targetId}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        className: "min-w-32",
        cell: (r: Report) => <span className="text-sm text-ink">{r.reason}</span>,
      },
      {
        key: "reporter",
        header: "Reporter",
        className: "min-w-32",
        cell: (r: Report) => (
          <span className="text-sm text-mut">{r.reporter.name}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (r: Report) => <StatusPill status={r.status} />,
      },
      {
        key: "created",
        header: "Reported",
        className: "min-w-24",
        cell: (r: Report) => (
          <span className="text-xs text-mut">{formatRelativeTime(r.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-28 text-right",
        cell: (r: Report) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Resolve report"
              className="text-ok hover:bg-ok-soft"
              disabled={r.status === "resolved"}
              onClick={() =>
                resolveReport.mutate(r.id, {
                  onError: () => toast.error("Failed to resolve report"),
                })
              }
            >
              <Check />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss report"
              className="text-mut hover:bg-soft"
              disabled={r.status === "dismissed"}
              onClick={() =>
                dismissReport.mutate(r.id, {
                  onError: () => toast.error("Failed to dismiss report"),
                })
              }
            >
              <X />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete report"
              className="text-err hover:bg-err-soft"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [resolveReport, dismissReport]
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Reports"
        subtitle="Triage community reports on posts, users, and messages"
        endpoint="GET /reports"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports…"
          className="h-8 w-48"
          aria-label="Search reports"
        />
      </AdminPageHeader>

      <FilterPills
        pills={[...REPORT_PILLS]}
        value={activePill}
        onChange={(pill) => setFilterPill("reports", pill)}
      />

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <VirtualTable
              rows={rows}
              columns={columns}
              rowKey={(r) => r.id}
              emptyState="No reports match the current filter."
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the report on{" "}
              <Badge variant="outline" className="mx-1 border-transparent bg-soft font-mono text-[10px]">
                {deleteTarget?.targetId}
              </Badge>
              . The reported content is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={delRow.isPending}
              onClick={() => {
                if (!deleteTarget) return
                delRow.mutate({ table: "reports", id: deleteTarget.id })
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
