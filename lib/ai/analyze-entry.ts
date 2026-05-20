// AI function: analyzes a trader's entry reasoning and extracts structured tags.
// Uses gpt-4o-mini via Vercel AI SDK generateObject. Has 1 retry with
// exponential backoff and a safe fallback — never blocks the createTrade action.
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { logger } from "@/lib/logger"

export const entryAnalysisSchema = z.object({
  primary_strategy: z.enum([
    "technical",
    "fundamental",
    "news",
    "social_proof",
    "other",
  ]),
  emotional_state: z.enum([
    "calm",
    "fomo",
    "revenge",
    "anxiety",
    "confidence",
  ]),
  // Null when the trader's note doesn't mention explicit price targets
  planned_target_price: z.number().nullable(),
  planned_stop_loss: z.number().nullable(),
})

export type EntryAnalysis = z.infer<typeof entryAnalysisSchema>

// Fallback returned when both AI attempts fail — keeps the trade-log UX unblocked.
// The user can still see their trade; tags will default and can be edited later.
const FALLBACK: EntryAnalysis = {
  primary_strategy: "other",
  emotional_state: "calm",
  planned_target_price: null,
  planned_stop_loss: null,
}

const PROMPT = (reasoning: string) =>
  `You are analyzing an Indian retail trader's note about a trade they just made. Extract:
1. Their primary strategy (technical = chart patterns/indicators; fundamental = earnings/valuation; news = recent news event; social_proof = Twitter/Reddit/friends tip; other = unclear)
2. Their emotional state (calm = rational; fomo = fear of missing out; revenge = trading to recover a loss; anxiety = worried/uncertain; confidence = very sure)
3. Any explicit target price they mentioned (number in INR, or null)
4. Any explicit stop loss they mentioned (number in INR, or null)

Be conservative — if strategy or emotion is not clear, default to 'other' and 'calm'. Only extract numeric targets/stops if the trader explicitly mentions them.

Trader's note: ${reasoning}`

async function attempt(reasoning: string): Promise<EntryAnalysis> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: entryAnalysisSchema,
    prompt: PROMPT(reasoning),
  })
  return object
}

export async function analyzeEntry(reasoning: string): Promise<EntryAnalysis> {
  const start = Date.now()
  logger.info("ai:analyzeEntry:start", { chars: reasoning.length })

  try {
    const result = await attempt(reasoning)
    logger.info("ai:analyzeEntry:success", { latencyMs: Date.now() - start, strategy: result.primary_strategy })
    return result
  } catch (firstError) {
    logger.warn("ai:analyzeEntry:retry", { error: String(firstError) })

    // 1s backoff before retry — chosen to respect OpenAI rate limits without
    // noticeably delaying the user (the trade saves optimistically in the UI)
    await new Promise((r) => setTimeout(r, 1000))

    try {
      const result = await attempt(reasoning)
      logger.info("ai:analyzeEntry:success_on_retry", { latencyMs: Date.now() - start })
      return result
    } catch (secondError) {
      logger.error("ai:analyzeEntry:fallback_used", {
        error: String(secondError),
        latencyMs: Date.now() - start,
      })
      return FALLBACK
    }
  }
}
