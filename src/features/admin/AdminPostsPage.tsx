import * as React from "react"
import { toast } from "sonner"
import { Eye, Trash2 } from "lucide-react"
import { useAdminPosts } from "@/features/admin/queries"
import { useTogglePostStatus, useDelRow } from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { FilterPills } from "@/features/admin/components/FilterPills"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { VirtualTable } from "@/features/admin/components/VirtualTable"
import { useAdminUiStore } from "@/stores/adminUiStore"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency, formatRelativeTime } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api/errors"
import type { Post } from "@/types"

const POST_PILLS = ["All", "active", "hidden", "flagged"] as const

export default function AdminPostsPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [deleteTarget, setDeleteTarget] = React.useState<Post | null>(null)

  const activePill = useAdminUiStore((s) => s.activeFilterPill.posts) ?? "All"
  const setFilterPill = useAdminUiStore((s) => s.setFilterPill)
  const toggleStatus = useTogglePostStatus()
  const delRow = useDelRow()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useAdminPosts({
    status: activePill === "All" ? undefined : activePill,
    search: debounced || undefined,
  })

  const rows = data?.data ?? []

  const columns = React.useMemo(
    () => [
      {
        key: "title",
        header: "Listing",
        className: "min-w-56",
        cell: (post: Post) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback name={post.title} src={post.media[0] ?? null} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{post.title}</p>
              <p className="font-mono text-[10px] text-mut">{post.id}</p>
            </div>
          </div>
        ),
      },
      {
        key: "author",
        header: "Seller",
        className: "min-w-32",
        cell: (post: Post) => (
          <span className="text-sm text-ink">{post.author.name}</span>
        ),
      },
      {
        key: "price",
        header: "Price",
        cell: (post: Post) => (
          <span className="font-mono text-sm text-ink">
            {post.price != null ? formatCurrency(post.price, post.currency) : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (post: Post) => <StatusPill status={post.status} />,
      },
      {
        key: "created",
        header: "Created",
        className: "min-w-24",
        cell: (post: Post) => (
          <span className="text-xs text-mut">{formatRelativeTime(post.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-24 text-right",
        cell: (post: Post) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Preview">
              <Eye />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="xs" aria-label="Change status">
                    <span className="text-[11px]">Status</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {(["active", "hidden", "flagged"] as const).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onSelect={() =>
                      toggleStatus.mutate(
                        { id: post.id, status: s },
                        {
                          onError: (error) =>
                            toast.error(getErrorMessage(error)),
                        }
                      )
                    }
                  >
                    Mark {s.charAt(0).toUpperCase() + s.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete post"
              className="text-err hover:bg-err-soft"
              onClick={() => setDeleteTarget(post)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [toggleStatus]
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Posts"
        subtitle="Review and moderate every listing"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings…"
          className="h-8 w-48"
          aria-label="Search posts"
        />
      </AdminPageHeader>

      <FilterPills
        pills={[...POST_PILLS]}
        value={activePill}
        onChange={(pill) => setFilterPill("posts", pill)}
      />

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <VirtualTable
              rows={rows}
              columns={columns}
              rowKey={(p) => p.id}
              emptyState="No posts match the current filter."
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-ink">{deleteTarget?.title}</span>{" "}
              and all of its media. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={delRow.isPending}
              onClick={() => {
                if (!deleteTarget) return
                delRow.mutate({ table: "posts", id: deleteTarget.id })
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
