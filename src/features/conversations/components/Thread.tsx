import { useNavigate } from "react-router-dom"
import { ArrowLeft, BadgePercent, CornerDownRight, Send, X } from "lucide-react"
import { useConversationThread } from "@/features/conversations/hooks/useConversationThread"
import { MessageBubble } from "@/features/conversations/components/MessageBubble"
import { OfferCard } from "@/features/conversations/components/OfferCard"
import { MakeOfferDialog } from "@/features/conversations/components/MakeOfferDialog"
import { TypingIndicator } from "@/features/conversations/components/TypingIndicator"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatCurrency } from "@/lib/utils"

export interface ThreadProps {
  conversationId: string
}

export function Thread({ conversationId }: ThreadProps) {
  const navigate = useNavigate()
  const {
    me,
    other,
    activePost,
    offers,
    messages,
    virtualizer,
    parentRef,
    handleScroll,
    draft,
    setDraft,
    emitTyping,
    handleSend,
    retryMessage,
    replyingTo,
    setReplyingTo,
    isSendMessagePending,
    offerOpen,
    setOfferOpen,
    isNegotiation,
    hasPendingOffer,
    isCreateOfferPending,
    handleCreateOffer,
    handleRespondOffer,
    editMessage,
    deleteMessage,
  } = useConversationThread(conversationId)

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col overflow-hidden rounded-card bg-card/95 shadow-sm ring-1 ring-foreground/10 backdrop-blur-md md:h-[calc(100svh-6rem)]">
      {/* Header */}
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

      {/* Offers Tray */}
      {offers.length > 0 && (
        <div className="flex max-h-56 flex-col gap-2.5 overflow-y-auto no-scrollbar border-b border-border/70 bg-muted/20 p-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              meId={me?.id ?? ""}
              onAction={handleRespondOffer}
            />
          ))}
        </div>
      )}

      {/* Messages Scroll Stream */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
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

      <TypingIndicator conversationId={conversationId} />

      {/* Quoted Reply Banner */}
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

      {/* Message Composer Bar */}
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
                handleSend()
              }
            }}
            placeholder="Write a message…"
            aria-label="Message body"
            className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
          />
        </div>
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={!draft.trim() || isSendMessagePending}
          aria-label="Send message"
          className="size-9 rounded-full bg-brand text-white hover:bg-brand/90 shadow-xs shrink-0 transition-transform active:scale-95"
        >
          <Send className="size-4" />
        </Button>
      </div>

      <MakeOfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onOffer={handleCreateOffer}
        pending={isCreateOfferPending}
        originalPrice={activePost?.price}
      />
    </div>
  )
}
