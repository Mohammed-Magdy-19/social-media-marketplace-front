import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { toast } from "sonner"
import { CheckCheck, Trash2 } from "lucide-react"
import { useNotifications } from "@/features/notifications/queries"
import { useMarkAllRead, useDeleteNotification } from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { StatusPill } from "@/features/admin/components/StatusPill"
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
import { cn, formatRelativeTime } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api/errors"
import type { AppNotification } from "@/types"

function NotificationRow({
  notification,
  onDelete,
}: {
  notification: AppNotification
  onDelete: (n: AppNotification) => void
}) {
  const [unread] = React.useState(!notification.read)
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-line-2 px-3 py-2.5 last:border-0",
        unread && "bg-brand-soft/50"
      )}
    >
      <div className="relative">
        <AvatarWithFallback
          name={notification.actor?.name ?? "System"}
          src={notification.actor?.avatar ?? null}
          size="sm"
        />
        {unread && (
          <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-brand" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{notification.title}</p>
          <StatusPill
            status={notification.transport === "socket" ? "System" : "User"}
            className={cn(
              notification.transport === "socket"
                ? "bg-violet-soft text-violet"
                : "bg-info-soft text-info"
            )}
          />
          <span className="text-[10px] text-muted-foreground">
            {notification.transport === "socket" ? "Socket.io" : "Hybrid write"}
          </span>
        </div>
        {notification.body && (
          <p className="truncate text-xs text-muted-foreground">{notification.body}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete notification"
          className="text-err hover:bg-err-soft"
          onClick={() => onDelete(notification)}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

export default function AdminNotificationsPage() {
  const { data, isLoading } = useNotifications()
  const markAllRead = useMarkAllRead()
  const deleteNotification = useDeleteNotification()
  const [deleteTarget, setDeleteTarget] =
    React.useState<AppNotification | null>(null)
  const parentRef = React.useRef<HTMLDivElement>(null)

  const notifications = data ?? []
  const unreadCount = notifications.filter((n) => !n.read).length

  const virtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  })

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Notifications"
        subtitle="All system and community notifications"
      >
        <Badge variant="outline" className="border-transparent bg-soft font-mono text-[10px] text-muted-foreground">
          {unreadCount} unread
        </Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() =>
            markAllRead.mutate(undefined, {
              onError: (error) =>
                toast.error(getErrorMessage(error)),
            })
          }
        >
          <CheckCheck />
          Mark all read
        </Button>
      </AdminPageHeader>

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <div ref={parentRef} className="max-h-[520px] overflow-y-auto">
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const n = notifications[item.index]
                  return (
                    <div
                      key={n.id}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute top-0 left-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      <NotificationRow
                        notification={n}
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
            <AlertDialogTitle>Delete notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the notification{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.title}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteNotification.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteNotification.mutate(deleteTarget.id)
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
