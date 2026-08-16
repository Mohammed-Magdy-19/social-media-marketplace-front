import { Banknote, Package, Users, ShieldAlert } from "lucide-react"
import { useAdminDashboard } from "@/features/admin/queries"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatCurrency } from "@/lib/utils"

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  mono = true,
  hint,
}: {
  label: string
  value: string
  icon: React.ReactNode
  mono?: boolean
  hint?: string
}) {
  return (
    <Card className="rounded-card border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className={cn("text-2xl font-semibold text-foreground", mono && "font-mono")}>
          {value}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminDashboard()

  if (isLoading || !data) {
    return (
      <div>
        <AdminPageHeader title="Overview" subtitle="Marketplace health at a glance" />
        <OverviewSkeleton />
      </div>
    )
  }

  const totalSales = data.sales.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Overview"
        subtitle="Marketplace health at a glance"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Total users"
          value={data.users.total.toLocaleString()}
          icon={<Users className="size-4" />}
          hint={`${data.users.active.toLocaleString()} active · ${data.users.suspended.toLocaleString()} suspended · ${data.users.banned.toLocaleString()} banned`}
        />
        <KpiCard
          label="Total posts"
          value={data.posts.total.toLocaleString()}
          icon={<Package className="size-4" />}
        />
        <KpiCard
          label="Pending reports"
          value={data.reports.pending.toLocaleString()}
          icon={<ShieldAlert className="size-4" />}
        />
        <KpiCard
          label="Completed sales"
          value={totalSales.toLocaleString()}
          icon={<Banknote className="size-4" />}
        />
      </div>

      <Card className="rounded-card border-border">
        <CardContent className="p-4">
          <div className="mb-3 text-xs font-medium text-muted-foreground">
            Sales volume by currency
          </div>
          {data.sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No completed sales yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.sales.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-soft px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {formatCurrency(s.totalAmount, s._id)}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {s.count.toLocaleString()} payments · {s._id}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {s._id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
