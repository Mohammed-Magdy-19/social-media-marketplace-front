import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { Category } from "@/types"

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => apiGet<Category[]>("/categories", { signal }),
    staleTime: 5 * 60_000,
  })
}
