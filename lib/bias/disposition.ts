// Disposition Effect — the tendency to hold winners too long and cut losers too quickly.
// Defined in SPEC.md §Bias math.
//
// Algorithm:
//  1. Split trades into winners (realized_pnl > 0) and losers (realized_pnl <= 0).
//  2. Compute mean hold duration for each group.
//  3. ratio = avg_loser_hold / avg_winner_hold.  Ratio > 1 means losers held longer.
//  4. cost: for each losing trade, estimate the savings if cut at avg_winner_hold time.
//     savings = max(0, current_loss - hypothetical_loss_at_winner_hold).
import type { Trade } from "@/lib/db/schema"

export interface DispositionResult {
  ratio: number       // avg_loser_hold / avg_winner_hold
  cost: number        // ₹ estimated cost of holding losers too long
  loserCount: number
  winnerCount: number
}

/**
 * Computes disposition effect metrics for a list of closed trades.
 * Returns ratio=0, cost=0 when either group is empty.
 *
 * Hold duration is measured in milliseconds (exit_date - entry_date).
 * Expressed in hours for readability in bias reports.
 */
export function computeDisposition(trades: Pick<Trade, "realizedPnl" | "entryDate" | "exitDate" | "quantity">[]): DispositionResult {
  const closed = trades.filter(
    (t) => t.realizedPnl != null && t.exitDate != null
  )

  const winners = closed.filter((t) => parseFloat(t.realizedPnl!) > 0)
  const losers  = closed.filter((t) => parseFloat(t.realizedPnl!) <= 0)

  if (winners.length === 0 || losers.length === 0) {
    return { ratio: 0, cost: 0, loserCount: losers.length, winnerCount: winners.length }
  }

  // Duration in hours — more intuitive than ms for traders
  const holdHours = (t: typeof trades[0]) =>
    (new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime()) / (1000 * 60 * 60)

  const winnerHolds = winners.map(holdHours)
  const loserHolds  = losers.map(holdHours)

  const avgWinnerHold = winnerHolds.reduce((a, b) => a + b, 0) / winners.length
  const avgLoserHold  = loserHolds.reduce((a, b) => a + b, 0) / losers.length

  // ratio > 1 → user holds losers longer than winners (classic disposition)
  const ratio = avgLoserHold / avgWinnerHold

  // Cost estimation:
  // For each loser, we estimate "what would the loss have been if I had exited
  // at the average winner hold time instead?"
  // Since we don't have the actual price path, we approximate: if the trade was still
  // a loss at the average winner hold time, the extra cost = (avgLoserHold - avgWinnerHold)
  // as a fraction of the loss, scaled by how long the loser was held beyond avgWinnerHold.
  //
  // Simpler model used here: cost = sum of (loser_hold - avgWinnerHold) * |loss_per_hour|
  // where loss_per_hour = |realized_pnl| / loser_hold.
  // This gives an approximate "cost per extra hour held" compound effect.
  let cost = 0
  for (let i = 0; i < losers.length; i++) {
    const loss       = Math.abs(parseFloat(losers[i].realizedPnl!))
    const hold       = loserHolds[i]
    const extraHold  = Math.max(0, hold - avgWinnerHold)
    const lossPerHr  = loss / hold
    cost += lossPerHr * extraHold
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    cost:  Math.round(cost  * 100) / 100,
    loserCount:  losers.length,
    winnerCount: winners.length,
  }
}