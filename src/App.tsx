import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { queryClient } from "@/lib/queryClient"
import { router } from "@/router"
import { Toaster } from "@/components/ui/sonner"
import { useSocketLifecycle } from "@/lib/socket/lifecycle"

function App() {
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
