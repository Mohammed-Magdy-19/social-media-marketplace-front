import type * as React from "react"

/**
 * Consistent page header for admin views: title + subtitle + trailing actions.
 */
export function AdminPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-lg font-bold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-sm leading-[1.5] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}
