import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  ApiResponse,
  Conversation,
  MessageCursorPage,
} from "@/types"

export const MESSAGES_PAGE_SIZE = 25

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ conversations: Conversation[] }>>(
        "/conversations",
        { signal }
      )
      return res.data.conversations
    },
    staleTime: 15_000,
  })
}

export function useConversationMeta(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<
        ApiResponse<{ conversation: Conversation }>
      >(`/conversations/${conversationId}`, { signal })
      return res.data.conversation
    },
    enabled: !!conversationId,
  })
}

export function useMessagesInfinite(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: async ({ pageParam, signal }) => {
      const res = await apiGet<ApiResponse<MessageCursorPage>>(
        `/conversations/${conversationId}/messages`,
        {
          params: { limit: MESSAGES_PAGE_SIZE, cursor: pageParam ?? undefined },
          signal,
        }
      )
      return res.data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
  })
}
