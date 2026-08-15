import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Flag, Heart, Bookmark, MessageCircle } from "lucide-react"
import type { z } from "zod"
import { usePost } from "@/features/posts/queries"
import { useToggleLike, useSavePost, useCreateComment } from "@/features/posts/mutations"
import { commentSchema } from "@/features/posts/schemas"
import { useStartNegotiation } from "@/features/conversations/mutations"
import { useCreatePaymentIntent } from "@/features/payments/mutations"
import { ReportDialog } from "@/features/reports/ReportDialog"
import { useAuthStore } from "@/stores/authStore"
import { socket } from "@/lib/socket/client"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { MediaPlaceholder } from "@/components/shared/MediaPlaceholder"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils"

type CommentValues = z.infer<typeof commentSchema>

export default function PostDetailPage() {
  const { postId = "" } = useParams()
  const { data: post, isLoading } = usePost(postId)
  const toggleLike = useToggleLike()
  const savePost = useSavePost()
  const createComment = useCreateComment()
  const startNegotiation = useStartNegotiation()
  const createIntent = useCreatePaymentIntent()
  const hasToken = useAuthStore((s) => !!s.accessToken)
  const [reportOpen, setReportOpen] = React.useState(false)

  const form = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: "" },
  })

  React.useEffect(() => {
    if (!postId) return
    socket.emit("join_post_room", postId)
    return () => {
      socket.emit("leave_post_room", postId)
    }
  }, [postId])

  if (isLoading || !post) {
    return (
      <div className="rounded-card bg-card p-8 text-sm text-muted-foreground ring-1 ring-foreground/10">
        Loading post…
      </div>
    )
  }

  const onSubmitComment = (values: CommentValues) => {
    createComment.mutate(
      { postId: post.id, text: values.text },
      {
        onSuccess: () => {
          toast.success(`POST /posts/${post.id}/comments`)
          form.reset()
        },
        onError: () => toast.error("Failed to post comment"),
      }
    )
  }

  const price = post.price

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft />
        Back
      </Link>

      <article className="flex flex-col gap-4 rounded-card bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <AvatarWithFallback name={post.author.name} src={post.author.avatar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{post.author.name}</p>
            <p className="text-xs text-muted-foreground">
              @{post.author.username} · {formatRelativeTime(post.createdAt)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setReportOpen(true)}
            aria-label="Report post"
          >
            <Flag />
          </Button>
        </div>

        {post.media.length > 0 ? (
          <img
            src={post.media[0].url}
            alt={post.caption}
            className="aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <MediaPlaceholder className="rounded-lg" />
        )}

        <h1 className="text-lg leading-snug font-semibold">{post.caption}</h1>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasToken && toggleLike.mutate({ postId: post.id, isLiked: post.isLiked })}
            className={cn(post.isLiked && "text-destructive")}
            disabled={!hasToken}
          >
            <Heart className={cn("size-4", post.isLiked && "fill-current")} />
            {post.likeCount}
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <MessageCircle className="size-4" />
            {post.commentCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasToken && savePost.mutate({ postId: post.id, isSaved: post.isSaved })}
            className={cn(post.isSaved && "text-brand")}
            disabled={!hasToken}
          >
            <Bookmark className={cn("size-4", post.isSaved && "fill-current")} />
            {post.saveCount}
          </Button>
        </div>

        {price != null && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-soft p-3">
            <span className="font-mono text-xl font-bold text-brand">
              {formatCurrency(price, post.currency)}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                onClick={() => {
                  if (hasToken) {
                    createIntent.mutate({
                      postId: post.id,
                      amount: price,
                      currency: post.currency ?? "USD",
                    })
                  }
                }}
                disabled={!hasToken}
              >
                Instant Buy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (hasToken) startNegotiation.mutate({ postId: post.id })
                }}
                disabled={!hasToken}
              >
                Negotiate
              </Button>
            </div>
          </div>
        )}
      </article>

      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {post.commentCount > 0 ? (
            <div className="flex flex-col gap-3">
              {post.commentCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No comments yet — be the first.
            </p>
          )}

          {hasToken ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmitComment)}
                className="flex items-center gap-2"
              >
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem className="grid flex-1">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Add a comment"
                          aria-label="Add a comment"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" size="sm" disabled={createComment.isPending}>
                  Post
                </Button>
              </form>
            </Form>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-brand">
                Log in
              </Link>{" "}
              to comment or negotiate.
            </p>
          )}
        </CardContent>
      </Card>

      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
        GET /posts/{post.id}
      </Badge>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        presetTargetType="post"
        presetTargetId={post.id}
      />
    </div>
  )
}
