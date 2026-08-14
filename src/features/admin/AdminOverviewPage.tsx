import { Link } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from "recharts"
import { ArrowDownRight, ArrowUpRight, Database, ShieldCheck } from "lucide-react"
import { useAdminDashboard } from "@/features/admin/queries"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatBytes, formatCurrency, formatRelativeTime } from "@/lib/utils"

const revenueConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--color-brand)",
  },
} satisfies ChartConfig

const categoryConfig = {
  posts: {
    label: "Posts",
    color: "var(--color-brand)",
  },
} satisfies ChartConfig

function TrendChip({ deltaPct, invert = false }: { deltaPct: number; invert?: boolean }) {
  const up = invert ? deltaPct < 0 : deltaPct >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-mono text-[10px]",
        up ? "bg-ok-soft text-ok" : "bg-err-soft text-err"
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  label,
  value,
  deltaPct,
  invert,
  mono = true,
}: {
  label: string
  value: string
  deltaPct?: number
  invert?: boolean
  mono?: boolean
}) {
  return (
    <Card className="rounded-card border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-mut">{label}</span>
        <span className={cn("text-2xl font-semibold text-ink", mono && "font-mono")}>
          {value}
        </span>
        {deltaPct !== undefined && (
          <div className="flex items-center gap-1.5">
            <TrendChip deltaPct={deltaPct} invert={invert} />
            <span className="text-[10px] text-mut">vs last 30d</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-card lg:col-span-2" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    </div>
  )
}

function ModerationQueue({ items }: { items: ReturnType<typeof useAdminDashboard>["data"] }) {
  if (!items) return null
  const pending = items.moderationQueue
  return (
    <Card className="rounded-card border-border">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="font-display text-sm font-bold">
          Moderation queue
        </CardTitle>
        <Badge variant="outline" className="gap-1 border-transparent bg-warn-soft font-mono text-[10px] text-warn">
          <ShieldCheck className="size-3" />
          {pending.length} pending
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-mut">Queue is clear.</p>
        ) : (
          pending.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-soft px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {report.reason}
                </p>
                <p className="truncate font-mono text-[10px] text-mut">
                  {report.targetSummary ?? report.targetId}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] text-mut">
                  {formatRelativeTime(report.createdAt)}
                </span>
                <StatusPill status={report.status} />
              </div>
            </div>
          ))
        )}
        <Button variant="ghost" size="sm" render={<Link to="/admin/reports" />}>
          View all reports
        </Button>
      </CardContent>
    </Card>
  )
}

function CategoryActivityChart({
  data,
}: {
  data: NonNullable<ReturnType<typeof useAdminDashboard>["data"]>["categoryActivity"]
}) {
  return (
    <ChartContainer config={categoryConfig} className="h-56" initialDimension={{ width: 480, height: 224 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--line-2)" />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "var(--mut)" }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--soft)" }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="posts" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminDashboard()

  if (isLoading || !data) {
    return (
      <div>
        <AdminPageHeader title="Overview" subtitle="Marketplace health at a glance" endpoint="GET /admin/dashboard" />
        <OverviewSkeleton />
      </div>
    )
  }

  const { kpis, revenueSeries, categoryActivity, recentReports, recentAudit, storageUsedBytes } = data

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Overview"
        subtitle="Marketplace health at a glance"
        endpoint="GET /admin/dashboard"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Revenue (30d)"
          value={formatCurrency(kpis.revenue30d)}
          deltaPct={kpis.revenueDeltaPct}
        />
        <KpiCard
          label="Active users"
          value={kpis.activeUsers.toLocaleString()}
          deltaPct={kpis.activeUsersDeltaPct}
        />
        <KpiCard
          label="Posts today"
          value={kpis.postsToday.toLocaleString()}
          deltaPct={kpis.postsTodayDeltaPct}
        />
        <KpiCard
          label="Pending reports"
          value={kpis.pendingReports.toLocaleString()}
          invert
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-card border-border lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="font-display text-sm font-bold">
              Revenue (7d)
            </CardTitle>
            <span className="font-mono text-[10px] text-mut">
              Δ {kpis.revenueDeltaPct >= 0 ? "+" : ""}
              {kpis.revenueDeltaPct.toFixed(1)}%
            </span>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={revenueConfig}
              className="h-56"
              initialDimension={{ width: 640, height: 224 }}
            >
              <AreaChart
                data={revenueSeries}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line-2)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--mut)" }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-sm font-bold">
              Category activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryActivityChart data={categoryActivity} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ModerationQueue items={data} />

        <Card className="rounded-card border-border">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="font-display text-sm font-bold">
              Recent reports
            </CardTitle>
            <Button variant="ghost" size="xs" render={<Link to="/admin/reports" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentReports.slice(0, 4).map((report) => (
              <div key={report.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {report.reason}
                  </p>
                  <p className="font-mono text-[10px] text-mut">{report.targetId}</p>
                </div>
                <StatusPill status={report.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-card border-border lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="font-display text-sm font-bold">
              Audit trail
            </CardTitle>
            <Button variant="ghost" size="xs" render={<Link to="/admin/audit-logs" />}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentAudit.slice(0, 4).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarWithFallback name={entry.actorName} src={null} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {entry.actorName}
                    </p>
                    <p className="truncate font-mono text-[10px] text-mut">
                      {entry.action}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-mut">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-card border-border">
        <CardContent className="flex items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-2 text-sm text-mut">
            <Database className="size-4" />
            <span>Storage used</span>
          </div>
          <span className="font-mono text-sm font-semibold text-ink">
            {formatBytes(storageUsedBytes)}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
