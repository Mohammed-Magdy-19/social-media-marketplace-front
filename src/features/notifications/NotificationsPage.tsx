import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  CheckCheck,
  Heart,
  Mail,
  MessageSquare,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useNotifications, useUnreadNotificationCount } from "@/features/notifications/queries"
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "@/features/notifications/mutations"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { AppNotification, NotificationType } from "@/types"

type FilterType = "all" | "unread" | NotificationType

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "moderation", label: "Moderation & Reports" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "follow", label: "Follows" },
  { key: "message", label: "Messages" },
]

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "like":
      return <Heart className="size-3.5 fill-current text-rose-500" />
    case "comment":
      return <MessageSquare className="size-3.5 fill-current text-blue-500" />
    case "follow":
      return <UserPlus className="size-3.5 text-emerald-500" />
    case "message":
      return <Mail className="size-3.5 text-indigo-500" />
    case "moderation":
      return <ShieldAlert className="size-3.5 text-amber-500" />
    default:
      return <Bell className="size-3.5 text-brand" />
  }
}

function getNotificationTone(type: NotificationType) {
  switch (type) {
    case "like":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20"
    case "comment":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "follow":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
    case "message":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
    case "moderation":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20"
    default:
      return "bg-brand/10 text-brand border-brand/20"
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = React.useState<FilterType>("all")

  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadData } = useUnreadNotificationCount()

  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const deleteNotification = useDeleteNotification()

  const unreadCount =
    unreadData?.count ?? notifications.filter((n) => !n.read).length

  const filteredNotifications = React.useMemo(() => {
    if (activeFilter === "all") return notifications
    if (activeFilter === "unread") return notifications.filter((n) => !n.read)
    return notifications.filter((n) => n.type === activeFilter)
  }, [notifications, activeFilter])

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) {
      markRead.mutate(n.id)
    }

    if (n.type === "moderation") {
      const metaTargetType = n.metadata?.targetType
      const metaTargetId = n.metadata?.targetId
      if (metaTargetType === "post" && metaTargetId) {
        void navigate(`/posts/${metaTargetId}`)
        return
      }
      if (metaTargetType === "user" && metaTargetId) {
        void navigate(`/users/${metaTargetId}`)
        return
      }
    }

    if (n.targetId) {
      if (n.type === "like" || n.type === "comment") {
        void navigate(`/posts/${n.targetId}`)
        return
      }
      if (n.type === "message") {
        void navigate(`/messages/${n.targetId}`)
        return
      }
    }

    if (n.actor?.id) {
      if (n.type === "follow") {
        void navigate(`/users/${n.actor.id}`)
        return
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Bell className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full px-2 text-xs font-semibold">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Stay updated on your interactions, likes, and activity.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="rounded-full text-xs font-semibold"
          >
            <CheckCheck className="mr-1.5 size-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-brand text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-soft hover:text-foreground ring-1 ring-border/60"
              )}
            >
              <span>{tab.label}</span>
              {tab.key === "unread" && unreadCount > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notifications List */}
      <Card className="rounded-card border-border overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-soft text-muted-foreground">
                <Bell className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilter === "unread"
                    ? "You're all caught up! No unread notifications."
                    : "You haven't received any notifications in this category yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "group flex items-start gap-3.5 p-3.5 transition-colors cursor-pointer hover:bg-muted/40",
                    !n.read && "bg-brand/5 dark:bg-brand/10"
                  )}
                >
                  <div className="relative shrink-0">
                    <AvatarWithFallback
                      name={n.actor?.name || n.actor?.username || "User"}
                      src={n.actor?.avatar ?? null}
                      size="default"
                    />
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-background shadow-xs",
                        getNotificationTone(n.type)
                      )}
                    >
                      {getNotificationIcon(n.type)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="size-2 rounded-full bg-brand shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.body}
                    </p>

                    {n.type === "moderation" && typeof n.metadata?.resolutionNotes === "string" && n.metadata.resolutionNotes.trim().length > 0 && (
                      <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-foreground/90">
                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 text-[11px] mb-1">
                          <ShieldAlert className="size-3.5" />
                          <span>Admin Resolution Response</span>
                        </div>
                        <p className="font-sans italic text-xs leading-relaxed">
                          &ldquo;{n.metadata.resolutionNotes}&rdquo;
                        </p>
                      </div>
                    )}

                    <p className="font-mono text-[10px] text-muted-foreground/80 mt-1.5">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete notification"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification.mutate(n.id)
                      }}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
