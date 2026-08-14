import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"

interface AuthState {
  user: PublicUser | null
  accessToken: string | null
  isHydrated: boolean
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
      setSession: (user, accessToken) =>
        set({ user, accessToken, isHydrated: true }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ user: null, accessToken: null, isHydrated: true })
        queryClient.clear()
      },
    }),
    {
      name: "vendo-session",
      partialize: (state) => ({ accessToken: state.accessToken }),
      onRehydrateStorage: () => (state) => {
        state?.setSession(null, state.accessToken)
      },
    }
  )
)
