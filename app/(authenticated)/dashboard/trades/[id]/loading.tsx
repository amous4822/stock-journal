import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function TradeDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl">
      <Skeleton className="h-4 w-28" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
              <Skeleton className="h-px w-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
