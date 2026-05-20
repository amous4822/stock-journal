// Computes the "Shadow Portfolio" outcome for a closed trade.
//
// Algorithm:
//  1. If the trade had no target and no stop → nothing to compare → return null.
//  2. Walk through daily OHLC bars from entry_date to today.
//  3. For a BUY trade: target hits when daily high ≥ target before stop hits (low ≤ stop).
//     For a SELL trade: the logic reverses — target hits when daily low ≤ target
//     before stop hits (high ≥ stop).
//  4. If neither trigger is hit, use the latest available close as the shadow exit.
//  5. shadow_pnl = (shadow_exit - entry) × qty × direction; pnl_delta = shadow - realized.
//  6. Return null when there's nothing to compare (no target AND no stop).
import { getDailyPrices } from "@/lib/prices/fetch"
import type { Trade } from "@/lib/db/schema"

export interface ShadowOutcome {
  shadowExitPrice: number
  shadowExitDate: Date
  shadowPnl: number
  pnlDelta: number   // positive = user left money on the table
}

interface ComputeShadowInput {
  trade: Pick<
    Trade,
    | "symbol"
    | "action"
    | "quantity"
    | "entryPrice"
    | "entryDate"
    | "plannedTargetPrice"
    | "plannedStopLoss"
    | "realizedPnl"
  >
}

/**
 * Returns the shadow outcome for a single trade, or null if there's no
 * target/stop to compare against. Pure function — no DB writes.
 */
export async function computeShadow({ trade }: ComputeShadowInput): Promise<ShadowOutcome | null> {
  const {
    symbol,
    action,
    quantity,
    entryPrice,
    entryDate,
    plannedTargetPrice,
    plannedStopLoss,
    realizedPnl,
  } = trade

  const target = plannedTargetPrice ? parseFloat(plannedTargetPrice) : null
  const stop   = plannedStopLoss    ? parseFloat(plannedStopLoss)    : null

  // Nothing to compare — trade had no stated plan
  // Also skip if the "plan" is a placeholder value (e.g. "0" from a data backfill)
  if ((target === null || target <= 0) && (stop === null || stop <= 0)) return null

  const entry = parseFloat(entryPrice)
  const prices = await getDailyPrices(
    symbol,
    new Date(entryDate),
    new Date()
  )

  if (prices.length === 0) return null

  const direction = action === "buy" ? 1 : -1

  let shadowExitPrice: number | null = null
  let shadowExitDate: Date | null = null

  for (const bar of prices) {
    const { date, high, low } = bar

    // BUY trade: profit when price rises
    //   Target hit: high >= target
    //   Stop hit:   low  <= stop
    // SELL trade: profit when price falls
    //   Target hit: low  <= target  (you shorted at a higher price, target is lower)
    //   Stop hit:   high >= stop    (price rose above your stop)
    const targetHit = action === "buy" ? high >= (target ?? Infinity) : low <= (target ?? -Infinity)
    const stopHit   = action === "buy" ? low  <= (stop  ?? -Infinity) : high >= (stop  ?? Infinity)

    if (targetHit) {
      shadowExitPrice = target ?? bar.close
      shadowExitDate  = new Date(date)
      break
    }
    if (stopHit) {
      shadowExitPrice = stop ?? bar.close
      shadowExitDate  = new Date(date)
      break
    }
  }

  // Neither trigger hit — use the latest close as the shadow exit
  if (shadowExitPrice === null) {
    const last = prices[prices.length - 1]
    shadowExitPrice = last.close
    shadowExitDate  = new Date(last.date)
  }

  // pnl = (exit - entry) × qty × direction
  //   Buy:  direction=+1  → profit when exit > entry
  //   Sell: direction=-1  → profit when exit < entry
  const shadowPnl = (shadowExitPrice - entry) * quantity * direction
  const realized  = realizedPnl ? parseFloat(realizedPnl) : 0
  const pnlDelta  = Math.round((shadowPnl - realized) * 100) / 100

  return {
    shadowExitPrice: Math.round(shadowExitPrice * 100) / 100,
    shadowExitDate: shadowExitDate as Date,
    shadowPnl:   Math.round(shadowPnl   * 100) / 100,
    pnlDelta:    pnlDelta,
  }
}