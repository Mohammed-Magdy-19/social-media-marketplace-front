import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPatch, apiPost } from "@/lib/api/client"
import { socket } from "@/lib/socket/client"
import { router } from "@/router"
import { queryKeys } from "@/api/queryKeys"
import type {
  ApiResponse,
  Conversation,
  Message,
  MessageCursorPage,
  Offer,
  OfferAction,
} from "@/types"

/**
 * Start a negotiation from a marketplace listing: create-or-reuse the 1:1
 * thread with the listing's author (seller), then navigate into it. The
 * offer itself is created later inside the conversation via useCreateOffer.
 */
export function useStartNegotiation() {
  return useMutation({
    mutationFn: async ({ sellerId, postId }: { sellerId: string; postId?: string }) => {
      const res = await apiPost<ApiResponse<{ conversation: Conversation }>>("/conversations", {
        participantIds: [sellerId],
      })
      return { conversation: res.data.conversation, postId }
    },
    onSuccess: ({ conversation, postId }) => {
      const query = postId ? `?postId=${encodeURIComponent(postId)}` : ""
      void router.navigate(`/messages/${conversation.id}${query}`)
    },
  })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      const clientMessageId = crypto.randomUUID()
      const optimistic: Message = {
        id: `client:${clientMessageId}`,
        messageId: clientMessageId,
        conversationId,
        senderId: "__me__",
        body,
        createdAt: new Date().toISOString(),
        clientMessageId,
        status: "pending",
      }
      queryClient.setQueryData<{
        pages: MessageCursorPage[]
        pageParams: (string | null)[]
      }>(queryKeys.conversations.messages(conversationId), (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ messages: [optimistic], nextCursor: null }],
            pageParams: [null],
          }
        }
        const pages = old.pages.map((page, index) =>
          index === 0
            ? { ...page, messages: [...(page?.messages ?? []), optimistic] }
            : page
        )
        return { ...old, pages }
      })
      socket.emit("send_message", {
        conversationId,
        body,
        clientMessageId,
      })
      // Mark the optimistic bubble as failed if the server never echoes it
      // back (offline / connect_error). No-op once reconciled by the bridge.
      setTimeout(() => {
        queryClient.setQueryData<
          { pages: MessageCursorPage[]; pageParams: (string | null)[] } | undefined
        >(queryKeys.conversations.messages(conversationId), (old) => {
          if (!old || old.pages.length === 0) return old
          const pages = old.pages.map((page, index) =>
            index === 0
              ? {
                  ...page,
                  messages: (page?.messages ?? []).map((m) =>
                    m.id === `client:${clientMessageId}`
                      ? { ...m, status: "failed" as const }
                      : m
                  ),
                }
              : page
          )
          return { ...old, pages }
        })
      }, 8000)
    },
  })
}

export function useCreateOffer(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, amount }: { postId: string; amount: number }) =>
      apiPost<ApiResponse<{ offer: Offer }>>(
        `/conversations/${conversationId}/offers`,
        { postId, amount }
      ),
    onSuccess: (res) => {
      const offer = res.data.offer
      queryClient.setQueryData<Offer[]>(
        queryKeys.conversations.offers(conversationId),
        (old) => {
          const list = old ? [...old] : []
          if (!list.some((o) => o.id === offer.id)) list.push(offer)
          return list.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        }
      )
    },
  })
}

export function useRespondToOffer(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      offerId,
      action,
      amount,
    }: {
      offerId: string
      action: OfferAction
      amount?: number
    }) =>
      apiPatch<ApiResponse<{ offer: Offer; newOffer?: Offer }>>(
        `/conversations/${conversationId}/offers/${offerId}`,
        { action, amount }
      ),
    onSuccess: (res) => {
      const { offer, newOffer } = res.data
      queryClient.setQueryData<Offer[]>(
        queryKeys.conversations.offers(conversationId),
        (old) => {
          const list = old ? [...old] : []
          const idx = list.findIndex((o) => o.id === offer.id)
          if (idx >= 0) list[idx] = offer
          else list.push(offer)
          if (newOffer && !list.some((o) => o.id === newOffer.id)) {
            list.push(newOffer)
          }
          return list.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        }
      )
    },
  })
}

export function useMarkMessagesRead(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPatch<{ status: string }>(
        `/conversations/${conversationId}/messages/read`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all(),
      })
    },
  })
}
