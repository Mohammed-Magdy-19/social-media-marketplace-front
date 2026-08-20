import { loadStripe } from "@stripe/stripe-js"

/**
 * Stripe.js singleton — created once at module scope, never inside a render
 * (payments spec §7). Card data only ever lives inside Stripe's hosted iframe
 * mounted via <Elements> / <PaymentElement>; it never touches our backend.
 */
const PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
  "pk_test_51U0PwuE9hM5oYTwwbKCSryayWuAleKWKxhvbVql4PobiyblYYV5W0GoNqldpeihOgq6rS49WCF2iPJ3OMek2nE4Z00xuM9kdMg"

export const stripePromise = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : null

