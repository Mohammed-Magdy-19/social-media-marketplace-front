import type * as React from "react"
import { Badge } from "@/components/ui/badge"

/**
 * Consistent page header for admin views: title + subtitle + optional
 * endpoint chip (mono, 9.5–11px per spec §2.2) + trailing actions.
 */
export function AdminPageHeader({
  title,
  subtitle,
  endpoint,
  children,
}: {
  title: string
  subtitle?: string
  endpoint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {endpoint && (
            <Badge
              variant="outline"
              className="border-transparent bg-soft font-mono text-[10px] text-mut"
            >
              {endpoint}
            </Badge>
          )}
        </div>
        {subtitle && (
          <p className="text-sm leading-[1.5] text-mut">{subtitle}</p>
        )}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}
