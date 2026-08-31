import * as React from "react"
import { Check, CornerDownRight, Pencil, Reply, Trash2, X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Message } from "@/types"

const bubbleVariants = cva(
  "relative max-w-[80%] rounded-xl px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors",
  {
    variants: {
      isMine: {
        true: "bg-brand text-white",
        false: "bg-card text-foreground",
      },
      isDeleted: {
        true: "italic ring-1 ring-foreground/10 bg-muted/40 text-muted-foreground",
      },
    },
    defaultVariants: {
      isMine: false,
      isDeleted: false,
    },
  }
)

export interface MessageBubbleProps extends VariantProps<typeof bubbleVariants> {
  message: Message
  isMine: boolean
  onRetry?: (message: Message) => void
  onReply?: (message: Message) => void
  onEdit?: (message: Message, newBody: string) => void
  onDelete?: (message: Message) => void
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
  onRetry,
  onReply,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
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
      {/* Action buttons for sender's messages (on left of bubble) */}
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

      <div className={cn(bubbleVariants({ isMine, isDeleted: message.isDeleted }))}>
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
                  className="underline underline-offset-2 hover:text-foreground cursor-pointer"
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

      {/* Action buttons for recipient's incoming messages (on right of bubble) */}
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
