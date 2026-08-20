import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PublicUser } from "@/types"

export interface UserProfile extends PublicUser {
  followerCount?: number
  followingCount?: number
}

export function usePublicUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ user: UserProfile }>>(
        `/users/${userId}`,
        { signal }
      )
      return res.data.user
    },
    enabled: Boolean(userId),
  })
}

export function useUserFollowers(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.followers(userId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ followers: PublicUser[] }>>(
        `/users/${userId}/followers`,
        { signal }
      )
      return res.data.followers ?? []
    },
    enabled: Boolean(userId),
  })
}

export function useUserFollowing(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.following(userId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ following: PublicUser[] }>>(
        `/users/${userId}/following`,
        { signal }
      )
      return res.data.following ?? []
    },
    enabled: Boolean(userId),
  })
}
