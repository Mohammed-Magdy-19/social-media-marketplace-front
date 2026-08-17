import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Trash2 } from "lucide-react"
import { useAdminConversations } from "@/features/admin/queries"
import { useDeleteConversation } from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils"
import type { Conversation } from "@/types"

function ConversationRow({
  conversation,
  typingSenders,
  onDelete,
}: {
  conversation: Conversation
  typingSenders: string[]
  onDelete: (c: Conversation) => void
}) {
  const other = conversation.participants[1] ?? conversation.participants[0]
  const typing = typingSenders.length > 0

  return (
    <div className="flex items-center gap-3 border-b border-line-2 px-3 py-2.5 last:border-0">
      <AvatarWithFallback name={other?.name ?? "Unknown"} src={other?.avatar ?? null} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {other?.name ?? "Unknown"}
          </p>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {conversation.lastMessageAt
              ? formatRelativeTime(conversation.lastMessageAt)
              : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              typing ? "font-medium text-brand" : "text-muted-foreground"
            )}
          >
            {typing
              ? "typing…"
              : (conversation.lastMessage?.body ?? "No messages yet")}
          </p>
          {conversation.unreadCount > 0 && (
            <Badge
              className="h-4 min-w-4 shrink-0 rounded-pill px-1 font-mono text-[10px]"
              variant="destructive"
            >
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {conversation.post?.price != null && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatCurrency(conversation.post.price, conversation.post.currency)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete conversation"
          className="text-err hover:bg-err-soft"
          onClick={() => onDelete(conversation)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

export default function AdminConversationsPage() {
  const { data, isLoading } = useAdminConversations()
  const deleteConversation = useDeleteConversation()
  const [deleteTarget, setDeleteTarget] =
    React.useState<Conversation | null>(null)
  const parentRef = React.useRef<HTMLDivElement>(null)

  const typingUserIds = useNegotiationUiStore((s) => s.typingUserIds)

  const conversations = React.useMemo(() => {
    const list = data?.data ?? []
    const sorted = [...list].sort((a, b) => {
      const aTyping = (typingUserIds[a.id]?.length ?? 0) > 0 ? 1 : 0
      const bTyping = (typingUserIds[b.id]?.length ?? 0) > 0 ? 1 : 0
      if (aTyping !== bTyping) return bTyping - aTyping
      return (
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime()
      )
    })
    return sorted
  }, [data, typingUserIds])

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Conversations"
        subtitle="Monitor active negotiations and typing activity"
      />

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <div ref={parentRef} className="max-h-[520px] overflow-y-auto">
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const c = conversations[item.index]
                  return (
                    <div
                      key={c.id}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <ConversationRow
                        conversation={c}
                        typingSenders={typingUserIds[c.id] ?? []}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the negotiation thread and its message
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteConversation.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteConversation.mutate(deleteTarget.id)
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
