import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { Payment, PaymentIntent } from "@/types"

export function usePaymentLedger() {
  return useQuery({
    queryKey: ["payments", "me"],
    queryFn: ({ signal }) => apiGet<Payment[]>("/payments/me", { signal }),
  })
}

export function usePaymentIntent(intentId: string) {
  return useQuery({
    queryKey: ["payments", "intent", intentId],
    queryFn: ({ signal }) =>
      apiGet<PaymentIntent>(`/payments/${intentId}`, { signal }),
    enabled: !!intentId,
  })
}
