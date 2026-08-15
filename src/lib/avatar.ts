const GRADIENTS = [
  ["#00C853", "#2BE77E"],
  ["#009E42", "#7C3AED"],
  ["#3B82F6", "#00C853"],
  ["#7C3AED", "#F59E0B"],
  ["#F59E0B", "#EF4444"],
  ["#3B82F6", "#7C3AED"],
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function avatarGradient(seed: string | null | undefined): { from: string; to: string } {
  const [from, to] = GRADIENTS[hashString(seed ?? "") % GRADIENTS.length]
  return { from, to }
}

export function initials(name: string | null | undefined): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function isDefaultAvatar(url: string | null | undefined): boolean {
  if (!url) return true
  return url.includes("/default/avatar")
}
