import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import {
  removeAdminListItem,
  restoreAdminLists,
  snapshotAdminLists,
  updateAdminListItem,
} from "./adminCache"
import { queryKeys, queryKeyPrefixes } from "@/api/queryKeys"
import type {
  ApiResponse,
  AppNotification,
  Post,
  PublicUser,
  Report,
} from "@/types"

const REPORTS_PREFIX = queryKeyPrefixes.reports
const ADMIN_USERS_PREFIX = queryKeyPrefixes.adminUsers
const ADMIN_POSTS_PREFIX = queryKeyPrefixes.adminPosts
const NOTIFICATIONS_PREFIX = queryKeyPrefixes.notificationsList

/**
 * Move a report to reviewed/dismissed/resolved (PATCH /reports/:id).
 * `pending` is deliberately not settable — the backend enum excludes it.
 * The returned `resolvedBy`/`resolvedAt` come from the server verbatim; we
 * never guess them optimistically from the current admin. On success the
 * row is patched in the cache AND the active queue query is invalidated,
 * since a status change likely moves the row out of a filtered view (§3.1).
 */
export function useUpdateReportStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      resolutionNotes,
    }: {
      id: string
      status: Report["status"]
      resolutionNotes?: string
    }) =>
      apiPatch<{ status: string; data: { report: Report } }>(
        `/reports/${id}`,
        { status, resolutionNotes }
      ),
    onSuccess: (res, { id }) => {
      const report = res?.data?.report
      if (report) {
        updateAdminListItem<Report>(
          queryClient,
          REPORTS_PREFIX,
          id,
          () => report
        )
      }
      void queryClient.invalidateQueries({ queryKey: REPORTS_PREFIX })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

/**
 * Permanently delete a report record (DELETE /reports/:id). No soft-delete
 * or undo on the backend — removal is immediate. The row is dropped from the
 * cached page locally and the queue is invalidated (§5.6).
 */
export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ status: string; message: string }>(`/reports/${id}`),
    onSuccess: (_res, id) => {
      removeAdminListItem(queryClient, REPORTS_PREFIX, id)
      toast.success("Report deleted")
      void queryClient.invalidateQueries({ queryKey: REPORTS_PREFIX })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicUser["status"] }) =>
      apiPatch<ApiResponse<{ user: PublicUser }>>(
        `/admin/users/${id}/status`,
        { status }
      ),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_USERS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, ADMIN_USERS_PREFIX)
      updateAdminListItem<PublicUser>(
        queryClient,
        ADMIN_USERS_PREFIX,
        id,
        (u) => ({ ...u, status })
      )
      return snapshot
    },
    onError: (error, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() })
    },
  })
}

/**
 * Change a user's role (PATCH /admin/users/:id/role). The role is the only
 * field that changes, so the row is patched in-place on the currently-cached
 * page rather than invalidating the whole list (spec §3.1). Self-role-change
 * is blocked server-side; the UI additionally disables the control on the
 * admin's own row (§4.2, §7 rule 2).
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: PublicUser["role"] }) =>
      apiPatch<ApiResponse<{ user: PublicUser }>>(
        `/admin/users/${id}/role`,
        { role }
      ),
    onMutate: async ({ id, role }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_USERS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, ADMIN_USERS_PREFIX)
      updateAdminListItem<PublicUser>(
        queryClient,
        ADMIN_USERS_PREFIX,
        id,
        (u) => ({ ...u, role })
      )
      return snapshot
    },
    onError: (error, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
      toast.error(getErrorMessage(error))
    },
  })
}

export function useTogglePostStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Post["status"] }) =>
      apiPatch<ApiResponse<{ post: Post }>>(`/posts/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_POSTS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, ADMIN_POSTS_PREFIX)
      updateAdminListItem<Post>(queryClient, ADMIN_POSTS_PREFIX, id, (p) => ({
        ...p,
        status,
      }))
      return snapshot
    },
    onSuccess: (_res, { status }) => {
      toast.success(`Post marked as ${status}`)
      void queryClient.invalidateQueries({ queryKey: ADMIN_POSTS_PREFIX })
    },
    onError: (error, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

const DEL_TABLE_KEY: Record<string, readonly string[]> = {
  posts: queryKeyPrefixes.adminPosts,
  reports: queryKeyPrefixes.reports,
  payments: queryKeyPrefixes.adminPayments,
  notifications: queryKeyPrefixes.notificationsList,
  conversations: queryKeyPrefixes.adminConversations,
  categories: queryKeyPrefixes.categories,
  uploads: queryKeyPrefixes.adminUploads,
  "audit-logs": queryKeyPrefixes.adminAuditLogs,
}

export function useDelRow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) =>
      apiDelete<{ ok: true }>(`/${table}/${id}`),
    onSuccess: (_data, { table, id }) => {
      const keyPrefix = DEL_TABLE_KEY[table] ?? [table]
      removeAdminListItem(queryClient, keyPrefix, id)
      toast.success(`Deleted row ${id.slice(0, 8)}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPatch<{ ok: true }>("/notifications/read-all"),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_PREFIX })
      const key = queryKeys.notifications.all()
      const snapshot = queryClient.getQueryData<AppNotification[]>(key)
      queryClient.setQueryData<AppNotification[]>(
        key,
        (old) => old?.map((n) => ({ ...n, read: true })) ?? []
      )
      return snapshot
    },
    onError: (error, _v, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData<AppNotification[]>(
          queryKeys.notifications.all(),
          snapshot
        )
      }
      toast.error(getErrorMessage(error))
    },
  })
}

export function useAddCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name }: { name: string }) =>
      apiPost<{ id: string }>("/categories", { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ ok: true }>(`/notifications/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ ok: true }>(`/admin/conversations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.conversations(),
      })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: true }>(`/comments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

