// Trades list page — fetches trades for the current user filtered by status.
// Filter state lives in the URL (?status=open|closed|all) for SSR compatibility.
import { Suspense } from "react"
import { desc, eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { trades } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { TradeList } from "./trade-list"
import { LogTradeModal } from "./log-trade-modal"
import { TableSkeleton } from "./table-skeleton"

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function TradesPage({ searchParams }: Props) {
  const session = await requireAuth()
  const { status } = await searchParams

  const normalizedStatus =
    status === "open" || status === "closed" ? status : "all"

  const rows = await db.query.trades.findMany({
    where:
      normalizedStatus === "all"
        ? eq(trades.userId, session.user.id)
        : and(
            eq(trades.userId, session.user.id),
            eq(trades.status, normalizedStatus)
          ),
    orderBy: [desc(trades.entryDate)],
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">
            Your complete trading history
          </p>
        </div>
        {/* CTA shown in the header on desktop; floating on mobile (below) */}
        <div className="hidden sm:block">
          <LogTradeModal />
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <TradeList trades={rows} activeStatus={normalizedStatus} />
      </Suspense>

      {/* Floating CTA — bottom-right on mobile per SPEC */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <LogTradeModal floating />
      </div>
    </div>
  )
}
