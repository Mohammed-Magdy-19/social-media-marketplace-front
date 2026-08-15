import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Trash2 } from "lucide-react"
import { useAdminUploads } from "@/features/admin/queries"
import { useDelRow } from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { StatusPill } from "@/features/admin/components/StatusPill"
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
import { cn, formatBytes, formatRelativeTime } from "@/lib/utils"
import type { Upload } from "@/types"

function MediaThumb({ upload }: { upload: Upload }) {
  if (upload.kind === "video") {
    return (
      <div className="grid size-full place-items-center bg-soft font-mono text-[10px] text-mut">
        MP4
      </div>
    )
  }
  if (upload.kind === "avatar") {
    return (
      <div className="grid size-full place-items-center">
        <AvatarWithFallback name={upload.name} src={upload.url} size="sm" />
      </div>
    )
  }
  if (upload.kind === "document") {
    return (
      <div className="grid size-full place-items-center bg-soft font-mono text-[10px] text-mut">
        DOC
      </div>
    )
  }
  return (
    <div
      className="size-full bg-cover bg-center"
      style={{ backgroundImage: `url(${upload.url})` }}
      role="img"
      aria-label={upload.name}
    />
  )
}

export default function AdminUploadsPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [deleteTarget, setDeleteTarget] = React.useState<Upload | null>(null)
  const parentRef = React.useRef<HTMLDivElement>(null)

  const delRow = useDelRow()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useAdminUploads({
    search: debounced || undefined,
  })

  const uploads = data?.data ?? []
  const totalBytes = uploads.reduce((sum, u) => sum + u.size, 0)

  const COLUMNS = 4
  const rows = Math.ceil(uploads.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 176,
    overscan: 4,
  })

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Uploads"
        subtitle="Every asset in object storage"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="h-8 w-48"
          aria-label="Search uploads"
        />
      </AdminPageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-mut">
          {uploads.length} assets · {formatBytes(totalBytes)}
        </span>
      </div>

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <p className="py-10 text-center text-sm text-mut">No uploads.</p>
          ) : (
            <div ref={parentRef} className="max-h-[520px] overflow-y-auto">
              <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const rowStart = item.index * COLUMNS
                  const rowUploads = uploads.slice(rowStart, rowStart + COLUMNS)
                  return (
                    <div
                      key={`row-${item.index}`}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute top-0 left-0 grid w-full grid-cols-2 gap-2 p-2 sm:grid-cols-4"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      {rowUploads.map((upload) => (
                        <div
                          key={upload.id}
                          className={cn(
                            "flex flex-col gap-1.5 rounded-lg border border-line-2 bg-soft p-2",
                            deleteTarget?.id === upload.id && "ring-2 ring-err"
                          )}
                        >
                          <div className="aspect-square w-full overflow-hidden rounded-md bg-background">
                            <MediaThumb upload={upload} />
                          </div>
                          <p className="truncate text-xs font-medium text-ink">
                            {upload.name}
                          </p>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] text-mut">
                              {formatBytes(upload.size)}
                            </span>
                            <span className="font-mono text-[10px] text-mut">
                              {formatRelativeTime(upload.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-[10px] text-mut">
                              {upload.owner.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <StatusPill status={upload.kind} />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Delete upload"
                                className="text-err hover:bg-err-soft"
                                onClick={() => setDeleteTarget(upload)}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-ink">{deleteTarget?.name}</span>{" "}
              from object storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={delRow.isPending}
              onClick={() => {
                if (!deleteTarget) return
                delRow.mutate({ table: "uploads", id: deleteTarget.id })
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
