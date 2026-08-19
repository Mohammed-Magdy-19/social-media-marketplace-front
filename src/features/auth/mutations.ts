import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { setStoredRefreshToken } from "@/lib/refresh-storage"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, PublicUser } from "@/types"
import type { z } from "zod"
import type { loginSchema, registerSchema } from "./schemas"

type LoginInput = z.infer<typeof loginSchema>
type RegisterInput = z.infer<typeof registerSchema>

interface AuthSessionData {
  user: PublicUser
  accessToken: string
  refreshToken: string
}

interface AuthMessageData {
  message: string
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiPost<ApiResponse<AuthSessionData>>("/auth/login", input),
    onSuccess: (data) => {
      const { user, accessToken, refreshToken } = data.data
      if (refreshToken) setStoredRefreshToken(refreshToken)
      useAuthStore.getState().setSession(user, accessToken)
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost<AuthMessageData>("/auth/register", input),
  })
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: () => apiPost<{ status: string }>("/auth/logout"),
    onMutate: () => {
      useAuthStore.getState().logout()
    },
  })
}
