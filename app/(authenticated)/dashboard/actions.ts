"use server"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { trades, shadowOutcomes, biasReports } from "@/lib/db/schema"
import { requireAuthForAction } from "@/lib/auth"
import { logger } from "@/lib/logger"

// Returns a Date within the current ISO week (Mon=0 … Sun=6) at the given UTC hour:minute.
// Using week-relative dates ensures demo trades always land in the bias report's weekly window.
function currentWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

function weekDay(weekStart: Date, dayOffset: number, hour: number, minute: number): Date {
  const d = new Date(weekStart)
  d.setUTCDate(weekStart.getUTCDate() + dayOffset)
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

export async function loadDemoData(): Promise<
  { ok: true; data: { tradesCreated: number } } | { ok: false; error: string }
> {
  const auth = await requireAuthForAction()
  if (!auth.ok) return auth

  const { userId } = auth

  logger.info("loadDemoData:start", { userId })

  // Clear all existing data for this user so the button always produces a clean slate.
  // Shadow outcomes cascade-delete with trades; bias reports are deleted explicitly so
  // the hourly cooldown doesn't block the user from immediately refreshing the report.
  await db.delete(trades).where(eq(trades.userId, userId))
  await db.delete(biasReports).where(eq(biasReports.userId, userId))

  const ws = currentWeekStart()

  // TCS exit anchors MARUTI's entry/exit so the Markov revenge model (60-min window) detects it.
  const tcsExit = weekDay(ws, 0, 10, 30) // Monday 10:30
  const marutiEntry = new Date(tcsExit.getTime() + 45 * 60 * 1000) // +45 min
  const marutiExit = new Date(tcsExit.getTime() + 55 * 60 * 1000)  // +55 min (within 60-min window)

  const inserted = await db
    .insert(trades)
    .values([
      {
        userId,
        symbol: "RELIANCE",
        action: "buy",
        quantity: 50,
        entryPrice: "2850.00",
        entryDate: weekDay(ws, 0, 9, 30),
        exitPrice: "3095.00",
        exitDate: weekDay(ws, 0, 14, 0),
        status: "closed",
        entryReasoning: "Strong breakout above 200 DMA with volume. Target 3100, stop 2780.",
        exitReasoning: "Hit target. Exited as planned.",
        primaryStrategy: "technical",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "3100.00",
        plannedStopLoss: "2780.00",
        exitReason: "hit_target",
        emotionalStateExit: "calm",
        realizedPnl: "12250.00",
        isDeviation: false,
      },
      // TCS — deviation, shadow outcome computed below
      {
        userId,
        symbol: "TCS",
        action: "buy",
        quantity: 20,
        entryPrice: "3920.00",
        entryDate: weekDay(ws, 0, 9, 30),
        exitPrice: "3780.00",
        exitDate: tcsExit,
        status: "closed",
        entryReasoning: "Results beat estimates. Target 4200, stop 3800.",
        exitReasoning: "Got nervous after market dropped 1%. Exited early.",
        primaryStrategy: "fundamental",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "4200.00",
        plannedStopLoss: "3800.00",
        exitReason: "panic",
        emotionalStateExit: "anxiety",
        realizedPnl: "-2800.00",
        isDeviation: true,
      },
      {
        userId,
        symbol: "HDFCBANK",
        action: "buy",
        quantity: 30,
        entryPrice: "1680.00",
        entryDate: weekDay(ws, 0, 10, 0),
        exitPrice: "1590.00",
        exitDate: weekDay(ws, 0, 13, 0),
        status: "closed",
        entryReasoning: "WhatsApp tip said HDFCBANK will gap up tomorrow. Bought without checking.",
        exitReasoning: "Stopped out on fear.",
        primaryStrategy: "social_proof",
        emotionalStateEntry: "fomo",
        plannedTargetPrice: "0.00",
        plannedStopLoss: "0.00",
        exitReason: "panic",
        emotionalStateExit: "anxiety",
        realizedPnl: "-2700.00",
        isDeviation: false,
      },
      {
        userId,
        symbol: "INFY",
        action: "buy",
        quantity: 40,
        entryPrice: "1450.00",
        entryDate: weekDay(ws, 1, 9, 30),
        exitPrice: "1420.00",
        exitDate: weekDay(ws, 1, 15, 0),
        status: "closed",
        entryReasoning: "Cup-and-handle pattern. Target 1550, stop 1420.",
        exitReasoning: "Stop triggered. Followed the plan.",
        primaryStrategy: "technical",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "1550.00",
        plannedStopLoss: "1420.00",
        exitReason: "hit_stop",
        emotionalStateExit: "calm",
        realizedPnl: "-1200.00",
        isDeviation: false,
      },
      // TATAMOTORS — deviation, shadow computed below
      {
        userId,
        symbol: "TATAMOTORS",
        action: "buy",
        quantity: 60,
        entryPrice: "820.00",
        entryDate: weekDay(ws, 1, 9, 30),
        exitPrice: "845.00",
        exitDate: weekDay(ws, 1, 11, 0),
        status: "closed",
        entryReasoning: "EV pivot story, technically strong. Target 920, stop 790.",
        exitReasoning: "Market sentiment turned bearish. Took small profit instead of waiting.",
        primaryStrategy: "technical",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "920.00",
        plannedStopLoss: "790.00",
        exitReason: "panic",
        emotionalStateExit: "anxiety",
        realizedPnl: "1500.00",
        isDeviation: true,
      },
      // MARUTI entered 45 min after TCS loss — shows up as revenge trade
      {
        userId,
        symbol: "MARUTI",
        action: "buy",
        quantity: 15,
        entryPrice: "11200.00",
        entryDate: marutiEntry,
        exitPrice: "10850.00",
        exitDate: marutiExit,
        status: "closed",
        entryReasoning: "Gut feel after the TCS loss. Had to make it back.",
        exitReasoning: "Cut quickly when it kept falling.",
        primaryStrategy: "other",
        emotionalStateEntry: "revenge",
        plannedTargetPrice: "0.00",
        plannedStopLoss: "0.00",
        exitReason: "panic",
        emotionalStateExit: "anxiety",
        realizedPnl: "-5250.00",
        isDeviation: false,
      },
      {
        userId,
        symbol: "BAJFINANCE",
        action: "buy",
        quantity: 10,
        entryPrice: "6800.00",
        entryDate: weekDay(ws, 1, 9, 30),
        exitPrice: "6550.00",
        exitDate: weekDay(ws, 1, 14, 30),
        status: "closed",
        entryReasoning: "Credit growth thesis. Target 7100, stop 6550.",
        exitReasoning: "Stop hit after NPA concerns surfaced.",
        primaryStrategy: "fundamental",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "7100.00",
        plannedStopLoss: "6550.00",
        exitReason: "hit_stop",
        emotionalStateExit: "calm",
        realizedPnl: "-2500.00",
        isDeviation: false,
      },
      {
        userId,
        symbol: "ITC",
        action: "buy",
        quantity: 100,
        entryPrice: "480.00",
        entryDate: weekDay(ws, 2, 10, 0),
        exitPrice: "461.00",
        exitDate: weekDay(ws, 2, 13, 0),
        status: "closed",
        entryReasoning: "Everyone on Twitter said ITC dividend play. FOMO — bought without analysis.",
        exitReasoning: "Lost conviction. Sold at a loss.",
        primaryStrategy: "social_proof",
        emotionalStateEntry: "fomo",
        plannedTargetPrice: "0.00",
        plannedStopLoss: "0.00",
        exitReason: "other",
        emotionalStateExit: "anxiety",
        realizedPnl: "-1900.00",
        isDeviation: false,
      },
      // ASIANPAINT — deviation, shadow computed below
      {
        userId,
        symbol: "ASIANPAINT",
        action: "buy",
        quantity: 8,
        entryPrice: "2950.00",
        entryDate: weekDay(ws, 2, 9, 30),
        exitPrice: "2910.00",
        exitDate: weekDay(ws, 2, 11, 0),
        status: "closed",
        entryReasoning: "Volume breakout from consolidation. Target 2880 stop, aiming for 3100.",
        exitReasoning: "Couldn't handle seeing it red. Exited before stop.",
        primaryStrategy: "technical",
        emotionalStateEntry: "calm",
        plannedTargetPrice: "3100.00",
        plannedStopLoss: "2880.00",
        exitReason: "panic",
        emotionalStateExit: "anxiety",
        realizedPnl: "-320.00",
        isDeviation: true,
      },
      {
        userId,
        symbol: "ICICIBANK",
        action: "buy",
        quantity: 25,
        entryPrice: "1180.00",
        entryDate: weekDay(ws, 3, 9, 30),
        status: "open",
        entryReasoning: "Strong retail credit growth. Target 1280, stop 1140.",
        primaryStrategy: "technical",
        emotionalStateEntry: "confidence",
        plannedTargetPrice: "1280.00",
        plannedStopLoss: "1140.00",
        isDeviation: false,
      },
    ])
    .returning({ id: trades.id, symbol: trades.symbol })

  const bySymbol = Object.fromEntries(inserted.map((t) => [t.symbol, t.id]))

  // Hardcode shadow outcomes instead of calling computeShadow() — avoids a Yahoo Finance
  // dependency during demo load and keeps values deterministic
  await db.insert(shadowOutcomes).values([
    {
      tradeId: bySymbol["TCS"],
      shadowExitPrice: "4200.00",
      shadowExitDate: weekDay(ws, 2, 14, 0),
      shadowPnl: "5600.00",
      pnlDelta: "8400.00",
    },
    {
      tradeId: bySymbol["TATAMOTORS"],
      shadowExitPrice: "920.00",
      shadowExitDate: weekDay(ws, 3, 14, 0),
      shadowPnl: "6000.00",
      pnlDelta: "4500.00",
    },
    {
      tradeId: bySymbol["ASIANPAINT"],
      shadowExitPrice: "2880.00",
      shadowExitDate: weekDay(ws, 3, 14, 0),
      shadowPnl: "-560.00",
      pnlDelta: "-240.00",
    },
  ])

  logger.info("loadDemoData:done", { userId, tradesInserted: 10 })

  return { ok: true, data: { tradesCreated: 10 } }
}
