import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { avatarGradient, initials } from "@/lib/avatar"

export function AvatarWithFallback({
  name,
  src,
  size = "default",
  className,
}: {
  name: string
  src?: string | null
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  const { from, to } = avatarGradient(name)
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback>
        <span
          className="flex size-full items-center justify-center text-xs font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          {initials(name)}
        </span>
      </AvatarFallback>
    </Avatar>
  )
}
