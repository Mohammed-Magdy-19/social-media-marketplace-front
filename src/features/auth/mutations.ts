import { useMutation } from "@tanstack/react-query"
import { apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { queryClient } from "@/lib/queryClient"
import type { PublicUser } from "@/types"
import type { z } from "zod"
import type { loginSchema, registerSchema } from "./schemas"

type LoginInput = z.infer<typeof loginSchema>
type RegisterInput = z.infer<typeof registerSchema>

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiPost<{ accessToken: string; user: PublicUser }>("/auth/login", input),
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data.user, data.accessToken)
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    },
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost<{ accessToken: string; user: PublicUser }>("/auth/register", input),
    onSuccess: (data) => {
      useAuthStore.getState().setSession(data.user, data.accessToken)
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    },
  })
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: () => apiPost<{ ok: true }>("/auth/logout"),
    onSettled: () => {
      useAuthStore.getState().logout()
    },
  })
}
