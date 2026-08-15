import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PaginatedResponse, Payment, PaymentIntent } from "@/types"

export function usePaymentLedger() {
  return useQuery({
    queryKey: queryKeys.payments.my(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<PaginatedResponse<Payment>>("/payments/me", {
        signal,
      })
      return res.data
    },
  })
}

export function usePaymentIntent(intentId: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(intentId),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ payment: PaymentIntent }>>(
        `/payments/${intentId}`,
        { signal }
      )
      return res.data.payment
    },
    enabled: !!intentId,
  })
}
