import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { useFilterStore, type FeedSort } from "@/stores/filterStore"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PaginatedResponse, Post } from "@/types"

export const POSTS_PAGE_SIZE = 12

export interface PostFilters {
  category: string | null
  tag: string | null
  author: string | null
  sort: FeedSort
}

export function usePostsInfinite(filters: PostFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.list(filters),
    queryFn: ({ pageParam, signal }) =>
      apiGet<PaginatedResponse<Post>>("/posts", {
        params: {
          page: pageParam ?? 1,
          limit: POSTS_PAGE_SIZE,
          category: filters.category ?? undefined,
          tag: filters.tag ?? undefined,
          author: filters.author ?? undefined,
          sort: filters.sort,
        },
        signal,
      }),
    initialPageParam: 1 as number,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextPage : undefined,
    placeholderData: keepPreviousData,
  })
}

export function useLivePostFilters() {
  const category = useFilterStore((s) => s.category)
  const tag = useFilterStore((s) => s.tag)
  const author = useFilterStore((s) => s.author)
  const sort = useFilterStore((s) => s.sort)
  return { category, tag, author, sort }
}

export function usePost(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ post: Post }>>(
        `/posts/${postId}`,
        { signal }
      )
      return res.data.post
    },
  })
}

export function useSavedPosts() {
  return useQuery({
    queryKey: queryKeys.users.savedPosts(),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Post>>("/users/me/saved-posts", { signal }),
  })
}
