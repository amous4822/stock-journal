// Demo seed — creates a deterministic demo user + 10 trades that exercise every
// feature in the app: shadow portfolio, bias report, all AI tags, open positions.
//
// Safety: only runs outside production to prevent accidental data corruption.
// Idempotent: uses upserts (onConflictDoUpdate) so re-running is safe.
//
// Usage:
//   pnpm seed
//   NODE_ENV=development pnpm seed  (explicit)

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { eq, inArray } from "drizzle-orm"
import * as schema from "../lib/db/schema"

if (process.env.NODE_ENV === "production") {
  console.error("❌ Refusing to seed in production. Set NODE_ENV=development.")
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

// ── Demo user ─────────────────────────────────────────────────────────────────

const DEMO_USER_ID = "seed-demo-user-00000000-0000-0000-0000-000000000001"
const DEMO_EMAIL = "demo@alphajournal.dev"

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns a Date that is `daysAgo` days before now at the given hour (IST approximated as UTC+5:30)
function tradeDate(daysAgo: number, hour = 10, minute = 0): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hour - 5, minute - 30, 0, 0) // shift IST → UTC
  return d
}

function pnl(action: "buy" | "sell", qty: number, entry: number, exit: number): string {
  const direction = action === "buy" ? 1 : -1
  return String(Math.round(direction * qty * (exit - entry) * 100) / 100)
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding demo data…")

  // 1. Upsert demo user
  await db
    .insert(schema.users)
    .values({
      id: DEMO_USER_ID,
      name: "Demo Trader",
      email: DEMO_EMAIL,
      emailVerified: new Date(),
      image: null,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { name: "Demo Trader", email: DEMO_EMAIL },
    })

  console.log(`  ✓ User: ${DEMO_EMAIL}`)

  // 2. Delete existing seed trades (idempotent reset)
  const existingTrades = await db.query.trades.findMany({
    where: eq(schema.trades.userId, DEMO_USER_ID),
    columns: { id: true },
  })
  if (existingTrades.length > 0) {
    const ids = existingTrades.map((t) => t.id)
    await db.delete(schema.shadowOutcomes).where(inArray(schema.shadowOutcomes.tradeId, ids))
    await db.delete(schema.trades).where(eq(schema.trades.userId, DEMO_USER_ID))
    console.log(`  ♻️  Cleared ${ids.length} existing seed trades`)
  }

  // 3. Insert trades
  //
  // Trade set covers:
  //  T1 — clean win, hit target (no deviation)
  //  T2 — panic close, exited early on a winner (deviation → shadow outcome)
  //  T3 — loss, held way past stop (disposition effect, deviation → shadow outcome)
  //  T4 — revenge trade 1 (placed <60 min after T3 loss)
  //  T5 — revenge trade 2 (loss, placed <60 min after T4)
  //  T6 — FOMO trade (social_proof strategy, loss)
  //  T7 — FOMO trade (social_proof strategy, small win)
  //  T8 — clean win, no deviation
  //  T9 — open position (still running)
  //  T10 — open position (still running)

  const trades: (typeof schema.trades.$inferInsert)[] = [
    // T1: RELIANCE buy — hit target cleanly
    {
      userId: DEMO_USER_ID,
      symbol: "RELIANCE",
      action: "buy",
      quantity: 50,
      entryPrice: "2450.00",
      entryDate: tradeDate(5, 9, 30),
      exitPrice: "2595.00",
      exitDate: tradeDate(4, 14, 0),
      status: "closed",
      entryReasoning: "Reliance broke out of a 3-week consolidation on 2× average volume. Clean technical setup targeting ₹2600.",
      exitReasoning: "Hit my ₹2600 target as planned. Took profits without greed.",
      primaryStrategy: "technical",
      emotionalStateEntry: "calm",
      emotionalStateExit: "calm",
      exitReason: "hit_target",
      plannedTargetPrice: "2600.00",
      plannedStopLoss: "2380.00",
      realizedPnl: pnl("buy", 50, 2450, 2595),
      isDeviation: false,
    },

    // T2: INFY buy — panic closed early (winner turned into smaller win, deviation)
    {
      userId: DEMO_USER_ID,
      symbol: "INFY",
      action: "buy",
      quantity: 100,
      entryPrice: "1820.00",
      entryDate: tradeDate(5, 10, 15),
      exitPrice: "1850.00",
      exitDate: tradeDate(5, 13, 45),
      status: "closed",
      entryReasoning: "Infosys Q4 guidance upgrade. Fundamentals strong. Targeting ₹1920 with stop at ₹1785.",
      exitReasoning: "Got nervous when it dipped to ₹1840 briefly. Took profit early even though it bounced back. Should have held.",
      primaryStrategy: "fundamental",
      emotionalStateEntry: "calm",
      emotionalStateExit: "anxiety",
      exitReason: "panic",
      plannedTargetPrice: "1920.00",
      plannedStopLoss: "1785.00",
      realizedPnl: pnl("buy", 100, 1820, 1850),
      isDeviation: true, // exited before target
    },

    // T3: TCS sell — held way past stop on a loss (strong disposition effect)
    {
      userId: DEMO_USER_ID,
      symbol: "TCS",
      action: "sell",
      quantity: 30,
      entryPrice: "4100.00",
      entryDate: tradeDate(4, 9, 45),
      exitPrice: "3920.00",
      exitDate: tradeDate(4, 15, 20),
      status: "closed",
      entryReasoning: "TCS looking toppy after the run-up. Short with stop at ₹4180, target ₹3900.",
      exitReasoning: "Held way too long hoping it would turn. Stop was ₹4180 but I exited at ₹3920 after a 5-hour ordeal.",
      primaryStrategy: "technical",
      emotionalStateEntry: "confidence",
      emotionalStateExit: "anxiety",
      exitReason: "hit_stop",
      plannedTargetPrice: "3900.00",
      plannedStopLoss: "4180.00",
      realizedPnl: pnl("sell", 30, 4100, 3920),
      isDeviation: true, // held past stop
    },

    // T4: HDFC revenge trade 1 — placed 25 min after T3 loss, lost again
    {
      userId: DEMO_USER_ID,
      symbol: "HDFCBANK",
      action: "buy",
      quantity: 40,
      entryPrice: "1640.00",
      entryDate: tradeDate(4, 15, 45), // 25 min after T3 exit
      exitPrice: "1610.00",
      exitDate: tradeDate(3, 10, 0),
      status: "closed",
      entryReasoning: "HDFC Bank at support. Feels like a bounce. Entering quickly to recover the TCS loss.",
      exitReasoning: "Stopped out. Should not have entered in this emotional state.",
      primaryStrategy: "technical",
      emotionalStateEntry: "revenge",
      emotionalStateExit: "anxiety",
      exitReason: "hit_stop",
      plannedTargetPrice: "1680.00",
      plannedStopLoss: "1620.00",
      realizedPnl: pnl("buy", 40, 1640, 1610),
      isDeviation: false,
    },

    // T5: WIPRO revenge trade 2 — placed 40 min after T4 loss
    {
      userId: DEMO_USER_ID,
      symbol: "WIPRO",
      action: "buy",
      quantity: 150,
      entryPrice: "540.00",
      entryDate: tradeDate(3, 10, 40), // 40 min after T4 exit
      exitPrice: "528.00",
      exitDate: tradeDate(3, 14, 0),
      status: "closed",
      entryReasoning: "Overtrading after losses. Entered Wipro on a whim to get back losses.",
      exitReasoning: "Stopped out again. Two revenge trades in a row. This is bad discipline.",
      primaryStrategy: "technical",
      emotionalStateEntry: "revenge",
      emotionalStateExit: "anxiety",
      exitReason: "hit_stop",
      plannedTargetPrice: "560.00",
      plannedStopLoss: "530.00",
      realizedPnl: pnl("buy", 150, 540, 528),
      isDeviation: false,
    },

    // T6: ZOMATO FOMO — bought on Twitter tip, loss
    {
      userId: DEMO_USER_ID,
      symbol: "ZOMATO",
      action: "buy",
      quantity: 500,
      entryPrice: "225.00",
      entryDate: tradeDate(3, 11, 30),
      exitPrice: "210.00",
      exitDate: tradeDate(2, 10, 0),
      status: "closed",
      entryReasoning: "A popular trading account tweeted a buy call on Zomato. Everyone is piling in. FOMO entry.",
      exitReasoning: "Twitter call was wrong. Cut losses.",
      primaryStrategy: "social_proof",
      emotionalStateEntry: "fomo",
      emotionalStateExit: "anxiety",
      exitReason: "hit_stop",
      plannedTargetPrice: "240.00",
      plannedStopLoss: "215.00",
      realizedPnl: pnl("buy", 500, 225, 210),
      isDeviation: false,
    },

    // T7: PAYTM FOMO — bought on WhatsApp group tip, small win
    {
      userId: DEMO_USER_ID,
      symbol: "PAYTM",
      action: "buy",
      quantity: 300,
      entryPrice: "780.00",
      entryDate: tradeDate(2, 10, 0),
      exitPrice: "800.00",
      exitDate: tradeDate(2, 14, 30),
      status: "closed",
      entryReasoning: "WhatsApp group pumping Paytm saying RBI approval news coming. Entered.",
      exitReasoning: "Took quick profits before the hype faded.",
      primaryStrategy: "social_proof",
      emotionalStateEntry: "fomo",
      emotionalStateExit: "confidence",
      exitReason: "hit_target",
      plannedTargetPrice: "810.00",
      plannedStopLoss: "760.00",
      realizedPnl: pnl("buy", 300, 780, 800),
      isDeviation: false,
    },

    // T8: NIFTY50_BE — clean win this week (for weekly bias report to have a winner)
    {
      userId: DEMO_USER_ID,
      symbol: "BAJFINANCE",
      action: "buy",
      quantity: 20,
      entryPrice: "7200.00",
      entryDate: tradeDate(1, 9, 30),
      exitPrice: "7380.00",
      exitDate: tradeDate(1, 14, 0),
      status: "closed",
      entryReasoning: "Bajaj Finance bounced off 50-DMA with strong volume. Clean entry near support.",
      exitReasoning: "Hit ₹7400 target area, took profits slightly early but within plan.",
      primaryStrategy: "technical",
      emotionalStateEntry: "calm",
      emotionalStateExit: "calm",
      exitReason: "hit_target",
      plannedTargetPrice: "7400.00",
      plannedStopLoss: "7100.00",
      realizedPnl: pnl("buy", 20, 7200, 7380),
      isDeviation: false,
    },

    // T9: SBIN — open position (still running)
    {
      userId: DEMO_USER_ID,
      symbol: "SBIN",
      action: "buy",
      quantity: 200,
      entryPrice: "810.00",
      entryDate: tradeDate(0, 9, 45),
      status: "open",
      entryReasoning: "SBI at 52-week support after correction. Targeting ₹850 with stop at ₹790.",
      primaryStrategy: "technical",
      emotionalStateEntry: "calm",
      plannedTargetPrice: "850.00",
      plannedStopLoss: "790.00",
      isDeviation: false,
    },

    // T10: TATAMOTORS — open position (still running)
    {
      userId: DEMO_USER_ID,
      symbol: "TATAMOTORS",
      action: "sell",
      quantity: 100,
      entryPrice: "960.00",
      entryDate: tradeDate(0, 10, 30),
      status: "open",
      entryReasoning: "Tata Motors overbought on RSI after 12% rally. Shorting with target ₹920, stop ₹985.",
      primaryStrategy: "technical",
      emotionalStateEntry: "confidence",
      plannedTargetPrice: "920.00",
      plannedStopLoss: "985.00",
      isDeviation: false,
    },
  ]

  const inserted = await db.insert(schema.trades).values(trades).returning({ id: schema.trades.id, symbol: schema.trades.symbol, isDeviation: schema.trades.isDeviation })
  console.log(`  ✓ ${inserted.length} trades seeded`)

  // 4. Shadow outcomes for deviation trades (T2 INFY and T3 TCS)
  const infy = inserted.find((t) => t.symbol === "INFY" && t.isDeviation)
  const tcs = inserted.find((t) => t.symbol === "TCS" && t.isDeviation)

  const shadowRows: (typeof schema.shadowOutcomes.$inferInsert)[] = []

  if (infy) {
    // Shadow: would have hit ₹1920 target vs actual exit ₹1850
    const shadowPnlVal = 100 * (1920 - 1820) // 10000
    const actualPnlVal = 100 * (1850 - 1820) // 3000
    shadowRows.push({
      tradeId: infy.id,
      shadowExitPrice: "1920.00",
      shadowExitDate: tradeDate(4, 16, 0),
      shadowPnl: String(shadowPnlVal),
      pnlDelta: String(actualPnlVal - shadowPnlVal), // -7000: user lost ₹7000 by panicking
    })
  }

  if (tcs) {
    // Shadow: would have been stopped at ₹4180 vs actual exit ₹3920
    // Sell trade: entry 4100, actual exit 3920 (pnl = 30 * (4100-3920) = 5400)
    // Shadow: stopped at 4180 (pnl = 30 * (4100-4180) = -2400) — would have been a smaller loss
    const actualPnlVal = 30 * (4100 - 3920) // 5400 (gain because it's a short)
    const shadowPnlVal = 30 * (4100 - 4180) // -2400 (would have hit stop and taken smaller loss)
    shadowRows.push({
      tradeId: tcs.id,
      shadowExitPrice: "4180.00",
      shadowExitDate: tradeDate(4, 11, 0),
      shadowPnl: String(shadowPnlVal),
      pnlDelta: String(actualPnlVal - shadowPnlVal), // 7800: by skipping stop, user actually gained more (short)
    })
  }

  if (shadowRows.length > 0) {
    await db.insert(schema.shadowOutcomes).values(shadowRows)
    console.log(`  ✓ ${shadowRows.length} shadow outcomes seeded`)
  }

  console.log("\n✅ Seed complete!")
  console.log(`   Demo user: ${DEMO_EMAIL}`)
  console.log("   Sign in with Google using this email to see the demo data.")
  console.log("   Then visit /dashboard/bias-report and click Refresh Report.\n")
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
