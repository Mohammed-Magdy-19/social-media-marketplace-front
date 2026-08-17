import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { RouteSkeleton } from "@/components/shared/RouteSkeleton"
import type { UserRole } from "@/types"

export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === "idle" || status === "authenticating") {
    return <RouteSkeleton />
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (status === "idle" || status === "authenticating") {
    return <RouteSkeleton />
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!user || user.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
