// Fetches daily OHLC prices for a symbol within a date range.
//
// Uses Yahoo Finance (via yahoo-finance2) for real NSE/NYBSE market data.
// Falls back to mock data when the API is unavailable or rate-limited.
//
// Yahoo Finance free tier: no API key required, rate-limited by Yahoo's
// infrastructure (not a published cap). Suitable for development and
// moderate production use. For high-volume, consider a paid provider.
import yf from "yahoo-finance2"
import { getMockPrices, type DailyPrice } from "./mock-data"

// yahoo-finance2's default export is a constructor function at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = new (yf as any)()

// Map Yahoo Finance candle to our DailyPrice shape
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
    date:  toDateString(candle.date),
    open:   Math.round(candle.open   * 100) / 100,
    high:   Math.round(candle.high   * 100) / 100,
    low:    Math.round(candle.low    * 100) / 100,
    close:  Math.round(candle.close  * 100) / 100,
    volume:  candle.volume ?? 0,
  }
}

// Appends ".NS" suffix for NSE tickers so Yahoo Finance resolves correctly.
function nseSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim()
  if (upper.endsWith(".NS") || upper.endsWith(".BO") || upper.startsWith("^")) {
    return upper
  }
  if (["NIFTY50", "NIFTY", "SENSEX", "BANKNIFTY"].includes(upper)) {
    return upper
  }
  return `${upper}.NS`
}

/**
 * Returns daily OHLC prices for `symbol` from `from` (inclusive) to `to` (inclusive).
 * Uses real Yahoo Finance data; falls back to mock data on error.
 *
 * Yahoo Finance only returns trading days (Mon–Fri, excluding Indian market holidays).
 * The date filter is inclusive — a weekend or holiday in the range returns no bars,
 * which is correct (no trading happened).
 */
export async function getDailyPrices(
  symbol: string,
  from: Date,
  to: Date,
): Promise<DailyPrice[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client as any).chart(nseSymbol(symbol), {
      period1: from,
      period2: to,
      interval: "1d",
    })

    if (!result.quotes || result.quotes.length === 0) {
      return fallbackToMock(symbol, from, to)
    }

    return result.quotes.map((c: { date: unknown; open: number; high: number; low: number; close: number; volume: number }) =>
      yahooToDailyPrice(c)
    )
  } catch (error) {
    console.warn(`[prices] Yahoo Finance failed for ${symbol}, using mock: ${error instanceof Error ? error.message : String(error)}`)
    return fallbackToMock(symbol, from, to)
  }
}

function fallbackToMock(symbol: string, from: Date, to: Date): DailyPrice[] {
  const all = getMockPrices(symbol)
  const fromStr = from.toISOString().split("T")[0]
  const toStr   = to.toISOString().split("T")[0]
  return all.filter((d) => d.date >= fromStr && d.date <= toStr)
}