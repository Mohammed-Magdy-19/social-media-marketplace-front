import * as React from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Class-component error boundary provider. Catches render/effect errors in
 * the tree below it (query client, router, socket-driven views) and shows a
 * recoverable fallback instead of unmounting the whole app.
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
      return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-4 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            An unexpected error occurred. Please reload the page to continue.
          </p>
          <pre className="max-h-32 max-w-full overflow-auto rounded-lg bg-soft p-3 text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button onClick={this.handleReload}>Reload page</Button>
        </div>
      )
    }
    return this.props.children
  }
}
