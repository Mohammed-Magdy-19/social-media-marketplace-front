import type { QueryClient, QueryKey } from "@tanstack/react-query"
import type { CursorPage } from "@/types"

type PageEnvelope = { pages: CursorPage<unknown>[]; pageParams: unknown[] }

/**
 * Generic helpers for optimistically editing cursor-paginated list cache
 * entries (used by admin mutations across every admin table). Key prefix
 * is an array, e.g. `["admin", "posts"]`, `["reports"]`.
 */
function isPrefixMatch(key: unknown, prefix: string[]): boolean {
  return (
    Array.isArray(key) &&
    prefix.every((part, index) => key[index] === part)
  )
}

export function adminListKeys(
  queryClient: QueryClient,
  keyPrefix: string[]
): QueryKey[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((entry) => isPrefixMatch(entry.queryKey, keyPrefix))
    .map((entry) => entry.queryKey)
}

export function updateAdminListItem<T>(
  queryClient: QueryClient,
  keyPrefix: string[],
  id: string,
  updater: (item: T) => T
) {
  for (const key of adminListKeys(queryClient, keyPrefix)) {
    queryClient.setQueryData<PageEnvelope>(key, (old) => {
      if (!old) return old
      let changed = false
      const pages = old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if ((item as { id?: string }).id !== id) return item
          changed = true
          return updater(item as T)
        }),
      }))
      return changed ? { ...old, pages } : old
    })
  }
}

export function removeAdminListItem(
  queryClient: QueryClient,
  keyPrefix: string[],
  id: string
) {
  for (const key of adminListKeys(queryClient, keyPrefix)) {
    queryClient.setQueryData<PageEnvelope>(key, (old) => {
      if (!old) return old
      const pages = old.pages.map((page) => ({
        ...page,
        items: page.items.filter(
          (item) => (item as { id?: string }).id !== id
        ),
      }))
      return { ...old, pages }
    })
  }
}

export function snapshotAdminLists(
  queryClient: QueryClient,
  keyPrefix: string[]
) {
  const snapshot = new Map<QueryKey, PageEnvelope>()
  for (const key of adminListKeys(queryClient, keyPrefix)) {
    const data = queryClient.getQueryData<PageEnvelope>(key)
    if (data) snapshot.set(key, data)
  }
  return snapshot
}

export function restoreAdminLists(
  queryClient: QueryClient,
  snapshot: Map<QueryKey, PageEnvelope>
) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}
