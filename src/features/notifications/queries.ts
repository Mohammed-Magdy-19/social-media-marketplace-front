import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { AppNotification } from "@/types"

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) =>
      apiGet<AppNotification[]>("/notifications", { signal }),
    staleTime: 15_000,
  })
}
