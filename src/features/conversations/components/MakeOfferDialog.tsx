import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { BadgePercent } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  createOfferFormSchema,
  type CreateOfferInput,
  type CreateOfferFormValues,
} from "@/features/conversations/schemas"
import { formatCurrency } from "@/lib/utils"

export interface MakeOfferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOffer: (values: CreateOfferFormValues) => void
  pending: boolean
  originalPrice?: number
}

export function MakeOfferDialog({
  open,
  onOpenChange,
  onOffer,
  pending,
  originalPrice,
}: MakeOfferDialogProps) {
  const form = useForm<CreateOfferInput, unknown, CreateOfferFormValues>({
    resolver: zodResolver(createOfferFormSchema),
    defaultValues: { amount: undefined },
  })

  React.useEffect(() => {
    if (open) form.reset({ amount: undefined })
  }, [open, form])

  const applyDiscount = (percent: number) => {
    if (!originalPrice) return
    const originalDollars = originalPrice / 100
    const discounted = Math.max(1, Math.round(originalDollars * (1 - percent / 100) * 100) / 100)
    form.setValue("amount", discounted, { shouldValidate: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BadgePercent className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Make an Offer</DialogTitle>
              <DialogDescription className="text-xs">
                Propose a custom price to the seller.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {originalPrice != null && originalPrice > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Listing Price:</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(originalPrice)}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Quick:</span>
              {[5, 10, 15, 20].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-6 rounded-full px-2 text-[11px] hover:bg-brand/10 hover:text-brand hover:border-brand/40"
                  onClick={() => applyDiscount(pct)}
                >
                  -{pct}%
                </Button>
              ))}
            </div>
          </div>
        )}

        <Form {...form}>
          <form
            id="offer-form"
            onSubmit={form.handleSubmit(onOffer)}
            className="flex flex-col gap-4 pt-1"
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormLabel className="text-xs font-semibold">Your Offer Price (USD)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-7 font-mono font-semibold"
                        autoFocus
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="offer-form"
            className="rounded-full text-xs font-semibold shadow-xs"
            disabled={pending}
          >
            <BadgePercent className="mr-1.5 size-4" />
            Send Offer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
