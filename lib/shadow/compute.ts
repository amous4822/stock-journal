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

export async function computeShadow({ trade }: ComputeShadowInput): Promise<ShadowOutcome | null> {
  const { symbol, action, quantity, entryPrice, entryDate, plannedTargetPrice, plannedStopLoss, realizedPnl } = trade

  const target = plannedTargetPrice ? parseFloat(plannedTargetPrice) : null
  const stop   = plannedStopLoss    ? parseFloat(plannedStopLoss)    : null

  // Skip trades with no plan, or where target/stop are placeholder 0 values
  if ((target === null || target <= 0) && (stop === null || stop <= 0)) return null

  const entry = parseFloat(entryPrice)
  const prices = await getDailyPrices(symbol, new Date(entryDate), new Date())

  if (prices.length === 0) return null

  const direction = action === "buy" ? 1 : -1

  let shadowExitPrice: number | null = null
  let shadowExitDate: Date | null = null

  for (const bar of prices) {
    const { date, high, low } = bar

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

  if (shadowExitPrice === null) {
    const last = prices[prices.length - 1]
    shadowExitPrice = last.close
    shadowExitDate  = new Date(last.date)
  }

  const shadowPnl = (shadowExitPrice - entry) * quantity * direction
  const realized  = realizedPnl ? parseFloat(realizedPnl) : 0

  return {
    shadowExitPrice: Math.round(shadowExitPrice * 100) / 100,
    shadowExitDate:  shadowExitDate as Date,
    shadowPnl:       Math.round(shadowPnl * 100) / 100,
    pnlDelta:        Math.round((shadowPnl - realized) * 100) / 100,
  }
}
