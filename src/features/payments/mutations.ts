import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { router } from "@/router"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { queryKeyPrefixes } from "@/api/queryKeys"
import { createPaymentIntentSchema } from "@/features/payments/schemas"
import type {
  ApiResponse,
  CreatePaymentIntentResponse,
  Payment,
} from "@/types"

type CreatePaymentIntentVariables = {
  amount: number
  currency?: string
  postId?: string
}

/**
 * Creates a Stripe PaymentIntent + a `pending` Payment row. This is the only
 * mutation that sends money-shaped input to our backend — everything after
 * this point happens between the browser and Stripe until the webhook lands.
 */
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async ({
      amount,
      currency,
      postId,
    }: CreatePaymentIntentVariables) => {
      const input = createPaymentIntentSchema.parse({ amount, currency, postId })
      const res = await apiPost<ApiResponse<CreatePaymentIntentResponse>>(
        "/payments/create-intent",
        input
      )
      return { payment: res.data, input }
    },
    onSuccess: ({ payment, input }) => {
      useCheckoutStore.getState().setIntent({
        paymentId: payment.paymentId,
        clientSecret: payment.clientSecret,
        amount: input.amount,
        currency: input.currency ?? "USD",
        postId: input.postId,
      })
      void router.navigate(`/checkout/${payment.paymentId}`)
    },
  })
}

/**
 * Admin-only refund. The backend rejects anything but a `completed` payment
 * (400 "Only completed payments can be refunded"), so the UI must only surface
 * this action for completed rows and rely on the server's 403/400 otherwise.
 */
export function useRefundPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiPost<ApiResponse<{ payment: Payment }>>(
        `/payments/${paymentId}/refund`
      ),
    onSuccess: () => {
      toast.success("Payment refunded")
      void queryClient.invalidateQueries({
        queryKey: queryKeyPrefixes.adminPayments,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeyPrefixes.paymentsMe,
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
