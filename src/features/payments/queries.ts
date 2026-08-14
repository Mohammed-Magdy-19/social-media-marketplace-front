import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type { Payment } from "@/types"

export function usePaymentLedger() {
  return useQuery({
    queryKey: ["payments", "me"],
    queryFn: ({ signal }) => apiGet<Payment[]>("/payments/me", { signal }),
  })
}
