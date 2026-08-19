import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet, refreshAccessToken } from "@/lib/api/client"
import { hasSessionHint } from "@/lib/session-hint"
import { getStoredRefreshToken } from "@/lib/refresh-storage"
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
  const setStatus = useAuthStore((s) => s.setStatus)
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    if (useAuthStore.getState().status !== "idle") return

    // Gate the restore attempt on any signal that a session may exist: the
    // readable `hasSession` cookie (top-level origins) OR the localStorage
    // refresh-token fallback (cross-site preview iframes, where SameSite=Strict
    // cookies are never stored). Absent both, skip the guaranteed 401s.
    if (!hasSessionHint() && !getStoredRefreshToken()) {
      setStatus("unauthenticated")
      return
    }

    setStatus("authenticating")

    apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me")
      .then((res) => {
        const store = useAuthStore.getState()
        setSession(res.data.user, store.accessToken ?? "")
      })
      .catch(async () => {
        try {
          await refreshAccessToken()
          const me = await apiGet<ApiResponse<{ user: PublicUser }>>("/auth/me")
          setSession(me.data.user, useAuthStore.getState().accessToken ?? "")
        } catch {
          setStatus("unauthenticated")
        }
      })
  }, [setStatus, setSession])
}
