import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom"
import { RouteSkeleton } from "@/components/shared/RouteSkeleton"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { RequireAuth, RequireRole } from "@/components/routing/guards"

function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function HomeRedirect() {
  const location = useLocation()
  return <Navigate to={`/home${location.search}`} replace />
}

const ShellLayout = lazy(() => import("@/components/layout/ShellLayout"))
const HomePage = lazy(() => import("@/features/home/HomePage"))
const MarketPage = lazy(() => import("@/features/home/MarketPage"))
const PostDetailPage = lazy(() => import("@/features/posts/PostDetailPage"))
const SavedPage = lazy(() => import("@/features/posts/SavedPage"))
const MessagesPage = lazy(() => import("@/features/conversations/MessagesPage"))
const CheckoutPage = lazy(() => import("@/features/payments/CheckoutPage"))
const LoginPage = lazy(() => import("@/features/auth/LoginPage"))
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"))
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"))
const UserProfilePage = lazy(() => import("@/features/profile/UserProfilePage"))

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
    path: "/login",
    element: (
      <PageBoundary>
        <LoginPage />
      </PageBoundary>
    ),
  },
  {
    path: "/register",
    element: (
      <PageBoundary>
        <RegisterPage />
      </PageBoundary>
    ),
  },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: (
          <PageBoundary>
            <ShellLayout />
          </PageBoundary>
        ),
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            path: "home",
            element: (
              <PageBoundary>
                <HomePage />
              </PageBoundary>
            ),
          },
          {
            path: "market",
            element: (
              <PageBoundary>
                <MarketPage />
              </PageBoundary>
            ),
          },
          {
            path: "posts/:postId",
            element: (
              <PageBoundary>
                <PostDetailPage />
              </PageBoundary>
            ),
          },
          {
            path: "messages/:conversationId?",
            element: (
              <PageBoundary>
                <MessagesPage />
              </PageBoundary>
            ),
          },
          {
            path: "checkout/:intentId?",
            element: (
              <PageBoundary>
                <CheckoutPage />
              </PageBoundary>
            ),
          },
          {
            path: "saved",
            element: (
              <PageBoundary>
                <SavedPage />
              </PageBoundary>
            ),
          },
          {
            path: "profile",
            element: (
              <PageBoundary>
                <ProfilePage />
              </PageBoundary>
            ),
          },
          {
            path: "users/:userId",
            element: (
              <PageBoundary>
                <UserProfilePage />
              </PageBoundary>
            ),
          },
        ],
      },
      {
        path: "admin",
        element: <RequireRole role="admin" />,
        children: [
          {
            element: (
              <PageBoundary>
                <AdminRoot />
              </PageBoundary>
            ),
            children: [
              {
                index: true,
                element: (
                  <PageBoundary>
                    <AdminOverviewPage />
                  </PageBoundary>
                ),
              },
              {
                path: "posts",
                element: (
                  <PageBoundary>
                    <AdminPostsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "categories",
                element: (
                  <PageBoundary>
                    <AdminCategoriesPage />
                  </PageBoundary>
                ),
              },
              {
                path: "users",
                element: (
                  <PageBoundary>
                    <AdminUsersPage />
                  </PageBoundary>
                ),
              },
              {
                path: "reports",
                element: (
                  <PageBoundary>
                    <AdminReportsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "notifications",
                element: (
                  <PageBoundary>
                    <AdminNotificationsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "conversations",
                element: (
                  <PageBoundary>
                    <AdminConversationsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "payments",
                element: (
                  <PageBoundary>
                    <AdminPaymentsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "audit-logs",
                element: (
                  <PageBoundary>
                    <AdminAuditLogsPage />
                  </PageBoundary>
                ),
              },
              {
                path: "uploads",
                element: (
                  <PageBoundary>
                    <AdminUploadsPage />
                  </PageBoundary>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
