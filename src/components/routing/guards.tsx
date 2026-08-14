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

export function RequireAuth() {
  const { isHydrated, accessToken } = useAuthGate()
  const location = useLocation()

  if (!isHydrated) return null
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const { isHydrated, accessToken, user } = useAuthGate()
  const location = useLocation()

  if (!isHydrated) return null
  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!user || user.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
