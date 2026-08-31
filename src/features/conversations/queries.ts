import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  ApiResponse,
  Conversation,
  Message,
  Offer,
  PaginatedResponse,
  PublicUser,
} from "@/types"

export const MESSAGES_PAGE_SIZE = 25

interface RawBackendMessage {
  id?: string
  _id?: string
  messageId?: string
  conversation?: string | { id?: string; _id?: string }
  conversationId?: string
  sender?: string | { id?: string; _id?: string; username?: string; avatar?: string }
  senderId?: string
  text?: string
  body?: string
  createdAt: string
  clientMessageId?: string
  status?: "pending" | "failed"
  replyTo?: { id?: string; messageId?: string; body?: string; senderId?: string; senderName?: string } | null
  isEdited?: boolean
  isDeleted?: boolean
}

export function normalizeMessage(raw: RawBackendMessage): Message {
  const id = String(raw.id || raw._id || raw.messageId || "")
  const conversationId =
    typeof raw.conversation === "string"
      ? raw.conversation
      : raw.conversation?.id || raw.conversation?._id || raw.conversationId || ""
  const senderId =
    typeof raw.sender === "string"
      ? raw.sender
      : raw.sender?.id || raw.sender?._id || raw.senderId || ""
  const body = raw.body ?? raw.text ?? ""

  return {
    id,
    messageId: raw.messageId || id,
    conversationId,
    senderId,
    body,
    createdAt: raw.createdAt,
    clientMessageId: raw.clientMessageId,
    status: raw.status,
    replyTo: raw.replyTo
      ? {
          id: raw.replyTo.id || raw.replyTo.messageId || "",
          body: raw.replyTo.body || "",
          senderId: raw.replyTo.senderId || "",
          senderName: raw.replyTo.senderName || "User",
        }
      : null,
    isEdited: raw.isEdited ?? false,
    isDeleted: raw.isDeleted ?? false,
  }
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<PaginatedResponse<Conversation>>(
        "/conversations",
        { signal }
      )
      return res.data ?? []
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
    enabled: !!conversationId && conversationId !== "undefined",
    retry: (failureCount, error: any) => error?.status !== 404 && failureCount < 1,
  })
}

export function useMessagesInfinite(conversationId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: async ({ pageParam, signal }) => {
      const res = await apiGet<{
        status: string
        data: {
          messages: RawBackendMessage[]
          hasMore: boolean
          nextCursor?: string
        }
      }>(
        `/conversations/${conversationId}/messages?limit=${MESSAGES_PAGE_SIZE}${
          pageParam ? `&cursor=${pageParam}` : ""
        }`,
        { signal }
      )
      const list = (res.data?.messages ?? []).map(normalizeMessage)
      const nextCursor = res.data?.nextCursor ?? (res.data?.hasMore ? list[list.length - 1]?.createdAt : undefined)
      return {
        messages: list,
        nextCursor,
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!conversationId && conversationId !== "undefined" && enabled,
    retry: (failureCount, error: any) => error?.status !== 404 && failureCount < 1,
  })
}

export function useOffers(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.conversations.offers(conversationId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ offers: Offer[] }>>(
        `/conversations/${conversationId}/offers`,
        { signal }
      )
      return res.data?.offers ?? []
    },
    enabled: !!conversationId && conversationId !== "undefined" && enabled,
    retry: (failureCount, error: any) => error?.status !== 404 && failureCount < 1,
  })
}

/** Offer field accessors — `conversation`/`post`/`proposedBy` can be id strings or populated objects. */
export function offerConversationId(offer: Offer): string {
  return typeof offer.conversation === "string"
    ? offer.conversation
    : offer.conversation.id
}

export function offerPostId(offer: Offer): string {
  return typeof offer.post === "string" ? offer.post : offer.post.id
}

export function offerProposer(offer: Offer): PublicUser | string {
  return offer.proposedBy
}

export function offerProposerId(offer: Offer): string {
  return typeof offer.proposedBy === "string"
    ? offer.proposedBy
    : offer.proposedBy.id
}

export function offerBuyerId(offer: Offer): string {
  if (typeof offer.buyer === "string") return offer.buyer
  return (offer.buyer as unknown as { id?: string; _id?: string })?.id ||
    (offer.buyer as unknown as { id?: string; _id?: string })?._id ||
    ""
}
