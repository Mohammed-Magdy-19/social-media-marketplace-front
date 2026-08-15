import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"

interface AuthState {
  user: PublicUser | null
  accessToken: string | null
  refreshToken: string | null
  isHydrated: boolean
  hasAccount: boolean
  restoringSession: boolean
  setSession: (
    user: PublicUser | null,
    accessToken: string | null,
    refreshToken?: string | null
  ) => void
  setUser: (user: PublicUser | null) => void
  setRestoringSession: (restoring: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,
      hasAccount: false,
      restoringSession: false,
      setSession: (user, accessToken, refreshToken = null) =>
        set((state) => ({
          user,
          accessToken,
          refreshToken,
          isHydrated: true,
          hasAccount: state.hasAccount || !!user || !!accessToken,
        })),
      setUser: (user) => set({ user }),
      setRestoringSession: (restoringSession) => set({ restoringSession }),
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isHydrated: true,
          hasAccount: false,
        })
        queryClient.clear()
      },
    }),
    {
      name: "vendo-session",
      partialize: (state) => ({
        hasAccount: state.hasAccount,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setSession(null, null, state.refreshToken ?? null)
        if (state?.hasAccount) {
          state.setRestoringSession(true)
        }
      },
    }
  )
)
