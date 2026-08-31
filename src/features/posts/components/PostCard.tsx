import { Link } from "react-router-dom"
import { Heart, MessageCircle, Bookmark, Tag } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useToggleLike, useSavePost } from "@/features/posts/mutations"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { MediaPlaceholder } from "@/components/shared/MediaPlaceholder"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils"
import type { Post } from "@/types"

export function PostCard({ post }: { post: Post }) {
  const toggleLike = useToggleLike()
  const savePost = useSavePost()
  const hasToken = useAuthStore((s) => !!s.accessToken)

  const onLike = () => {
    if (!hasToken) return
    toggleLike.mutate({ postId: post.id, isLiked: post.isLiked })
  }

  const onSave = () => {
    if (!hasToken) return
    savePost.mutate({ postId: post.id, isSaved: post.isSaved })
  }

  const mediaList = Array.isArray(post?.media) ? post.media : []
  const tagsList = Array.isArray(post?.tags) ? post.tags : []
  const authorName = post.author?.name || post.author?.username || "User"
  const authorId = post.author?.id || (post.author as unknown as { _id?: string })?._id
  const authorProfileLink = authorId ? `/users/${authorId}` : undefined

  return (
    <article className="flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-3">
        {authorProfileLink ? (
          <Link to={authorProfileLink} className="transition-opacity hover:opacity-85">
            <AvatarWithFallback name={authorName} src={post.author?.avatar} />
          </Link>
        ) : (
          <AvatarWithFallback name={authorName} src={post.author?.avatar} />
        )}
        <div className="min-w-0 flex-1">
          {authorProfileLink ? (
            <Link
              to={authorProfileLink}
              className="inline-block max-w-full truncate text-sm font-semibold hover:underline hover:text-brand transition-colors"
            >
              {authorName}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold">{authorName}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(post.createdAt)}
            {post.category?.name && ` · ${post.category.name}`}
          </p>
        </div>
        {post.price != null && (
          <Badge variant="secondary" className="font-mono">
            {formatCurrency(post.price, post.currency)}
          </Badge>
        )}
      </div>

      <Link to={`/posts/${post.id}`} className="group">
        <p className="text-sm leading-relaxed group-hover:text-muted-foreground">
          {post.title}
        </p>
      </Link>

      <Link
        to={`/posts/${post.id}`}
        className="block"
        aria-label="View post media"
      >
        {mediaList.length > 0 ? (
          <img
            src={mediaList[0]}
            alt={post.title ?? "Post"}
            loading="lazy"
            className="aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <MediaPlaceholder className="rounded-lg" />
        )}
      </Link>

      {tagsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Tag className="size-3 text-muted-foreground" />
          {tagsList.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLike}
          disabled={!hasToken || toggleLike.isPending}
          className={cn("gap-1.5", post.isLiked && "text-destructive")}
          aria-pressed={post.isLiked}
        >
          <Heart className={cn("size-4", post.isLiked && "fill-current")} />
          {post.likesCount}
        </Button>
        <Link
          to={`/posts/${post.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label="View comments"
        >
          <MessageCircle className="size-4" />
          {post.commentsCount}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          disabled={!hasToken || savePost.isPending}
          className={cn("ml-auto gap-1.5", post.isSaved && "text-brand")}
          aria-pressed={post.isSaved}
        >
          <Bookmark className={cn("size-4", post.isSaved && "fill-current")} />
          {post.saveCount}
        </Button>
      </div>
    </article>
  )
}
