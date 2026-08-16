import { useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import { queryKeys } from "@/api/queryKeys"
import type {
  AdminDashboard,
  ApiResponse,
  AuditLog,
  Conversation,
  PaginatedResponse,
  Payment,
  Post,
  PublicUser,
  Report,
  Upload,
} from "@/types"

export interface AdminPostsFilters {
  status?: string
  search?: string
}

export interface AdminUsersFilters {
  status?: string
  search?: string
}

export interface AdminPaymentsFilters {
  status?: string
  search?: string
}

export interface ReportsFilters {
  status?: string
  search?: string
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
    staleTime: 20_000,
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

export function useAdminUsers(filters: AdminUsersFilters = {}) {
  return useQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<PublicUser>>("/admin/users", {
        params: {
          status: filters.status ?? undefined,
          search: filters.search ?? undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useReports(filters: ReportsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.all(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Report>>("/reports", {
        params: {
          status: filters.status ?? undefined,
          search: filters.search ?? undefined,
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
    queryFn: async ({ signal }) => {
      const res = await apiGet<ApiResponse<{ conversations: Conversation[] }>>(
        "/admin/conversations",
        { signal }
      )
      return res.data.conversations ?? []
    },
    placeholderData: keepPreviousData,
  })
}

export function useAdminPayments(filters: AdminPaymentsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.admin.payments(filters),
    queryFn: ({ signal }) =>
      apiGet<PaginatedResponse<Payment>>("/payments/me", {
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
 * Assumed endpoint — PSD §6.9 specifies the Audit Logs UI but not the
 * literal route. Confirm with backend before shipping.
 */
export function useAuditLogs() {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(),
    queryFn: ({ signal }) =>
      apiGet<AuditLog[]>("/admin/audit-logs", { signal }),
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
