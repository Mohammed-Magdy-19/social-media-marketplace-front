import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, string> = {
  success: "text-ok bg-ok-soft",
  published: "text-ok bg-ok-soft",
  resolved: "text-ok bg-ok-soft",
  active: "text-ok bg-ok-soft",
  hidden: "text-mut bg-soft",
  pending: "text-warn bg-warn-soft",
  suspended: "text-warn bg-warn-soft",
  draft: "text-info bg-info-soft",
  flagged: "text-err bg-err-soft",
  banned: "text-err bg-err-soft",
  dismissed: "text-err bg-err-soft",
  failed: "text-err bg-err-soft",
  refunded: "text-info bg-info-soft",
  user: "text-info bg-info-soft",
  moderator: "text-info bg-info-soft",
  admin: "text-violet bg-violet-soft",
  system: "text-violet bg-violet-soft",
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
