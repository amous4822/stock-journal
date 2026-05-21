"use server"
import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { trades, biasReports } from "@/lib/db/schema"
import type { BiasReport } from "@/lib/db/schema"
import { requireAuthForAction } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { computeDisposition } from "@/lib/bias/disposition"
import { computeRevenge } from "@/lib/bias/revenge"
import { computeFomo } from "@/lib/bias/fomo"
import { generateBiasNarrative } from "@/lib/ai/bias-narrative"
import { revalidatePath } from "next/cache"

function currentWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

function currentWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart)
  end.setUTCDate(weekStart.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

export async function computeBiasReport(): Promise<{ ok: true; data: BiasReport } | { ok: false; error: string }> {
  logger.info("action:computeBiasReport:start")

  const authResult = await requireAuthForAction()
  if (!authResult.ok) return authResult
  const { userId } = authResult

  const weekStart = currentWeekStart()
  const weekEnd = currentWeekEnd(weekStart)

  const existing = await db.query.biasReports.findFirst({
    where: and(
      eq(biasReports.userId, userId),
      eq(biasReports.weekStart, weekStart.toISOString().split("T")[0])
    ),
    orderBy: (r, { desc }) => [desc(r.computedAt)],
  })

  if (existing) {
    const ageMs = Date.now() - new Date(existing.computedAt).getTime()
    if (ageMs < 60 * 60 * 1000) {
      logger.info("action:computeBiasReport:rate_limited", { ageMs })
      return { ok: false, error: `Report was last refreshed ${Math.ceil(ageMs / 60_000)} minutes ago. Please wait until the hourly refresh window resets.` }
    }
  }

  try {
    const closedTrades = await db.query.trades.findMany({
      where: and(
        eq(trades.userId, userId),
        eq(trades.status, "closed"),
        gte(trades.exitDate, weekStart),
        lte(trades.exitDate, weekEnd)
      ),
    })

    logger.info("action:computeBiasReport:trades_fetched", { count: closedTrades.length })

    const disposition = computeDisposition(closedTrades)
    const revenge = computeRevenge(closedTrades)
    const fomo = computeFomo(closedTrades)

    const narrative = await generateBiasNarrative({
      dispositionRatio: disposition.ratio,
      dispositionCost: disposition.cost,
      revengeBaseline: revenge.baselineWinrate,
      revengeConditional: revenge.conditionalWinrate,
      revengeTradesCount: revenge.revengeTradesCount,
      fomoStrategyPnl: fomo.fomoPnl,
      otherStrategyPnl: fomo.otherPnl,
      fomoCount: fomo.fomoCount,
      totalTrades: closedTrades.length,
      insufficientRevengeData: revenge.insufficientData,
    })

    const weekStartStr = weekStart.toISOString().split("T")[0]

    const [report] = await db
      .insert(biasReports)
      .values({
        userId,
        weekStart: weekStartStr,
        dispositionRatio: String(disposition.ratio),
        dispositionCost: String(disposition.cost),
        revengeBaselineWinrate: String(revenge.baselineWinrate),
        revengeConditionalWinrate: String(revenge.conditionalWinrate),
        revengeTradesCount: revenge.revengeTradesCount,
        fomoStrategyPnl: String(fomo.fomoPnl),
        aiNarrative: narrative,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [biasReports.userId, biasReports.weekStart],
        set: {
          dispositionRatio: String(disposition.ratio),
          dispositionCost: String(disposition.cost),
          revengeBaselineWinrate: String(revenge.baselineWinrate),
          revengeConditionalWinrate: String(revenge.conditionalWinrate),
          revengeTradesCount: revenge.revengeTradesCount,
          fomoStrategyPnl: String(fomo.fomoPnl),
          aiNarrative: narrative,
          computedAt: new Date(),
        },
      })
      .returning()

    logger.info("action:computeBiasReport:success", { reportId: report.id })
    revalidatePath("/dashboard/bias-report")
    return { ok: true, data: report }
  } catch (error) {
    logger.error("action:computeBiasReport:error", { error: String(error), userId })
    return { ok: false, error: "Failed to compute bias report. Please try again." }
  }
}
