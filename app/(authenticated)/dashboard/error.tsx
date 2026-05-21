"use client"
import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    // Log to the server-side logger (falls back to console in the browser)
    logger.error("dashboard:unhandled_error", {
      message: error.message,
      digest: error.digest ?? "none",
    })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          An unexpected error occurred. Your data is safe — this is a display issue only.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        <RefreshCw className="mr-1.5 size-3.5" />
        Try again
      </Button>
    </div>
  )
}
