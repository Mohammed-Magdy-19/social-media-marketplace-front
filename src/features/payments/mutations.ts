import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { router } from "@/router"
import type { PaymentIntent } from "@/types"

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: ({
      postId,
      amount,
      currency,
    }: {
      postId: string
      amount: number
      currency: string
    }) =>
      apiPost<PaymentIntent>("/payments/create-intent", {
        postId,
        amount,
        currency,
      }),
    onSuccess: (data) => {
      void router.navigate(`/checkout/${data.id}`)
    },
  })
}

export function useConfirmPayment() {
  return useMutation({
    mutationFn: ({ intentId }: { intentId: string }) =>
      apiPost<{ status: string }>(`/payments/${intentId}/confirm`),
  })
}
