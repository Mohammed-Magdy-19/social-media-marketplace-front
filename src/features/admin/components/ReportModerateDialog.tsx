import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Flag,
  Loader2,
  ShieldAlert,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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
import {
  useDeleteComment,
  useDelRow,
  useSetUserStatus,
  useTogglePostStatus,
  useUpdateReportStatus,
} from "@/features/admin/mutations"
import {
  updateReportFormSchema,
  type UpdateReportFormValues,
} from "@/features/reports/schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { cn } from "@/lib/utils"
import { ApiError, type Report } from "@/types"

const NOTES_MAX = 2000

const STATUS_OPTIONS: {
  value: UpdateReportFormValues["status"]
  label: string
  description: string
  icon: typeof CheckCircle2
  color: string
}[] = [
  {
    value: "reviewed",
    label: "Under Review",
    description: "Mark as actively investigated by the team",
    icon: Flag,
    color: "text-amber-500",
  },
  {
    value: "dismissed",
    label: "Dismiss Report",
    description: "No violation found or false alarm",
    icon: XCircle,
    color: "text-muted-foreground",
  },
  {
    value: "resolved",
    label: "Resolve & Enforce",
    description: "Violation confirmed and action taken",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
]

type TargetAction = "none" | "hide_post" | "flag_post" | "delete_post" | "suspend_user" | "ban_user" | "delete_comment"

interface ReactionOption {
  id: TargetAction
  label: string
  description: string
  icon: typeof ShieldAlert
  variant: "default" | "destructive" | "warning"
  defaultNote: string
}

function getReactionsForTarget(targetType: Report["targetType"]): ReactionOption[] {
  switch (targetType) {
    case "post":
      return [
        {
          id: "none",
          label: "No content action",
          description: "Keep listing visible in public feed",
          icon: CheckCircle2,
          variant: "default",
          defaultNote: "Report reviewed.",
        },
        {
          id: "hide_post",
          label: "Hide Listing",
          description: "Remove listing from search and public marketplace",
          icon: EyeOff,
          variant: "warning",
          defaultNote: "Listing violates marketplace policies and has been hidden.",
        },
        {
          id: "flag_post",
          label: "Flag Listing",
          description: "Mark listing with a moderation flag",
          icon: AlertTriangle,
          variant: "warning",
          defaultNote: "Listing flagged for policy compliance review.",
        },
        {
          id: "delete_post",
          label: "Delete Listing",
          description: "Permanently delete listing and all associated media",
          icon: Trash2,
          variant: "destructive",
          defaultNote: "Listing removed permanently for policy violation.",
        },
      ]
    case "user":
      return [
        {
          id: "none",
          label: "No account action",
          description: "Leave user account status unchanged",
          icon: CheckCircle2,
          variant: "default",
          defaultNote: "User report reviewed.",
        },
        {
          id: "suspend_user",
          label: "Suspend User",
          description: "Temporarily restrict account access",
          icon: UserX,
          variant: "warning",
          defaultNote: "Account suspended due to community guidelines violations.",
        },
        {
          id: "ban_user",
          label: "Ban User",
          description: "Permanently terminate user access",
          icon: ShieldAlert,
          variant: "destructive",
          defaultNote: "Account banned permanently for severe or repeated violations.",
        },
      ]
    case "comment":
      return [
        {
          id: "none",
          label: "No comment action",
          description: "Leave comment visible in thread",
          icon: CheckCircle2,
          variant: "default",
          defaultNote: "Comment report reviewed.",
        },
        {
          id: "delete_comment",
          label: "Delete Comment",
          description: "Permanently remove comment from the post",
          icon: Trash2,
          variant: "destructive",
          defaultNote: "Comment deleted for violating community standards.",
        },
      ]
    default:
      return []
  }
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403
}

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
  const togglePostStatus = useTogglePostStatus()
  const deletePost = useDelRow()
  const setUserStatus = useSetUserStatus()
  const deleteComment = useDeleteComment()

  const reactions = React.useMemo(
    () => getReactionsForTarget(report.targetType),
    [report.targetType]
  )

  const [selectedReaction, setSelectedReaction] = React.useState<TargetAction>("none")

  const form = useForm<UpdateReportFormValues>({
    resolver: zodResolver(updateReportFormSchema),
    defaultValues: { status: initialStatus, resolutionNotes: report.resolutionNotes || "" },
  })

  const status = form.watch("status")
  const isPending =
    updateStatus.isPending ||
    togglePostStatus.isPending ||
    deletePost.isPending ||
    setUserStatus.isPending ||
    deleteComment.isPending

  const handleSelectReaction = (reaction: ReactionOption) => {
    setSelectedReaction(reaction.id)
    if (reaction.id !== "none") {
      form.setValue("status", "resolved")
      if (!form.getValues("resolutionNotes")) {
        form.setValue("resolutionNotes", reaction.defaultNote)
      }
    }
  }

  const onSubmit = async (values: UpdateReportFormValues) => {
    try {
      // 1. Execute the report status change
      await updateStatus.mutateAsync({
        id: report.id,
        status: values.status,
        resolutionNotes: values.resolutionNotes || undefined,
      })

      // 2. Execute target action if specified
      let actionLabel = ""
      if (selectedReaction === "hide_post") {
        await togglePostStatus.mutateAsync({ id: report.targetId, status: "hidden" })
        actionLabel = " & listing hidden"
      } else if (selectedReaction === "flag_post") {
        await togglePostStatus.mutateAsync({ id: report.targetId, status: "flagged" })
        actionLabel = " & listing flagged"
      } else if (selectedReaction === "delete_post") {
        await deletePost.mutateAsync({ table: "posts", id: report.targetId })
        actionLabel = " & listing deleted"
      } else if (selectedReaction === "suspend_user") {
        await setUserStatus.mutateAsync({ id: report.targetId, status: "suspended" })
        actionLabel = " & user suspended"
      } else if (selectedReaction === "ban_user") {
        await setUserStatus.mutateAsync({ id: report.targetId, status: "banned" })
        actionLabel = " & user banned"
      } else if (selectedReaction === "delete_comment") {
        await deleteComment.mutateAsync(report.targetId)
        actionLabel = " & comment deleted"
      }

      toast.success(`Report marked as ${values.status}${actionLabel}`)
      onOpenChange(false)
    } catch (error) {
      if (isForbidden(error)) {
        onForbidden?.()
        return
      }
      toast.error(getErrorMessage(error))
    }
  }

  const targetLink =
    report.targetType === "post"
      ? `/posts/${report.targetId}`
      : report.targetType === "user"
      ? `/users/${report.targetId}`
      : null

  const reporterName =
    typeof report.reporter === "object"
      ? report.reporter?.name || report.reporter?.username || "Anonymous"
      : report.reporter || "Anonymous"

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Moderate Report</DialogTitle>
              <DialogDescription className="text-xs">
                Review report details, enforce moderation actions, and resolve ticket.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Report Overview Card */}
        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                {report.targetType}
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground">{report.targetId}</span>
            </div>
            {targetLink && (
              <Link
                to={targetLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <span>View {report.targetType}</span>
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>

          <div className="pt-1">
            <span className="font-semibold text-foreground">Reported reason: </span>
            <span className="text-muted-foreground">&ldquo;{report.reason}&rdquo;</span>
          </div>

          <div className="text-[11px] text-muted-foreground">
            Reported by <span className="font-medium text-foreground">{reporterName}</span>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 pt-1"
            id="report-moderate-form"
          >
            {/* Status Selector */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="grid gap-1.5">
                  <FormLabel className="text-xs font-semibold">Report Status</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 w-full text-xs">
                        <SelectValue placeholder="Choose a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="text-xs">
                            <div className="flex items-center gap-2">
                              <option.icon className={cn("size-3.5", option.color)} />
                              <span className="font-medium">{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Moderation Reaction (Enforcement Action) */}
            {reactions.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Direct Action on {report.targetType}
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Optional enforcement
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {reactions.map((r) => {
                    const isSelected = selectedReaction === r.id
                    const Icon = r.icon
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectReaction(r)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-brand bg-brand/10 text-foreground ring-1 ring-brand"
                            : "border-border/70 bg-card hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg",
                            isSelected ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold leading-none text-foreground">{r.label}</p>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                            {r.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Resolution Notes */}
            <FormField
              control={form.control}
              name="resolutionNotes"
              render={({ field }) => (
                <FormItem className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-semibold">
                      Resolution Notes
                    </FormLabel>
                    <span className="text-[10px] text-muted-foreground">
                      {(field.value ?? "").length}/{NOTES_MAX}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      maxLength={NOTES_MAX}
                      placeholder={
                        status === "reviewed"
                          ? "Summary of investigation or triage findings…"
                          : status === "dismissed"
                          ? "Reason report was dismissed (e.g. no violation found)…"
                          : "Action taken (e.g. content removed, user warned/suspended)…"
                      }
                      className="resize-none text-xs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            form="report-moderate-form"
            className="rounded-full text-xs font-medium"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Applying Action…
              </>
            ) : (
              "Apply Moderation Action"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

