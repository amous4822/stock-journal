// Revenge Trading — Markov 2-state model.
// Defined in SPEC.md §Bias math.
//
// Algorithm:
//  1. Sort trades by exit_date ascending.
//  2. baseline_winrate = wins / total (overall win rate).
//  3. For each trade T, check if there was a losing trade within the PREVIOUS 60 minutes.
//     A "revenge trade" is one where a loss occurred in the 60-min lookback window.
//  4. conditional_winrate = wins_in_revenge / count_revenge.
//  5. penalty = baseline - conditional, clamped to [0, 1].
//  6. Returns penalty=0 with insufficient_data flag when revenge_trades_count < 5.
import type { Trade } from "@/lib/db/schema"

export interface RevengeResult {
  baselineWinrate: number
  conditionalWinrate: number
  revengeTradesCount: number
  penalty: number          // baseline - conditional, clamped to [0, 1]
  insufficientData: boolean
}

/**
 * Analyzes revenge trading patterns in a list of closed trades.
 * Requires at least 5 revenge trades for a statistically meaningful result.
 *
 * 60-minute lookback window — chosen because most intraday trading platforms
 * use this as the "cooling off" default per SPEC.md.
 */
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

  // Algorithm walks forward through trades in time order.
// For each trade, we check only PRIOR losses (losses that occurred before
// this trade's exit) within a 60-minute lookback window.
// We maintain a queue of prior losses in chronological order.
const ONE_HOUR = 60 * 60 * 1000
const isWin = (t: typeof closed[0]) => parseFloat(t.realizedPnl!) > 0

let revengeCount = 0
let revengeWins  = 0
// lossQueue holds exit times (ms) of losses in chronological order.
// We push loss times and pop from the front when they fall out of the lookback window.
const lossQueue: number[] = []

for (const t of closed) {
  const exitMs = new Date(t.exitDate!).getTime()

  // Remove from queue: any loss that is more than 1 hour before this trade
  // OR any loss that occurred at or after this trade's exit time
  // (losses after the trade's exit cannot be "prior losses" for this trade)
  while (lossQueue.length > 0 && (exitMs - lossQueue[0] > ONE_HOUR || lossQueue[0] >= exitMs)) {
    lossQueue.shift()
  }

  // A trade is a "revenge trade" if there was at least one loss in the prior 60 min
  if (lossQueue.length > 0) {
    revengeCount++
    if (isWin(t)) revengeWins++
  }

  // After checking, add this trade's exit time to the loss queue if it was a loss
  if (!isWin(t)) {
    lossQueue.push(exitMs)
  }
}

  const totalWins = closed.filter(isWin).length
  const baseline = totalWins / closed.length
  const conditional = revengeCount > 0 ? revengeWins / revengeCount : 0

  // penalty > 0 means trading after a loss hurts your win rate
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