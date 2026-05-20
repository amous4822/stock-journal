// Dashboard home — summary stats + recent trades. Shadow Portfolio widget comes in Phase 3.
import Link from "next/link"
import { desc, eq, sum, sql } from "drizzle-orm"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"
import { db } from "@/lib/db"
import { trades, shadowOutcomes } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatINR, formatDate } from "@/lib/utils"
import { LogTradeModal } from "./trades/log-trade-modal"

export default async function DashboardPage() {
  const session = await requireAuth()
  const userId = session.user.id

  const [allTrades, recentTrades, shadowData] = await Promise.all([
    // Aggregate stats
    db.query.trades.findMany({
      where: eq(trades.userId, userId),
      columns: { status: true, realizedPnl: true },
    }),
    // Recent 10 trades for the table
    db.query.trades.findMany({
      where: eq(trades.userId, userId),
      orderBy: [desc(trades.entryDate)],
      limit: 10,
    }),
    // Shadow portfolio — sum of all shadow outcomes for this user's closed trades
    db
      .select({
        totalShadowPnl: sql<string>`sum(${shadowOutcomes.shadowPnl}::numeric)`,
        totalRealizedPnl: sql<string>`sum(${trades.realizedPnl}::numeric)`,
        tradeCount: sql<string>`count(${shadowOutcomes.tradeId})`,
      })
      .from(shadowOutcomes)
      .innerJoin(trades, eq(shadowOutcomes.tradeId, trades.id))
      .where(eq(trades.userId, userId)),
  ])

  const closedTrades = allTrades.filter((t) => t.status === "closed" && t.realizedPnl != null)
  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnl!), 0)
  const winCount = closedTrades.filter((t) => parseFloat(t.realizedPnl!) > 0).length
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : null
  const openCount = allTrades.filter((t) => t.status === "open").length

  const shadow = shadowData[0]
  const shadowCount = shadow?.tradeCount ? parseInt(shadow.tradeCount) : 0
  const totalShadowPnl = shadow?.totalShadowPnl ? parseFloat(shadow.totalShadowPnl) : 0
  const totalRealizedPnl = shadow?.totalRealizedPnl ? parseFloat(shadow.totalRealizedPnl) : 0
  const shadowDelta = totalRealizedPnl > 0 || totalShadowPnl > 0 ? totalShadowPnl - totalRealizedPnl : 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s how your trading is going this week.
          </p>
        </div>
        <LogTradeModal />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total P&L"
          value={closedTrades.length === 0 ? "—" : (totalPnl >= 0 ? "+" : "") + formatINR(totalPnl)}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          className={
            closedTrades.length > 0
              ? totalPnl >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
              : ""
          }
          sub={`${closedTrades.length} closed trade${closedTrades.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          title="Win Rate"
          value={winRate !== null ? `${winRate.toFixed(0)}%` : "—"}
          icon={Activity}
          sub={`${winCount} wins of ${closedTrades.length} closed`}
        />
        <StatCard
          title="Open Positions"
          value={String(openCount)}
          icon={TrendingUp}
          sub="trades currently running"
        />
      </div>

      {/* Shadow Portfolio */}
      {shadowCount > 0 ? (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Shadow Portfolio</CardTitle>
              <Badge variant="outline" className="text-xs">
                {shadowCount} trade{shadowCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Your Actual P&L</p>
              <p className={cn("text-xl font-bold font-mono", totalRealizedPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {totalRealizedPnl >= 0 ? "+" : ""}{formatINR(totalRealizedPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shadow P&L</p>
              <p className="text-xl font-bold font-mono text-muted-foreground">
                {totalShadowPnl >= 0 ? "+" : ""}{formatINR(totalShadowPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className={cn("text-xl font-bold font-mono", shadowDelta >= 0 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400")}>
                {shadowDelta >= 0 ? "+" : ""}{formatINR(shadowDelta)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {shadowDelta >= 0 ? "cost of bias" : "saved by deviation"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Shadow Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No deviations detected yet — shadow outcomes are computed when you close a trade that deviates from your plan.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent trades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Trades</h2>
          <Link
            href="/dashboard/trades"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentTrades.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No trades yet — log your first one above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTrades.map((trade) => {
                  const pnl = trade.realizedPnl ? parseFloat(trade.realizedPnl) : null
                  return (
                    <tr key={trade.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/trades/${trade.id}`}
                          className="font-mono font-medium hover:underline"
                        >
                          {trade.symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            "uppercase text-xs",
                            trade.action === "buy"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {trade.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(trade.entryDate)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={trade.status === "open" ? "outline" : "secondary"}>
                          {trade.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {pnl !== null ? (
                          <span
                            className={cn(
                              "font-medium",
                              pnl >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {formatINR(trade.realizedPnl)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  className,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  sub: string
  className?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("mt-1 text-2xl font-bold tracking-tight", className)}>{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </div>
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}
