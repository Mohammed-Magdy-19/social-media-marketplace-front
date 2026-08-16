import type { InfiniteData } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import type {
  AppNotification,
  Message,
  MessageCursorPage,
  PaginatedResponse,
  Post,
  PostComment,
  PublicUser,
} from "@/types"

/**
 * The one sanctioned place where the socket layer writes into the TanStack
 * Query cache. Incoming events are buffered and flushed once per animation
 * frame as a single batched cache write, so React 19's automatic batching
 * is not defeated by socket callbacks firing outside a React event handler.
 *
 * Every key used here is pulled from `queryKeys` / `queryKeyPrefixes`.
 */

type CommentEvent =
  | { kind: "created"; comment: PostComment }
  | { kind: "updated"; comment: PostComment }
  | { kind: "reply"; comment: PostComment }
  | { kind: "deleted"; commentId: string; replyIds: string[] }

const pendingMessages = new Map<string, Message>()
const pendingNotifications = new Map<string, AppNotification>()
const pendingLikeDeltas = new Map<string, { likesCount: number; isLiked: boolean }>()
const pendingCommentDeltas = new Map<string, number>()
const pendingCommentEvents: CommentEvent[] = []

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

export function bridgeLikeDelta(postId: string, likesCount: number, isLiked: boolean) {
  pendingLikeDeltas.set(postId, { likesCount, isLiked })
  scheduleFlush()
}

export function bridgeCommentDelta(postId: string, commentsCount: number) {
  pendingCommentDeltas.set(postId, commentsCount)
  scheduleFlush()
}

/** Raw backend `Comment` payload (handbook §5.4) → frontend `PostComment`. */
export interface SocketComment {
  id: string
  post: string | { id: string }
  author: PublicUser
  text: string
  parentComment?: string | { id: string } | null
  createdAt: string
}

function toPostComment(comment: SocketComment): PostComment {
  return {
    id: comment.id,
    postId: typeof comment.post === "string" ? comment.post : comment.post.id,
    parentId:
      typeof comment.parentComment === "string"
        ? comment.parentComment
        : comment.parentComment?.id ?? undefined,
    author: comment.author,
    text: comment.text,
    createdAt: comment.createdAt,
    likeCount: 0,
    isLiked: false,
    replies: [],
  }
}

export function bridgeNewComment(comment: SocketComment) {
  pendingCommentEvents.push({ kind: "created", comment: toPostComment(comment) })
  scheduleFlush()
}

export function bridgeCommentUpdated(comment: SocketComment) {
  pendingCommentEvents.push({ kind: "updated", comment: toPostComment(comment) })
  scheduleFlush()
}

export function bridgeReplyCreated(comment: SocketComment) {
  pendingCommentEvents.push({ kind: "reply", comment: toPostComment(comment) })
  scheduleFlush()
}

export function bridgeCommentDeleted(payload: { commentId: string; replyIds: string[] }) {
  pendingCommentEvents.push({ kind: "deleted", ...payload })
  scheduleFlush()
}

function isMessagesKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    key.length >= 3 &&
    key[0] === "conversations" &&
    key[2] === "messages"
  )
}

function isNotificationsListKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    key.length >= 2 &&
    key[0] === "notifications" &&
    key[1] === "list"
  )
}

function isPostListKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    ((key[0] === "posts" && key[1] === "list") ||
      (key[0] === "users" && key[1] === "me" && key[2] === "feed") ||
      (key[0] === "users" && key[1] === "me" && key[2] === "saved-posts"))
  )
}

function isCommentsKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === "posts" &&
    key[2] === "comments"
  )
}

function flushMessages() {
  if (pendingMessages.size === 0) return
  const cache = queryClient.getQueryCache()
  const entries = cache.getAll().filter((q) => isMessagesKey(q.queryKey))
  for (const entry of entries) {
    const conversationId = entry.queryKey[1]
    const matching = [...pendingMessages.values()].filter(
      (m) => m.conversationId === conversationId
    )
    if (matching.length === 0) continue
    queryClient.setQueryData<InfiniteData<MessageCursorPage>>(
      entry.queryKey,
      (old) => {
        if (!old || old.pages.length === 0) return old
        const pages = old.pages.map((page, index) => {
          if (index !== 0) return page
          const seen = new Set(page.messages.map((m) => m.messageId))
          const added = matching.filter((m) => !seen.has(m.messageId))
          return { ...page, messages: [...page.messages, ...added] }
        })
        return { ...old, pages }
      }
    )
  }
}

function flushNotifications() {
  if (pendingNotifications.size === 0) return
  const cache = queryClient.getQueryCache()
  const added = [...pendingNotifications.values()]
  const entries = cache.getAll().filter((q) => isNotificationsListKey(q.queryKey))
  for (const entry of entries) {
    queryClient.setQueryData<AppNotification[]>(entry.queryKey, (old) => {
      const seen = new Set((old ?? []).map((n) => n.id))
      const fresh = added.filter((n) => !seen.has(n.id))
      if (fresh.length === 0) return old
      return [...fresh, ...(old ?? [])]
    })
  }
}

function updatePostInPage(
  pages: PaginatedResponse<Post>[],
  postId: string,
  next: { likesCount?: number; isLiked?: boolean; commentsCount?: number }
) {
  let changed = false
  const mapped = pages.map((page) => ({
    ...page,
    data: page.data.map((post) => {
      if (post.id !== postId) return post
      changed = true
      return { ...post, ...next }
    }),
  }))
  return changed ? mapped : pages
}

function flushLikeDeltas() {
  if (pendingLikeDeltas.size === 0) return
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    if (!isPostListKey(entry.queryKey)) continue
    queryClient.setQueryData<InfiniteData<PaginatedResponse<Post>>>(
      entry.queryKey,
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

function flushCommentDeltas() {
  if (pendingCommentDeltas.size === 0) return
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    if (!isPostListKey(entry.queryKey)) continue
    queryClient.setQueryData<InfiniteData<PaginatedResponse<Post>>>(
      entry.queryKey,
      (old) => {
        if (!old) return old
        let pages = old.pages
        for (const [postId, commentsCount] of pendingCommentDeltas) {
          pages = updatePostInPage(pages, postId, { commentsCount })
        }
        return { ...old, pages }
      }
    )
  }
}

function replaceOrAppend(list: PostComment[], comment: PostComment): PostComment[] {
  let replaced = false
  const mapped = list.map((c) => {
    if (c.id === comment.id) {
      replaced = true
      return comment
    }
    if (c.replies.some((r) => r.id === comment.id)) {
      replaced = true
      return {
        ...c,
        replies: c.replies.map((r) => (r.id === comment.id ? comment : r)),
      }
    }
    return c
  })
  if (replaced) return mapped
  return [comment, ...list]
}

function removeComment(
  list: PostComment[],
  commentId: string,
  replyIds: string[]
): PostComment[] {
  const target = new Set([commentId, ...replyIds])
  return list
    .filter((c) => !target.has(c.id))
    .map((c) => ({
      ...c,
      replies: c.replies.filter((r) => !target.has(r.id)),
    }))
}

function bumpCommentCount(postId: string, delta: number) {
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    if (isPostListKey(entry.queryKey)) {
      queryClient.setQueryData<InfiniteData<PaginatedResponse<Post>>>(
        entry.queryKey,
        (old) => {
          if (!old) return old
          let changed = false
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((post) => {
              if (post.id !== postId) return post
              changed = true
              return {
                ...post,
                commentsCount: Math.max(0, post.commentsCount + delta),
              }
            }),
          }))
          return changed ? { ...old, pages } : old
        }
      )
    }
  }
  queryClient.setQueryData<Post>(queryKeys.posts.detail(postId), (old) =>
    old && old.id === postId
      ? { ...old, commentsCount: Math.max(0, old.commentsCount + delta) }
      : old
  )
}

function flushCommentEvents() {
  if (pendingCommentEvents.length === 0) return
  const cache = queryClient.getQueryCache()
  const commentKeys = cache.getAll().filter((q) => isCommentsKey(q.queryKey))

  for (const event of pendingCommentEvents) {
    if (event.kind === "deleted") {
      for (const entry of commentKeys) {
        const postId = entry.queryKey[1]
        if (typeof postId !== "string") continue
        queryClient.setQueryData<PostComment[]>(entry.queryKey, (old) => {
          if (!old) return old
          const flat = [...old, ...old.flatMap((c) => c.replies)]
          if (!flat.some((c) => c.id === event.commentId)) return old
          bumpCommentCount(postId, -(1 + event.replyIds.length))
          return removeComment(old, event.commentId, event.replyIds)
        })
      }
      continue
    }

    const { comment } = event
    const key = queryKeys.posts.comments(comment.postId)
    queryClient.setQueryData<PostComment[]>(key, (old) => {
      if (event.kind === "updated") {
        if (!old) return [comment]
        return replaceOrAppend(old, comment)
      }
      if (event.kind === "reply") {
        if (!old) return old
        const flat = [...old, ...old.flatMap((c) => c.replies)]
        if (flat.some((c) => c.id === comment.id)) return old
        bumpCommentCount(comment.postId, 1)
        return old.map((c) =>
          c.id === comment.parentId
            ? { ...c, replies: [comment, ...c.replies] }
            : c
        )
      }
      // created
      if (old && old.some((c) => c.id === comment.id)) return old
      bumpCommentCount(comment.postId, 1)
      return [comment, ...(old ?? [])]
    })
  }
}

function flush() {
  flushMessages()
  flushNotifications()
  flushLikeDeltas()
  flushCommentDeltas()
  flushCommentEvents()
  pendingMessages.clear()
  pendingNotifications.clear()
  pendingLikeDeltas.clear()
  pendingCommentDeltas.clear()
  pendingCommentEvents.length = 0
}
