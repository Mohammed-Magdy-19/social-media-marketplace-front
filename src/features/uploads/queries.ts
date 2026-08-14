import { useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { CursorPage, Upload } from "@/types"

export interface UploadFilters {
  kind?: string
  owner?: string
  search?: string
}

export function useUploads(filters: UploadFilters = {}) {
  return useQuery({
    queryKey: ["uploads", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Upload>>("/uploads", {
        params: {
          kind: filters.kind ?? undefined,
          owner: filters.owner ?? undefined,
          search: filters.search ?? undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}
