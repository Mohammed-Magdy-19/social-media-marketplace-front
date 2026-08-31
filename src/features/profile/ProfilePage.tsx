import * as React from "react"
import { useRef } from "react"
import { Link } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Bookmark, Calendar, Camera, Loader2, Package, UserCheck, Users } from "lucide-react"
import { toast } from "sonner"
import { useCurrentUser } from "@/features/auth/queries"
import { useLogoutMutation } from "@/features/auth/mutations"
import { usePostsInfinite, useSavedPosts } from "@/features/posts/queries"
import { usePublicUser } from "@/features/users/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { uploadAvatar } from "@/lib/api/client"
import { getErrorMessage } from "@/lib/api/errors"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import { cn, formatDate } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"

interface MyPostsGridProps {
  author: string
  onPostsCountChange?: (count: number) => void
}

function MyPostsGrid({ author }: MyPostsGridProps) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePostsInfinite({ category: null, tag: null, author, sort: "newest" })
  const parentRef = useRef<HTMLDivElement>(null)

  const posts = React.useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  )
  const COLUMNS = useResponsiveColumns()
  const rows = Math.ceil(posts.length / COLUMNS)
  const totalVirtualRows = rows + (hasNextPage ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: totalVirtualRows,
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
      <div className="flex flex-col items-center gap-2 rounded-card bg-card p-10 text-center ring-1 ring-foreground/10">
        <Package className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No listings yet</p>
        <p className="text-xs text-muted-foreground">
          Items and posts you publish will show up here.
        </p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-y-auto no-scrollbar">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const isLoaderRow = item.index >= rows
          if (isLoaderRow) {
            return (
              <div
                key={`loader-${item.index}`}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className="absolute top-0 left-0 flex w-full justify-center py-4"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Loading more…
                    </>
                  ) : (
                    "Load more listings"
                  )}
                </Button>
              </div>
            )
          }

          const rowStart = item.index * COLUMNS
          const rowPosts = posts.slice(rowStart, rowStart + COLUMNS)
          return (
            <div
              key={`row-${item.index}`}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="absolute top-0 left-0 grid w-full grid-cols-1 gap-3 pb-3 sm:grid-cols-2 xl:grid-cols-3"
              style={{ transform: `translateY(${item.start}px)` }}
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

interface StatTileProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  to?: string
}

function StatTile({ label, value, icon, to }: StatTileProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-card bg-card px-4 py-3 ring-1 ring-foreground/10 transition-all duration-200",
        to && "hover:bg-soft hover:ring-brand/30 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="font-mono text-xl font-bold tabular-nums text-foreground">{value}</span>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block group">
        {content}
      </Link>
    )
  }

  return content
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: fresh } = useCurrentUser()
  const logout = useLogoutMutation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const profile = fresh ?? user
  const authorId = profile?.id || (profile as unknown as { _id?: string })?._id || ""

  // Queries for real profile metrics
  const { data: publicProfile } = usePublicUser(authorId)
  const { data: savedPostsData } = useSavedPosts()
  const { data: userPostsData } = usePostsInfinite({
    category: null,
    tag: null,
    author: authorId,
    sort: "newest",
  })

  const savedCount = savedPostsData?.data?.length ?? 0
  const listingsCount = React.useMemo(
    () => userPostsData?.pages.flatMap((p) => p.data).length ?? 0,
    [userPostsData]
  )
  const followerCount = publicProfile?.followerCount ?? 0
  const followingCount = publicProfile?.followingCount ?? 0

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !profile) return
    setUploading(true)
    try {
      const { url } = await uploadAvatar(file)
      useAuthStore.getState().setUser({ ...profile, avatar: url })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(authorId) }),
      ])
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
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBoundary fallback={<SectionFallback />}>
        <Card className="mt-4 rounded-card">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="group relative">
              <AvatarWithFallback
                name={profile.name}
                src={profile.avatar ?? null}
                size="lg"
                className="size-20 ring-2 ring-background"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="absolute inset-0 grid cursor-pointer place-items-center rounded-full bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 disabled:opacity-0"
                aria-label="Upload avatar"
              >
                {uploading ? (
                  <Loader2 className="size-6 animate-spin text-white" />
                ) : (
                  <Camera className="size-6 text-white" />
                )}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickAvatar}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{profile.name}</h3>
                <Badge
                  variant={profile.role === "admin" ? "destructive" : "secondary"}
                >
                  {profile.role}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    profile.status === "active"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-red-500/10 text-red-500"
                  )}
                >
                  {profile.status}
                </Badge>
              </div>
              {profile.bio && <p className="mt-2 text-sm text-foreground/90">{profile.bio}</p>}
            </div>
            <Button variant="outline" onClick={() => logout.mutate()}>
              Log out
            </Button>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Listings"
          value={listingsCount}
          icon={<Package className="size-3.5" />}
        />
        <StatTile
          label="Saved"
          value={savedCount}
          icon={<Bookmark className="size-3.5" />}
          to="/saved"
        />
        <StatTile
          label="Followers"
          value={followerCount}
          icon={<Users className="size-3.5" />}
        />
        <StatTile
          label="Following"
          value={followingCount}
          icon={<UserCheck className="size-3.5" />}
        />
        <StatTile
          label="Joined"
          value={formatDate(profile.createdAt)}
          icon={<Calendar className="size-3.5" />}
        />
      </div>

      <ErrorBoundary fallback={<SectionFallback />}>
        <Card className="rounded-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">
              My listings {listingsCount > 0 && `(${listingsCount})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <MyPostsGrid author={authorId} />
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  )
}

