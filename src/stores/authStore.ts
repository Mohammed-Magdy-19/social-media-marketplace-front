import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"

interface AuthState {
  user: PublicUser | null
  accessToken: string | null
  isHydrated: boolean
  hasAccount: boolean
  restoringSession: boolean
  setSession: (user: PublicUser | null, accessToken: string | null) => void
  setUser: (user: PublicUser | null) => void
  setRestoringSession: (restoring: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isHydrated: false,
      hasAccount: false,
      restoringSession: false,
      setSession: (user, accessToken) =>
        set((state) => ({
          user,
          accessToken,
          isHydrated: true,
          hasAccount: state.hasAccount || !!user || !!accessToken,
        })),
      setUser: (user) => set({ user }),
      setRestoringSession: (restoringSession) => set({ restoringSession }),
      logout: () => {
        set({ user: null, accessToken: null, isHydrated: true })
        queryClient.clear()
      },
    }),
    {
      name: "vendo-session",
      partialize: (state) => ({
        hasAccount: state.hasAccount,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setSession(null, null)
        if (state?.hasAccount) {
          state.setRestoringSession(true)
        }
      },
    }
  )
)
