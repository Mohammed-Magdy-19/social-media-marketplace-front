import { create } from "zustand"

export interface CheckoutIntent {
  paymentId: string
  clientSecret: string
  amount: number
  currency: string
  postId?: string
}

interface CheckoutState {
  intent: CheckoutIntent | null
  setIntent: (intent: CheckoutIntent) => void
  clear: () => void
}

/**
 * Short-lived in-progress checkout state (payments spec §7). Populated by
 * useCreatePaymentIntent before navigating to /checkout/:paymentId and cleared
 * on completion or on leaving the flow. Never persisted across sessions — a
 * stale clientSecret must not be reused for a new attempt.
 */
export const useCheckoutStore = create<CheckoutState>()((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
  clear: () => set({ intent: null }),
}))
