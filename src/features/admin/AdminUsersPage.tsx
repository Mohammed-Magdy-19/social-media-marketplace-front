import * as React from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { useAdminUsers } from "@/features/admin/queries"
import { useSetUserStatus, useDelRow } from "@/features/admin/mutations"
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
import { cn, formatRelativeTime } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api/errors"
import type { PublicUser } from "@/types"

const USER_PILLS = ["All", "active", "suspended", "banned"] as const

export default function AdminUsersPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [banTarget, setBanTarget] = React.useState<PublicUser | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<PublicUser | null>(null)

  const activePill = useAdminUiStore((s) => s.activeFilterPill.users) ?? "All"
  const setFilterPill = useAdminUiStore((s) => s.setFilterPill)
  const setStatus = useSetUserStatus()
  const delRow = useDelRow()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useAdminUsers({
    status: activePill === "All" ? undefined : activePill,
    search: debounced || undefined,
  })

  const rows = data?.data ?? []

  const columns = React.useMemo(
    () => [
      {
        key: "user",
        header: "User",
        className: "min-w-56",
        cell: (u: PublicUser) => (
          <div className="flex items-center gap-2">
            <AvatarWithFallback name={u.name} src={u.avatar ?? null} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{u.name}</p>
              <p className="truncate font-mono text-[10px] text-mut">@{u.username}</p>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        className: "min-w-40",
        cell: (u: PublicUser) => (
          <span className="text-sm text-mut">{u.email}</span>
        ),
      },
      {
        key: "role",
        header: "Role",
        cell: (u: PublicUser) => <StatusPill status={u.role} />,
      },
      {
        key: "status",
        header: "Status",
        cell: (u: PublicUser) => <StatusPill status={u.status} />,
      },
      {
        key: "joined",
        header: "Joined",
        className: "min-w-24",
        cell: (u: PublicUser) => (
          <span className="text-xs text-mut">{formatRelativeTime(u.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-24 text-right",
        cell: (u: PublicUser) => (
          <div className="flex justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="xs" aria-label="Change status">
                    <span className="text-[11px]">Status</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    setStatus.mutate({ id: u.id, status: "active" })
                  }
                >
                  Set Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    setStatus.mutate({ id: u.id, status: "suspended" })
                  }
                >
                  Set Suspended
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setBanTarget(u)}
                >
                  Ban permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete user"
              className="text-err hover:bg-err-soft"
              onClick={() => setDeleteTarget(u)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [setStatus]
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Users"
        subtitle="Manage accounts, roles, and moderation status"
        endpoint="GET /admin/users"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="h-8 w-48"
          aria-label="Search users"
        />
      </AdminPageHeader>

      <FilterPills
        pills={[...USER_PILLS]}
        value={activePill}
        onChange={(pill) => setFilterPill("users", pill)}
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
              rowKey={(u) => u.id}
              emptyState="No users match the current filter."
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={banTarget !== null}
        onOpenChange={(open) => !open && setBanTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {banTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Banned accounts are immediately locked out and their listings are
              hidden from the marketplace. This can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={setStatus.isPending}
              onClick={() => {
                if (!banTarget) return
                setStatus.mutate(
                  { id: banTarget.id, status: "banned" },
                  {
                    onError: (error) =>
                      toast.error(getErrorMessage(error)),
                  }
                )
                setBanTarget(null)
              }}
            >
              Ban user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account for{" "}
              <span className={cn("font-medium text-ink")}>
                {deleteTarget?.name}
              </span>{" "}
              and all of its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={delRow.isPending}
              onClick={() => {
                if (!deleteTarget) return
                delRow.mutate({ table: "users", id: deleteTarget.id })
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
