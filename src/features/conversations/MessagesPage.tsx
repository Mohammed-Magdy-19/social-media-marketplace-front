import * as React from "react"
import { useRef } from "react"
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
} from "@/features/conversations/queries"
import { useSendMessage } from "@/features/conversations/mutations"
import { negotiationOfferSchema } from "@/features/conversations/schemas"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { socket } from "@/lib/socket/client"
import { getErrorMessage } from "@/lib/api/errors"
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
import type { Message } from "@/types"

type OfferValues = z.infer<typeof negotiationOfferSchema>

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
}: {
  message: Message
  isMine: boolean
}) {
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
            "mt-0.5 text-[10px]",
            isMine ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {formatRelativeTime(message.createdAt)}
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

function OfferDialog({
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
    resolver: zodResolver(negotiationOfferSchema),
    defaultValues: { price: undefined, message: "" },
  })

  React.useEffect(() => {
    if (open) form.reset({ price: undefined, message: "" })
  }, [open, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
          <DialogDescription>
            Propose a price and message to the seller.
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
              name="price"
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
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Add a short message" />
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
  const me = useAuthStore((s) => s.user)
  const { data: meta } = useConversationMeta(conversationId)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessagesInfinite(conversationId)
  const sendMessage = useSendMessage(conversationId)
  const [offerOpen, setOfferOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickToBottom = useRef(true)
  const didInitialScroll = useRef(false)

  const setActiveConversation = useNegotiationUiStore(
    (s) => s.setActiveConversation
  )

  React.useEffect(() => {
    setActiveConversation(conversationId)
    didInitialScroll.current = false
    stickToBottom.current = true
    socket.emit("join_conversation", { conversationId })
    return () => {
      setActiveConversation(null)
      socket.emit("leave_conversation", { conversationId })
    }
  }, [conversationId, setActiveConversation])

  // pages[0] is the newest batch; reverse to chronological (oldest → newest).
  const messages = React.useMemo(
    () => (data?.pages ? [...data.pages].reverse().flatMap((p) => p.messages) : []),
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

  const onOffer = (values: OfferValues) => {
    sendMessage.mutate(
      { body: values.message, offerAmount: values.price },
      {
        onSuccess: () => {
          toast.success(`Offer ${formatCurrency(values.price)} sent`)
          setOfferOpen(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const other =
    meta?.participants.find((p) => p.id !== me?.id) ??
    meta?.participants[0]

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
            {meta?.post?.caption ?? "Negotiation"}
          </p>
        </div>
        {meta?.post?.price != null && (
          <Badge variant="outline" className="font-mono">
            {formatCurrency(meta.post.price, meta.post.currency)}
          </Badge>
        )}
        <Button size="sm" variant="outline" onClick={() => setOfferOpen(true)}>
          Make offer
        </Button>
      </div>

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
                  <MessageBubble message={message} isMine={isMine} />
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

      <OfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onOffer={onOffer}
        pending={sendMessage.isPending}
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

  if (!conversationId) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Negotiate listings and keep offers in one place.
          </p>
        </div>
        <Card className="rounded-card">
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
      <Card className="hidden max-h-[calc(100svh-6rem)] overflow-y-auto rounded-card md:block">
        <CardContent className="p-2">
          <ErrorBoundary fallback={<SectionFallback />}>
            <ConversationList activeId={conversationId} />
          </ErrorBoundary>
        </CardContent>
      </Card>
      <ErrorBoundary fallback={<SectionFallback />}>
        <Thread conversationId={conversationId} />
      </ErrorBoundary>
    </div>
  )
}
