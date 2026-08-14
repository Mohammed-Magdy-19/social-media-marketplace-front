import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { useCurrentUser } from "@/features/auth/queries"
import type { UserRole } from "@/types"

function useAuthGate() {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const { data: currentUser } = useCurrentUser()
  const resolvedUser = currentUser ?? user
  return { isHydrated, accessToken, user: resolvedUser }
}

function AuthRedirect() {
  const hasAccount = useAuthStore((s) => s.hasAccount)
  const location = useLocation()
  return (
    <Navigate
      to={hasAccount ? "/login" : "/register"}
      replace
      state={{ from: location.pathname }}
    />
  )
}

export function RequireAuth() {
  const { isHydrated, accessToken } = useAuthGate()

  if (!isHydrated) return null
  if (!accessToken) return <AuthRedirect />
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const { isHydrated, accessToken, user } = useAuthGate()

  if (!isHydrated) return null
  if (!accessToken) return <AuthRedirect />
  if (!user || user.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
