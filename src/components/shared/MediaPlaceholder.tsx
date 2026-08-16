import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function MediaPlaceholder({
  ratio = "aspect-video",
  label = "media preview",
  className,
}: {
  ratio?: string
  label?: string
  className?: string
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex w-full items-center justify-center border border-border bg-surface-subtle text-muted-foreground",
        ratio,
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <ImageIcon className="size-6 text-muted-foreground/70" />
        <span className="font-mono text-[10px] tracking-wider uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
