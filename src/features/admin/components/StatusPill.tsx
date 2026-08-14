import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, string> = {
  Success: "text-ok bg-ok-soft",
  Published: "text-ok bg-ok-soft",
  Resolved: "text-ok bg-ok-soft",
  Active: "text-ok bg-ok-soft",
  Pending: "text-warn bg-warn-soft",
  Suspended: "text-warn bg-warn-soft",
  Draft: "text-info bg-info-soft",
  Flagged: "text-err bg-err-soft",
  Banned: "text-err bg-err-soft",
  Dismissed: "text-err bg-err-soft",
  Failed: "text-err bg-err-soft",
  Refunded: "text-info bg-info-soft",
  User: "text-info bg-info-soft",
  Admin: "text-violet bg-violet-soft",
  System: "text-violet bg-violet-soft",
}

/**
 * Fixed status→token pill mapping (spec §7) — never bespoke colors.
 * Unknown statuses fall back to a neutral muted tone.
 */
export function StatusPill({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const tone = STATUS_TONE[status] ?? "text-mut bg-soft"
  return (
    <Badge variant="outline" className={cn("border-transparent", tone, className)}>
      {status}
    </Badge>
  )
}
