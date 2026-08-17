import { useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  AdminDashboard,
  ApiResponse,
  AuditAction,
  AuditLog,
  Conversation,
  PaginatedResponse,
  Payment,
  PaymentStatus,
  Post,
  PublicUser,
  Report,
  Upload,
  UserRole,
  UserStatus,
} from "@/types"

export interface AdminPostsFilters {
  status?: string
  search?: string
}

export interface AdminUsersFilters {
  search?: string
  role?: UserRole
  status?: UserStatus
}

export interface AdminPaymentsFilters {
  status?: PaymentStatus
}

export interface AuditLogsFilters {
  actor?: string
  action?: AuditAction
}

export interface ReportsFilters {
  status?: string
  page?: number
}

export function useReports(filters: ReportsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.all(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Report>>("/reports", {
        params: {
          status: filters.status ?? undefined,
          page: filters.page ?? undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<AdminDashboard>>(
        "/admin/dashboard",
        { signal }
      )
      return res.data
    },
    enabled,
    staleTime: 60_000,
  })
}

export function useAdminPosts(filters: AdminPostsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.admin.posts(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Post>>("/posts", {
        params: {
          status: filters.status ?? undefined,
          search: filters.search ?? undefined,
          scope: "admin",
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Offset-paginated admin user list (spec §3.1 / api §5.11). `search` is
 * sent as raw, unescaped text — the backend escapes regex metacharacters
 * server-side, so any client-side escaping would double-escape and corrupt
 * searches containing `.`, `+`, etc.
 */
export function useAdminUsers(
  page = 1,
  filters: AdminUsersFilters = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.users({ page, ...filters }),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<PublicUser>>("/admin/users", {
        params: {
          search: filters.search ?? undefined,
          role: filters.role ?? undefined,
          status: filters.status ?? undefined,
          page,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Assumed admin-scoped REST list of §D conversation resources — the PSD
 * specifies the thread list UI (sorted by lastMessage, typing on top) but
 * not the literal route. Confirm with backend before shipping.
 */
export function useAdminConversations() {
  return useQuery({
    queryKey: queryKeys.admin.conversations(),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Conversation>>("/admin/conversations", {
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Global transaction ledger for admins — NOT the self-scoped `/payments/me`
 * route. Gated entirely by `restrictTo('admin')` at the route layer.
 */
export function useAdminPayments(
  page = 1,
  filters: AdminPaymentsFilters = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.payments({ page, ...filters }),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Payment>>("/admin/payments", {
        params: {
          status: filters.status ?? undefined,
          page,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Offset-paginated, immutable audit trail (spec §3.1 / api §5.11).
 * Read-only — there is no mutation counterpart and there must never be
 * edit/delete UI for these rows (spec §7 rule 5).
 */
export function useAuditLogs(
  page = 1,
  filters: AuditLogsFilters = {}
) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs({ page, ...filters }),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<AuditLog>>("/admin/audit-logs", {
        params: {
          actor: filters.actor ?? undefined,
          action: filters.action ?? undefined,
          page,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminUploads(filters: { search?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.admin.uploads(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Upload>>("/uploads", {
        params: { search: filters.search ?? undefined },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}
