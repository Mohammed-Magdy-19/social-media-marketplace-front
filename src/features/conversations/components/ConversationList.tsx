import { Link } from "react-router-dom"
import { useConversations } from "@/features/conversations/queries"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"

export interface ConversationListProps {
  activeId?: string
  onSelect?: () => void
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const me = useAuthStore((s) => s.user)
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
        const other =
          c.participants.find(
            (p) =>
              p &&
              p.id !== me?.id &&
              (p as unknown as { _id?: string })?._id !== me?.id
          ) ?? c.participants[0]
        const displayName = other?.name || other?.username || "Unknown"
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
              name={displayName}
              src={other?.avatar ?? null}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {displayName}
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
