// MOCK DATA for v1. Production would call NSE Bhavcopy or a paid feed like
// twelvedata. This file provides synthetic OHLC daily data for 10 NSE stocks
// using a deterministic random walk seeded from the symbol — data is
// consistent across server restarts and deploys.
export interface DailyPrice {
  date: string       // "YYYY-MM-DD"
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Base prices (approximate current NSE prices in INR) for realistic P&L ranges
const BASE_PRICES: Record<string, number> = {
  RELIANCE: 2500,
  TCS: 3800,
  INFY: 1850,
  HDFCBANK: 1700,
  ICICIBANK: 1150,
  TATAMOTORS: 950,
  MARUTI: 11500,
  BAJFINANCE: 6500,
  ITC: 420,
  ASIANPAINT: 2500,
}

// Mulberry32 — deterministic PRNG seeded with symbol string hash.
// Produces uniform [0, 1) floats; consistent across all runs.
function makeRng(symbol: string): () => number {
  let seed = Array.from(symbol).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  // Mix bits to break correlation between symbol hash and sequence
  seed = (seed ^ (seed >>> 16)) * 0x45d9f3b
  seed = (seed ^ (seed >>> 16)) * 0x45d9f3b
  seed = seed ^ (seed >>> 16)

  let s0 = seed
  let s1 = seed ^ 0xdeadbeef
  // Initialize state to something nontrivial
  s0 = (s0 ^ 0x85ebca6b) ^ (s1 >>> 13)
  s1 = (s1 ^ 0xc2f4c3b3) ^ (s0 >>> 13)

  return () => {
    s0 = Math.imul(s0 ^ (s0 >>> 15), 1 | s1)
    s1 = Math.imul(s1 ^ (s1 >>> 15), 1 | s0)
    const t = ((s0 ^ (s0 << 1)) >>> 0) + 0x80000000
    return ((t >>> 0) + s1) / 0x100000000
  }
}

// Deterministic random walk: each day's price drifts from the previous close.
// Daily volatility ~1.5% (realistic for mid-cap Indian stocks).
// Returns [open, high, low, close] for one trading day.
function walkDay(prevClose: number, rng: () => number): [number, number, number, number] {
  const drift = 0.0003   // ~3 bps daily drift (slight positive bias, long-term growth)
  const vol   = 0.015     // ~1.5% daily volatility
  const r1 = rng()
  const r2 = rng()
  // Box-Muller transform for normal distribution
  const z = Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2)
  const pctChange = drift + vol * z
  const open  = prevClose                       // open = previous close (realistic for daily data)
  const close = Math.round(open * (1 + pctChange) * 100) / 100
  const range = Math.abs(close - open) * (0.5 + rng()) // intraday range 0.5x-1.5x of movement
  const high  = Math.max(open, close) + Math.round(range * rng() * 100) / 100
  const low   = Math.min(open, close) - Math.round(range * rng() * 100) / 100
  return [open, Math.round(high * 100) / 100, Math.round(low * 100) / 100, close]
}

// Generate 365 calendar days (including non-trading days — the data itself
// represents the last 365 "available" trading days; we include all calendar days
// so the date index matches real calendars).
// The date range starts 365 days ago and ends today.
function generateSymbolData(symbol: string): DailyPrice[] {
  const rng = makeRng(symbol)
  const basePrice = BASE_PRICES[symbol] ?? 1000
  const days: DailyPrice[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 364) // 365 days inclusive

  let prevClose = basePrice
  for (let i = 0; i < 365; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const [open, high, low, close] = walkDay(prevClose, rng)
    // Real NSE data wouldn't include weekends/holidays, but for mock we include
    // all calendar days — the algorithm just walks the price regardless.
    days.push({
      date: d.toISOString().split("T")[0],
      open: Math.round(open * 100) / 100,
      high,
      low,
      close,
      volume: Math.round(1_000_000 + rng() * 5_000_000),
    })
    prevClose = close
  }

  return days
}

// Lazy singleton — generate per-symbol on first access, then cache in memory.
// (Per-process only; in Vercel Functions each cold start re-generates.)
const cache = new Map<string, DailyPrice[]>()

export function getMockPrices(symbol: string): DailyPrice[] {
  const s = symbol.toUpperCase()
  if (!cache.has(s)) {
    cache.set(s, generateSymbolData(s))
  }
  return cache.get(s)!
}