import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Check, ShieldCheck } from "lucide-react"
import { useAdminUsers } from "@/features/admin/queries"
import { useSetUserStatus, useUpdateUserRole } from "@/features/admin/mutations"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { StatusPill } from "@/features/admin/components/StatusPill"
import { TablePagination } from "@/features/admin/components/TablePagination"
import { VirtualTable, type VirtualColumn } from "@/features/admin/components/VirtualTable"
import { useAuthStore } from "@/stores/authStore"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api/errors"
import type { PublicUser, UserRole, UserStatus } from "@/types"

const STATUS_FILTER_OPTIONS: { value: "all" | UserStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
]

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
]

const ROLE_FILTER_OPTIONS: { value: "all" | UserRole; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "User" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
]

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
]

function validParam<T extends string>(
  value: string | null,
  options: readonly { value: T }[],
  fallback: T
): T {
  return options.some((o) => o.value === value) ? (value as T) : fallback
}

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [banTarget, setBanTarget] = React.useState<PublicUser | null>(null)

  const currentUser = useAuthStore((s) => s.user)

  const rawPage = Number(searchParams.get("page"))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const activeStatus = validParam(
    searchParams.get("status"),
    STATUS_FILTER_OPTIONS,
    "all"
  )
  const activeRole = validParam(
    searchParams.get("role"),
    ROLE_FILTER_OPTIONS,
    "all"
  )
  const searchFromUrl = searchParams.get("search") ?? ""
  const [search, setSearch] = React.useState(searchFromUrl)

  const setStatus = useSetUserStatus()
  const updateRole = useUpdateUserRole()

  React.useEffect(() => {
    const t = setTimeout(() => {
      setParam("search", search.trim())
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value === "all" || value === "") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    next.delete("page")
    setSearchParams(next, { replace: true })
  }

  const goToPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set("page", String(p))
    setSearchParams(next, { replace: true })
  }

  const { data, isLoading } = useAdminUsers(page, {
    search: searchFromUrl || undefined,
    role: activeRole === "all" ? undefined : activeRole,
    status: activeStatus === "all" ? undefined : activeStatus,
  })

  const rows = data?.data ?? []
  const hasMore = data?.pagination.hasMore ?? false

  const columns = React.useMemo<VirtualColumn<PublicUser>[]>(
    () => [
      {
        key: "user",
        header: "User",
        className: "min-w-60",
        cell: (u: PublicUser) => (
          <div className="flex items-center gap-2.5">
            <AvatarWithFallback name={u.name} src={u.avatar ?? null} size="sm" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                {u.name}
                {u.role === "admin" && (
                  <ShieldCheck className="size-3.5 shrink-0 text-violet" />
                )}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">@{u.username}</p>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        className: "min-w-44",
        align: "center",
        cell: (u: PublicUser) => (
          <span className="truncate text-sm text-muted-foreground">{u.email}</span>
        ),
      },
      {
        key: "role",
        header: "Role",
        className: "w-28",
        align: "center",
        cell: (u: PublicUser) => <StatusPill status={u.role} />,
      },
      {
        key: "status",
        header: "Status",
        className: "w-28",
        align: "center",
        cell: (u: PublicUser) => <StatusPill status={u.status} />,
      },
      {
        key: "joined",
        header: "Joined",
        className: "min-w-24",
        align: "center",
        cell: (u: PublicUser) => (
          <span className="text-xs text-muted-foreground">{formatRelativeTime(u.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "w-36",
        align: "center",
        cell: (u: PublicUser) => {
          const isSelf = u.id === currentUser?.id
          return (
            <div className="flex items-center justify-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="xs"
                      aria-label="Change role or status"
                      disabled={isSelf}
                    >
                      <span className="text-[11px]">Moderate</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Change role
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ROLE_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      disabled={u.role === option.value}
                      onClick={() =>
                        updateRole.mutate({ id: u.id, role: option.value })
                      }
                    >
                      <span className="flex-1">{option.label}</span>
                      {u.role === option.value && <Check className="size-3.5" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Set account status
                  </DropdownMenuLabel>
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      disabled={u.status === option.value}
                      onClick={() => {
                        if (option.value === "banned") {
                          setBanTarget(u)
                          return
                        }
                        setStatus.mutate({ id: u.id, status: option.value })
                      }}
                    >
                      <span className="flex-1">{option.label}</span>
                      {u.status === option.value && <Check className="size-3.5" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [currentUser?.id, setStatus, updateRole]
  )

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Users"
        subtitle="Manage accounts, roles, and moderation status"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="h-8 w-48"
          aria-label="Search users"
        />
      </AdminPageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activeRole}
          onValueChange={(value) => {
            if (value) setParam("role", value)
          }}
        >
          <SelectTrigger size="sm" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeStatus}
          onValueChange={(value) => {
            if (value) setParam("status", value)
          }}
        >
          <SelectTrigger size="sm" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="font-mono text-xs text-muted-foreground">
          {rows.length} user{rows.length === 1 ? "" : "s"}
          {activeRole !== "all" && ` · ${activeRole}`}
          {activeStatus !== "all" && ` · ${activeStatus}`}
          {searchFromUrl && ` · “${searchFromUrl}”`}
        </span>
      </div>

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

      <TablePagination page={page} hasMore={hasMore} onPageChange={goToPage} />

      <AlertDialog
        open={banTarget !== null}
        onOpenChange={(open) => !open && setBanTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {banTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Banned accounts are immediately locked out and their listings
              are hidden from the marketplace. They will be signed out of all
              devices immediately. This can be reversed later.
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
    </div>
  )
}
