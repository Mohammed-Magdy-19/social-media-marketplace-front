import { useQuery } from "@tanstack/react-query"
import { keepPreviousData } from "@tanstack/react-query"
import { apiGet } from "@/lib/api/client"
import type {
  AdminDashboard,
  AuditLog,
  Conversation,
  CursorPage,
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

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: ({ signal }) =>
      apiGet<AdminDashboard>("/admin/dashboard", { signal }),
    staleTime: 20_000,
  })
}

export function useAdminPosts(filters: AdminPostsFilters = {}) {
  return useQuery({
    queryKey: ["admin", "posts", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Post>>("/posts", {
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
    queryKey: ["admin", "users", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<PublicUser>>("/admin/users", {
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
    queryKey: ["reports", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Report>>("/reports", {
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
    queryKey: ["admin", "conversations"],
    queryFn: ({ signal }) =>
      apiGet<Conversation[]>("/admin/conversations", { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminPayments(filters: AdminPaymentsFilters = {}) {
  return useQuery({
    queryKey: ["admin", "payments", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Payment>>("/payments/me", {
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
    queryKey: ["admin", "audit-logs"],
    queryFn: ({ signal }) =>
      apiGet<AuditLog[]>("/admin/audit-logs", { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminUploads(filters: { search?: string } = {}) {
  return useQuery({
    queryKey: ["admin", "uploads", filters],
    queryFn: ({ signal }) =>
      apiGet<CursorPage<Upload>>("/uploads", {
        params: { search: filters.search ?? undefined },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}
