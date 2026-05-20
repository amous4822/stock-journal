// Server actions for trade CRUD — createTrade and closeTrade.
// All actions: validate input → auth check → AI analysis → DB write → return discriminated union.
// Never throws to the client. Logs at entry, exit, and on every error.
"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { trades } from "@/lib/db/schema"
import type { Trade } from "@/lib/db/schema"
import { requireAuthForAction } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { analyzeEntry } from "@/lib/ai/analyze-entry"
import { analyzeExit } from "@/lib/ai/analyze-exit"
import { createTradeSchema, closeTradeSchema } from "./schemas"

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

// ── createTrade ───────────────────────────────────────────────────────────────

export async function createTrade(input: unknown): Promise<Result<Trade>> {
  logger.info("action:createTrade:start")

  // 1. Validate input
  const parsed = createTradeSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input"
    logger.warn("action:createTrade:validation_failed", { message })
    return { ok: false, error: message }
  }

  // 2. Auth check — every action must verify session
  const authResult = await requireAuthForAction()
  if (!authResult.ok) return authResult
  const { userId } = authResult

  try {
    const {
      symbol,
      action,
      quantity,
      entryPrice,
      entryDate,
      entryReasoning,
      plannedTargetPrice,
      plannedStopLoss,
    } = parsed.data

    // 3. AI tagging — runs in parallel with no user-blocking; falls back on failure
    const analysis = await analyzeEntry(entryReasoning)

    // 4. Insert trade row
    // Drizzle's numeric columns accept string or number — using String() for clarity
    const [trade] = await db
      .insert(trades)
      .values({
        userId,
        symbol: symbol.toUpperCase().trim(),
        action,
        quantity,
        entryPrice: String(entryPrice),
        entryDate,
        entryReasoning,
        primaryStrategy: analysis.primary_strategy,
        emotionalStateEntry: analysis.emotional_state,
        plannedTargetPrice: plannedTargetPrice ? String(plannedTargetPrice) : null,
        plannedStopLoss: plannedStopLoss ? String(plannedStopLoss) : null,
      })
      .returning()

    logger.info("action:createTrade:success", { tradeId: trade.id, symbol, strategy: analysis.primary_strategy })
    revalidatePath("/dashboard/trades")
    revalidatePath("/dashboard")
    return { ok: true, data: trade }
  } catch (error) {
    logger.error("action:createTrade:error", { error: String(error), userId })
    return { ok: false, error: "Failed to log trade. Please try again." }
  }
}

// ── closeTrade ────────────────────────────────────────────────────────────────

export async function closeTrade(input: unknown): Promise<Result<Trade>> {
  logger.info("action:closeTrade:start")

  const parsed = closeTradeSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input"
    logger.warn("action:closeTrade:validation_failed", { message })
    return { ok: false, error: message }
  }

  const authResult = await requireAuthForAction()
  if (!authResult.ok) return authResult
  const { userId } = authResult

  const { tradeId, exitPrice, exitDate, exitReasoning } = parsed.data

  try {
    // Fetch the trade first — ensure it exists and belongs to this user
    const existing = await db.query.trades.findFirst({
      where: and(eq(trades.id, tradeId), eq(trades.userId, userId)),
    })

    if (!existing) {
      return { ok: false, error: "Trade not found." }
    }
    if (existing.status === "closed") {
      return { ok: false, error: "Trade is already closed." }
    }

    const entryPrice = parseFloat(existing.entryPrice)
    const plannedTarget = existing.plannedTargetPrice
      ? parseFloat(existing.plannedTargetPrice)
      : null
    const plannedStop = existing.plannedStopLoss
      ? parseFloat(existing.plannedStopLoss)
      : null

    // AI exit analysis — determines exit reason, emotion, and deviation
    const analysis = await analyzeExit(
      existing.entryReasoning,
      exitReasoning,
      plannedTarget,
      plannedStop,
      entryPrice,
      exitPrice
    )

    // Realized P&L:
    //   Buy:  profit when price rises  → (exit - entry) * qty
    //   Sell: profit when price falls  → (entry - exit) * qty
    const direction = existing.action === "buy" ? 1 : -1
    const realizedPnl = (exitPrice - entryPrice) * existing.quantity * direction

    const [updated] = await db
      .update(trades)
      .set({
        exitPrice: String(exitPrice),
        exitDate,
        exitReasoning,
        status: "closed",
        exitReason: analysis.exit_reason,
        emotionalStateExit: analysis.emotional_state,
        isDeviation: analysis.is_deviation,
        realizedPnl: String(realizedPnl.toFixed(2)),
        updatedAt: new Date(),
      })
      .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
      .returning()

    logger.info("action:closeTrade:success", {
      tradeId,
      realizedPnl: realizedPnl.toFixed(2),
      isDeviation: analysis.is_deviation,
    })

    // TODO: Phase 3 — if analysis.is_deviation, call computeShadow(tradeId) here
    // Deferred because computeShadow depends on the mock price service (Phase 3)

    revalidatePath("/dashboard/trades")
    revalidatePath(`/dashboard/trades/${tradeId}`)
    revalidatePath("/dashboard")
    return { ok: true, data: updated }
  } catch (error) {
    logger.error("action:closeTrade:error", { error: String(error), tradeId, userId })
    return { ok: false, error: "Failed to close trade. Please try again." }
  }
}
