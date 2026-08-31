import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const INVALID_DATE_FALLBACK = "—"

export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now()
): string {
  const then = new Date(iso ?? "").getTime()
  if (Number.isNaN(then)) return INVALID_DATE_FALLBACK
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(iso!).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function formatCurrency(amountInCents: number, currency = "USD"): string {
  const amount = (amountInCents ?? 0) / 100
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(iso: string | null | undefined): string {
  const date = new Date(iso ?? "")
  if (Number.isNaN(date.getTime())) return INVALID_DATE_FALLBACK
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
