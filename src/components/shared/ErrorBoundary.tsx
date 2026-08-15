import * as React from "react"
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-4 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Please reload the page to continue.
          </p>
          <Button onClick={this.handleReload}>Reload page</Button>
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
