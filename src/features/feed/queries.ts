import { useInfiniteQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { PaginatedResponse, Post } from "@/types"

export const FEED_PAGE_SIZE = 10

export function useFeedInfinite() {
  return useInfiniteQuery({
    queryKey: queryKeys.users.feed(),
    queryFn: ({ pageParam, signal }) =>
      apiGet<PaginatedResponse<Post>>("/users/me/feed", {
        params: { page: pageParam ?? 1, limit: FEED_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1 as number,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextPage : undefined,
  })
}
