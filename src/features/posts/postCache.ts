import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query"
import type { PaginatedResponse, Post } from "@/types"

export type PostPageEnvelope = InfiniteData<PaginatedResponse<Post>>

function isPostListKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    ((key[0] === "posts" && key[1] === "list") ||
      (key[0] === "users" && key[1] === "me" && key[2] === "feed") ||
      (key[0] === "users" && key[1] === "me" && key[2] === "saved-posts"))
  )
}

function listKeys(queryClient: QueryClient): QueryKey[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((entry) => isPostListKey(entry.queryKey))
    .map((entry) => entry.queryKey)
}

export function updatePostInCache(
  queryClient: QueryClient,
  postId: string,
  updater: (post: Post) => Post
) {
  for (const key of listKeys(queryClient)) {
    queryClient.setQueryData<any>(key, (old: any) => {
      if (!old) return old
      if (Array.isArray(old.pages)) {
        let changed = false
        const pages = old.pages.map((page: any) => {
          if (!page || !Array.isArray(page.data)) return page
          return {
            ...page,
            data: page.data.map((post: Post) => {
              if (post.id !== postId) return post
              changed = true
              return updater(post)
            }),
          }
        })
        return changed ? { ...old, pages } : old
      }
      if (Array.isArray(old.data)) {
        let changed = false
        const data = old.data.map((post: Post) => {
          if (post.id !== postId) return post
          changed = true
          return updater(post)
        })
        return changed ? { ...old, data } : old
      }
      return old
    })
  }
}

export function snapshotPostsInCache(queryClient: QueryClient) {
  const snapshot = new Map<QueryKey, PostPageEnvelope>()
  for (const key of listKeys(queryClient)) {
    const data = queryClient.getQueryData<PostPageEnvelope>(key)
    if (data) snapshot.set(key, data)
  }
  return snapshot
}

export function restorePostsInCache(
  queryClient: QueryClient,
  snapshot: Map<QueryKey, PostPageEnvelope>
) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}
