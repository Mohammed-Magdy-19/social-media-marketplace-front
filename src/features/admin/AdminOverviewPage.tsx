import {
  Banknote,
  Package,
  Users,
  CreditCard,
} from "lucide-react"
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
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  mono = true,
}: {
  label: string
  value: string
  icon: React.ReactNode
  mono?: boolean
}) {
  return (
    <Card className="rounded-card border-border">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-mut">
          {icon}
          {label}
        </div>
        <span className={cn("text-2xl font-semibold text-ink", mono && "font-mono")}>
          {value}
        </span>
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

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Overview"
        subtitle="Marketplace health at a glance"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Total volume"
          value={formatCurrency(data.totalVolumeCents / 100)}
          icon={<Banknote className="size-4" />}
        />
        <KpiCard
          label="Total users"
          value={data.totalUsers.toLocaleString()}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Total posts"
          value={data.totalPosts.toLocaleString()}
          icon={<Package className="size-4" />}
        />
        <KpiCard
          label="Total payments"
          value={data.totalPayments.toLocaleString()}
          icon={<CreditCard className="size-4" />}
        />
      </div>
    </div>
  )
}
