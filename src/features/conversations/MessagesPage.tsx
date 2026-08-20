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
} from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, BadgePercent, Send } from "lucide-react"
import type { z } from "zod"
import {
  useConversations,
  useConversationMeta,
  useMessagesInfinite,
  useOffers,
  offerProposerId,
} from "@/features/conversations/queries"
import {
  useCreateOffer,
  useMarkMessagesRead,
  useRespondToOffer,
  useSendMessage,
} from "@/features/conversations/mutations"
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
} from "@/types"

type OfferValues = z.infer<typeof createOfferFormSchema>

const OFFER_STATUS_TONE: Record<OfferStatus, string> = {
  pending: "text-warn bg-warn-soft",
  accepted: "text-ok bg-ok-soft",
  rejected: "text-err bg-err-soft",
  countered: "text-info bg-info-soft",
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
}: {
  message: Message
  isMine: boolean
  onRetry?: (message: Message) => void
}) {
  const failed = message.status === "failed"
  return (
    <div className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-3 py-2 text-sm ring-1 ring-foreground/10",
          isMine ? "bg-brand text-white" : "bg-card"
        )}
      >
        <p className="leading-relaxed whitespace-pre-wrap break-words">
          {message.body}
        </p>
        <p
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
            formatRelativeTime(message.createdAt)
          )}
        </p>
      </div>
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
}: {
  pending: boolean
  onCounter: (amountCents: number) => void
}) {
  const form = useForm<OfferValues>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: { amount: undefined },
  })

  return (
    <form
      onSubmit={form.handleSubmit((v) => onCounter(v.amount))}
      className="flex items-center gap-2"
    >
      <Form {...form}>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem className="grid flex-1">
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Counter amount (USD)"
                  autoFocus
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
      <Button type="submit" size="sm" disabled={pending}>
        Send counter
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
  const isMine = offerProposerId(offer) === meId
  const proposerName =
    typeof offer.proposedBy === "object" && offer.proposedBy
      ? offer.proposedBy.name
      : "They"
  const actionable = offer.status === "pending" && !isMine

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">
            {formatCurrency(offer.amount / 100)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {isMine ? "You" : proposerName} · {formatRelativeTime(offer.createdAt)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("border-transparent", OFFER_STATUS_TONE[offer.status])}
        >
          {OFFER_STATUS_LABEL[offer.status]}
        </Badge>
      </div>

      {offer.status === "pending" && isMine && (
        <p className="text-xs text-muted-foreground">Waiting for a response…</p>
      )}

      {actionable && !counterOpen && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => onAction(offer.id, "accept")}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(offer.id, "reject")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCounterOpen(true)}
          >
            Counter
          </Button>
        </div>
      )}

      {actionable && counterOpen && (
        <CounterOfferForm
          pending={false}
          onCounter={(amount) => onAction(offer.id, "counter", amount)}
        />
      )}
    </div>
  )
}

function MakeOfferDialog({
  open,
  onOpenChange,
  onOffer,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOffer: (values: OfferValues) => void
  pending: boolean
}) {
  const form = useForm<OfferValues>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: { amount: undefined },
  })

  React.useEffect(() => {
    if (open) form.reset({ amount: undefined })
  }, [open, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
          <DialogDescription>
            Propose a price for this listing. Amounts are in dollars.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="offer-form"
            onSubmit={form.handleSubmit(onOffer)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormLabel>Offer price (USD)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="offer-form" disabled={pending}>
            <BadgePercent />
            Send offer
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
  const createOffer = useCreateOffer(conversationId)
  const respondToOffer = useRespondToOffer(conversationId)
  const markRead = useMarkMessagesRead(conversationId)
  const [offerOpen, setOfferOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
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

  const onSend = () => {
    const body = draft.trim()
    if (!body) return
    sendMessage.mutate(
      { body },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
    setDraft("")
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

  const onOffer = (values: OfferValues) => {
    if (!meta?.post) return
    createOffer.mutate(
      { postId: meta.post.id, amount: values.amount },
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

  const other =
    meta?.participants.find((p) => p.id !== me?.id) ??
    meta?.participants[0]

  // Negotiation affordances live only in 1:1 conversations anchored to a
  // priced listing (spec §5.2/§5.8); hide them in group/plain chats.
  const isNegotiation = !!meta?.post && meta?.isGroup !== true
  const hasPendingOffer = (offers ?? []).some((o) => o.status === "pending")

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col overflow-hidden rounded-card bg-card ring-1 ring-foreground/10 md:h-[calc(100svh-6rem)]">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => void navigate("/messages")}
          aria-label="Back to conversations"
        >
          <ArrowLeft />
        </Button>
        <AvatarWithFallback
          name={other?.name ?? "Unknown"}
          src={other?.avatar ?? null}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{other?.name ?? "Conversation"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {meta?.post?.title ?? "Negotiation"}
          </p>
        </div>
        {meta?.post?.price != null && (
          <Badge variant="outline" className="font-mono">
            {formatCurrency(meta.post.price, meta.post.currency)}
          </Badge>
        )}
        {isNegotiation && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOfferOpen(true)}
            disabled={hasPendingOffer}
          >
            {hasPendingOffer ? "Offer pending" : "Make offer"}
          </Button>
        )}
      </div>

      {(offers?.length ?? 0) > 0 && (
        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto border-b border-border p-3">
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

      <div
        ref={parentRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Start the conversation — send a message or make an offer.
          </div>
        ) : (
          <div
            className="relative flex flex-col gap-2 p-3"
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
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TypingBadge />

      <div className="flex items-center gap-2 border-t border-border p-2.5">
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
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={onSend}
          disabled={!draft.trim() || sendMessage.isPending}
          aria-label="Send message"
        >
          <Send />
        </Button>
      </div>

      <MakeOfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onOffer={onOffer}
        pending={createOffer.isPending}
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
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
    <div className="flex flex-col gap-1">
      {sorted.map((c) => {
        const other = c.participants[1]
        const active = c.id === activeId
        return (
          <Link
            key={c.id}
            to={`/messages/${c.id}`}
            onClick={onSelect}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted",
              active && "bg-muted"
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
      <Card className="hidden max-h-[calc(100svh-6rem)] overflow-y-auto rounded-card md:block">
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
