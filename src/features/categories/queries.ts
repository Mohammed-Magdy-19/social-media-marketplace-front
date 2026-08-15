import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, Category } from "@/types"

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ categories: Category[] }>>(
        "/categories",
        { signal }
      )
      return res.data.categories
    },
    staleTime: 5 * 60_000,
  })
}
