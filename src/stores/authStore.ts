import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"
import { socket } from "@/lib/socket/client"
import { clearStoredRefreshToken } from "@/lib/refresh-storage"

export type AuthStatus =
  | "idle"
  | "authenticating"
  | "authenticated"
  | "unauthenticated"

interface AuthState {
  user: PublicUser | null
  accessToken: string | null
  status: AuthStatus
  notice: string | null
  setSession: (user: PublicUser, accessToken: string) => void
  setAccessToken: (token: string) => void
  setUser: (user: PublicUser | null) => void
  setStatus: (status: AuthStatus) => void
  setNotice: (notice: string | null) => void
  clear: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      status: "idle",
      notice: null,
      setSession: (user, accessToken) => {
        set({ user, accessToken, status: "authenticated", notice: null })
        socket.auth = { token: accessToken }
        if (socket.connected) socket.disconnect().connect()
      },
      setAccessToken: (token) => {
        set({ accessToken: token })
        socket.auth = { token }
        if (socket.connected) socket.disconnect().connect()
      },
      setUser: (user) => set({ user }),
      setStatus: (status) => set({ status }),
      setNotice: (notice) => set({ notice }),
      clear: () => {
        clearStoredRefreshToken()
        set({ user: null, accessToken: null, status: "unauthenticated" })
        queryClient.clear()
      },
      logout: () => {
        clearStoredRefreshToken()
        set({ user: null, accessToken: null, status: "unauthenticated" })
        queryClient.clear()
      },
    }),
    {
      name: "vendo-auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
)
