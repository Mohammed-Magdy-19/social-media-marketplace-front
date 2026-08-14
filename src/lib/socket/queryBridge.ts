import { queryClient } from "@/lib/queryClient"
import type { AppNotification, CursorPage, Message, Post } from "@/types"

/**
 * The one sanctioned place where the socket layer writes into the TanStack
 * Query cache. Incoming events are buffered and flushed once per animation
 * frame as a single batched cache write, so React 19's automatic batching
 * is not defeated by socket callbacks firing outside a React event handler.
 */

type MessageKey = readonly [string, string, string]

const pendingMessages = new Map<string, Message>()
const pendingNotifications = new Map<string, AppNotification>()
const pendingLikeDeltas = new Map<string, { likeCount: number; isLiked: boolean }>()
const pendingCommentDeltas = new Map<string, number>()

let rafScheduled = false

function scheduleFlush() {
  if (rafScheduled) return
  rafScheduled = true
  requestAnimationFrame(() => {
    rafScheduled = false
    flush()
  })
}

export function bridgeReceiveMessage(message: Message) {
  pendingMessages.set(message.messageId, message)
  scheduleFlush()
}

export function bridgeNotification(notification: AppNotification) {
  pendingNotifications.set(notification.id, notification)
  scheduleFlush()
}

export function bridgeLikeDelta(postId: string, likeCount: number, isLiked: boolean) {
  pendingLikeDeltas.set(postId, { likeCount, isLiked })
  scheduleFlush()
}

export function bridgeCommentDelta(postId: string, commentCount: number) {
  pendingCommentDeltas.set(postId, commentCount)
  scheduleFlush()
}

function isConversationMessagesKey(key: unknown): key is MessageKey {
  return (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === "conversations" &&
    key[2] === "messages"
  )
}

function flushMessages() {
  if (pendingMessages.size === 0) return
  const cache = queryClient.getQueryCache()
  const entries = cache.getAll().filter((q) => isConversationMessagesKey(q.queryKey))
  for (const entry of entries) {
    const conversationId = entry.queryKey[1]
    const matching = [...pendingMessages.values()].filter(
      (m) => m.conversationId === conversationId
    )
    if (matching.length === 0) continue
    queryClient.setQueryData<{
      pages: CursorPage<Message>[]
      pageParams: (string | null)[]
    }>(entry.queryKey, (old) => {
      if (!old || old.pages.length === 0) return old
      const pages = old.pages.map((page, index) => {
        if (index !== old.pages.length - 1) return page
        const seen = new Set(page.items.map((m) => m.messageId))
        const added = matching.filter((m) => !seen.has(m.messageId))
        return { ...page, items: [...page.items, ...added] }
      })
      return { ...old, pages }
    })
  }
}

function flushNotifications() {
  if (pendingNotifications.size === 0) return
  const key = ["notifications"] as const
  const existing = queryClient.getQueryData<AppNotification[]>(key)
  if (!existing) return
  const seen = new Set(existing.map((n) => n.id))
  const added = [...pendingNotifications.values()].filter((n) => !seen.has(n.id))
  if (added.length === 0) return
  queryClient.setQueryData<AppNotification[]>(key, (old) => [...added, ...(old ?? [])])
}

function updatePostInPage(pages: CursorPage<Post>[], postId: string, next: { likeCount?: number; isLiked?: boolean; commentCount?: number }) {
  let changed = false
  const mapped = pages.map((page) => ({
    ...page,
    items: page.items.map((post) => {
      if (post.id !== postId) return post
      changed = true
      return { ...post, ...next }
    }),
  }))
  return changed ? mapped : pages
}

function flushCommentDeltas() {
  if (pendingCommentDeltas.size === 0) return
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    const key = entry.queryKey as unknown
    const isPostKey =
      Array.isArray(key) && key.length > 0 && key[0] === "posts"
    const isFeedKey =
      Array.isArray(key) && key.length >= 2 && key[0] === "users" && key[1] === "me" && key[2] === "feed"
    if (!isPostKey && !isFeedKey) continue
    queryClient.setQueryData<{ pages: CursorPage<Post>[]; pageParams: unknown[] }>(
      entry.queryKey as unknown as string[],
      (old) => {
        if (!old) return old
        let pages = old.pages
        for (const [postId, commentCount] of pendingCommentDeltas) {
          pages = updatePostInPage(pages, postId, { commentCount })
        }
        return { ...old, pages }
      }
    )
  }
}

function flushLikeDeltas() {
  if (pendingLikeDeltas.size === 0) return
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    const key = entry.queryKey as unknown
    const isPostKey =
      Array.isArray(key) && key.length > 0 && key[0] === "posts"
    const isFeedKey =
      Array.isArray(key) && key.length >= 2 && key[0] === "users" && key[1] === "me" && key[2] === "feed"
    if (!isPostKey && !isFeedKey) continue
    queryClient.setQueryData<{ pages: CursorPage<Post>[]; pageParams: unknown[] }>(
      entry.queryKey as unknown as string[],
      (old) => {
        if (!old) return old
        let pages = old.pages
        for (const [postId, delta] of pendingLikeDeltas) {
          pages = updatePostInPage(pages, postId, delta)
        }
        return { ...old, pages }
      }
    )
  }
}

function flush() {
  flushMessages()
  flushNotifications()
  flushLikeDeltas()
  flushCommentDeltas()
  pendingMessages.clear()
  pendingNotifications.clear()
  pendingLikeDeltas.clear()
  pendingCommentDeltas.clear()
}
