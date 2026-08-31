import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  AppNotification,
  NotificationType,
  PaginatedResponse,
  PublicUser,
  UserRole,
  UserStatus,
} from "@/types"

interface RawBackendNotification {
  id?: string
  _id?: string
  recipient?: string
  sender?: {
    id?: string
    _id?: string
    name?: string
    username?: string
    avatar?: string | null
    role?: string
    status?: string
    email?: string
    createdAt?: string
  }
  actor?: {
    id?: string
    _id?: string
    name?: string
    username?: string
    avatar?: string | null
  }
  type?: string
  title?: string
  body?: string
  message?: string
  targetId?: string
  metadata?: Record<string, unknown>
  isRead?: boolean
  read?: boolean
  createdAt?: string
  transport?: "socket" | "hybrid"
}

export function normalizeNotification(raw: RawBackendNotification): AppNotification {
  const senderName =
    raw.actor?.name ||
    raw.actor?.username ||
    raw.sender?.name ||
    raw.sender?.username ||
    "Someone"

  let type: NotificationType = "system"
  const rawType = String(raw.type || "").toUpperCase()
  let title = raw.title || ""
  let body = raw.body || ""

  if (rawType === "LIKE") {
    type = "like"
    if (!title) title = `${senderName} liked your post`
    if (!body) body = "Your post received a new like."
  } else if (rawType === "COMMENT") {
    type = "comment"
    if (!title) title = `${senderName} commented on your post`
    if (!body) body = "Check out the new comment on your post."
  } else if (rawType === "FOLLOW") {
    type = "follow"
    if (!title) title = `${senderName} started following you`
    if (!body) body = `${senderName} is now following your profile.`
  } else if (rawType === "MESSAGE") {
    type = "message"
    if (!title) title = `New message from ${senderName}`
    if (!body) body = "You received a new direct message."
  } else if (rawType === "NEW_POST") {
    type = "system"
    if (!title) title = `${senderName} shared a new post`
    if (!body) body = "A creator you follow just published new content."
  } else {
    if (!title) title = "Notification"
    if (!body) body = raw.message || "You have a new update."
  }

  const actorSource = raw.actor || raw.sender
  const actor: PublicUser | null = actorSource
    ? {
        id: String(actorSource.id || actorSource._id || ""),
        name: actorSource.name || actorSource.username || "User",
        username: actorSource.username || "user",
        email: ("email" in actorSource && typeof actorSource.email === "string") ? actorSource.email : "",
        avatar: actorSource.avatar || null,
        role: (("role" in actorSource && actorSource.role as UserRole) || "user"),
        status: (("status" in actorSource && actorSource.status as UserStatus) || "active"),
        createdAt: (("createdAt" in actorSource && typeof actorSource.createdAt === "string") ? actorSource.createdAt : new Date().toISOString()),
      }
    : null

  return {
    id: String(raw.id || raw._id || crypto.randomUUID()),
    type,
    actor,
    title,
    body,
    targetId: raw.targetId ? String(raw.targetId) : undefined,
    metadata: raw.metadata,
    read: Boolean(raw.read ?? raw.isRead ?? false),
    createdAt: raw.createdAt || new Date().toISOString(),
    transport: raw.transport || "hybrid",
  }
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<PaginatedResponse<RawBackendNotification>>(
        "/notifications",
        { signal }
      )
      const list = Array.isArray(res.data) ? res.data : []
      return list.map(normalizeNotification)
    },
    staleTime: 15_000,
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<{ status: string; data: { count: number } }>(
        "/notifications/unread-count",
        { signal }
      )
      return res.data
    },
    staleTime: 10_000,
  })
}
