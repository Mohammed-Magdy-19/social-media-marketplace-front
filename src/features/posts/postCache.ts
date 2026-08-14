import type { QueryClient, QueryKey } from "@tanstack/react-query"
import type { CursorPage, Post } from "@/types"

export type PostPageEnvelope = {
  pages: CursorPage<Post>[]
  pageParams: unknown[]
}

function isPostListKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    key.length > 0 &&
    (key[0] === "posts" || (key[0] === "users" && key[1] === "me" && key[2] === "feed"))
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
    queryClient.setQueryData<PostPageEnvelope>(key, (old) => {
      if (!old) return old
      let changed = false
      const pages = old.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => {
          if (post.id !== postId) return post
          changed = true
          return updater(post)
        }),
      }))
      return changed ? { ...old, pages } : old
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
