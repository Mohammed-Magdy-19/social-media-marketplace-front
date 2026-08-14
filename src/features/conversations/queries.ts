import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { Conversation, CursorPage, Message } from "@/types"

export const MESSAGES_PAGE_SIZE = 25

export function useConversationMeta(conversationId: string) {
  return useQuery({
    queryKey: ["conversations", conversationId],
    queryFn: ({ signal }) =>
      apiGet<Conversation>(`/conversations/${conversationId}`, { signal }),
    enabled: !!conversationId,
  })
}

export function useMessagesInfinite(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ["conversations", conversationId, "messages"],
    queryFn: ({ pageParam, signal }) =>
      apiGet<CursorPage<Message>>(`/conversations/${conversationId}/messages`, {
        params: { limit: MESSAGES_PAGE_SIZE, cursor: pageParam ?? undefined },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
  })
}
