import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import type { PublicUser } from "@/types"

export function useCurrentUser() {
  const hasToken = useAuthStore((s) => !!s.accessToken)
  const result = useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => apiGet<PublicUser>("/auth/me", { signal }),
    enabled: hasToken,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  })

  useEffect(() => {
    if (result.data) {
      useAuthStore.getState().setUser(result.data)
    }
  }, [result.data])

  return result
}
