import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPost } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import type { ApiResponse } from "@/types"

export function useFollowUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiPost<ApiResponse<{ ok: true }>>(`/users/${userId}/follow`),
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
    onError: (error: any, { userId }) => {
      if (error?.response?.status === 409) {
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
  return useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      apiDelete<ApiResponse<{ ok: true }>>(`/users/${userId}/follow`),
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
    onError: (error: any, { userId }) => {
      if (error?.response?.status === 404) {
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
