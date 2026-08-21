import * as React from "react"
import { useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  BadgePercent,
  Check,
  CornerDownRight,
  Pencil,
  Reply,
  Send,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import type { z } from "zod"
import {
  useConversations,
  useConversationMeta,
  useMessagesInfinite,
  useOffers,
  offerProposerId,
  offerBuyerId,
  offerPostId,
} from "@/features/conversations/queries"
import { usePost } from "@/features/posts/queries"
import {
  useCreateOffer,
  useDeleteMessage,
  useEditMessage,
  useMarkMessagesRead,
  useRespondToOffer,
  useSendMessage,
} from "@/features/conversations/mutations"
import { useCreatePaymentIntent } from "@/features/payments/mutations"
import { createOfferFormSchema } from "@/features/conversations/schemas"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { socket } from "@/lib/socket/client"
import { getErrorMessage } from "@/lib/api/errors"
import { queryKeys } from "@/api/queryKeys"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import type {
  Message,
  MessageCursorPage,
  Offer,
  OfferAction,
  OfferStatus,
  Post,
} from "@/types"

type OfferValues = z.infer<typeof createOfferFormSchema>

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

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
  onRetry,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message
  isMine: boolean
  onRetry?: (message: Message) => void
  onReply?: (message: Message) => void
  onEdit?: (message: Message, newBody: string) => void
  onDelete?: (message: Message) => void
}) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editDraft, setEditDraft] = React.useState(message.body)
  const failed = message.status === "failed"

  React.useEffect(() => {
    setEditDraft(message.body)
  }, [message.body])

  const handleSaveEdit = () => {
    const trimmed = editDraft.trim()
    if (!trimmed || trimmed === message.body) {
      setIsEditing(false)
      return
    }
    onEdit?.(message, trimmed)
    setIsEditing(false)
  }

  if (message.isDeleted) {
    return (
      <div className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[80%] rounded-xl px-3 py-2 text-xs italic ring-1 ring-foreground/10",
            isMine ? "bg-muted/50 text-muted-foreground" : "bg-muted/40 text-muted-foreground"
          )}
        >
          This message was deleted
        </div>
      </div>
    )
  }

  return (
    <div className={cn("group flex w-full items-center gap-1.5", isMine ? "justify-end" : "justify-start")}>
      {/* Action buttons for my messages (on left of bubble) */}
      {isMine && !isEditing && !failed && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onReply && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onReply(message)}
              title="Reply"
            >
              <Reply className="size-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditDraft(message.body)
                setIsEditing(true)
              }}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(message)}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative max-w-[80%] rounded-xl px-3 py-2 text-sm ring-1 ring-foreground/10",
          isMine ? "bg-brand text-white" : "bg-card"
        )}
      >
        {/* Quoted Reply Preview */}
        {message.replyTo && (
          <div
            className={cn(
              "mb-1.5 flex flex-col gap-0.5 rounded-md px-2 py-1 text-xs border-l-2",
              isMine
                ? "bg-black/15 text-white/90 border-white/60"
                : "bg-muted/80 text-foreground/80 border-brand"
            )}
          >
            <div className="flex items-center gap-1 font-semibold text-[11px] opacity-80">
              <CornerDownRight className="size-3" />
              <span>{message.replyTo.senderName}</span>
            </div>
            <p className="line-clamp-2 text-[11px] opacity-90 truncate">
              {message.replyTo.body}
            </p>
          </div>
        )}

        {/* Message body or inline editor */}
        {isEditing ? (
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <Input
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveEdit()
                } else if (e.key === "Escape") {
                  setIsEditing(false)
                }
              }}
              autoFocus
              className="h-8 text-xs bg-black/20 text-white border-white/30 focus-visible:ring-white"
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-5 w-5 text-white hover:bg-white/20"
                onClick={() => setIsEditing(false)}
              >
                <X className="size-3" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                className="h-5 w-5 text-white hover:bg-white/20"
                onClick={handleSaveEdit}
              >
                <Check className="size-3" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">
            {message.body}
          </p>
        )}

        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[10px]",
            isMine ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {failed ? (
            <>
              <span className="text-destructive">Not delivered</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="underline underline-offset-2"
                >
                  Retry
                </button>
              )}
            </>
          ) : (
            <>
              <span>{formatRelativeTime(message.createdAt)}</span>
              {message.isEdited && <span className="opacity-75">(edited)</span>}
            </>
          )}
        </div>
      </div>

      {/* Action buttons for incoming messages (on right of bubble) */}
      {!isMine && !failed && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onReply && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onReply(message)}
              title="Reply"
            >
              <Reply className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
})

function TypingBadge() {
  const typingUserIds = useNegotiationUiStore((s) => s.typingUserIds)
  const conversationId = useParams<{ conversationId?: string }>().conversationId
  const senders = conversationId ? (typingUserIds[conversationId] ?? []) : []

  if (senders.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 px-1 pb-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-current" />
      </span>
      {senders.length === 1 ? "typing…" : "several people typing…"}
    </div>
  )
}

function CounterOfferForm({
  pending,
  onCounter,
  onCancel,
}: {
  pending: boolean
  onCounter: (amountCents: number) => void
  onCancel: () => void
}) {
  const form = useForm<OfferValues>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: { amount: undefined },
  })

  return (
    <form
      onSubmit={form.handleSubmit((v) => onCounter(v.amount))}
      className="flex items-center gap-2 rounded-xl bg-background/80 p-2 ring-1 ring-border/60"
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="grid flex-1">
              <FormControl>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">$</span>
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Counter offer amount"
                    autoFocus
                    className="h-8 pl-6 text-xs"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" size="sm" className="h-8 rounded-full text-xs font-medium" disabled={pending}>
        Send Counter
      </Button>
    </form>
  )
}

function OfferCard({
  offer,
  meId,
  onAction,
}: {
  offer: Offer
  meId: string
  onAction: (offerId: string, action: OfferAction, amount?: number) => void
}) {
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
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 shadow-xs transition-all",
        isAccepted
          ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20"
          : "border-border/60 bg-card/90 backdrop-blur-xs hover:border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 font-mono text-xs font-bold">
            <Tag className="size-4 text-brand" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-tight text-foreground">
                {formatCurrency(offer.amount / 100)}
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
          onCounter={(amount) => onAction(offer.id, "counter", Math.round(amount * 100))}
          onCancel={() => setCounterOpen(false)}
        />
      )}

      {isAccepted && isBuyer && currentOfferPostId && (
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-emerald-500/20">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            <span>Offer accepted! Proceed to checkout:</span>
          </div>
          <Button
            size="sm"
            className="h-8 rounded-full px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            onClick={() => {
              createIntent.mutate({
                postId: currentOfferPostId,
                amount: offer.amount,
                currency: "USD",
              })
            }}
            disabled={createIntent.isPending}
          >
            Pay {formatCurrency(offer.amount / 100)}
          </Button>
        </div>
      )}
    </div>
  )
}

function MakeOfferDialog({
  open,
  onOpenChange,
  onOffer,
  pending,
  originalPrice,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOffer: (values: OfferValues) => void
  pending: boolean
  originalPrice?: number
}) {
  const form = useForm<OfferValues>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: { amount: undefined },
  })

  React.useEffect(() => {
    if (open) form.reset({ amount: undefined })
  }, [open, form])

  const applyDiscount = (percent: number) => {
    if (!originalPrice) return
    const discounted = Math.max(1, Math.round(originalPrice * (1 - percent / 100) * 100) / 100)
    form.setValue("amount", discounted)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BadgePercent className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Make an Offer</DialogTitle>
              <DialogDescription className="text-xs">
                Propose a custom price to the seller.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {originalPrice != null && originalPrice > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Listing Price:</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(originalPrice)}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Quick:</span>
              {[5, 10, 15, 20].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-6 rounded-full px-2 text-[11px] hover:bg-brand/10 hover:text-brand hover:border-brand/40"
                  onClick={() => applyDiscount(pct)}
                >
                  -{pct}%
                </Button>
              ))}
            </div>
          </div>
        )}

        <Form {...form}>
          <form
            id="offer-form"
            onSubmit={form.handleSubmit(onOffer)}
            className="flex flex-col gap-4 pt-1"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormLabel className="text-xs font-semibold">Your Offer Price (USD)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-7 font-mono font-semibold"
                        autoFocus
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="offer-form"
            className="rounded-full text-xs font-semibold shadow-xs"
            disabled={pending}
          >
            <BadgePercent className="mr-1.5 size-4" />
            Send Offer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Thread({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { data: meta } = useConversationMeta(conversationId)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessagesInfinite(conversationId)
  const { data: offers } = useOffers(conversationId)
  const sendMessage = useSendMessage(conversationId)
  const editMessage = useEditMessage(conversationId)
  const deleteMessage = useDeleteMessage(conversationId)
  const createOffer = useCreateOffer(conversationId)
  const respondToOffer = useRespondToOffer(conversationId)
  const markRead = useMarkMessagesRead(conversationId)
  const [offerOpen, setOfferOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [replyingTo, setReplyingTo] = React.useState<Message | null>(null)
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickToBottom = useRef(true)
  const didInitialScroll = useRef(false)

  const setActiveConversation = useNegotiationUiStore(
    (s) => s.setActiveConversation
  )

  // Mark inbound messages read once on chat open, and again when the tab
  // regains focus (spec §5.9) — never on every scroll or incoming message.
  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    const onFocus = () => markRead.mutate()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    setActiveConversation(conversationId)
    didInitialScroll.current = false
    stickToBottom.current = true
    socket.emit("join_conversation", { conversationId })
    return () => {
      setActiveConversation(null)
      socket.emit("leave_conversation", { conversationId })
    }
  }, [conversationId, setActiveConversation])

  // pages[0] is the newest batch (newest-first per page); reverse the page
  // order AND each page's array to get chronological oldest → newest.
  const messages = React.useMemo(
    () =>
      data?.pages
        ? [...data.pages]
            .reverse()
            .flatMap((p) => [
              ...(Array.isArray(p) ? p : (p?.messages ?? [])),
            ].reverse())
        : [],
    [data]
  )

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 12,
  })

  React.useEffect(() => {
    if (messages.length === 0) return
    if (!didInitialScroll.current) {
      didInitialScroll.current = true
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
    } else if (stickToBottom.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
    }
  }, [messages.length, virtualizer])

  const onScroll = () => {
    const el = parentRef.current
    if (!el) return
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  const emitTyping = () => {
    socket.emit("typing_message", { conversationId })
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = setTimeout(() => {
      socket.emit("stop_typing_message", { conversationId })
    }, 2500)
  }

  React.useEffect(
    () => () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    },
    []
  )

  const other =
    meta?.participants.find((p) => p.id !== me?.id) ??
    meta?.participants[0]

  const onSend = () => {
    const body = draft.trim()
    if (!body) return
    sendMessage.mutate(
      {
        body,
        replyTo: replyingTo?.messageId,
        replyPreview: replyingTo
          ? {
              id: replyingTo.messageId,
              body: replyingTo.body,
              senderId: replyingTo.senderId,
              senderName:
                replyingTo.senderId === me?.id ? "You" : other?.name ?? "User",
            }
          : undefined,
      },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
    setDraft("")
    setReplyingTo(null)
  }

  const retryMessage = (failed: Message) => {
    queryClient.setQueryData<
      { pages: MessageCursorPage[]; pageParams: (string | null)[] } | undefined
    >(queryKeys.conversations.messages(conversationId), (old) => {
      if (!old || old.pages.length === 0) return old
      const pages = old.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              messages: (page?.messages ?? []).filter((m) => m.id !== failed.id),
            }
          : page
      )
      return { ...old, pages }
    })
    sendMessage.mutate(
      { body: failed.body },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const [searchParams] = useSearchParams()
  const queryPostId = searchParams.get("postId")
  const firstOffer = offers?.[0]
  const firstOfferPostId = firstOffer ? offerPostId(firstOffer) : undefined

  const activePostId = queryPostId || firstOfferPostId || meta?.post?.id
  const { data: activePostData } = usePost(activePostId)
  const activePost: Post | undefined =
    (activePostData ?? undefined) ||
    meta?.post ||
    (firstOffer && typeof firstOffer.post === "object" ? (firstOffer.post as Post) : undefined)

  const onOffer = (values: OfferValues) => {
    const targetPostId = activePost?.id || activePostId
    if (!targetPostId) {
      toast.error("No listing associated with this negotiation.")
      return
    }
    createOffer.mutate(
      { postId: targetPostId, amount: Math.round(values.amount * 100) },
      {
        onSuccess: () => {
          toast.success("Offer sent")
          setOfferOpen(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const onRespond = (offerId: string, action: OfferAction, amount?: number) => {
    respondToOffer.mutate(
      { offerId, action, amount },
      {
        onSuccess: () => {
          toast.success(
            action === "accept"
              ? "Offer accepted"
              : action === "reject"
                ? "Offer rejected"
                : "Counter offer sent"
          )
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  // Negotiation affordances live in conversations with an associated listing or existing offers
  const isNegotiation = Boolean(activePost || (offers && offers.length > 0))
  const hasPendingOffer = (offers ?? []).some((o) => o.status === "pending")

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col overflow-hidden rounded-card bg-card/95 shadow-sm ring-1 ring-foreground/10 backdrop-blur-md md:h-[calc(100svh-6rem)]">
      {/* Modern Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-3.5 py-2.5 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="icon-xs"
            className="md:hidden -ml-1 text-muted-foreground"
            onClick={() => void navigate("/messages")}
            aria-label="Back to conversations"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <AvatarWithFallback
            name={other?.name ?? "Unknown"}
            src={other?.avatar ?? null}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              {other?.name ?? "Conversation"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {activePost?.title ? `Listing: ${activePost.title}` : "Chat"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activePost?.price != null && (
            <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 border-border/80 bg-muted/30">
              {formatCurrency(activePost.price, activePost.currency)}
            </Badge>
          )}
          {isNegotiation && (
            <Button
              size="sm"
              variant={hasPendingOffer ? "outline" : "default"}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold shadow-xs transition-all",
                !hasPendingOffer && "bg-brand hover:bg-brand/90 text-white"
              )}
              onClick={() => setOfferOpen(true)}
              disabled={hasPendingOffer}
            >
              <BadgePercent className="mr-1.5 size-3.5" />
              {hasPendingOffer ? "Offer Pending" : "Make Offer"}
            </Button>
          )}
        </div>
      </div>

      {/* Offers Tray (no scrollbar) */}
      {(offers?.length ?? 0) > 0 && (
        <div className="flex max-h-56 flex-col gap-2.5 overflow-y-auto no-scrollbar border-b border-border/70 bg-muted/20 p-3">
          {offers!.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              meId={me?.id ?? ""}
              onAction={onRespond}
            />
          ))}
        </div>
      )}

      {/* Messages Scroll Stream (no scrollbar) */}
      <div
        ref={parentRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain no-scrollbar p-3.5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <BadgePercent className="size-6" />
            </div>
            <p className="font-medium text-foreground">Start the conversation</p>
            <p className="text-xs max-w-xs">Send a direct message or make a negotiation offer on this listing.</p>
          </div>
        ) : (
          <div
            className="relative flex flex-col gap-2.5"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const message = messages[item.index]
              if (!message) return null
              const isMine = message.senderId === me?.id || message.senderId === "__me__"
              return (
                <div
                  key={message.messageId}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute top-0 left-0 w-full px-1 py-1"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <MessageBubble
                    message={message}
                    isMine={isMine}
                    onRetry={isMine ? retryMessage : undefined}
                    onReply={(m) => setReplyingTo(m)}
                    onEdit={
                      isMine
                        ? (m, newBody) =>
                            editMessage.mutate({
                              messageId: m.messageId,
                              newBody,
                            })
                        : undefined
                    }
                    onDelete={
                      isMine
                        ? (m) =>
                            deleteMessage.mutate({ messageId: m.messageId })
                        : undefined
                    }
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TypingBadge />

      {/* Reply bar when replying to a message */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/50 px-3.5 py-2 text-xs text-muted-foreground backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="size-3.5 text-brand shrink-0" />
            <span className="font-semibold text-foreground">
              Replying to {replyingTo.senderId === me?.id ? "yourself" : other?.name ?? "User"}:
            </span>
            <span className="truncate italic max-w-xs">{replyingTo.body}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5 shrink-0 rounded-full hover:bg-muted"
            onClick={() => setReplyingTo(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Modern Composer Bar */}
      <div className="flex items-center gap-2 border-t border-border/70 bg-card/80 p-2.5 backdrop-blur-xs">
        <div className="flex flex-1 items-center rounded-full bg-muted/40 px-3.5 py-1 ring-1 ring-border/60 focus-within:bg-card focus-within:ring-2 focus-within:ring-brand/30 transition-all">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (e.target.value.trim()) emitTyping()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Write a message…"
            aria-label="Message body"
            className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
          />
        </div>
        <Button
          size="icon-sm"
          onClick={onSend}
          disabled={!draft.trim() || sendMessage.isPending}
          aria-label="Send message"
          className="size-9 rounded-full bg-brand text-white hover:bg-brand/90 shadow-xs shrink-0 transition-transform active:scale-95"
        >
          <Send className="size-4" />
        </Button>
      </div>

      <MakeOfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onOffer={onOffer}
        pending={createOffer.isPending}
        originalPrice={activePost?.price}
      />
    </div>
  )
}

function ConversationList({
  activeId,
  onSelect,
}: {
  activeId?: string
  onSelect?: () => void
}) {
  const { data, isLoading } = useConversations()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        No conversations yet — hit{" "}
        <span className="font-medium text-foreground">Negotiate</span> on a
        listing to start one.
      </p>
    )
  }

  const sorted = [...data].sort(
    (a, b) =>
      new Date(b.lastMessageAt ?? b.participants[0]?.createdAt ?? 0).getTime() -
      new Date(a.lastMessageAt ?? a.participants[0]?.createdAt ?? 0).getTime()
  )

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((c) => {
        const other = c.participants[1]
        const active = c.id === activeId
        return (
          <Link
            key={c.id}
            to={`/messages/${c.id}`}
            onClick={onSelect}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-muted/70",
              active && "bg-muted shadow-2xs font-medium"
            )}
            aria-current={active ? "page" : undefined}
          >
            <AvatarWithFallback
              name={other?.name ?? "Unknown"}
              src={other?.avatar ?? null}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {other?.name ?? "Unknown"}
                </p>
                {c.lastMessageAt && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatRelativeTime(c.lastMessageAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {c.lastMessage?.body ?? "Tap to open"}
                </p>
                {c.unreadCount > 0 && (
                  <Badge
                    className="h-4 min-w-4 shrink-0 rounded-pill px-1 text-[10px]"
                    variant="destructive"
                  >
                    {c.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const validConversationId =
    conversationId && conversationId !== "undefined" ? conversationId : undefined

  if (!validConversationId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="mt-4">
          <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Negotiate listings and keep offers in one place.
          </p>
        </div>
        <Card className="mt-4 rounded-card">
          <CardContent className="p-2">
            <ErrorBoundary fallback={<SectionFallback />}>
              <ConversationList />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
      <Card className="hidden max-h-[calc(100svh-6rem)] overflow-y-auto no-scrollbar rounded-card md:block">
        <CardContent className="p-2">
          <ErrorBoundary fallback={<SectionFallback />}>
            <ConversationList activeId={validConversationId} />
          </ErrorBoundary>
        </CardContent>
      </Card>
      <ErrorBoundary fallback={<SectionFallback />}>
        <Thread conversationId={validConversationId} />
      </ErrorBoundary>
    </div>
  )
}
