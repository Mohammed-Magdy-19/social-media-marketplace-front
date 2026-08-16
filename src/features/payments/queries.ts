import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  ApiResponse,
  PaginatedResponse,
  Payment,
} from "@/types"

/**
 * The current user's own purchase history (offset-paginated). The server
 * returns `limit + 1` rows as a "has more" signal (PaginatedResponse).
 */
export function useMyPayments(page = 1) {
  return useQuery({
    queryKey: queryKeys.payments.my(page),
    queryFn: async ({ signal }) => {
      const res = await apiGet<PaginatedResponse<Payment>>("/payments/me", {
        params: { page },
        signal,
      })
      return res.data
    },
    placeholderData: keepPreviousData,
  })
}

/**
 * Single payment detail, participant/admin-scoped server-side. While the
 * payment is still `pending` we poll every 2.5s as a backstop to the
 * `payment_updated` socket event; polling stops once status leaves `pending`.
 */
export function usePayment(paymentId: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(paymentId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ payment: Payment }>>(
        `/payments/${paymentId}`,
        { signal }
      )
      return res.data.payment
    },
    enabled: !!paymentId,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2500 : false,
  })
}
