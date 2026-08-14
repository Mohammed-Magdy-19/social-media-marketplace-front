import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { useFilterStore, type FeedSort } from "@/stores/filterStore"
import type { CursorPage, Post } from "@/types"

export const POSTS_PAGE_SIZE = 12

export interface PostFilters {
  category: string | null
  tag: string | null
  author: string | null
  sort: FeedSort
}

export function usePostsInfinite(filters: PostFilters) {
  return useInfiniteQuery({
    queryKey: ["posts", filters],
    queryFn: ({ pageParam, signal }) =>
      apiGet<CursorPage<Post>>("/posts", {
        params: {
          limit: POSTS_PAGE_SIZE,
          cursor: pageParam ?? undefined,
          category: filters.category ?? undefined,
          tag: filters.tag ?? undefined,
          author: filters.author ?? undefined,
          sort: filters.sort,
        },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
    queryKey: ["posts", "detail", postId],
    queryFn: ({ signal }) => apiGet<Post>(`/posts/${postId}`, { signal }),
  })
}

export function useSavedPosts() {
  return useQuery({
    queryKey: ["users", "me", "saved-posts"],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Post>>("/users/me/saved-posts", { signal }),
  })
}
