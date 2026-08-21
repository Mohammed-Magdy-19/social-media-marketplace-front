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
      return res.data?.user ?? null
    },
    enabled: Boolean(userId),
  })
}

export function useUserFollowers(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.followers(userId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<any>(`/users/${userId}/followers`, { signal })
      const rawList: any[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.followers)
        ? res.data.followers
        : []
      const followers: PublicUser[] = rawList
        .map((item: any) => {
          if (!item) return null
          const u = item.follower && typeof item.follower === "object" ? item.follower : item
          const id = String(u.id || u._id || "")
          if (!id) return null
          return {
            id,
            name: u.name || u.username || "User",
            username: u.username || "user",
            email: u.email || "",
            avatar: u.avatar || null,
            role: u.role || "user",
            status: u.status || "active",
            bio: u.bio || undefined,
            createdAt: u.createdAt || new Date().toISOString(),
          } as PublicUser
        })
        .filter((u): u is PublicUser => Boolean(u && u.id))
      return followers
    },
    enabled: Boolean(userId),
  })
}

export function useUserFollowing(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.following(userId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<any>(`/users/${userId}/following`, { signal })
      const rawList: any[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.following)
        ? res.data.following
        : []
      const following: PublicUser[] = rawList
        .map((item: any) => {
          if (!item) return null
          const u = item.following && typeof item.following === "object" ? item.following : item
          const id = String(u.id || u._id || "")
          if (!id) return null
          return {
            id,
            name: u.name || u.username || "User",
            username: u.username || "user",
            email: u.email || "",
            avatar: u.avatar || null,
            role: u.role || "user",
            status: u.status || "active",
            bio: u.bio || undefined,
            createdAt: u.createdAt || new Date().toISOString(),
          } as PublicUser
        })
        .filter((u): u is PublicUser => Boolean(u && u.id))
      return following
    },
    enabled: Boolean(userId),
  })
}
