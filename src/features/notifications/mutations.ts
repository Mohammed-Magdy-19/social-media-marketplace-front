import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiDelete, apiPatch } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import { getErrorMessage } from "@/lib/api/errors"
import type { AppNotification } from "@/types"

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiPatch<{ status: string; data: { notification: unknown } }>(
        `/notifications/${id}/read`
      ),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() })
      const key = queryKeys.notifications.all()
      const previous = queryClient.getQueryData<AppNotification[]>(key)

      queryClient.setQueryData<AppNotification[]>(key, (old) =>
        old?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? []
      )

      queryClient.setQueryData<{ count: number }>(
        queryKeys.notifications.unreadCount(),
        (old) => ({ count: Math.max(0, (old?.count ?? 1) - 1) })
      )

      return { previous }
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications.all(), context.previous)
      }
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiPatch<{ status: string; data: { modifiedCount: number } }>(
        "/notifications/read-all"
      ),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() })
      const key = queryKeys.notifications.all()
      const previous = queryClient.getQueryData<AppNotification[]>(key)

      queryClient.setQueryData<AppNotification[]>(key, (old) =>
        old?.map((n) => ({ ...n, read: true })) ?? []
      )

      queryClient.setQueryData<{ count: number }>(
        queryKeys.notifications.unreadCount(),
        { count: 0 }
      )

      return { previous }
    },
    onSuccess: () => {
      toast.success("All notifications marked as read")
    },
    onError: (error, _v, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications.all(), context.previous)
      }
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ status: string; data: null }>(`/notifications/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() })
      const key = queryKeys.notifications.all()
      const previous = queryClient.getQueryData<AppNotification[]>(key)

      const target = previous?.find((n) => n.id === id)
      queryClient.setQueryData<AppNotification[]>(key, (old) =>
        old?.filter((n) => n.id !== id) ?? []
      )

      if (target && !target.read) {
        queryClient.setQueryData<{ count: number }>(
          queryKeys.notifications.unreadCount(),
          (old) => ({ count: Math.max(0, (old?.count ?? 1) - 1) })
        )
      }

      return { previous }
    },
    onSuccess: () => {
      toast.success("Notification removed")
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications.all(), context.previous)
      }
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    },
  })
}
