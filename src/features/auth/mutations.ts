import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { queryClient } from "@/lib/queryClient"
import type { PublicUser } from "@/types"
import type { z } from "zod"
import type { loginSchema, registerSchema } from "./schemas"

type LoginInput = z.infer<typeof loginSchema>
type RegisterInput = z.infer<typeof registerSchema>

interface AuthSessionData {
  user: PublicUser
  accessToken?: string
}

interface AuthResponse {
  status: string
  data: AuthSessionData
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiPost<AuthResponse>("/auth/login", input),
    onSuccess: (data) => {
      const { user, accessToken } = data.data
      useAuthStore.getState().setSession(user, accessToken ?? null)
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost<AuthResponse>("/auth/register", input),
    onSuccess: (data) => {
      const { user, accessToken } = data.data
      useAuthStore.getState().setSession(user, accessToken ?? null)
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    },
  })
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: () => apiPost<{ status: string }>("/auth/logout"),
    onSettled: () => {
      useAuthStore.getState().logout()
    },
  })
}
