import { TableSkeleton } from "./table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function TradesLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="hidden h-9 w-28 sm:block" />
      </div>
      <TableSkeleton />
    </div>
  )
}
