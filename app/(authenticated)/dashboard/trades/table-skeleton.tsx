// Loading skeleton for the trades table — shown while data is streaming.
export function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-lg border border-border p-4">
      <div className="h-4 w-1/3 rounded bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-4 flex-1 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
