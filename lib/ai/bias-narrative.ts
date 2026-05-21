import { logger } from "@/lib/logger"
import { GROQ_MODEL, GROQ_API_URL } from "./groq"

export interface BiasStats {
  dispositionRatio: number
  dispositionCost: number
  revengeBaseline: number
  revengeConditional: number
  revengeTradesCount: number
  fomoStrategyPnl: number
  otherStrategyPnl: number
  fomoCount: number
  totalTrades: number
  insufficientRevengeData: boolean
}

function buildPrompt(stats: BiasStats): string {
  const dispositionLine = stats.dispositionRatio > 1
    ? `You held losing trades ${stats.dispositionRatio.toFixed(1)}× longer than winning ones, costing an estimated ₹${stats.dispositionCost.toLocaleString("en-IN")}.`
    : `Your hold times for winners and losers were balanced this week (ratio: ${stats.dispositionRatio.toFixed(2)}).`

  const revengeLine = stats.insufficientRevengeData
    ? `Not enough data yet to measure revenge trading (need at least 5 trades placed within 60 minutes of a loss).`
    : `When you traded within 60 minutes of a loss, your win rate dropped from ${(stats.revengeBaseline * 100).toFixed(0)}% to ${(stats.revengeConditional * 100).toFixed(0)}% (${stats.revengeTradesCount} revenge trades).`

  const fomoLine = stats.fomoCount > 0
    ? `Trades you tagged as social proof (FOMO) netted ₹${stats.fomoStrategyPnl.toLocaleString("en-IN")} vs ₹${stats.otherStrategyPnl.toLocaleString("en-IN")} from other strategies.`
    : `No FOMO-tagged trades this week.`

  return `You are a trading coach analyzing an Indian retail trader's weekly performance. Write exactly 2 short paragraphs (4-5 sentences each) in plain English. Be direct, specific, and constructive — not harsh. Use the ₹ symbol for currency. Do not use bullet points or headers.

Here are the trader's stats for this week:
- ${dispositionLine}
- ${revengeLine}
- ${fomoLine}
- Total trades: ${stats.totalTrades}

Paragraph 1: Summarize the biggest bias pattern this week and its financial impact.
Paragraph 2: Give one concrete, actionable suggestion the trader can apply next week.`
}

const FALLBACK_NARRATIVE = "Not enough data to generate a narrative this week. Log more trades and close them before the week ends. Keep your entry and exit reasoning detailed — the AI needs context to tag your patterns accurately."

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY is not set")

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq API error ${response.status}: ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const text = data.choices[0]?.message?.content
  if (!text) throw new Error("Empty response from Groq")
  return text.trim()
}

export async function generateBiasNarrative(stats: BiasStats): Promise<string> {
  const start = Date.now()
  logger.info("ai:generateBiasNarrative:start", { totalTrades: stats.totalTrades })

  if (stats.totalTrades === 0) return FALLBACK_NARRATIVE

  try {
    const result = await callGroq(buildPrompt(stats))
    logger.info("ai:generateBiasNarrative:success", { latencyMs: Date.now() - start })
    return result
  } catch (firstError) {
    logger.warn("ai:generateBiasNarrative:retry", { error: String(firstError) })
    await new Promise((r) => setTimeout(r, 1000))

    try {
      const result = await callGroq(buildPrompt(stats))
      logger.info("ai:generateBiasNarrative:success_on_retry", { latencyMs: Date.now() - start })
      return result
    } catch (secondError) {
      logger.error("ai:generateBiasNarrative:fallback_used", { error: String(secondError), latencyMs: Date.now() - start })
      return FALLBACK_NARRATIVE
    }
  }
}
