import { cn } from "@/lib/utils"

export function Logo({
  className,
  imgClassName,
  size = 32,
  showWordmark = false,
  wordmark = "vendo",
}: {
  className?: string
  imgClassName?: string
  size?: number
  showWordmark?: boolean
  wordmark?: string
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-2", className)}
    >
      <img
        src="/WebsiteLogo.png"
        alt={wordmark}
        width={size}
        height={size}
        className={cn("size-8 shrink-0 rounded-full object-contain", imgClassName)}
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span
          className="font-display text-lg font-black tracking-[-0.02em] text-ink"
        >
          {wordmark}
        </span>
      )}
    </span>
  )
}
