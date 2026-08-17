import { useEffect } from "react"
import { socket } from "@/lib/socket/client"
import { useAuthStore } from "@/stores/authStore"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { queryClient } from "@/lib/queryClient"
import { queryKeys, queryKeyPrefixes } from "@/api/queryKeys"
import {
  bridgeCommentDeleted,
  bridgeCommentDelta,
  bridgeCommentUpdated,
  bridgeLikeDelta,
  bridgeNewComment,
  bridgeNotification,
  bridgeOfferCreated,
  bridgeOfferUpdated,
  bridgeReceiveMessage,
  bridgeReplyCreated,
  type SocketComment,
} from "@/lib/socket/queryBridge"
import type {
  AppNotification,
  Message,
  Offer,
  Payment,
  PaymentStatus,
} from "@/types"

/**
 * Connects the singleton socket once a valid session exists and wires the
 * server event table (stack §5) into the query bridge. Never connect while
 * unauthenticated; re-join the active conversation room on reconnect.
 */
export function useSocketLifecycle() {
  const status = useAuthStore((s) => s.status)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return

    socket.auth = { token: accessToken }
    if (!socket.connected) socket.connect()

    const onReceiveMessage = (message: Message) => bridgeReceiveMessage(message)
    const onTyping = (payload: { conversationId: string; userId: string }) =>
      useNegotiationUiStore
        .getState()
        .setTyping(payload.conversationId, payload.userId, true)
    const onStopTyping = (payload: { conversationId: string; userId: string }) =>
      useNegotiationUiStore
        .getState()
        .setTyping(payload.conversationId, payload.userId, false)
    const onNotification = (notification: AppNotification) =>
      bridgeNotification(notification)
    const onLikeBroadcast = (payload: {
      postId: string
      likesCount: number
      isLiked: boolean
    }) => bridgeLikeDelta(payload.postId, payload.likesCount, payload.isLiked)
    const onCommentBroadcast = (payload: { postId: string; commentsCount: number }) =>
      bridgeCommentDelta(payload.postId, payload.commentsCount)
    const onNewComment = (comment: SocketComment) => bridgeNewComment(comment)
    const onCommentUpdated = (comment: SocketComment) =>
      bridgeCommentUpdated(comment)
    const onCommentDeleted = (payload: {
      commentId: string
      replyIds: string[]
    }) => bridgeCommentDeleted(payload)
    const onReplyCreated = (comment: SocketComment) => bridgeReplyCreated(comment)
    const onOfferCreated = (offer: Offer) => bridgeOfferCreated(offer)
    const onOfferUpdated = (payload: { offer: Offer; newOffer?: Offer }) =>
      bridgeOfferUpdated(payload)
    const onPaymentUpdated = (payload: {
      paymentId: string
      status: PaymentStatus
    }) => {
      queryClient.setQueryData<Payment>(
        queryKeys.payments.detail(payload.paymentId),
        (old) => (old ? { ...old, status: payload.status } : old)
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeyPrefixes.paymentsMe,
      })
    }

    const registerFollowingRooms = () => {
      const authorIds = collectFeedAuthorIds()
      if (authorIds.length > 0) socket.emit("register_following_rooms", authorIds)
    }

    const onConnect = () => {
      registerFollowingRooms()
      const active = useNegotiationUiStore.getState().activeConversationId
      if (active) {
        socket.emit("join_conversation", { conversationId: active })
      }
    }

    const onConnectError = (err: Error) => {
      const message = err?.message ?? ""
      if (
        message.includes("This account has been banned. Access denied.") ||
        message.includes("This account is currently suspended.")
      ) {
        useAuthStore.getState().clear()
        useAuthStore.getState().setNotice(message)
      }
    }

    socket.on("receive_message", onReceiveMessage)
    socket.on("typing_message", onTyping)
    socket.on("stop_typing_message", onStopTyping)
    socket.on("notification_created", onNotification)
    socket.on("like_broadcast", onLikeBroadcast)
    socket.on("comment_broadcast", onCommentBroadcast)
    socket.on("new_comment", onNewComment)
    socket.on("comment_updated", onCommentUpdated)
    socket.on("comment_deleted", onCommentDeleted)
    socket.on("reply_created", onReplyCreated)
    socket.on("offer_created", onOfferCreated)
    socket.on("offer_updated", onOfferUpdated)
    socket.on("payment_updated", onPaymentUpdated)
    socket.on("connect", onConnect)
    socket.on("connect_error", onConnectError)

    return () => {
      socket.off("receive_message", onReceiveMessage)
      socket.off("typing_message", onTyping)
      socket.off("stop_typing_message", onStopTyping)
      socket.off("notification_created", onNotification)
      socket.off("like_broadcast", onLikeBroadcast)
      socket.off("comment_broadcast", onCommentBroadcast)
      socket.off("new_comment", onNewComment)
      socket.off("comment_updated", onCommentUpdated)
      socket.off("comment_deleted", onCommentDeleted)
      socket.off("reply_created", onReplyCreated)
      socket.off("offer_created", onOfferCreated)
      socket.off("offer_updated", onOfferUpdated)
      socket.off("payment_updated", onPaymentUpdated)
      socket.off("connect", onConnect)
      socket.off("connect_error", onConnectError)
      if (socket.connected) socket.disconnect()
    }
  }, [status, accessToken])
}

/** Unique post author IDs currently cached in any post/feed list page. */
function collectFeedAuthorIds(): string[] {
  const ids = new Set<string>()
  const cache = queryClient.getQueryCache()
  for (const entry of cache.getAll()) {
    const key = entry.queryKey as readonly unknown[]
    if (!key || key.length < 2) continue
    const isPostList =
      key[0] === "posts" ||
      key[0] === "users" && key[1] === "me" && key[2] === "feed"
    if (!isPostList) continue
    const data = queryClient.getQueryData<{
      pages?: Array<{ data?: Array<{ author?: { id?: string } }> }>
    }>(entry.queryKey)
    for (const page of data?.pages ?? []) {
      for (const post of page.data ?? []) {
        if (post.author?.id) ids.add(post.author.id)
      }
    }
  }
  return [...ids]
}
