// FOMO P&L — sums P&L of trades tagged social_proof vs everything else.
// Defined in SPEC.md §Bias math.
//
// Simple: for closed trades, partition by primaryStrategy === 'social_proof'
// and sum realized_pnl for each group.
import type { Trade } from "@/lib/db/schema"

export interface FomoResult {
  fomoPnl: number
  otherPnl: number
  fomoCount: number
  otherCount: number
}

export function computeFomo(
  trades: Pick<Trade, "realizedPnl" | "primaryStrategy">[]
): FomoResult {
  const closed = trades.filter((t) => t.realizedPnl != null)

  let fomoPnl = 0
  let otherPnl = 0
  let fomoCount = 0
  let otherCount = 0

  for (const t of closed) {
    const pnl = parseFloat(t.realizedPnl!)
    if (t.primaryStrategy === "social_proof") {
      fomoPnl += pnl
      fomoCount++
    } else {
      otherPnl += pnl
      otherCount++
    }
  }

  return {
    fomoPnl:   Math.round(fomoPnl   * 100) / 100,
    otherPnl:  Math.round(otherPnl  * 100) / 100,
    fomoCount,
    otherCount,
  }
}