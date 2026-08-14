import { create } from "zustand"

export const ADMIN_VIEWS = [
  "overview",
  "posts",
  "categories",
  "users",
  "reports",
  "notifications",
  "conversations",
  "payments",
  "audit-logs",
  "uploads",
] as const

export type AdminViewName = (typeof ADMIN_VIEWS)[number]

interface AdminUiState {
  isSidebarOpen: boolean
  globalSearchQuery: string
  activeFilterPill: Partial<Record<AdminViewName, string>>
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setGlobalSearchQuery: (query: string) => void
  setFilterPill: (view: AdminViewName, pillId: string) => void
}

export const useAdminUiStore = create<AdminUiState>()((set) => ({
  isSidebarOpen: false,
  globalSearchQuery: "",
  activeFilterPill: {},
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setGlobalSearchQuery: (globalSearchQuery) => set({ globalSearchQuery }),
  setFilterPill: (view, pillId) =>
    set((s) => ({
      activeFilterPill: { ...s.activeFilterPill, [view]: pillId },
    })),
}))
