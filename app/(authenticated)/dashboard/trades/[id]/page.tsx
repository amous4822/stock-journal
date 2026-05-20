// Trade detail page — shows entry/exit details, AI tags, and the close action.
import { notFound } from "next/navigation"
import { eq, and } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { db } from "@/lib/db"
import { trades } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatINR, formatDate } from "@/lib/utils"
import { CloseTradeModal } from "./close-trade-modal"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TradeDetailPage({ params }: Props) {
  const session = await requireAuth()
  const { id } = await params

  const trade = await db.query.trades.findFirst({
    where: and(eq(trades.id, id), eq(trades.userId, session.user.id)),
  })

  if (!trade) notFound()

  const pnl = trade.realizedPnl ? parseFloat(trade.realizedPnl) : null
  const isProfit = pnl !== null && pnl >= 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard/trades"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Trades
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{trade.symbol}</h1>
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
          <Badge variant={trade.status === "open" ? "outline" : "secondary"}>
            {trade.status}
          </Badge>
        </div>
        {trade.status === "open" && <CloseTradeModal tradeId={trade.id} />}
      </div>

      {/* Deviation warning */}
      {trade.isDeviation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Deviation detected
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              The AI found you may have exited outside your original plan. Shadow Portfolio
              comparison will appear here in Phase 3.
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Entry card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Date" value={formatDate(trade.entryDate)} />
            <DetailRow label="Price" value={formatINR(trade.entryPrice)} mono />
            <DetailRow label="Quantity" value={String(trade.quantity)} mono />
            <DetailRow
              label="Total value"
              value={formatINR(parseFloat(trade.entryPrice) * trade.quantity)}
              mono
            />
            <hr className="border-border" />
            {/* AI tags */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                AI Tags
              </p>
              <TagRow label="Strategy" value={trade.primaryStrategy} />
              <TagRow label="Emotion" value={trade.emotionalStateEntry} />
              {trade.plannedTargetPrice && (
                <TagRow label="Target" value={formatINR(trade.plannedTargetPrice)} />
              )}
              {trade.plannedStopLoss && (
                <TagRow label="Stop" value={formatINR(trade.plannedStopLoss)} />
              )}
            </div>
            <hr className="border-border" />
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                Reasoning
              </p>
              <p className="text-sm text-muted-foreground">{trade.entryReasoning}</p>
            </div>
          </CardContent>
        </Card>

        {/* Exit card */}
        <Card className={trade.status === "open" ? "opacity-50" : ""}>
          <CardHeader>
            <CardTitle className="text-base">Exit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trade.status === "open" ? (
              <p className="text-sm text-muted-foreground">
                Trade is still open. Close it to see exit details.
              </p>
            ) : (
              <>
                <DetailRow label="Date" value={formatDate(trade.exitDate)} />
                <DetailRow label="Price" value={formatINR(trade.exitPrice)} mono />
                <DetailRow label="Exit reason" value={trade.exitReason ?? "—"} />
                {pnl !== null && (
                  <DetailRow
                    label="Realized P&L"
                    value={(isProfit ? "+" : "") + formatINR(pnl)}
                    mono
                    className={isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                  />
                )}
                <hr className="border-border" />
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                    AI Tags
                  </p>
                  {trade.emotionalStateExit && (
                    <TagRow label="Emotion" value={trade.emotionalStateExit} />
                  )}
                  <TagRow
                    label="Deviation"
                    value={trade.isDeviation ? "Yes" : "No"}
                    className={trade.isDeviation ? "text-amber-600 dark:text-amber-400" : ""}
                  />
                </div>
                {trade.exitReasoning && (
                  <>
                    <hr className="border-border" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                        Reasoning
                      </p>
                      <p className="text-sm text-muted-foreground">{trade.exitReasoning}</p>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", mono && "font-mono", className)}>{value}</span>
    </div>
  )
}

function TagRow({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant="outline" className={cn("text-xs capitalize", className)}>
        {value.replace(/_/g, " ")}
      </Badge>
    </div>
  )
}
