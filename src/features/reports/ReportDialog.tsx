import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { useCreateReport } from "@/features/reports/mutations"
import { createReportFormSchema, type CreateReportFormValues } from "@/features/reports/schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { ApiError, type ReportTargetType } from "@/types"

const REASON_MAX = 1000

const QUICK_REASONS = ["Spam", "Harassment", "Fake listing", "Prohibited item"]

/**
 * §4.3 — the backend's two distinct 400/404 responses are user-legible and
 * should render verbatim ("No {targetType} found with that ID." etc.) rather
 * than being collapsed into a generic message.
 */
function reportErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
    const serverMessage = error.message
    if (serverMessage && !/request failed with status code/i.test(serverMessage)) {
      return serverMessage
    }
  }
  return getErrorMessage(error)
}

/**
 * Shared "report this" trigger + form (spec §4). The target is fixed per
 * mount point via `targetType`/`targetId` props — never user-editable —
 * and only `reason` is a real form input. No optimistic UI: success just
 * closes the dialog and shows a confirmation toast (§4.4).
 */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: ReportTargetType
  targetId: string
}) {
  const report = useCreateReport()

  const form = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportFormSchema),
    defaultValues: { targetType, targetId, reason: "" },
  })

  const reason = form.watch("reason") ?? ""

  const onSubmit = (values: CreateReportFormValues) => {
    report.mutate(values, {
      onSuccess: () => {
        toast.success("Thanks, our team will review this")
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(reportErrorMessage(error))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
          <DialogDescription>
            Flag content that breaks the community rules. Our team will review
            this.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="report-form"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      maxLength={REASON_MAX}
                      placeholder={`What's wrong with this ${targetType}?`}
                    />
                  </FormControl>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => field.onChange(r)}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-soft hover:text-foreground"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      {reason.length}/{REASON_MAX}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="report-form" disabled={report.isPending}>
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
