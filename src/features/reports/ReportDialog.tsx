import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Flag, Loader2 } from "lucide-react"
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

const QUICK_REASONS_BY_TYPE: Record<ReportTargetType, string[]> = {
  post: ["Spam / Fraud", "Fake or Counterfeit", "Prohibited item", "Harassment", "Inappropriate content"],
  comment: ["Spam", "Harassment / Bullying", "Hate speech", "Offensive language"],
  user: ["Impersonation", "Scam / Fraudulent activity", "Harassment", "Inappropriate profile"],
}

function targetTypeLabel(type: ReportTargetType): string {
  switch (type) {
    case "post":
      return "Listing"
    case "comment":
      return "Comment"
    case "user":
      return "User"
    default:
      return "Content"
  }
}

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

  React.useEffect(() => {
    if (open) {
      form.reset({ targetType, targetId, reason: "" })
    }
  }, [open, targetType, targetId, form])

  const reason = form.watch("reason") ?? ""
  const quickReasons = QUICK_REASONS_BY_TYPE[targetType] ?? QUICK_REASONS_BY_TYPE.post
  const label = targetTypeLabel(targetType)

  const onSubmit = (values: CreateReportFormValues) => {
    report.mutate(values, {
      onSuccess: () => {
        toast.success("Thanks, our team will review this report")
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
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Flag className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Report {label}</DialogTitle>
              <DialogDescription className="text-xs">
                Flag {label.toLowerCase()} that breaks community rules. Our team will review this promptly.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 pt-1"
            id="report-form"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel className="text-xs font-semibold">Reason for Report</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      maxLength={REASON_MAX}
                      placeholder={`Describe what's wrong with this ${label.toLowerCase()}…`}
                      className="resize-none text-xs"
                      autoFocus
                    />
                  </FormControl>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1">
                      {quickReasons.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => field.onChange(r)}
                          className="rounded-full border border-border/80 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {reason.length}/{REASON_MAX}
                      </span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            form="report-form"
            className="rounded-full text-xs font-medium"
            disabled={report.isPending || !reason.trim()}
          >
            {report.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit report"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

