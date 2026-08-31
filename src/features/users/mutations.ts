import { useMutation, useQueryClient } from "@tanstack/react-query"
import axios from "axios"
import { apiDelete, apiPost } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import { useAuthStore } from "@/stores/authStore"
import type { ApiResponse, PublicUser } from "@/types"

export function useFollowUser() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiPost<ApiResponse<{ ok: true }>>(`/users/${userId}/follow`),

    onMutate: async ({ userId }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.followers(userId),
      })
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.detail(userId),
      })

      // Snapshot previous values for rollback
      const previousFollowers = queryClient.getQueryData<PublicUser[]>(
        queryKeys.users.followers(userId)
      )
      const previousUser = queryClient.getQueryData(
        queryKeys.users.detail(userId)
      )

      // Optimistically add current user to followers list
      if (currentUser) {
        queryClient.setQueryData<PublicUser[]>(
          queryKeys.users.followers(userId),
          (old) => (old ? [currentUser, ...old] : [currentUser])
        )
      }

      // Optimistically update follower count on the user detail
      queryClient.setQueryData(
        queryKeys.users.detail(userId),
        (old: Record<string, unknown> | undefined) =>
          old
            ? {
                ...old,
                followerCount:
                  ((old.followerCount as number | undefined) ?? 0) + 1,
              }
            : old
      )

      return { previousFollowers, previousUser }
    },

    onSuccess: (_data, { userId }) => {
      toast.success("Followed user")
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.followers(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.feed(),
      })
    },

    onError: (error: unknown, { userId }, context) => {
      // Rollback optimistic update
      if (context?.previousFollowers !== undefined) {
        queryClient.setQueryData(
          queryKeys.users.followers(userId),
          context.previousFollowers
        )
      }
      if (context?.previousUser !== undefined) {
        queryClient.setQueryData(
          queryKeys.users.detail(userId),
          context.previousUser
        )
      }

      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Already following — synchronize state
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.detail(userId),
        })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.followers(userId),
        })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.feed(),
        })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })
}

export function useUnfollowUser() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiDelete<ApiResponse<{ ok: true }>>(`/users/${userId}/follow`),

    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.followers(userId),
      })
      await queryClient.cancelQueries({
        queryKey: queryKeys.users.detail(userId),
      })

      const previousFollowers = queryClient.getQueryData<PublicUser[]>(
        queryKeys.users.followers(userId)
      )
      const previousUser = queryClient.getQueryData(
        queryKeys.users.detail(userId)
      )

      // Optimistically remove current user from followers list
      if (currentUser) {
        queryClient.setQueryData<PublicUser[]>(
          queryKeys.users.followers(userId),
          (old) =>
            old
              ? old.filter(
                  (f) =>
                    f.id !== currentUser.id &&
                    (f as unknown as { _id?: string })._id !== currentUser.id
                )
              : []
        )
      }

      // Optimistically update follower count on the user detail
      queryClient.setQueryData(
        queryKeys.users.detail(userId),
        (old: Record<string, unknown> | undefined) =>
          old
            ? {
                ...old,
                followerCount: Math.max(
                  0,
                  ((old.followerCount as number | undefined) ?? 1) - 1
                ),
              }
            : old
      )

      return { previousFollowers, previousUser }
    },

    onSuccess: (_data, { userId }) => {
      toast.success("Unfollowed user")
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.detail(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.followers(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.feed(),
      })
    },

    onError: (error: unknown, { userId }, context) => {
      // Rollback optimistic update
      if (context?.previousFollowers !== undefined) {
        queryClient.setQueryData(
          queryKeys.users.followers(userId),
          context.previousFollowers
        )
      }
      if (context?.previousUser !== undefined) {
        queryClient.setQueryData(
          queryKeys.users.detail(userId),
          context.previousUser
        )
      }

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Not following — synchronize state
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.detail(userId),
        })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.followers(userId),
        })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.users.feed(),
        })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })
}
