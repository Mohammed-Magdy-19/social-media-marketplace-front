import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { socket } from "@/lib/socket/client"
import { router } from "@/router"
import { queryKeys } from "@/api/queryKeys"
import type { Message, MessageCursorPage } from "@/types"

export function useStartNegotiation() {
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) =>
      apiPost<{ conversationId: string }>("/conversations", { postId }),
    onSuccess: (data) => {
      void router.navigate(`/messages/${data.conversationId}`)
    },
  })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      body,
      offerAmount,
    }: {
      body: string
      offerAmount?: number
    }) => {
      const clientMessageId = crypto.randomUUID()
      const optimistic: Message = {
        id: `client:${clientMessageId}`,
        messageId: clientMessageId,
        conversationId,
        senderId: "__me__",
        body,
        createdAt: new Date().toISOString(),
        clientMessageId,
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
            ? { ...page, messages: [...page.messages, optimistic] }
            : page
        )
        return { ...old, pages }
      })
      socket.emit("send_message", {
        conversationId,
        body,
        offerAmount,
        clientMessageId,
      })
    },
  })
}
