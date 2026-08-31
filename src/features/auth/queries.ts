import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet, refreshAccessToken } from "@/lib/api/client"
import { hasSessionHint } from "@/lib/session-hint"
import { getStoredRefreshToken } from "@/lib/refresh-storage"
import { useAuthStore } from "@/stores/authStore"
import { queryClient } from "@/lib/queryClient"
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
  const setStatus = useAuthStore((s) => s.setStatus)
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    const state = useAuthStore.getState()

    // If we already have a valid accessToken and user in store from localStorage, mark authenticated
    if (state.accessToken && state.user) {
      setStatus("authenticated")
      // Validate session with /auth/me in background
      apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me")
        .then((me) => {
          queryClient.setQueryData(queryKeys.auth.me(), me.data.user)
          useAuthStore.getState().setUser(me.data.user)
        })
        .catch(() => {
          // If token expired, attempt refresh
          refreshAccessToken()
            .then((token) => {
              return apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me").then((me) => {
                queryClient.setQueryData(queryKeys.auth.me(), me.data.user)
                setSession(me.data.user, token)
              })
            })
            .catch(() => {
              useAuthStore.getState().clear()
            })
        })
      return
    }

    if (!hasSessionHint() && !getStoredRefreshToken() && !state.accessToken) {
      setStatus("unauthenticated")
      return
    }

    setStatus("authenticating")

    const restoreSession = async () => {
      try {
        let token = useAuthStore.getState().accessToken
        if (!token) {
          token = await refreshAccessToken()
        }
        const me = await apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me")
        queryClient.setQueryData(queryKeys.auth.me(), me.data.user)
        setSession(me.data.user, token)
      } catch {
        useAuthStore.getState().clear()
      }
    }

    void restoreSession()
  }, [setStatus, setSession])
}
