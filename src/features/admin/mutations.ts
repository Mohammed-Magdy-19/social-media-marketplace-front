import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client"
import { toast } from "sonner"
import {
  removeAdminListItem,
  restoreAdminLists,
  snapshotAdminLists,
  updateAdminListItem,
} from "./adminCache"
import { queryKeys, queryKeyPrefixes } from "@/api/queryKeys"
import type { AppNotification, Post, PublicUser, Report } from "@/types"

const REPORTS_PREFIX = queryKeyPrefixes.reports
const ADMIN_USERS_PREFIX = queryKeyPrefixes.adminUsers
const ADMIN_POSTS_PREFIX = queryKeyPrefixes.adminPosts
const NOTIFICATIONS_PREFIX = queryKeyPrefixes.notificationsList

export function useResolveReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<Report>(`/reports/${id}`, { status: "resolved" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: REPORTS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, REPORTS_PREFIX)
      updateAdminListItem<Report>(queryClient, REPORTS_PREFIX, id, (r) => ({
        ...r,
        status: "resolved",
      }))
      return snapshot
    },
    onError: (_e, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() })
    },
  })
}

export function useDismissReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<Report>(`/reports/${id}`, { status: "dismissed" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: REPORTS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, REPORTS_PREFIX)
      updateAdminListItem<Report>(queryClient, REPORTS_PREFIX, id, (r) => ({
        ...r,
        status: "dismissed",
      }))
      return snapshot
    },
    onError: (_e, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() })
    },
  })
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicUser["status"] }) =>
      apiPatch<PublicUser>(`/admin/users/${id}/status`, { status }),
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
    onError: (_e, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() })
    },
  })
}

export function useTogglePostStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Post["status"] }) =>
      apiPatch<Post>(`/posts/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_POSTS_PREFIX })
      const snapshot = snapshotAdminLists(queryClient, ADMIN_POSTS_PREFIX)
      updateAdminListItem<Post>(queryClient, ADMIN_POSTS_PREFIX, id, (p) => ({
        ...p,
        status,
      }))
      return snapshot
    },
    onError: (_e, _v, snapshot) => {
      if (snapshot) restoreAdminLists(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

const DEL_TABLE_KEY: Record<string, readonly string[]> = {
  posts: queryKeyPrefixes.adminPosts,
  users: queryKeyPrefixes.adminUsers,
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
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<{ ok: true }>("/notifications/read-all"),
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
    onError: (_e, _v, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData<AppNotification[]>(
          queryKeys.notifications.all(),
          snapshot
        )
      }
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
