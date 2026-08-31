import * as React from "react"
import { useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { toast } from "sonner"
import {
  useConversationMeta,
  useMessagesInfinite,
  useOffers,
  offerPostId,
} from "@/features/conversations/queries"
import { usePost } from "@/features/posts/queries"
import {
  useCreateOffer,
  useDeleteMessage,
  useEditMessage,
  useMarkMessagesRead,
  useRespondToOffer,
  useSendMessage,
} from "@/features/conversations/mutations"
import { useNegotiationUiStore } from "@/stores/negotiationUiStore"
import { useAuthStore } from "@/stores/authStore"
import { socket } from "@/lib/socket/client"
import { queryKeys } from "@/api/queryKeys"
import { getErrorMessage } from "@/lib/api/errors"
import type {
  Message,
  MessageCursorPage,
  OfferAction,
  Post,
} from "@/types"
import type { CreateOfferFormValues } from "@/features/conversations/schemas"

export function useConversationThread(conversationId: string) {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()

  const { data: meta } = useConversationMeta(conversationId)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessagesInfinite(conversationId)
  const { data: offers } = useOffers(conversationId)

  const sendMessage = useSendMessage(conversationId)
  const editMessage = useEditMessage(conversationId)
  const deleteMessage = useDeleteMessage(conversationId)
  const createOffer = useCreateOffer(conversationId)
  const respondToOffer = useRespondToOffer(conversationId)
  const markRead = useMarkMessagesRead(conversationId)
  const markReadRef = useRef(markRead.mutate)
  markReadRef.current = markRead.mutate

  const [offerOpen, setOfferOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [replyingTo, setReplyingTo] = React.useState<Message | null>(null)
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stickToBottom = useRef(true)
  const didInitialScroll = useRef(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const setActiveConversation = useNegotiationUiStore(
    (s) => s.setActiveConversation
  )

  // Mark inbound messages read once on chat open, and on tab focus
  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    markReadRef.current()
  }, [conversationId])

  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    const onFocus = () => markReadRef.current()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [conversationId])

  // Socket room lifecycle
  React.useEffect(() => {
    if (!conversationId || conversationId === "undefined") return
    setActiveConversation(conversationId)
    didInitialScroll.current = false
    stickToBottom.current = true
    socket.emit("join_conversation", { conversationId })

    return () => {
      setActiveConversation(null)
      socket.emit("leave_conversation", { conversationId })
    }
  }, [conversationId, setActiveConversation])

  // Clean typing timeout on unmount
  React.useEffect(
    () => () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    },
    []
  )

  // Chronological message order (oldest → newest)
  const messages = React.useMemo(
    () =>
      data?.pages
        ? [...data.pages]
            .reverse()
            .flatMap((p) => [
              ...(Array.isArray(p) ? p : (p?.messages ?? [])),
            ].reverse())
        : [],
    [data]
  )

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 12,
  })

  // Auto-scroll on initial load or new messages
  React.useEffect(() => {
    if (messages.length === 0) return
    if (!didInitialScroll.current) {
      didInitialScroll.current = true
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
    } else if (stickToBottom.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" })
    }
  }, [messages.length, virtualizer])

  const handleScroll = () => {
    const el = parentRef.current
    if (!el) return
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 80 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  const emitTyping = () => {
    socket.emit("typing_message", { conversationId })
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = setTimeout(() => {
      socket.emit("stop_typing_message", { conversationId })
    }, 2500)
  }

  const other =
    meta?.participants.find((p) => p.id !== me?.id) ??
    meta?.participants[0]

  const handleSend = () => {
    const body = draft.trim()
    if (!body) return
    sendMessage.mutate(
      {
        body,
        replyTo: replyingTo?.messageId,
        replyPreview: replyingTo
          ? {
              id: replyingTo.messageId,
              body: replyingTo.body,
              senderId: replyingTo.senderId,
              senderName:
                replyingTo.senderId === me?.id ? "You" : other?.name ?? "User",
            }
          : undefined,
      },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
    setDraft("")
    setReplyingTo(null)
  }

  const retryMessage = (failed: Message) => {
    queryClient.setQueryData<
      { pages: MessageCursorPage[]; pageParams: (string | null)[] } | undefined
    >(queryKeys.conversations.messages(conversationId), (old) => {
      if (!old || old.pages.length === 0) return old
      const pages = old.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              messages: (page?.messages ?? []).filter((m) => m.id !== failed.id),
            }
          : page
      )
      return { ...old, pages }
    })
    sendMessage.mutate(
      { body: failed.body },
      {
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  // Active listing resolution for negotiations
  const queryPostId = searchParams.get("postId")
  const firstOffer = offers?.[0]
  const firstOfferPostId = firstOffer ? offerPostId(firstOffer) : undefined
  const activePostId = queryPostId || firstOfferPostId || meta?.post?.id

  const { data: activePostData } = usePost(activePostId)
  const activePost: Post | undefined =
    (activePostData ?? undefined) ||
    meta?.post ||
    (firstOffer && typeof firstOffer.post === "object" ? (firstOffer.post as Post) : undefined)

  const handleCreateOffer = (values: CreateOfferFormValues) => {
    const targetPostId = activePost?.id || activePostId
    if (!targetPostId) {
      toast.error("No listing associated with this negotiation.")
      return
    }
    // Note: values.amount is already transformed to cents by schema
    createOffer.mutate(
      { postId: targetPostId, amount: values.amount },
      {
        onSuccess: () => {
          toast.success("Offer sent")
          setOfferOpen(false)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const handleRespondOffer = (offerId: string, action: OfferAction, amount?: number) => {
    respondToOffer.mutate(
      { offerId, action, amount },
      {
        onSuccess: () => {
          toast.success(
            action === "accept"
              ? "Offer accepted"
              : action === "reject"
                ? "Offer rejected"
                : "Counter offer sent"
          )
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const isNegotiation = Boolean(activePost || (offers && offers.length > 0))
  const hasPendingOffer = (offers ?? []).some((o) => o.status === "pending")

  return {
    me,
    other,
    meta,
    activePost,
    offers: offers ?? [],
    messages,
    virtualizer,
    parentRef,
    handleScroll,
    draft,
    setDraft,
    emitTyping,
    handleSend,
    retryMessage,
    replyingTo,
    setReplyingTo,
    isSendMessagePending: sendMessage.isPending,
    offerOpen,
    setOfferOpen,
    isNegotiation,
    hasPendingOffer,
    isCreateOfferPending: createOffer.isPending,
    handleCreateOffer,
    handleRespondOffer,
    editMessage,
    deleteMessage,
  }
}
