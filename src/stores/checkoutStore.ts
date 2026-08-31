import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

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
 * on completion or on leaving the flow. Persisted in sessionStorage across page
 * reloads within the same browser tab session.
 */
export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      intent: null,
      setIntent: (intent) => set({ intent }),
      clear: () => set({ intent: null }),
    }),
    {
      name: "vendo-checkout-session",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
