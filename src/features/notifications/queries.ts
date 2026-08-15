import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { AppNotification, PaginatedResponse } from "@/types"

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<PaginatedResponse<AppNotification>>(
        "/notifications",
        { signal }
      )
      return res.data
    },
    staleTime: 15_000,
  })
}
