import * as React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Check, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useReports } from "@/features/admin/queries"
import { useDeleteReport } from "@/features/admin/mutations"
import { ReportModerateDialog } from "@/features/admin/components/ReportModerateDialog"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { FilterPills } from "@/features/admin/components/FilterPills"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { VirtualTable } from "@/features/admin/components/VirtualTable"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import type { UpdateReportFormValues } from "@/features/reports/schemas"
import { ApiError, type Report, type ReportTargetType } from "@/types"

const STATUS_OPTIONS: { value: UpdateReportFormValues["status"]; label: string }[] = [
  { value: "reviewed", label: "Reviewed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "resolved", label: "Resolved" },
]

const STATUS_PILLS = ["All", "pending", "reviewed", "dismissed", "resolved"]

const TARGET_ROUTES: Partial<Record<ReportTargetType, (id: string) => string>> = {
  post: (id) => `/posts/${id}`,
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

function reporterLabel(report: Report): string {
  if (typeof report.reporter === "string") return report.reporter
  return report.reporter?.name || report.reporter?.username || "Unknown"
}

function resolvedByLabel(report: Report): string | null {
  if (!report.resolvedBy) return null
  if (typeof report.resolvedBy === "string") return report.resolvedBy
  return report.resolvedBy?.name || report.resolvedBy?.username || "Unknown"
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function copyTargetId(report: Report) {
  void navigator.clipboard?.writeText(report.targetId)
  toast.success("Target ID copied")
}

function TargetCell({ report }: { report: Report }) {
  const route = TARGET_ROUTES[report.targetType]
  if (route) {
    return (
      <Link
        to={route(report.targetId)}
        className="flex items-center gap-2 text-sm text-brand hover:underline"
      >
        <Badge variant="outline" className="border-transparent bg-soft font-mono text-[10px]">
          {report.targetType}
        </Badge>
        <span className="font-mono text-xs">{shortId(report.targetId)}</span>
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="border-transparent bg-soft font-mono text-[10px]">
        {report.targetType}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{shortId(report.targetId)}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Copy target ID"
        onClick={() => copyTargetId(report)}
      >
        <Copy />
      </Button>
    </div>
  )
}

function ReasonCell({ report }: { report: Report }) {
  const [expanded, setExpanded] = React.useState(false)
  const needsExpand = report.reason.length > 120
  const shown = expanded || !needsExpand ? report.reason : `${report.reason.slice(0, 120)}…`
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-foreground">{shown}</span>
      {needsExpand && (
        <Button
          variant="ghost"
          size="xs"
          className="w-fit text-brand"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Collapse" : "View full"}
        </Button>
      )}
    </div>
  )
}

function ResolvedCell({ report }: { report: Report }) {
  const by = resolvedByLabel(report)
  if (!by) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-col">
      <span className="text-xs text-foreground">{by}</span>
      {report.resolvedAt && (
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(report.resolvedAt)}
        </span>
      )}
    </div>
  )
}

export default function AdminReportsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [moderateTarget, setModerateTarget] = React.useState<{
    report: Report
    status: UpdateReportFormValues["status"]
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Report | null>(null)

  const rawStatus = searchParams.get("status")
  const activeStatus = STATUS_PILLS.includes(rawStatus ?? "")
    ? (rawStatus as string)
    : "All"

  React.useEffect(() => {
    if (!searchParams.has("status")) {
      setSearchParams({ status: "pending" }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStatusFilter = (pill: string) => {
    const next = new URLSearchParams(searchParams)
    if (pill === "All") next.delete("status")
    else next.set("status", pill)
    setSearchParams(next, { replace: true })
  }

  const deleteReport = useDeleteReport()

  const { data, isLoading, error } = useReports({
    status: activeStatus === "All" ? undefined : activeStatus,
  })

  React.useEffect(() => {
    if (isForbidden(error)) navigate("/", { replace: true })
  }, [error, navigate])

  const rows = data?.data ?? []

  const columns = React.useMemo(
    () => [
      {
        key: "target",
        header: "Target",
        className: "min-w-40",
        cell: (r: Report) => <TargetCell report={r} />,
      },
      {
        key: "reason",
        header: "Reason",
        className: "min-w-56",
        cell: (r: Report) => <ReasonCell report={r} />,
      },
      {
        key: "reporter",
        header: "Reporter",
        className: "min-w-28",
        cell: (r: Report) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback
              name={reporterLabel(r)}
              src={typeof r.reporter === "object" ? (r.reporter.avatar ?? null) : null}
              size="sm"
            />
            <span className="truncate text-sm text-foreground">{reporterLabel(r)}</span>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        className: "w-24",
        cell: (r: Report) => <StatusPill status={r.status} />,
      },
      {
        key: "filed",
        header: "Filed",
        className: "min-w-24",
        cell: (r: Report) => (
          <span className="text-xs text-muted-foreground">{formatRelativeTime(r.createdAt)}</span>
        ),
      },
      {
        key: "resolved",
        header: "Resolved by",
        className: "min-w-24",
        cell: (r: Report) => <ResolvedCell report={r} />,
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-36 text-right",
        cell: (r: Report) => (
          <div className="flex items-center justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="xs" aria-label="Moderate report">
                    <span className="text-[11px]">Moderate</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Set report status
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={r.status === option.value}
                    onClick={() =>
                      setModerateTarget({ report: r, status: option.value })
                    }
                  >
                    <span className="flex-1">{option.label}</span>
                    {r.status === option.value && <Check className="size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
    []
  )

  const onForbidden = () => navigate("/", { replace: true })

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Reports"
        subtitle="Triage community reports on posts, comments, and users"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          pills={STATUS_PILLS}
          value={activeStatus}
          onChange={setStatusFilter}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {rows.length} report{rows.length === 1 ? "" : "s"}
          {activeStatus !== "All" && ` · ${activeStatus}`}
        </span>
      </div>

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

      {moderateTarget && (
        <ReportModerateDialog
          key={moderateTarget.report.id}
          report={moderateTarget.report}
          initialStatus={moderateTarget.status}
          onOpenChange={(open) => !open && setModerateTarget(null)}
          onForbidden={onForbidden}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the report on{" "}
              <Badge
                variant="outline"
                className="mx-1 border-transparent bg-soft font-mono text-[10px]"
              >
                {deleteTarget?.targetId}
              </Badge>
              . The reported content is not affected, and this can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteReport.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteReport.mutate(deleteTarget.id, {
                  onError: (error) => {
                    if (isForbidden(error)) onForbidden()
                  },
                })
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
