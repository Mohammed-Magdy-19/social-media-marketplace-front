import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function RouteSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-svh w-full flex-col gap-4 p-4", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="hidden h-24 w-full rounded-card md:block" />
        <Skeleton className="hidden h-24 w-full rounded-card md:block" />
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  )
}
