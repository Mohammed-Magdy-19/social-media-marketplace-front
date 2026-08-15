import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useParams } from "react-router-dom"
import { usePaymentIntent, usePaymentLedger } from "@/features/payments/queries"
import { useConfirmPayment } from "@/features/payments/mutations"
import { checkoutSchema } from "@/features/payments/schemas"
import type { CheckoutValues } from "@/features/payments/schemas"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { PaymentStatus } from "@/types"

function statusPill(status: PaymentStatus) {
  switch (status) {
    case "succeeded":
      return { label: "Succeeded", className: "bg-emerald-500/10 text-emerald-500" }
    case "pending":
      return { label: "Pending", className: "bg-amber-500/10 text-amber-500" }
    case "failed":
      return { label: "Failed", className: "bg-red-500/10 text-red-500" }
    case "refunded":
      return { label: "Refunded", className: "bg-muted text-muted-foreground" }
    default:
      return { label: status, className: "bg-muted text-muted-foreground" }
  }
}

function Ledger() {
  const { data, isLoading } = usePaymentLedger()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payments yet.</p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((p) => {
        const pill = statusPill(p.status)
        return (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="font-mono text-xs text-muted-foreground">
                {p.id.slice(0, 12)}…
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(p.amount, p.currency)}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn("border-transparent", pill.className)}
            >
              {pill.label}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

export default function CheckoutPage() {
  const { intentId } = useParams<{ intentId: string }>()
  const { data: intent, isLoading } = usePaymentIntent(intentId ?? "")
  const confirmPayment = useConfirmPayment()

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { termsAccepted: false as never },
  })

  if (isLoading || !intent) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Card className="rounded-card">
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
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

      <Card className="rounded-card">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <AvatarWithFallback name="NexMarket Pay" src={null} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Payment intent</p>
              <p className="font-mono text-xs text-muted-foreground">
                {intent.id.slice(0, 12)}…
              </p>
            </div>
            <span className="font-mono text-lg font-semibold">
              {formatCurrency(intent.amount, intent.currency)}
            </span>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(intent.amount, intent.currency)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Processing fee</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span className="font-mono">
                {formatCurrency(intent.amount, intent.currency)}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-mono break-all">client_secret: {intent.clientSecret}</p>
            <p>
              Funds are held in escrow until the seller confirms delivery.
            </p>
          </div>

          <Form {...form}>
            <form
              id="checkout-form"
              onSubmit={form.handleSubmit(() => {
                confirmPayment.mutate(
                  { intentId: intent.id },
                  {
                    onSuccess: () => {
                      form.reset({ termsAccepted: false as never })
                    },
                    onError: () => {
                      form.setError("termsAccepted", {
                        message: "Payment failed. Try again.",
                      })
                    },
                  }
                )
              })}
              className="flex flex-col gap-4"
            >
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
                      <FormLabel className="font-normal leading-snug">
                        I accept the NexMarket terms of service and escrow
                        agreement.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              form="checkout-form"
              disabled={confirmPayment.isPending}
            >
              {confirmPayment.isPending ? "Processing…" : "Confirm payment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader>
          <CardTitle className="font-display text-base">
            Payment ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Ledger />
        </CardContent>
      </Card>
    </div>
  )
}
