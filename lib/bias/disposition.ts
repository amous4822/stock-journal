import type { Trade } from "@/lib/db/schema"

export interface DispositionResult {
  ratio: number       // avg_loser_hold / avg_winner_hold
  cost: number        // ₹ estimated cost of holding losers too long
  loserCount: number
  winnerCount: number
}

export function computeDisposition(trades: Pick<Trade, "realizedPnl" | "entryDate" | "exitDate" | "quantity">[]): DispositionResult {
  const closed = trades.filter(
    (t) => t.realizedPnl != null && t.exitDate != null
  )

  const winners = closed.filter((t) => parseFloat(t.realizedPnl!) > 0)
  const losers  = closed.filter((t) => parseFloat(t.realizedPnl!) <= 0)

  if (winners.length === 0 || losers.length === 0) {
    return { ratio: 0, cost: 0, loserCount: losers.length, winnerCount: winners.length }
  }

  const holdHours = (t: typeof trades[0]) =>
    (new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime()) / (1000 * 60 * 60)

  const winnerHolds = winners.map(holdHours)
  const loserHolds  = losers.map(holdHours)

  const avgWinnerHold = winnerHolds.reduce((a, b) => a + b, 0) / winners.length
  const avgLoserHold  = loserHolds.reduce((a, b) => a + b, 0) / losers.length

  const ratio = avgLoserHold / avgWinnerHold

  // Approximate cost: for each loser, estimate the extra loss from holding beyond
  // the average winner hold time. Uses loss_per_hour as a linear proxy since
  // we don't have intraday price paths.
  // TODO: revisit with tick data once we have a real price feed
  let cost = 0
  for (let i = 0; i < losers.length; i++) {
    const loss      = Math.abs(parseFloat(losers[i].realizedPnl!))
    const hold      = loserHolds[i]
    const extraHold = Math.max(0, hold - avgWinnerHold)
    const lossPerHr = loss / hold
    cost += lossPerHr * extraHold
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    cost:  Math.round(cost  * 100) / 100,
    loserCount:  losers.length,
    winnerCount: winners.length,
  }
}
