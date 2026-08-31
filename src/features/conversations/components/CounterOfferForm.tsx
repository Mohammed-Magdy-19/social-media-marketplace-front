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

const counterSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter an amount" })
    .positive("Amount must be positive"),
})

type CounterValues = z.infer<typeof counterSchema>

export interface CounterOfferFormProps {
  pending: boolean
  onCounter: (amountDollars: number) => void
  onCancel: () => void
}

export function CounterOfferForm({
  pending,
  onCounter,
  onCancel,
}: CounterOfferFormProps) {
  const form = useForm<CounterValues>({
    resolver: zodResolver(counterSchema),
    defaultValues: { amount: undefined },
  })

  return (
    <form
      onSubmit={form.handleSubmit((v) => onCounter(v.amount))}
      className="flex items-center gap-2 rounded-xl bg-background/80 p-2 ring-1 ring-border/60"
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
                    placeholder="Counter offer amount"
                    autoFocus
                    className="h-8 pl-6 text-xs"
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
      </Form>
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" size="sm" className="h-8 rounded-full text-xs font-medium" disabled={pending}>
        Send Counter
      </Button>
    </form>
  )
}
