import type { InfiniteData } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import type {
  AppNotification,
  Conversation,
  Message,
  MessageCursorPage,
  MessageSummary,
  Offer,
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
const pendingMessageEdits = new Map<string, { messageId: string; conversationId: string; body: string; isEdited: boolean }>()
const pendingMessageDeletions = new Map<string, { messageId: string; conversationId: string }>()
const pendingNotifications = new Map<string, AppNotification>()
const pendingLikeDeltas = new Map<string, { likesCount: number; isLiked: boolean }>()
const pendingCommentDeltas = new Map<string, number>()
const pendingCommentEvents: CommentEvent[] = []
const pendingOffers: Offer[] = []
const pendingOfferUpdates: { offer: Offer; newOffer?: Offer }[] = []

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

export function bridgeMessageEdited(payload: {
  messageId: string
  conversationId: string
  body: string
  isEdited: boolean
}) {
  pendingMessageEdits.set(payload.messageId, payload)
  scheduleFlush()
}

export function bridgeMessageDeleted(payload: {
  messageId: string
  conversationId: string
}) {
  pendingMessageDeletions.set(payload.messageId, payload)
  scheduleFlush()
}

export function bridgeOfferCreated(offer: Offer) {
  pendingOffers.push(offer)
  scheduleFlush()
}

export function bridgeOfferUpdated(payload: { offer: Offer; newOffer?: Offer }) {
  pendingOfferUpdates.push(payload)
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
  if (pendingMessages.size === 0 && pendingMessageEdits.size === 0 && pendingMessageDeletions.size === 0) return
  const cache = queryClient.getQueryCache()
  const entries = cache.getAll().filter((q) => isMessagesKey(q.queryKey))
  const touchedConversations = new Set<string>()
  for (const entry of entries) {
    const conversationId = entry.queryKey[1] as string
    const matching = [...pendingMessages.values()].filter(
      (m) => m.conversationId === conversationId
    )
    const edits = [...pendingMessageEdits.values()].filter(
      (e) => e.conversationId === conversationId
    )
    const deletions = [...pendingMessageDeletions.values()].filter(
      (d) => d.conversationId === conversationId
    )

    if (matching.length === 0 && edits.length === 0 && deletions.length === 0) continue

    queryClient.setQueryData<InfiniteData<MessageCursorPage>>(
      entry.queryKey,
      (old) => {
        if (!old || old.pages.length === 0) return old
        const pages = old.pages.map((page, index) => {
          let messages = (page?.messages ?? []).map((m) => {
            const edit = edits.find((e) => e.messageId === m.messageId || e.messageId === m.id)
            if (edit) {
              return { ...m, body: edit.body, isEdited: true }
            }
            const deletion = deletions.find((d) => d.messageId === m.messageId || d.messageId === m.id)
            if (deletion) {
              return { ...m, body: "", isDeleted: true }
            }
            return m
          })

          if (index === 0 && matching.length > 0) {
            // Reconcile optimistic inserts: drop the locally-created temp message
            // once the authoritative echo (same clientMessageId) arrives.
            const optimisticIds = new Set(
              matching
                .filter((m) => m.clientMessageId)
                .map((m) => `client:${m.clientMessageId}`)
            )
            messages = messages.filter(
              (m) => !(optimisticIds.has(m.id) && m.id.startsWith("client:"))
            )
            const seen = new Set(messages.map((m) => m.messageId))
            const added = matching.filter((m) => !seen.has(m.messageId))
            if (added.length > 0) messages = [...messages, ...added]
          }

          return { ...page, messages }
        })
        return { ...old, pages }
      }
    )
    touchedConversations.add(conversationId)
  }

  if (touchedConversations.size > 0 && pendingMessages.size > 0) {
    patchConversationList([...touchedConversations])
  }
}

/** Keep the conversation list live: bump lastMessage/lastMessageAt and re-sort. */
function patchConversationList(conversationIds: string[]) {
  const list = queryClient.getQueryData<Conversation[]>(queryKeys.conversations.all())
  if (!list || list.length === 0) return
  let changed = false
  const next = list.map((c) => {
    if (!conversationIds.includes(c.id)) return c
    const latest = [...pendingMessages.values()]
      .filter((m) => m.conversationId === c.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
    if (!latest) return c
    changed = true
    const summary: MessageSummary = {
      id: latest.messageId,
      senderId: latest.senderId,
      body: latest.body,
      createdAt: latest.createdAt,
    }
    return { ...c, lastMessage: summary, lastMessageAt: latest.createdAt }
  })
  if (!changed) return
  const sorted = next.slice().sort(
    (a, b) =>
      new Date(b.lastMessageAt ?? 0).getTime() -
      new Date(a.lastMessageAt ?? 0).getTime()
  )
  queryClient.setQueryData(queryKeys.conversations.all(), sorted)
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

function isOffersKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    key.length === 3 &&
    key[0] === "conversations" &&
    key[2] === "offers"
  )
}

function offerConversationId(offer: Offer): string {
  return typeof offer.conversation === "string" ? offer.conversation : offer.conversation.id
}

/** Patch the offers cache in place (append / replace / counter-chain), oldest first. */
function flushOffers() {
  if (pendingOffers.length === 0 && pendingOfferUpdates.length === 0) return
  const cache = queryClient.getQueryCache()
  const entries = cache.getAll().filter((q) => isOffersKey(q.queryKey))
  for (const entry of entries) {
    const conversationId = entry.queryKey[1] as string
    const created = pendingOffers.filter((o) => offerConversationId(o) === conversationId)
    const updated = pendingOfferUpdates.filter(
      (p) => offerConversationId(p.offer) === conversationId
    )
    if (created.length === 0 && updated.length === 0) continue
    queryClient.setQueryData<Offer[]>(entry.queryKey, (old) => {
      const list = old ? [...old] : []
      for (const offer of created) {
        if (!list.some((o) => o.id === offer.id)) list.push(offer)
      }
      for (const { offer, newOffer } of updated) {
        const idx = list.findIndex((o) => o.id === offer.id)
        if (idx >= 0) list[idx] = offer
        else list.push(offer)
        if (newOffer && !list.some((o) => o.id === newOffer.id)) list.push(newOffer)
      }
      return list.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })
  }
}

function flush() {
  flushMessages()
  flushNotifications()
  flushLikeDeltas()
  flushCommentDeltas()
  flushCommentEvents()
  flushOffers()
  pendingMessages.clear()
  pendingMessageEdits.clear()
  pendingMessageDeletions.clear()
  pendingNotifications.clear()
  pendingLikeDeltas.clear()
  pendingCommentDeltas.clear()
  pendingCommentEvents.length = 0
  pendingOffers.length = 0
  pendingOfferUpdates.length = 0
}
