import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Flag, Heart, Bookmark, MessageCircle } from "lucide-react"
import type { z } from "zod"
import { usePost, usePostComments } from "@/features/posts/queries"
import { useToggleLike, useSavePost, useCreateComment } from "@/features/posts/mutations"
import { commentSchema } from "@/features/posts/schemas"
import { useStartNegotiation } from "@/features/conversations/mutations"
import { useCreatePaymentIntent } from "@/features/payments/mutations"
import { ReportDialog } from "@/features/reports/ReportDialog"
import { useAuthStore } from "@/stores/authStore"
import { socket } from "@/lib/socket/client"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import { getErrorMessage } from "@/lib/api/errors"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { MediaPlaceholder } from "@/components/shared/MediaPlaceholder"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
  const { data: comments = [], isLoading: isLoadingComments } = usePostComments(postId)
  const toggleLike = useToggleLike()
  const savePost = useSavePost()
  const createComment = useCreateComment()
  const startNegotiation = useStartNegotiation()
  const createIntent = useCreatePaymentIntent()
  const hasToken = useAuthStore((s) => !!s.accessToken)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [reportCommentTarget, setReportCommentTarget] = React.useState<string | null>(null)

  const form = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: "" },
  })

  React.useEffect(() => {
    if (!postId) return
    socket.emit("join_post_room", postId)

    const onCommentEvent = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.comments(postId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(postId),
      })
    }

    socket.on("new_comment", onCommentEvent)
    socket.on("comment_deleted", onCommentEvent)
    socket.on("comment_updated", onCommentEvent)

    return () => {
      socket.emit("leave_post_room", postId)
      socket.off("new_comment", onCommentEvent)
      socket.off("comment_deleted", onCommentEvent)
      socket.off("comment_updated", onCommentEvent)
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
          toast.success("Comment posted")
          form.reset()
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const price = post.price
  const authorName = post.author?.name || post.author?.username || "User"
  const authorId = post.author?.id || (post.author as unknown as { _id?: string })?._id
  const authorProfileLink = authorId ? `/users/${authorId}` : undefined

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft />
        Back
      </Link>

      <ErrorBoundary fallback={<SectionFallback />}>
      <article className="flex flex-col gap-4 rounded-card bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          {authorProfileLink ? (
            <Link to={authorProfileLink} className="transition-opacity hover:opacity-85">
              <AvatarWithFallback
                name={authorName}
                src={post.author?.avatar}
              />
            </Link>
          ) : (
            <AvatarWithFallback
              name={authorName}
              src={post.author?.avatar}
            />
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
              <p className="truncate text-sm font-semibold">
                {authorName}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              @{post.author?.username} · {formatRelativeTime(post.createdAt)}
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

        {(post.media?.length ?? 0) > 0 ? (
          <img
            src={post.media[0]}
            alt={post.title ?? "Post"}
            className="aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <MediaPlaceholder className="rounded-lg" />
        )}

        <h1 className="text-lg leading-snug font-semibold">{post.title}</h1>

        {post.content && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {post.content}
          </p>
        )}

        {(post.tags?.length ?? 0) > 0 && (
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
            disabled={!hasToken || toggleLike.isPending}
          >
            <Heart className={cn("size-4", post.isLiked && "fill-current")} />
            {post.likesCount}
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <MessageCircle className="size-4" />
            {post.commentsCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => hasToken && savePost.mutate({ postId: post.id, isSaved: post.isSaved })}
            className={cn(post.isSaved && "text-brand")}
            disabled={!hasToken || savePost.isPending}
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
                  if (hasToken && post.status === "active") {
                    createIntent.mutate({
                      postId: post.id,
                      amount: Math.round(price * 100),
                      currency: post.currency ?? "USD",
                    })
                  }
                }}
                disabled={!hasToken || post.status !== "active"}
              >
                Instant Buy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (hasToken && authorId)
                    startNegotiation.mutate({ sellerId: authorId, postId: post.id })
                }}
                disabled={!hasToken || !authorId}
              >
                Negotiate
              </Button>
            </div>
          </div>
        )}
      </article>
      </ErrorBoundary>

      <ErrorBoundary fallback={<SectionFallback />}>
      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoadingComments ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : comments.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {comments.length} comment{comments.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-col gap-2.5">
                {comments.map((c) => {
                  const commentAuthorName = c.author?.name || c.author?.username || "User"
                  const commentAuthorId = c.author?.id || (c.author as unknown as { _id?: string })?._id
                  const commentAuthorLink = commentAuthorId ? `/users/${commentAuthorId}` : undefined
                  return (
                    <div
                      key={c.id || (c as unknown as { _id?: string })._id}
                      className="group flex items-start gap-2.5 rounded-lg bg-soft/60 p-3 ring-1 ring-foreground/5"
                    >
                      {commentAuthorLink ? (
                        <Link to={commentAuthorLink} className="transition-opacity hover:opacity-85">
                          <AvatarWithFallback name={commentAuthorName} src={c.author?.avatar} size="sm" />
                        </Link>
                      ) : (
                        <AvatarWithFallback name={commentAuthorName} src={c.author?.avatar} size="sm" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            {commentAuthorLink ? (
                              <Link
                                to={commentAuthorLink}
                                className="text-xs font-semibold text-foreground hover:underline hover:text-brand"
                              >
                                {commentAuthorName}
                              </Link>
                            ) : (
                              <span className="text-xs font-semibold text-foreground">{commentAuthorName}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              if (!hasToken) {
                                toast.error("Please log in to report comments")
                                return
                              }
                              const cId = c.id || (c as unknown as { _id?: string })._id
                              if (cId) setReportCommentTarget(cId)
                            }}
                            aria-label="Report comment"
                            title="Report comment"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity size-6"
                          >
                            <Flag className="size-3" />
                          </Button>
                        </div>
                        <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words">
                          {c.text}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
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
      </ErrorBoundary>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
      />

      <ReportDialog
        open={Boolean(reportCommentTarget)}
        onOpenChange={(open) => {
          if (!open) setReportCommentTarget(null)
        }}
        targetType="comment"
        targetId={reportCommentTarget ?? ""}
      />
    </div>
  )
}

