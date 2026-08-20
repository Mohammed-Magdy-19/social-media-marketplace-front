import * as React from "react"
import { useRef } from "react"
import { useParams, Link, Navigate } from "react-router-dom"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowLeft, UserPlus, UserMinus, MessageCircle, Calendar } from "lucide-react"
import { usePublicUser, useUserFollowers } from "@/features/users/queries"
import { useFollowUser, useUnfollowUser } from "@/features/users/mutations"
import { useStartNegotiation } from "@/features/conversations/mutations"
import { usePostsInfinite } from "@/features/posts/queries"
import { ProductCard } from "@/features/posts/components/ProductCard"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { formatDate } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"

function UserPostsGrid({ authorId }: { authorId: string }) {
  const { data, isLoading } = usePostsInfinite({
    category: null,
    tag: null,
    author: authorId,
    sort: "newest",
  })
  const parentRef = useRef<HTMLDivElement>(null)

  const posts = React.useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  )
  const COLUMNS = useResponsiveColumns()
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
        No listings posted yet.
      </p>
    )
  }

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-y-auto no-scrollbar">
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
    <div className="flex flex-col items-center gap-0.5 rounded-card bg-card px-4 py-2.5 ring-1 ring-foreground/10">
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

export default function UserProfilePage() {
  const { userId = "" } = useParams<{ userId: string }>()
  const currentUser = useAuthStore((s) => s.user)
  const hasToken = useAuthStore((s) => !!s.accessToken)

  const { data: user, isLoading, isError } = usePublicUser(userId)
  const { data: followers = [] } = useUserFollowers(userId)
  const followUser = useFollowUser()
  const unfollowUser = useUnfollowUser()
  const startNegotiation = useStartNegotiation()

  // Check if currentUser is in the followers list
  const isFollowing = React.useMemo(() => {
    if (!currentUser) return false
    return followers.some((f) => f.id === currentUser.id || (f as unknown as { _id?: string })._id === currentUser.id)
  }, [followers, currentUser])

  const isSelf = currentUser && (currentUser.id === userId || (currentUser as unknown as { _id?: string })._id === userId)

  if (isSelf) {
    return <Navigate to="/profile" replace />
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-44 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-card p-12 text-center ring-1 ring-foreground/10">
        <p className="text-base font-medium text-foreground">User not found</p>
        <p className="text-sm text-muted-foreground">The profile you are looking for does not exist or has been removed.</p>
        <Link to="/home" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft /> Back to Feed
        </Link>
      </div>
    )
  }

  const displayName = user.name || user.username || "User"
  const followerCount = user.followerCount ?? followers.length
  const followingCount = user.followingCount ?? 0

  const handleToggleFollow = () => {
    if (!hasToken) return
    if (isFollowing) {
      unfollowUser.mutate({ userId })
    } else {
      followUser.mutate({ userId })
    }
  }

  const handleMessage = () => {
    if (!hasToken) return
    startNegotiation.mutate({ sellerId: userId })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft />
          Back
        </Link>
      </div>

      <ErrorBoundary fallback={<SectionFallback />}>
        <Card className="rounded-card overflow-hidden">
          <div className="h-28 w-full bg-gradient-to-r from-brand/20 via-brand/10 to-transparent sm:h-36" />
          <CardContent className="flex flex-col gap-4 p-6 -mt-12 sm:-mt-14">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:text-left">
                <AvatarWithFallback
                  name={displayName}
                  src={user.avatar}
                  size="lg"
                  className="size-20 ring-4 ring-card sm:size-24"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
                    {displayName}
                  </h1>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>

              {hasToken && (
                <div className="flex items-center justify-center gap-2 sm:justify-end">
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggleFollow}
                    disabled={followUser.isPending || unfollowUser.isPending}
                    className="min-w-28"
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="size-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-4" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleMessage}
                    disabled={startNegotiation.isPending}
                  >
                    <MessageCircle className="size-4" />
                    Message / Negotiate
                  </Button>
                </div>
              )}
            </div>

            {user.bio && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {user.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatTile label="Followers" value={followerCount} />
              <StatTile label="Following" value={followingCount} />
              <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>Joined {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </ErrorBoundary>

      <ErrorBoundary fallback={<SectionFallback />}>
        <Card className="rounded-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Listings & Posts</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <UserPostsGrid authorId={userId} />
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  )
}
