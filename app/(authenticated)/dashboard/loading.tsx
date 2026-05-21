import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="size-5 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Shadow portfolio */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent trades */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-4 py-3">
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 border-t border-border px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
