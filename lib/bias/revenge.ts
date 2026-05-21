// Markov 2-state model for revenge trading detection.
// Walks trades in time order; a trade is "revenge" if a loss occurred in the
// prior 60 minutes (the standard cooling-off window used by most Indian brokerages).
import type { Trade } from "@/lib/db/schema"

export interface RevengeResult {
  baselineWinrate: number
  conditionalWinrate: number
  revengeTradesCount: number
  penalty: number
  insufficientData: boolean
}

export function computeRevenge(
  trades: Pick<Trade, "realizedPnl" | "exitDate" | "entryDate">[]
): RevengeResult {
  const closed = trades
    .filter((t) => t.realizedPnl != null && t.exitDate != null)
    .sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime())

  if (closed.length === 0) {
    return {
      baselineWinrate: 0, conditionalWinrate: 0,
      revengeTradesCount: 0, penalty: 0, insufficientData: true,
    }
  }

  const ONE_HOUR = 60 * 60 * 1000
  const isWin = (t: typeof closed[0]) => parseFloat(t.realizedPnl!) > 0

  let revengeCount = 0
  let revengeWins  = 0
  const lossQueue: number[] = []

  for (const t of closed) {
    const exitMs = new Date(t.exitDate!).getTime()

    while (lossQueue.length > 0 && (exitMs - lossQueue[0] > ONE_HOUR || lossQueue[0] >= exitMs)) {
      lossQueue.shift()
    }

    if (lossQueue.length > 0) {
      revengeCount++
      if (isWin(t)) revengeWins++
    }

    if (!isWin(t)) {
      lossQueue.push(exitMs)
    }
  }

  const totalWins = closed.filter(isWin).length
  const baseline = totalWins / closed.length
  const conditional = revengeCount > 0 ? revengeWins / revengeCount : 0

  // Need at least 5 revenge trades for a meaningful result
  const penalty = revengeCount >= 5
    ? Math.max(0, Math.min(1, baseline - conditional))
    : 0

  return {
    baselineWinrate:    Math.round(baseline    * 10_000) / 10_000,
    conditionalWinrate: Math.round(conditional * 10_000) / 10_000,
    revengeTradesCount: revengeCount,
    penalty:            Math.round(penalty * 10_000) / 10_000,
    insufficientData:   revengeCount < 5,
  }
}
