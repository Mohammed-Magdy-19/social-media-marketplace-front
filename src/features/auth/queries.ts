import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet, refreshAccessToken } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PublicUser } from "@/types"

export function useCurrentUser() {
  const hasToken = useAuthStore((s) => !!s.accessToken)
  const result = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: ({ signal }) =>
      apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me", {
        signal,
      }).then((res) => res.data.user),
    enabled: hasToken,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  useEffect(() => {
    if (result.data) {
      useAuthStore.getState().setUser(result.data)
    }
  }, [result.data])

  return result
}

export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status)
  return useQuery({
    queryKey: queryKeys.auth.bootstrap(),
    queryFn: async ({ signal }) => {
      if (!useAuthStore.getState().accessToken) {
        await refreshAccessToken()
      }
      const res = await apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me", {
        signal,
      })
      return res.data.user
    },
    enabled: status === "idle",
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
