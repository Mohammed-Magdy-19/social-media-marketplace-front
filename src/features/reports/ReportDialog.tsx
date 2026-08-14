import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateReport } from "@/features/reports/mutations"
import { reportSchema } from "@/features/reports/schemas"
import { usePostsInfinite } from "@/features/posts/queries"
import type { ReportTargetType } from "@/types"

type ReportValues = z.infer<typeof reportSchema>

export function ReportDialog({
  open,
  onOpenChange,
  presetTargetType = "post",
  presetTargetId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetTargetType?: ReportTargetType
  presetTargetId?: string
}) {
  const [targetType, setTargetType] = useState<ReportTargetType>(presetTargetType)
  const [postTarget, setPostTarget] = useState<string>(presetTargetId ?? "")

  useEffect(() => {
    if (open) {
      setTargetType(presetTargetType)
      setPostTarget(presetTargetId ?? "")
      form.reset({ reason: undefined, detail: "" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetTargetType, presetTargetId])

  const report = useCreateReport()
  const { data: postsData } = usePostsInfinite({
    category: null,
    tag: null,
    author: null,
    sort: "latest",
  })

  const posts = useMemo(
    () => postsData?.pages.flatMap((p) => p.items) ?? [],
    [postsData]
  )

  const form = useForm<ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: undefined, detail: "" },
  })

  const onSubmit = (values: ReportValues) => {
    const targetId =
      targetType === "post"
        ? postTarget
        : presetTargetId ?? promptTargetFor(targetType)
    if (!targetId) {
      toast.error("Pick a target to report")
      return
    }
    report.mutate(
      { ...values, targetType, targetId },
      {
        onSuccess: () => {
          toast.success(`POST /reports — report submitted`)
          onOpenChange(false)
        },
        onError: () => {
          toast.error("Failed to submit report")
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an item</DialogTitle>
          <DialogDescription>
            Flag content that breaks the community rules.
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
                <FormItem className="grid">
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        if (value) field.onChange(value)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportSchema.shape.reason.options.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {targetType === "post" && posts.length > 0 && (
              <FormItem className="grid">
                <FormLabel>Target post</FormLabel>
                <FormControl>
                  <Select value={postTarget} onValueChange={(v) => v && setPostTarget(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a post" />
                    </SelectTrigger>
                    <SelectContent>
                      {posts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.caption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="detail"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormLabel>Details (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="What's wrong with this item?"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="report-form"
            disabled={report.isPending}
          >
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function promptTargetFor(_type: ReportTargetType): string {
  const value = window.prompt(
    "Enter the ID of the item you want to report"
  )
  return value?.trim() ?? ""
}
