import { Link } from "react-router-dom"
import { Heart, Bookmark, BadgePercent } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useToggleLike, useSavePost } from "@/features/posts/mutations"
import { useStartNegotiation } from "@/features/conversations/mutations"
import { useCreatePaymentIntent } from "@/features/payments/mutations"
import { MediaPlaceholder } from "@/components/shared/MediaPlaceholder"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import type { Post } from "@/types"

export function ProductCard({ post }: { post: Post }) {
  const toggleLike = useToggleLike()
  const savePost = useSavePost()
  const startNegotiation = useStartNegotiation()
  const createIntent = useCreatePaymentIntent()
  const hasToken = useAuthStore((s) => !!s.accessToken)

  const price = post?.price
  const discount = price != null && (post?.saveCount ?? 0) > 0 ? "-15%" : undefined
  const mediaList = Array.isArray(post?.media) ? post.media : []

  const onBuy = () => {
    if (!hasToken || price == null || post.status !== "active") return
    createIntent.mutate({ postId: post.id, amount: price, currency: post.currency ?? "USD" })
  }

  const onNegotiate = () => {
    if (!hasToken || price == null || post.status !== "active") return
    startNegotiation.mutate({ sellerId: post.author?.id ?? "", postId: post.id })
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-card bg-card ring-1 ring-foreground/10">
      <div className="relative">
        <Link to={`/posts/${post.id}`} aria-label="View product">
          {mediaList.length > 0 ? (
            <img
              src={mediaList[0]}
              alt={post.title ?? "Product"}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          ) : (
            <MediaPlaceholder ratio="aspect-square" className="w-full" />
          )}
        </Link>
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount && (
            <Badge className="bg-brand text-white">
              <BadgePercent />
              {discount}
            </Badge>
          )}
          {post.category?.name && <Badge variant="secondary">{post.category.name}</Badge>}
        </div>
        <div className="absolute right-2 bottom-2 flex gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => hasToken && toggleLike.mutate({ postId: post.id, isLiked: post.isLiked })}
            disabled={!hasToken || toggleLike.isPending}
            aria-label={post.isLiked ? "Unlike" : "Like"}
          >
            <Heart className={cn("size-4", post.isLiked && "fill-current text-destructive")} />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => hasToken && savePost.mutate({ postId: post.id, isSaved: post.isSaved })}
            disabled={!hasToken || savePost.isPending}
            aria-label={post.isSaved ? "Unsave" : "Save"}
          >
            <Bookmark className={cn("size-4", post.isSaved && "fill-current text-brand")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link to={`/posts/${post.id}`} className="line-clamp-2 text-sm font-medium">
          {post.title}
        </Link>
        <div className="flex items-baseline gap-1.5">
          {price != null && (
            <span className="font-mono text-base font-bold text-brand">
              {formatCurrency(price, post.currency)}
            </span>
          )}
          {discount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(Math.round((price ?? 0) * 1.15), post.currency)}
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-1.5 pt-1 sm:flex-row">
          <Button
            size="sm"
            className="flex-1"
            onClick={onBuy}
            disabled={!hasToken || price == null || post.status !== "active"}
          >
            Instant Buy
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onNegotiate}
            disabled={!hasToken || price == null || post.status !== "active"}
          >
            Negotiate
          </Button>
        </div>
      </div>
    </article>
  )
}
