import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

export interface CounterOfferFormProps {
  pending: boolean
  minDollars?: number
  maxDollars?: number
  onCounter: (amountDollars: number) => void
  onCancel: () => void
}

export function CounterOfferForm({
  pending,
  minDollars,
  maxDollars,
  onCounter,
  onCancel,
}: CounterOfferFormProps) {
  const schema = React.useMemo(() => {
    return z.object({
      amount: z.coerce
        .number({ invalid_type_error: "Enter an amount" })
        .positive("Amount must be positive")
        .refine(
          (v) => (minDollars != null ? v > minDollars : true),
          minDollars != null ? `Must be greater than $${minDollars.toFixed(2)}` : ""
        )
        .refine(
          (v) => (maxDollars != null ? v < maxDollars : true),
          maxDollars != null ? `Must be lower than $${maxDollars.toFixed(2)}` : ""
        ),
    })
  }, [minDollars, maxDollars])

  type CounterInput = z.input<typeof schema>
  type CounterValues = z.output<typeof schema>

  const form = useForm<CounterInput, unknown, CounterValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: undefined },
  })

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <form
        onSubmit={form.handleSubmit((v) => onCounter(v.amount))}
        className="flex items-center gap-2 rounded-xl bg-background/90 p-2 ring-1 ring-border/60 shadow-xs"
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="grid flex-1">
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">$</span>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Counter amount"
                      autoFocus
                      className="h-8 pl-6 text-xs font-mono font-semibold"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />
        </Form>
        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-8 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand/90" disabled={pending}>
          Send Counter
        </Button>
      </form>
      {(minDollars != null || maxDollars != null) && (
        <p className="px-1 text-[11px] text-muted-foreground">
          Convergence range:{" "}
          <span className="font-semibold text-foreground">
            {minDollars != null ? `>$${minDollars.toFixed(2)}` : ""}
            {minDollars != null && maxDollars != null ? " and " : ""}
            {maxDollars != null ? `<$${maxDollars.toFixed(2)}` : ""}
          </span>
        </p>
      )}
    </div>
  )
}
