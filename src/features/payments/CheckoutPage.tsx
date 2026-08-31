import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout"
import { toast } from "sonner"
import { CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react"
import { stripePromise } from "@/lib/stripe-client"
import { useCheckoutStore } from "@/stores/checkoutStore"
import { useAuthStore } from "@/stores/authStore"
import { useMyPayments, usePayment } from "@/features/payments/queries"
import { checkoutSchema, type CheckoutValues } from "@/features/payments/schemas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatCurrency } from "@/lib/utils"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import type { PaymentStatus } from "@/types"

const STATUS_BADGE: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-500" },
  completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-500" },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-500" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground" },
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const badge = STATUS_BADGE[status]
  return (
    <Badge variant="outline" className={cn("border-transparent", badge.className)}>
      {badge.label}
    </Badge>
  )
}

function PaymentHistory() {
  const { data } = useMyPayments()
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payments yet.</p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
        >
          <div className="flex flex-col">
            <span className="font-mono text-xs text-muted-foreground">
              {p.id.slice(0, 12)}…
            </span>
            <span className="text-sm font-medium">
              {formatCurrency(p.amount / 100, p.currency)}
            </span>
          </div>
          <PaymentStatusBadge status={p.status} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Inner Stripe Checkout Elements form.
 * Uses Stripe's modern Checkout Sessions Elements API (checkout.confirm()).
 */
function CheckoutForm({
  onConfirmed,
  submitting,
}: {
  onConfirmed: () => void
  submitting: boolean
}) {
  const checkoutResult = useCheckoutElements()
  const [isElementReady, setIsElementReady] = useState(false)
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const currentUser = useAuthStore((s) => s.user)

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      phoneNumber: currentUser?.phoneNumber || "",
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      termsAccepted: false as never,
    },
  })

  // Sync phone number if user session loads asynchronously
  useEffect(() => {
    if (currentUser?.phoneNumber && !form.getValues("phoneNumber")) {
      form.setValue("phoneNumber", currentUser.phoneNumber)
    }
  }, [currentUser?.phoneNumber, form])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isElementReady) setLoadTimedOut(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [isElementReady])

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.")
      return
    }

    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          )
          if (!response.ok) throw new Error("Could not reverse geocode location")
          const data = await response.json()
          const addr = data.address || {}

          const road = addr.road || addr.pedestrian || addr.street || ""
          const houseNumber = addr.house_number || ""
          const street = [houseNumber, road].filter(Boolean).join(" ") || data.display_name?.split(",")[0] || ""
          const city = addr.city || addr.town || addr.village || addr.suburb || ""
          const state = addr.state || addr.province || addr.region || ""
          const postalCode = addr.postcode || addr.postal_code || ""
          const country = addr.country || ""

          if (street) form.setValue("street", street, { shouldValidate: true })
          if (city) form.setValue("city", city, { shouldValidate: true })
          if (state) form.setValue("state", state, { shouldValidate: true })
          if (postalCode) form.setValue("postalCode", postalCode, { shouldValidate: true })
          if (country) form.setValue("country", country, { shouldValidate: true })

          toast.success("Location auto-detected successfully! Please review details below.")
        } catch {
          toast.error("Could not fetch address from coordinates. Please enter manually.")
        } finally {
          setDetectingLocation(false)
        }
      },
      (error) => {
        setDetectingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location access denied. You can enter your address manually.")
        } else {
          toast.error("Unable to retrieve location. Please enter manually.")
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const handlePay = form.handleSubmit(async () => {
    if (checkoutResult.type !== "success") return
    if (!isElementReady) {
      toast.error(
        "Payment form is still loading or could not connect to Stripe. Please verify your Stripe publishable key."
      )
      return
    }
    try {
      const result = await checkoutResult.checkout.confirm()
      if (result.type === "error") {
        toast.error(result.error.message ?? "Payment could not be confirmed.")
        return
      }
      // Stripe accepted the confirmation attempt — the webhook is the source of
      // truth for the final status, so move to the "confirming" state.
      onConfirmed()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment processing error"
      toast.error(message)
    }
  })

  return (
    <Form {...form}>
      <form id="checkout-form" onSubmit={handlePay} className="flex flex-col gap-5">
        {/* Contact & Delivery Address Section */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-sm font-semibold">Delivery & Contact Details</h3>
              <p className="text-xs text-muted-foreground">Required for verified marketplace transaction records</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={detectingLocation}
              onClick={handleDetectLocation}
              className="h-8 gap-1.5 rounded-full text-xs font-medium"
            >
              {detectingLocation ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Detecting…</span>
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  <span>Detect My Location</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem className="grid gap-1">
                  <FormLabel className="text-xs font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      autoComplete="tel"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="grid gap-1">
                  <FormLabel className="text-xs font-medium">
                    Street Address <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="123 Market Street, Apt 4B"
                      autoComplete="street-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-medium">
                      City <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="San Francisco"
                        autoComplete="address-level2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-medium">
                      State / Province <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="California"
                        autoComplete="address-level1"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-medium">
                      ZIP / Postal Code <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="94103"
                        autoComplete="postal-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-medium">
                      Country <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="United States"
                        autoComplete="country-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Stripe Payment Element */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <h3 className="mb-3 text-sm font-semibold">Payment Method</h3>
          <PaymentElement
            onReady={() => {
              setIsElementReady(true)
              setLoadTimedOut(false)
            }}
            onLoaderStart={() => setIsElementReady(false)}
          />
        </div>

        {loadTimedOut && !isElementReady && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 flex flex-col gap-2">
            <p className="font-semibold text-sm">Stripe payment form is loading or session needs a refresh</p>
            <p className="opacity-90 leading-relaxed">
              If you just updated your Stripe API key, please hard-refresh the page (<kbd className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono">Ctrl + Shift + R</kbd>) or restart a new checkout session.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full text-xs bg-card"
                onClick={() => {
                  useCheckoutStore.getState().clear()
                  window.location.reload()
                }}
              >
                Reload with New Key
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full text-xs"
                render={<Link to="/messages" />}
              >
                Back to Messages
              </Button>
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="termsAccepted"
          render={({ field }) => (
            <FormItem className="flex items-start gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              </FormControl>
              <div className="flex flex-col gap-1">
                <FormLabel className="font-normal leading-snug text-xs text-muted-foreground">
                  I accept the NexMarket terms of service and escrow agreement.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="submit"
            form="checkout-form"
            disabled={checkoutResult.type !== "success" || !isElementReady || submitting || form.formState.isSubmitting}
            className="rounded-full px-6 font-semibold shadow-xs"
          >
            {form.formState.isSubmitting ? "Processing…" : "Confirm payment"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function OrderSummary({
  amount,
  currency,
  paymentId,
}: {
  amount: number
  currency: string
  paymentId: string
}) {
  return (
    <Card className="rounded-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Payment</p>
            <p className="font-mono text-xs text-muted-foreground">
              {paymentId.slice(0, 12)}…
            </p>
          </div>
          <span className="font-mono text-lg font-semibold">
            {formatCurrency(amount / 100, currency)}
          </span>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(amount / 100, currency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Processing fee</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total</span>
            <span className="font-mono">
              {formatCurrency(amount / 100, currency)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CheckoutPage() {
  const { intentId } = useParams<{ intentId: string }>()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const isSpecialRoute = intentId === "success" || intentId === "cancel"
  const paymentId = (!isSpecialRoute && intentId ? intentId : sessionId) || sessionId || ""
  const intent = useCheckoutStore((s) => s.intent)

  const [submitted, setSubmitted] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [stripeStatus, setStripeStatus] = useState<string | null>(null)

  const { data: payment, isLoading, refetch: refetchPayment } = usePayment(paymentId)

  const redirectClientSecret = searchParams.get("payment_intent_client_secret")
  const hasRedirectBack = !!redirectClientSecret || !!sessionId || isSpecialRoute
  const clientSecret = redirectClientSecret ?? intent?.clientSecret ?? payment?.clientSecret ?? null
  const amount = intent?.amount ?? payment?.amount ?? 0
  const currency = intent?.currency ?? payment?.currency ?? "USD"

  const isConfirmed = submitted || hasRedirectBack

  // Clear the short-lived intent once the payment reaches a terminal state so
  // a stale clientSecret is never reused for a new attempt.
  useEffect(() => {
    if (
      payment?.status === "completed" ||
      payment?.status === "failed" ||
      payment?.status === "refunded"
    ) {
      useCheckoutStore.getState().clear()
    }
  }, [payment?.status])

  // Backstop: stop the spinner after 60s and show a "still processing" state
  // rather than spinning forever if the socket/poll never resolves.
  useEffect(() => {
    if (!isConfirmed || payment?.status !== "pending") return
    const t = setTimeout(() => setTimedOut(true), 60_000)
    return () => clearTimeout(t)
  }, [isConfirmed, payment?.status])

  // Redirect-back reconciliation (§4.3): read Stripe's own status for display
  // only — the final UI decision always comes from our backend's Payment.status.
  useEffect(() => {
    if (!redirectClientSecret || !stripePromise) return
    let cancelled = false
    void stripePromise.then((stripe) =>
      stripe
        ?.retrievePaymentIntent(redirectClientSecret)
        .then(({ paymentIntent }) => {
          if (!cancelled && paymentIntent) setStripeStatus(paymentIntent.status)
        })
        .catch(() => undefined)
    )
    return () => {
      cancelled = true
    }
  }, [redirectClientSecret])

  if (isLoading && !payment) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    )
  }

  // Terminal success / failure states — sourced only from backend Payment.status.
  if (payment?.status === "completed") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Card className="rounded-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
              Payment completed
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(amount / 100, currency)} charged to your card.
              A receipt has been emailed to you.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" render={<Link to="/messages" />}>
                View messages
              </Button>
              <Button size="sm" render={<Link to="/market" />}>
                Keep shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (payment?.status === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Card className="rounded-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <XCircle className="size-10 text-red-500" />
            <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
              Payment failed
            </h1>
            <p className="text-sm text-muted-foreground">
              Your payment could not be processed. No charge was made. Please
              try again or use a different payment method.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" render={<Link to="/market" />}>
                Back to market
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
          Checkout
        </h1>
        <p className="text-sm text-muted-foreground">
          Confirm your payment details.
        </p>
      </div>

      {payment && <PaymentStatusBadge status={payment.status} />}

      <ErrorBoundary fallback={<SectionFallback />}>
        <OrderSummary amount={amount} currency={currency} paymentId={paymentId} />
      </ErrorBoundary>

      <ErrorBoundary fallback={<SectionFallback />}>
        {isConfirmed && payment?.status === "pending" && !timedOut ? (
          <Card className="rounded-card">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <Loader2 className="size-8 animate-spin text-brand" />
              <p className="text-sm font-medium">Confirming your payment…</p>
              <p className="text-xs text-muted-foreground">
                {stripeStatus ? `Stripe status: ${stripeStatus}` : "This usually takes a few seconds."}
              </p>
            </CardContent>
          </Card>
        ) : isConfirmed && payment?.status === "pending" ? (
          <Card className="rounded-card">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                Your payment is still processing.
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                It may take a little longer than usual. We&apos;ll email you once
                it completes — no need to keep this page open.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchPayment()}
                  className="rounded-full text-xs"
                >
                  Check status again
                </Button>
                <Button
                  size="sm"
                  render={<Link to="/messages" />}
                  className="rounded-full text-xs"
                >
                  Back to messages
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !clientSecret ? (
          <Card className="rounded-card">
            <CardContent className="flex flex-col gap-2 p-8 text-center">
              <p className="text-sm font-medium">
                This checkout session has expired.
              </p>
              <p className="text-xs text-muted-foreground">
                Return to the listing to start a new checkout.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" render={<Link to="/market" />}>
                  Back to market
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : stripePromise == null ? (
          <Card className="rounded-card">
            <CardContent className="flex flex-col gap-2 p-8 text-center">
              <p className="text-sm font-medium">Payments are unavailable.</p>
              <p className="text-xs text-muted-foreground">
                Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY to
                enable card payments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-card">
            <CardContent className="flex flex-col gap-4 p-6">
              <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  submitting={submitted}
                  onConfirmed={() => setSubmitted(true)}
                />
              </CheckoutElementsProvider>
            </CardContent>
          </Card>
        )}
      </ErrorBoundary>

      <Card className="rounded-card">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="font-display text-base font-bold">Payment history</p>
          <ErrorBoundary fallback={<SectionFallback />}>
            <PaymentHistory />
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  )
}
