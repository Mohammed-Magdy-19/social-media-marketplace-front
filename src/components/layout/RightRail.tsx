import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, TrendingUp } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { usePostsInfinite } from "@/features/posts/queries"
import { useAdminDashboard } from "@/features/admin/queries"
import { ReportDialog } from "@/features/reports/ReportDialog"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MediaPlaceholder } from "@/components/shared/MediaPlaceholder"
import { formatCurrency } from "@/lib/utils"

function TopDeals() {
  const { data } = usePostsInfinite({
    category: null,
    tag: null,
    author: null,
    sort: "newest",
  })

  const deals = useMemo(
    () => (data?.pages.flatMap((p) => p.data) ?? []).slice(0, 3),
    [data]
  )

  if (deals.length === 0) return null

  return (
    <Card className="rounded-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <TrendingUp className="size-4 text-brand" />
          Top Deals
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {deals.map((post) => (
          <Link
            key={post.id}
            to={`/posts/${post.id}`}
            className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted"
          >
            <MediaPlaceholder
              className="size-10 shrink-0 rounded-lg"
              ratio=""
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{post.caption}</p>
              {post.price != null && (
                <p className="text-sm font-semibold text-brand">
                  {formatCurrency(post.price, post.currency)}
                </p>
              )}
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function AdminDesk() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "admin"
  const { data } = useAdminDashboard(isAdmin)

  if (!isAdmin || !data) return null

  const series = data.revenueSeries ?? []
  const points = series.map((p, i) => {
    const x = (i / Math.max(1, series.length - 1)) * 100
    const max = Math.max(...series.map((s) => s.revenue), 1)
    const y = 100 - (p.revenue / max) * 100
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <Card className="rounded-card">
      <CardHeader>
        <CardTitle>Admin Desk</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="h-10 w-full"
          aria-hidden="true"
        >
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Revenue 30d ·{" "}
            {data.kpis?.revenueDeltaPct != null
              ? `${data.kpis.revenueDeltaPct > 0 ? "+" : ""}${data.kpis.revenueDeltaPct}%`
              : "—"}
          </span>
          <Button size="sm" variant="outline" render={<Link to="/admin" />}>
            Open console
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportItem() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="rounded-card bg-soft">
      <CardHeader>
        <CardTitle className="text-sm">Report an item</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          See something off? Flag a post, user, or message for review.
        </p>
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          File a report
        </Button>
      </CardContent>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        presetTargetType="post"
      />
    </Card>
  )
}

export function RightRail() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-3 xl:flex">
      <ErrorBoundary fallback={<SectionFallback />}>
        <TopDeals />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SectionFallback />}>
        <ReportItem />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SectionFallback />}>
        <AdminDesk />
      </ErrorBoundary>
      <Badge
        variant="outline"
        className="font-mono text-[10px] text-muted-foreground"
      >
        GET /posts · GET /admin/dashboard
      </Badge>
    </aside>
  )
}
