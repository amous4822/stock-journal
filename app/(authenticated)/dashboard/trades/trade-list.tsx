// Trade list — filter tabs + table. Client component because tabs change the URL.
"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react"
import type { Trade } from "@/lib/db/schema"
import { Badge } from "@/components/ui/badge"
import { cn, formatINR, formatDate } from "@/lib/utils"

interface Props {
  trades: Trade[]
  activeStatus: "all" | "open" | "closed"
}

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
] as const

export function TradeList({ trades, activeStatus }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function setFilter(status: string) {
    const params = status === "all" ? "" : `?status=${status}`
    router.push(`${pathname}${params}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeStatus === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {trades.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <TrendingUp className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No trades yet</p>
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Log Trade&rdquo; to record your first trade
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {trades.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Symbol</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entry Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade }: { trade: Trade }) {
  const pnl = trade.realizedPnl ? parseFloat(trade.realizedPnl) : null
  const isPositive = pnl !== null && pnl >= 0

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/trades/${trade.id}`}
          className="font-mono font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {trade.symbol}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={trade.action === "buy" ? "default" : "secondary"}
          className={cn(
            "uppercase text-xs",
            trade.action === "buy"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          )}
        >
          {trade.action === "buy" ? (
            <ArrowUpRight className="mr-1 size-3" />
          ) : (
            <ArrowDownRight className="mr-1 size-3" />
          )}
          {trade.action}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono">{trade.quantity}</td>
      <td className="px-4 py-3 text-right font-mono">{formatINR(trade.entryPrice)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(trade.entryDate)}</td>
      <td className="px-4 py-3">
        <Badge variant={trade.status === "open" ? "outline" : "secondary"}>
          {trade.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {pnl !== null ? (
          <span className={cn("font-medium", isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {isPositive ? "+" : ""}
            {formatINR(trade.realizedPnl)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
