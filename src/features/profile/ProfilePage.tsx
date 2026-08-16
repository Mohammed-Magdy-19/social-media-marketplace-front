import * as React from "react"
import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Camera, Mail } from "lucide-react"
import { toast } from "sonner"
import { useCurrentUser } from "@/features/auth/queries"
import { useLogoutMutation } from "@/features/auth/mutations"
import { usePostsInfinite } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { uploadAvatar } from "@/lib/api/client"
import { getErrorMessage } from "@/lib/api/errors"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import { formatDate } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"

function MyPostsGrid({ author }: { author: string }) {
  const { data, isLoading } = usePostsInfinite({ category: null, tag: null, author, sort: "newest" })
  const parentRef = useRef<HTMLDivElement>(null)

  const posts = React.useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  )
  const COLUMNS = 3
  const rows = Math.ceil(posts.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320,
    overscan: 4,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-card" />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <p className="rounded-card bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No listings yet.
      </p>
    )
  }

  return (
    <div ref={parentRef} className="max-h-96 overflow-y-auto pr-1">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const rowStart = item.index * COLUMNS
          const rowPosts = posts.slice(rowStart, rowStart + COLUMNS)
          return (
            <div
              key={`row-${item.index}`}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {rowPosts.map((post) => (
                <ProductCard key={post.id} post={post} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-card bg-card px-4 py-3 ring-1 ring-foreground/10">
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: fresh } = useCurrentUser()
  const logout = useLogoutMutation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const profile = fresh ?? user

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !profile) return
    setUploading(true)
    try {
      const { url } = await uploadAvatar(file)
      useAuthStore.getState().setUser({ ...profile, avatar: url })
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
      toast.success("Avatar updated")
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBoundary fallback={<SectionFallback />}>
        <div className="flex justify-center">
          <Card className="w-full max-w-sm text-center">
            <CardHeader className="pb-0">
              <div className="flex flex-col items-center gap-4">
                <div className="group relative">
                  <AvatarWithFallback
                    name={profile.name}
                    src={profile.avatar ?? null}
                    size="lg"
                    className="size-24"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 grid cursor-pointer place-items-center rounded-full bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 disabled:opacity-0"
                    aria-label="Upload avatar"
                  >
                    <Camera className="size-6" />
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickAvatar}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-xl font-semibold">{profile.name}</h3>
                    <Badge
                      variant={profile.role === "admin" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {profile.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {profile.bio && (
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              )}
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                {profile.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    <span>{profile.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => logout.mutate()}>
                Log out
              </Button>
            </CardFooter>
          </Card>
        </div>
      </ErrorBoundary>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Listings" value="0" />
        <StatTile label="Saved" value="0" />
        <StatTile label="Member since" value={formatDate(profile.createdAt)} />
      </div>

      <ErrorBoundary fallback={<SectionFallback />}>
        <Card className="rounded-card">
          <CardHeader>
            <CardTitle className="font-display text-base">My listings</CardTitle>
          </CardHeader>
          <CardContent>
            <MyPostsGrid author={profile.id} />
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  )
}
