import { useParams } from "react-router-dom"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"

export interface TypingIndicatorProps {
  conversationId?: string
}

export function TypingIndicator({ conversationId: propId }: TypingIndicatorProps) {
  const paramId = useParams<{ conversationId?: string }>().conversationId
  const conversationId = propId || paramId
  const typingUserIds = useNegotiationUiStore((s) => s.typingUserIds)
  const senders = conversationId ? (typingUserIds[conversationId] ?? []) : []

  if (senders.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-4 pb-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-current" />
      </span>
      {senders.length === 1 ? "typing…" : "several people typing…"}
    </div>
  )
}
