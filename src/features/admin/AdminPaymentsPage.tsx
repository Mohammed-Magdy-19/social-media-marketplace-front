import * as React from "react"
import { Trash2 } from "lucide-react"
import { useAdminPayments } from "@/features/admin/queries"
import { useDelRow } from "@/features/admin/mutations"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import type { Payment } from "@/types"

const PAYMENT_PILLS = ["All", "succeeded", "pending", "failed", "refunded"] as const

export default function AdminPaymentsPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [deleteTarget, setDeleteTarget] = React.useState<Payment | null>(null)

  const activePill = useAdminUiStore((s) => s.activeFilterPill.payments) ?? "All"
  const setFilterPill = useAdminUiStore((s) => s.setFilterPill)
  const delRow = useDelRow()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useAdminPayments({
    status: activePill === "All" ? undefined : activePill,
    search: debounced || undefined,
  })

  const rows = data?.data ?? []

  const columns = React.useMemo(
    () => [
      {
        key: "id",
        header: "Transaction",
        className: "min-w-40",
        cell: (p: Payment) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-foreground">{p.id}</span>
            <span className="text-[10px] text-muted-foreground">{p.method}</span>
          </div>
        ),
      },
      {
        key: "user",
        header: "User",
        className: "min-w-32",
        cell: (p: Payment) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback name={`User ${p.userId}`} src={null} size="sm" />
            <span className="font-mono text-[10px] text-muted-foreground">{p.userId}</span>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        cell: (p: Payment) => (
          <span className="font-mono text-sm font-semibold text-foreground">
            {formatCurrency(p.amount, p.currency)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (p: Payment) => <StatusPill status={p.status} />,
      },
      {
        key: "created",
        header: "Created",
        className: "min-w-24",
        cell: (p: Payment) => (
          <span className="text-xs text-muted-foreground">{formatRelativeTime(p.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-16 text-right",
        cell: (p: Payment) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete payment"
              className="text-err hover:bg-err-soft"
              onClick={() => setDeleteTarget(p)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Payments"
        subtitle="Ledger of all marketplace transactions"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments…"
          className="h-8 w-48"
          aria-label="Search payments"
        />
      </AdminPageHeader>

      <FilterPills
        pills={[...PAYMENT_PILLS]}
        value={activePill}
        onChange={(pill) => setFilterPill("payments", pill)}
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
              rowKey={(p) => p.id}
              emptyState="No payments match the current filter."
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
            <AlertDialogTitle>Delete payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the transaction record{" "}
              <span className="font-mono text-foreground">{deleteTarget?.id}</span> from
              the ledger. Refunds are not issued by this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={delRow.isPending}
              onClick={() => {
                if (!deleteTarget) return
                delRow.mutate({ table: "payments", id: deleteTarget.id })
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
