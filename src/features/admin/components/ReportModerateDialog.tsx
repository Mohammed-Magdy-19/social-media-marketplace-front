import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateReportStatus } from "@/features/admin/mutations"
import {
  updateReportFormSchema,
  type UpdateReportFormValues,
} from "@/features/reports/schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { ApiError, type Report } from "@/types"

const NOTES_MAX = 2000

const STATUS_OPTIONS: { value: UpdateReportFormValues["status"]; label: string }[] = [
  { value: "reviewed", label: "Reviewed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "resolved", label: "Resolved" },
]

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

/**
 * Admin status-change form (spec §5.3). Offers exactly the three PATCH-able
 * statuses — `pending` is a valid stored value but deliberately absent here.
 * `resolutionNotes` is optional-but-encouraged: resolving or dismissing a
 * report without a note is allowed (the backend accepts an empty string).
 */
export function ReportModerateDialog({
  report,
  initialStatus = "reviewed",
  onOpenChange,
  onForbidden,
}: {
  report: Report
  initialStatus?: UpdateReportFormValues["status"]
  onOpenChange: (open: boolean) => void
  onForbidden?: () => void
}) {
  const updateStatus = useUpdateReportStatus()

  const form = useForm<UpdateReportFormValues>({
    resolver: zodResolver(updateReportFormSchema),
    defaultValues: { status: initialStatus, resolutionNotes: "" },
  })

  const status = form.watch("status")

  const onSubmit = (values: UpdateReportFormValues) => {
    updateStatus.mutate(
      {
        id: report.id,
        status: values.status,
        resolutionNotes: values.resolutionNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Report marked as ${values.status}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (isForbidden(error)) {
            onForbidden?.()
            return
          }
          toast.error(getErrorMessage(error))
        },
      }
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Moderate report</DialogTitle>
          <DialogDescription>
            Update the status of the report on{" "}
            <span className="font-mono text-foreground">{report.targetId}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            id="report-moderate-form"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resolutionNotes"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    Resolution notes{" "}
                    <span className="text-muted-foreground">(recommended)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={NOTES_MAX}
                      placeholder={
                        status === "reviewed"
                          ? "Summary of the review…"
                          : "What action was taken?"
                      }
                    />
                  </FormControl>
                  <div className="flex justify-end">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {(field.value ?? "").length}/{NOTES_MAX}
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
          <Button
            type="submit"
            form="report-moderate-form"
            disabled={updateStatus.isPending}
          >
            Apply status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
