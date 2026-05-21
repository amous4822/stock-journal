import { eq, and } from "drizzle-orm"
import { Brain, RefreshCw, TrendingDown, Zap, Users } from "lucide-react"
import { db } from "@/lib/db"
import { biasReports } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatINR } from "@/lib/utils"
import { RefreshReportButton } from "./refresh-button"

function currentWeekStartStr(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString().split("T")[0]
}

export default async function BiasReportPage() {
  const session = await requireAuth()
  const userId = session.user.id

  const weekStartStr = currentWeekStartStr()

  const report = await db.query.biasReports.findFirst({
    where: and(
      eq(biasReports.userId, userId),
      eq(biasReports.weekStart, weekStartStr)
    ),
    orderBy: (r, { desc }) => [desc(r.computedAt)],
  })

  const lastRefreshed = report ? new Date(report.computedAt) : null
  const ageMs = lastRefreshed ? Date.now() - lastRefreshed.getTime() : null
  const cooldownRemaining = ageMs !== null && ageMs < 60 * 60 * 1000
    ? Math.ceil((60 * 60 * 1000 - ageMs) / 60_000)
    : 0

  const dispositionRatio = report?.dispositionRatio ? parseFloat(report.dispositionRatio) : null
  const dispositionCost = report?.dispositionCost ? parseFloat(report.dispositionCost) : null
  const baselineWinrate = report?.revengeBaselineWinrate ? parseFloat(report.revengeBaselineWinrate) : null
  const conditionalWinrate = report?.revengeConditionalWinrate ? parseFloat(report.revengeConditionalWinrate) : null
  const revengeTradesCount = report?.revengeTradesCount ?? null
  const fomoPnl = report?.fomoStrategyPnl ? parseFloat(report.fomoStrategyPnl) : null

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bias Report</h1>
          <p className="text-sm text-muted-foreground">
            Weekly analysis of your behavioral patterns · {weekStartStr}
          </p>
        </div>
        <RefreshReportButton cooldownMinutes={cooldownRemaining} />
      </div>

      {!report ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Brain className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground max-w-sm">
            No report yet. Click <strong>Refresh Report</strong> above to analyze this
            week&apos;s trades. You need at least one closed trade this week.
          </p>
        </div>
      ) : (
        <>
          {/* Three bias cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Disposition Effect */}
            <Card className={cn(dispositionRatio !== null && dispositionRatio > 1.2 && "border-amber-300 dark:border-amber-800")}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="size-4 text-amber-500" />
                  <CardTitle className="text-sm font-medium">Disposition Effect</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dispositionRatio !== null ? (
                  <>
                    <p className="text-2xl font-bold font-mono">
                      {dispositionRatio.toFixed(2)}×
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dispositionRatio > 1
                        ? `You held losing trades ${dispositionRatio.toFixed(1)}× longer than winners.`
                        : "Hold times for winners and losers were balanced."}
                    </p>
                    {dispositionCost !== null && dispositionCost > 0 && (
                      <Badge variant="secondary" className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20">
                        Estimated cost: {formatINR(dispositionCost)}
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not enough data</p>
                )}
              </CardContent>
            </Card>

            {/* Revenge Trading */}
            <Card className={cn(
              baselineWinrate !== null &&
              conditionalWinrate !== null &&
              conditionalWinrate < baselineWinrate - 0.1 &&
              "border-red-300 dark:border-red-800"
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-red-500" />
                  <CardTitle className="text-sm font-medium">Revenge Trading</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {baselineWinrate !== null && conditionalWinrate !== null ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
                        {(conditionalWinrate * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">after a loss</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Win rate drops from {(baselineWinrate * 100).toFixed(0)}% overall
                      to {(conditionalWinrate * 100).toFixed(0)}% when trading within 60 min
                      of a loss ({revengeTradesCount} trades).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Need at least 5 trades placed within 60 min of a loss to measure this.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* FOMO */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-blue-500" />
                  <CardTitle className="text-sm font-medium">FOMO (Social Proof)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {fomoPnl !== null ? (
                  <>
                    <p className={cn(
                      "text-2xl font-bold font-mono",
                      fomoPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {fomoPnl >= 0 ? "+" : ""}{formatINR(fomoPnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      P&amp;L from trades tagged &quot;social proof&quot; (tips, Twitter calls, FOMO).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No trades tagged as social proof this week.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Narrative */}
          {report.aiNarrative && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-purple-500" />
                  <CardTitle className="text-base">AI Coach Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {report.aiNarrative.split("\n\n").map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground/90">
                      {para}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {lastRefreshed && (
            <p className="text-xs text-muted-foreground text-right">
              Last refreshed {lastRefreshed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
