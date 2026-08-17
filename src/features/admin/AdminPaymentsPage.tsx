import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { RotateCcw } from "lucide-react"
import { useAdminPayments } from "@/features/admin/queries"
import { useRefundPayment } from "@/features/payments/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { FilterPills } from "@/features/admin/components/FilterPills"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { TablePagination } from "@/features/admin/components/TablePagination"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import type { Payment } from "@/types"

const PAYMENT_PILLS = ["All", "completed", "pending", "failed", "refunded"] as const

function buyerLabel(buyer: Payment["buyer"]): string {
  return typeof buyer === "string" ? buyer : buyer.name
}

export default function AdminPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [refundTarget, setRefundTarget] = React.useState<Payment | null>(null)

  const rawPage = Number(searchParams.get("page"))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const rawStatus = searchParams.get("status")
  const activeStatus = PAYMENT_PILLS.some((p) => p === rawStatus)
    ? (rawStatus as string)
    : "All"

  const refundPayment = useRefundPayment()

  const setStatusFilter = (pill: string) => {
    const next = new URLSearchParams(searchParams)
    if (pill === "All") next.delete("status")
    else next.set("status", pill)
    next.delete("page")
    setSearchParams(next, { replace: true })
  }

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set("page", String(p))
    setSearchParams(next, { replace: true })
  }

  const { data, isLoading } = useAdminPayments(page, {
    status: activeStatus === "All" ? undefined : (activeStatus as Payment["status"]),
  })

  const rows = data?.data ?? []
  const hasMore = data?.pagination.hasMore ?? false

  const columns = React.useMemo(
    () => [
      {
        key: "id",
        header: "Transaction",
        className: "min-w-40",
        cell: (p: Payment) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-foreground">{p.id}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {p.transactionId}
            </span>
          </div>
        ),
      },
      {
        key: "buyer",
        header: "Buyer",
        className: "min-w-32",
        cell: (p: Payment) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback name={buyerLabel(p.buyer)} src={null} size="sm" />
            <span className="text-xs text-foreground">{buyerLabel(p.buyer)}</span>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        cell: (p: Payment) => (
          <span className="font-mono text-sm font-semibold text-foreground">
            {formatCurrency(p.amount / 100, p.currency)}
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
        cell: (p: Payment) =>
          p.status === "completed" ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Refund payment"
                className="text-info hover:bg-info-soft"
                disabled={refundPayment.isPending}
                onClick={() => setRefundTarget(p)}
              >
                <RotateCcw />
              </Button>
            </div>
          ) : null,
      },
    ],
    [refundPayment.isPending]
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Payments"
        subtitle="Ledger of all marketplace transactions"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterPills
          pills={[...PAYMENT_PILLS]}
          value={activeStatus}
          onChange={setStatusFilter}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {rows.length} payment{rows.length === 1 ? "" : "s"}
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
              rowKey={(p) => p.id}
              emptyState="No payments match the current filter."
            />
          )}
        </CardContent>
      </Card>

      <TablePagination page={page} hasMore={hasMore} onPageChange={goToPage} />

      <AlertDialog
        open={refundTarget !== null}
        onOpenChange={(open) => !open && setRefundTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Refund{" "}
              <span className="font-mono text-foreground">
                {formatCurrency((refundTarget?.amount ?? 0) / 100, refundTarget?.currency)}
              </span>{" "}
              to {refundTarget ? buyerLabel(refundTarget.buyer) : "the buyer"}? The
              money is returned via Stripe and the ledger is updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={refundPayment.isPending}
              onClick={() => {
                if (!refundTarget) return
                refundPayment.mutate(refundTarget.id)
                setRefundTarget(null)
              }}
            >
              Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
