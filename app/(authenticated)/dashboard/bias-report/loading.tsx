import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function BiasReportLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32 shrink-0" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
