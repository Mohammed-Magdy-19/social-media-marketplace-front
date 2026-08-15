import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PublicUser } from "@/types"
import type { z } from "zod"
import type { loginSchema, registerSchema } from "./schemas"

type LoginInput = z.infer<typeof loginSchema>
type RegisterInput = z.infer<typeof registerSchema>

interface AuthSessionData {
  user: PublicUser
  accessToken?: string
  refreshToken?: string
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiPost<ApiResponse<AuthSessionData>>("/auth/login", input),
    onSuccess: (data) => {
      const { user, accessToken, refreshToken } = data.data
      useAuthStore
        .getState()
        .setSession(user, accessToken ?? null, refreshToken ?? null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost<ApiResponse<AuthSessionData>>("/auth/register", input),
    onSuccess: (data) => {
      const { user, accessToken, refreshToken } = data.data
      useAuthStore
        .getState()
        .setSession(user, accessToken ?? null, refreshToken ?? null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
    },
  })
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: () => {
      const refreshToken = useAuthStore.getState().refreshToken
      return apiPost<{ status: string }>(
        "/auth/logout",
        refreshToken ? { refreshToken } : {}
      )
    },
    onSettled: () => {
      useAuthStore.getState().logout()
    },
  })
}
