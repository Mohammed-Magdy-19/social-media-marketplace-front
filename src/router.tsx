import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { RouteSkeleton } from "@/components/shared/RouteSkeleton"
import { RequireAuth, RequireRole } from "@/components/routing/guards"

function Boundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
}

const ShellLayout = lazy(() => import("@/components/layout/ShellLayout"))
const HomePage = lazy(() => import("@/features/home/HomePage"))
const PostDetailPage = lazy(() => import("@/features/posts/PostDetailPage"))
const SavedPage = lazy(() => import("@/features/posts/SavedPage"))
const MessagesPage = lazy(() => import("@/features/conversations/MessagesPage"))
const CheckoutPage = lazy(() => import("@/features/payments/CheckoutPage"))
const LoginPage = lazy(() => import("@/features/auth/LoginPage"))
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"))
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"))

const AdminRoot = lazy(() => import("@/features/admin/AdminRoot"))
const AdminOverviewPage = lazy(() => import("@/features/admin/AdminOverviewPage"))
const AdminPostsPage = lazy(() => import("@/features/admin/AdminPostsPage"))
const AdminCategoriesPage = lazy(
  () => import("@/features/admin/AdminCategoriesPage")
)
const AdminUsersPage = lazy(() => import("@/features/admin/AdminUsersPage"))
const AdminReportsPage = lazy(() => import("@/features/admin/AdminReportsPage"))
const AdminNotificationsPage = lazy(
  () => import("@/features/admin/AdminNotificationsPage")
)
const AdminConversationsPage = lazy(
  () => import("@/features/admin/AdminConversationsPage")
)
const AdminPaymentsPage = lazy(() => import("@/features/admin/AdminPaymentsPage"))
const AdminAuditLogsPage = lazy(
  () => import("@/features/admin/AdminAuditLogsPage")
)
const AdminUploadsPage = lazy(() => import("@/features/admin/AdminUploadsPage"))

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Boundary>
        <ShellLayout />
      </Boundary>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: "posts/:postId", element: <PostDetailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "messages/:conversationId?", element: <MessagesPage /> },
          { path: "checkout/:intentId", element: <CheckoutPage /> },
          { path: "saved", element: <SavedPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "admin",
        element: <RequireRole role="Admin" />,
        children: [
          {
            element: (
              <Boundary>
                <AdminRoot />
              </Boundary>
            ),
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: "posts", element: <AdminPostsPage /> },
              { path: "categories", element: <AdminCategoriesPage /> },
              { path: "users", element: <AdminUsersPage /> },
              { path: "reports", element: <AdminReportsPage /> },
              { path: "notifications", element: <AdminNotificationsPage /> },
              { path: "conversations", element: <AdminConversationsPage /> },
              { path: "payments", element: <AdminPaymentsPage /> },
              { path: "audit-logs", element: <AdminAuditLogsPage /> },
              { path: "uploads", element: <AdminUploadsPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
])
