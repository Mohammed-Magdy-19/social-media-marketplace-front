import * as React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: React.ReactNode
  /** Custom fallback UI; defaults to a full-page recovery screen. */
  fallback?: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Class-component error boundary. Catches render/effect errors in the tree
 * below it and shows a recoverable fallback instead of crashing the app. Stack
 * traces are logged via `console.error` but never surfaced to the user.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Importing a module script failed") ||
      error?.name === "ChunkLoadError"

    if (isChunkError) {
      const storageKey = "chunk_reload_retry"
      const lastRetry = sessionStorage.getItem(storageKey)
      const now = Date.now()
      if (!lastRetry || now - Number(lastRetry) > 10000) {
        sessionStorage.setItem(storageKey, String(now))
        window.location.reload()
        return
      }
    }
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Importing a module script failed")

      if (this.props.fallback && !isChunkError) {
        return this.props.fallback
      }
      return (
        <div className="flex min-h-[50svh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <RefreshCw className="size-6" />
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h1 className="text-lg font-bold text-foreground">
              {isChunkError ? "App Update Available" : "Something went wrong"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? "A new version of the app was deployed. Please refresh to load the latest updates."
                : "An unexpected error occurred. Please reload the page to continue."}
            </p>
          </div>
          <Button onClick={this.handleReload} className="rounded-full px-5 font-semibold">
            Reload page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Compact fallback for isolated sections of a page. Keeps the surrounding UI
 * alive when a single component fails to render.
 */
export function SectionFallback() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-card bg-card p-6 text-center ring-1 ring-foreground/10">
      <p className="text-sm font-medium">This section hit an error</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Something went wrong while rendering this section. The rest of the page
        is still working.
      </p>
    </div>
  )
}
