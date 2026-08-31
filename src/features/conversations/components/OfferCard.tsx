import * as React from "react"
import { Check, Clock, ShieldAlert, Tag, X } from "lucide-react"
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
import type { Offer, OfferAction, OfferStatus, Post } from "@/types"

const MAX_COUNTER_ROUNDS = 3

const offerCardVariants = cva("flex flex-col gap-2 rounded-xl border p-3 shadow-xs transition-all", {
  variants: {
    status: {
      pending: "border-border/60 bg-card/90 backdrop-blur-xs hover:border-border",
      accepted: "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20",
      rejected: "border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/10 opacity-80",
      countered: "border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/10 opacity-90",
      expired: "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 opacity-75",
      system_cancelled: "border-zinc-500/20 bg-zinc-500/5 dark:bg-zinc-950/10 opacity-75",
    },
  },
  defaultVariants: {
    status: "pending",
  },
})

const OFFER_STATUS_TONE: Record<OfferStatus, string> = {
  pending: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
  accepted: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
  rejected: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800",
  countered: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
  expired: "text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
  system_cancelled: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
}

const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  countered: "Countered",
  expired: "Expired (24h)",
  system_cancelled: "Cancelled (Item Sold)",
}

export interface OfferCardProps {
  offer: Offer
  meId: string
  onAction: (offerId: string, action: OfferAction, amountCents?: number) => void
}

function getExpiresInText(expiresAtStr?: string): string | null {
  if (!expiresAtStr) return null
  const diffMs = new Date(expiresAtStr).getTime() - Date.now()
  if (diffMs <= 0) return "Expired"
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`
  return `Expires in ${minutes}m`
}

export function OfferCard({ offer, meId, onAction }: OfferCardProps) {
  const [counterOpen, setCounterOpen] = React.useState(false)
  const createIntent = useCreatePaymentIntent()

  const isMine = offerProposerId(offer) === meId
  const proposerName =
    typeof offer.proposedBy === "object" && offer.proposedBy
      ? offer.proposedBy.name || offer.proposedBy.username
      : "They"

  const isPending = offer.status === "pending"
  const actionable = isPending && !isMine

  const buyerId = offerBuyerId(offer)
  const isBuyer = buyerId === meId
  const currentOfferPostId = offerPostId(offer)
  const isAccepted = offer.status === "accepted"

  const postObj = typeof offer.post === "object" ? (offer.post as Post) : null
  const listingPriceCents = postObj?.price ?? undefined

  // Fatigue check: 3 counter rounds max
  const buyerCounters = offer.counterCountBuyer || 0
  const sellerCounters = offer.counterCountSeller || 0
  const myCounterCount = isBuyer ? buyerCounters : sellerCounters
  const isCounterCapReached = myCounterCount >= MAX_COUNTER_ROUNDS

  // Convergence range calculations
  const minCounterDollars = isBuyer
    ? listingPriceCents
      ? Math.round(listingPriceCents * 0.70) / 100
      : undefined
    : offer.amount / 100 // Seller must counter higher than buyer's offer

  const maxCounterDollars = isBuyer
    ? offer.amount / 100 // Buyer must counter lower than seller's offer
    : listingPriceCents
      ? listingPriceCents / 100
      : undefined // Seller must counter lower than listing price

  const expiresIn = getExpiresInText(offer.expiresAt)

  return (
    <div className={cn(offerCardVariants({ status: offer.status }))}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 font-mono text-xs font-bold">
            <Tag className="size-4 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
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
                    offer.status === "countered" && "bg-blue-500",
                    offer.status === "expired" && "bg-zinc-400",
                    offer.status === "system_cancelled" && "bg-zinc-400"
                  )}
                />
                {OFFER_STATUS_LABEL[offer.status]}
              </Badge>

              {isPending && expiresIn && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <Clock className="size-3" />
                  {expiresIn}
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
              {isMine ? "Proposed by You" : `Proposed by ${proposerName}`} · {formatRelativeTime(offer.createdAt)}
              {(buyerCounters > 0 || sellerCounters > 0) && (
                <span className="ml-1 text-muted-foreground/80 font-mono">
                  (Round {buyerCounters + sellerCounters}/{MAX_COUNTER_ROUNDS * 2})
                </span>
              )}
            </p>
          </div>
        </div>

        {actionable && !counterOpen && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              className="h-7.5 rounded-full px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
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
              Decline
            </Button>
            {!isCounterCapReached ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7.5 rounded-full px-2.5 text-xs font-medium"
                onClick={() => setCounterOpen(true)}
              >
                Counter
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground italic px-1">
                Max counters (3/3)
              </span>
            )}
          </div>
        )}
      </div>

      {offer.status === "pending" && isMine && (
        <p className="text-xs text-muted-foreground">
          Waiting for response from {isBuyer ? "seller" : "buyer"}…
        </p>
      )}

      {actionable && counterOpen && (
        <CounterOfferForm
          pending={false}
          minDollars={minCounterDollars}
          maxDollars={maxCounterDollars}
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
            Complete Checkout · {formatCurrency(offer.amount)}
          </Button>
        </div>
      )}

      {isAccepted && !isBuyer && (
        <div className="flex items-center gap-1.5 pt-2.5 text-xs text-emerald-600 dark:text-emerald-400 border-t border-emerald-500/20 font-medium">
          <Check className="size-3.5" />
          <span>Offer accepted. Waiting for buyer to complete checkout payment.</span>
        </div>
      )}

      {offer.status === "system_cancelled" && (
        <div className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground border-t border-border/40 font-medium">
          <ShieldAlert className="size-3.5 text-muted-foreground" />
          <span>This negotiation was closed because the listing was purchased.</span>
        </div>
      )}
    </div>
  )
}

