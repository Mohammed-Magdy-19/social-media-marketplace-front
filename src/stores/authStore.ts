import { create } from "zustand"
import type { PublicUser } from "@/types"
import { queryClient } from "@/lib/queryClient"
import { socket } from "@/lib/socket/client"

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

export const useAuthStore = create<AuthState>((set) => ({
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
    set({ user: null, accessToken: null, status: "unauthenticated" })
    queryClient.clear()
  },
  logout: () => {
    set({ user: null, accessToken: null, status: "unauthenticated" })
    queryClient.clear()
  },
}))
