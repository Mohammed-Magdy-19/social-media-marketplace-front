import { useEffect } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { queryClient } from "@/lib/queryClient"
import { router } from "@/router"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { useSocketLifecycle } from "@/lib/socket/lifecycle"
import { useAuthStore } from "@/stores/authStore"
import { useAuthBootstrap } from "@/features/auth/queries"

function useSessionRestore() {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthBootstrap()

  useEffect(() => {
    if (status !== "idle") return
    useAuthStore.getState().setStatus("authenticating")
  }, [status])

  useEffect(() => {
    if (status !== "authenticating") return
    if (bootstrap.data) {
      useAuthStore.getState().setUser(bootstrap.data)
      useAuthStore.getState().setStatus("authenticated")
    } else if (bootstrap.isError) {
      useAuthStore.getState().setStatus("unauthenticated")
    }
  }, [status, bootstrap.data, bootstrap.isError])
}

function App() {
  useSessionRestore()
  useSocketLifecycle()

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
