import { useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { PaginatedResponse, Upload } from "@/types"

export interface UploadFilters {
  kind?: string
  owner?: string
  search?: string
}

export function useUploads(filters: UploadFilters = {}) {
  return useQuery({
    queryKey: queryKeys.uploads.all(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Upload>>("/uploads", {
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
