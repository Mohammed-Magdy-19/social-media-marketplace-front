import { useInfiniteQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { CursorPage, Post } from "@/types"

export const FEED_PAGE_SIZE = 10

export function useFeedInfinite() {
  return useInfiniteQuery({
    queryKey: ["users", "me", "feed"],
    queryFn: ({ pageParam, signal }) =>
      apiGet<CursorPage<Post>>("/users/me/feed", {
        params: { limit: FEED_PAGE_SIZE, cursor: pageParam ?? undefined },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
