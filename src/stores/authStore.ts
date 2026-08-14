import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"

interface AuthState {
  user: PublicUser | null
  accessToken: string | null
  isHydrated: boolean
  hasAccount: boolean
  setSession: (user: PublicUser | null, accessToken: string | null) => void
  setUser: (user: PublicUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isHydrated: false,
      hasAccount: false,
      setSession: (user, accessToken) =>
        set((state) => ({
          user,
          accessToken,
          isHydrated: true,
          hasAccount: state.hasAccount || !!user || !!accessToken,
        })),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ user: null, accessToken: null, isHydrated: true })
        queryClient.clear()
      },
    }),
    {
      name: "vendo-session",
      partialize: (state) => ({
        accessToken: state.accessToken,
        hasAccount: state.hasAccount,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setSession(null, state.accessToken)
      },
    }
  )
)
