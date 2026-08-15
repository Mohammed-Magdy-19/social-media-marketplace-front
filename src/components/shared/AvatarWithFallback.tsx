import * as React from "react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { avatarGradient, initials, isDefaultAvatar } from "@/lib/avatar"

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
  const [imgFailed, setImgFailed] = React.useState(false)
  const { from, to } = avatarGradient(name)
  const showImage = !!src && !isDefaultAvatar(src) && !imgFailed
  return (
    <Avatar size={size} className={className}>
      {showImage ? (
        <AvatarImage
          src={src}
          alt={name}
          onError={() => setImgFailed(true)}
        />
      ) : null}
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
