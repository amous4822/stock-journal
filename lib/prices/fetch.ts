// Uses Yahoo Finance for real NSE daily OHLC data. Falls back to mock data
// when the API is unavailable or rate-limited. For high-volume production,
// swap the provider here — the interface (getDailyPrices) stays the same.
import yf from "yahoo-finance2"
import { getMockPrices, type DailyPrice } from "./mock-data"
import { logger } from "@/lib/logger"

// yahoo-finance2's default export is a constructor at runtime despite TS types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = new (yf as any)()

function toDateString(date: unknown): string {
  if (typeof date === "string") return date.split("T")[0]
  if (date instanceof Date) return date.toISOString().split("T")[0]
  return String(date)
}

function yahooToDailyPrice(candle: {
  date: unknown
  open: number
  high: number
  low: number
  close: number
  volume: number
}): DailyPrice {
  return {
    date: toDateString(candle.date),
    open: Math.round(candle.open * 100) / 100,
    high: Math.round(candle.high * 100) / 100,
    low: Math.round(candle.low * 100) / 100,
    close: Math.round(candle.close * 100) / 100,
    volume: candle.volume ?? 0,
  }
}

// Appends ".NS" suffix for NSE tickers — Yahoo Finance requires this to
// distinguish National Stock Exchange listings from US-listed ADRs.
function nseSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim()
  if (upper.endsWith(".NS") || upper.endsWith(".BO") || upper.startsWith("^")) return upper
  if (["NIFTY50", "NIFTY", "SENSEX", "BANKNIFTY"].includes(upper)) return upper
  return `${upper}.NS`
}

export async function getDailyPrices(symbol: string, from: Date, to: Date): Promise<DailyPrice[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client as any).chart(nseSymbol(symbol), { period1: from, period2: to, interval: "1d" })

    if (!result.quotes || result.quotes.length === 0) return fallbackToMock(symbol, from, to)

    return result.quotes.map((c: { date: unknown; open: number; high: number; low: number; close: number; volume: number }) =>
      yahooToDailyPrice(c)
    )
  } catch (error) {
    logger.warn("prices:yahoo_finance_failed", { symbol, error: error instanceof Error ? error.message : String(error) })
    return fallbackToMock(symbol, from, to)
  }
}

function fallbackToMock(symbol: string, from: Date, to: Date): DailyPrice[] {
  const all = getMockPrices(symbol)
  const fromStr = from.toISOString().split("T")[0]
  const toStr = to.toISOString().split("T")[0]
  return all.filter((d) => d.date >= fromStr && d.date <= toStr)
}
