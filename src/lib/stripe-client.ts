import { loadStripe } from "@stripe/stripe-js"

/**
 * Stripe.js singleton — created once at module scope, never inside a render
 * (payments spec §7). Card data only ever lives inside Stripe's hosted iframe
 * mounted via <Elements> / <PaymentElement>; it never touches our backend.
 */
const PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
  "pk_test_51U0PwuE9hM5oYTwwZZKOZ0XV5kAUHqCYDs4QfsX4IGYf5Wlujq6bFRGY32c5OiOcBVbk0PufpWYBU8h2qJcrvXC800CWB55vvM"

export const stripePromise = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : null

