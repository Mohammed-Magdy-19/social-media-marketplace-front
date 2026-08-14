import { useEffect } from "react"
import { socket } from "@/lib/socket/client"
import { useAuthStore } from "@/stores/authStore"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { queryClient } from "@/lib/queryClient"
import {
  bridgeCommentDelta,
  bridgeLikeDelta,
  bridgeNotification,
  bridgeReceiveMessage,
} from "@/lib/socket/queryBridge"
import type { AppNotification, Message } from "@/types"

/**
 * Connects the singleton socket once a valid session exists and wires the
 * server event table (stack §5) into the query bridge. Never connect while
 * unauthenticated; re-join the active conversation room on reconnect.
 */
export function useSocketLifecycle() {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!isHydrated || !accessToken) return

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
      likeCount: number
      isLiked: boolean
    }) => bridgeLikeDelta(payload.postId, payload.likeCount, payload.isLiked)
    const onCommentBroadcast = (payload: { postId: string; commentCount: number }) =>
      bridgeCommentDelta(payload.postId, payload.commentCount)
    const onPaymentSucceeded = () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", "me"] })
    }
    const onConnect = () => {
      const active = useNegotiationUiStore.getState().activeConversationId
      if (active) {
        socket.emit("join_conversation", { conversationId: active })
      }
    }

    socket.on("receive_message", onReceiveMessage)
    socket.on("typing_message", onTyping)
    socket.on("stop_typing_message", onStopTyping)
    socket.on("notification_created", onNotification)
    socket.on("like_broadcast", onLikeBroadcast)
    socket.on("comment_broadcast", onCommentBroadcast)
    socket.on("payment_succeeded", onPaymentSucceeded)
    socket.on("connect", onConnect)

    return () => {
      socket.off("receive_message", onReceiveMessage)
      socket.off("typing_message", onTyping)
      socket.off("stop_typing_message", onStopTyping)
      socket.off("notification_created", onNotification)
      socket.off("like_broadcast", onLikeBroadcast)
      socket.off("comment_broadcast", onCommentBroadcast)
      socket.off("payment_succeeded", onPaymentSucceeded)
      socket.off("connect", onConnect)
      if (socket.connected) socket.disconnect()
    }
  }, [isHydrated, accessToken])
}
