import * as React from "react"
import { Check, Tag, X } from "lucide-react"
import { cva } from "class-variance-authority"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CounterOfferForm } from "@/features/conversations/components/CounterOfferForm"
import { useCreatePaymentIntent } from "@/features/payments/mutations"
import {
  offerBuyerId,
  offerPostId,
  offerProposerId,
} from "@/features/conversations/queries"
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils"
import type { Offer, OfferAction, OfferStatus } from "@/types"

const offerCardVariants = cva("flex flex-col gap-2 rounded-xl border p-3 shadow-xs transition-all", {
  variants: {
    isAccepted: {
      true: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20",
      false: "border-border/60 bg-card/90 backdrop-blur-xs hover:border-border",
    },
  },
  defaultVariants: {
    isAccepted: false,
  },
})

const OFFER_STATUS_TONE: Record<OfferStatus, string> = {
  pending: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
  accepted: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
  rejected: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
  countered: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
}

const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  countered: "Countered",
}

export interface OfferCardProps {
  offer: Offer
  meId: string
  onAction: (offerId: string, action: OfferAction, amountCents?: number) => void
}

export function OfferCard({ offer, meId, onAction }: OfferCardProps) {
  const [counterOpen, setCounterOpen] = React.useState(false)
  const createIntent = useCreatePaymentIntent()

  const isMine = offerProposerId(offer) === meId
  const proposerName =
    typeof offer.proposedBy === "object" && offer.proposedBy
      ? offer.proposedBy.name || offer.proposedBy.username
      : "They"
  const actionable = offer.status === "pending" && !isMine

  const buyerId = offerBuyerId(offer)
  const isBuyer = buyerId === meId
  const currentOfferPostId = offerPostId(offer)
  const isAccepted = offer.status === "accepted"

  return (
    <div className={cn(offerCardVariants({ isAccepted }))}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 font-mono text-xs font-bold">
            <Tag className="size-4 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-tight text-foreground">
                {formatCurrency(offer.amount)}
              </span>
              <Badge
                variant="outline"
                className={cn("border-transparent px-2 py-0.5 text-[11px] font-medium", OFFER_STATUS_TONE[offer.status])}
              >
                <span
                  className={cn(
                    "mr-1.5 inline-block size-1.5 rounded-full",
                    offer.status === "pending" && "bg-amber-500 animate-pulse",
                    offer.status === "accepted" && "bg-emerald-500",
                    offer.status === "rejected" && "bg-rose-500",
                    offer.status === "countered" && "bg-blue-500"
                  )}
                />
                {OFFER_STATUS_LABEL[offer.status]}
              </Badge>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {isMine ? "Proposed by You" : `Proposed by ${proposerName}`} · {formatRelativeTime(offer.createdAt)}
            </p>
          </div>
        </div>

        {actionable && !counterOpen && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              className="h-7.5 rounded-full px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              onClick={() => onAction(offer.id, "accept")}
            >
              <Check className="mr-1 size-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
              onClick={() => onAction(offer.id, "reject")}
            >
              <X className="mr-1 size-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7.5 rounded-full px-2.5 text-xs font-medium"
              onClick={() => setCounterOpen(true)}
            >
              Counter
            </Button>
          </div>
        )}
      </div>

      {offer.status === "pending" && isMine && (
        <p className="text-xs text-muted-foreground">
          Waiting for response from seller…
        </p>
      )}

      {actionable && counterOpen && (
        <CounterOfferForm
          pending={false}
          onCounter={(amountDollars) =>
            onAction(offer.id, "counter", Math.round(amountDollars * 100))
          }
          onCancel={() => setCounterOpen(false)}
        />
      )}

      {isAccepted && isBuyer && currentOfferPostId && (
        <div className="pt-2.5 border-t border-emerald-500/20">
          <Button
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
            onClick={() => {
              createIntent.mutate({
                postId: currentOfferPostId,
                amount: offer.amount,
                currency: "USD",
              })
            }}
            disabled={createIntent.isPending}
          >
            Pay {formatCurrency(offer.amount)}
          </Button>
        </div>
      )}

      {isAccepted && !isBuyer && (
        <div className="flex items-center gap-1.5 pt-2.5 text-xs text-emerald-600 dark:text-emerald-400 border-t border-emerald-500/20 font-medium">
          <Check className="size-3.5" />
          <span>Offer accepted. Waiting for buyer to complete checkout payment.</span>
        </div>
      )}
    </div>
  )
}
