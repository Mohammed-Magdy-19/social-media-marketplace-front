import { useEffect } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { queryClient } from "@/lib/queryClient"
import { router } from "@/router"
import { Toaster } from "@/components/ui/sonner"
import { useSocketLifecycle } from "@/lib/socket/lifecycle"
import { useAuthStore } from "@/stores/authStore"
import { refreshAccessToken } from "@/lib/api/client"

function useSessionRestore() {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const hasAccount = useAuthStore((s) => s.hasAccount)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!isHydrated || hasAccount === false || accessToken) return
    useAuthStore.getState().setRestoringSession(true)
    refreshAccessToken()
      .catch(() => useAuthStore.getState().logout())
      .finally(() => useAuthStore.getState().setRestoringSession(false))
  }, [isHydrated, hasAccount, accessToken])
}

function App() {
  useSessionRestore()
  useSocketLifecycle()

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
