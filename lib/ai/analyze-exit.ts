// AI function: analyzes a trader's exit and classifies the reason + deviation.
// A "deviation" is when the trader exited outside their stated plan (target/stop).
// Uses gpt-4o-mini via Vercel AI SDK generateObject. Same retry/fallback pattern as analyzeEntry.
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { logger } from "@/lib/logger"

export const exitAnalysisSchema = z.object({
  exit_reason: z.enum([
    "hit_target",
    "hit_stop",
    "panic",
    "anxiety",
    "reevaluation",
    "other",
  ]),
  emotional_state: z.enum([
    "calm",
    "fomo",
    "revenge",
    "anxiety",
    "confidence",
  ]),
  // True when exit price diverges from the stated plan without rational reevaluation
  is_deviation: z.boolean(),
  deviation_explanation: z.string().nullable(),
})

export type ExitAnalysis = z.infer<typeof exitAnalysisSchema>

const FALLBACK: ExitAnalysis = {
  exit_reason: "other",
  emotional_state: "calm",
  is_deviation: false,
  deviation_explanation: null,
}

const PROMPT = (
  entryReasoning: string,
  exitReasoning: string,
  plannedTarget: number | null,
  plannedStop: number | null,
  entryPrice: number,
  exitPrice: number
) => {
  const planSummary =
    plannedTarget || plannedStop
      ? `Their original plan: target ₹${plannedTarget ?? "none"}, stop ₹${plannedStop ?? "none"}.`
      : `They had no explicit target or stop loss.`

  return `You are analyzing whether an Indian retail trader deviated from their trading plan.

Entry context: "${entryReasoning}"
Exit context: "${exitReasoning}"
Entry price: ₹${entryPrice}. Exit price: ₹${exitPrice}.
${planSummary}

Classify:
1. exit_reason: why they exited (hit_target = reached stated target; hit_stop = reached stated stop; panic = sudden fear-driven exit; anxiety = uncertain, exited early; reevaluation = logical change of view; other = unclear)
2. emotional_state: their emotional state at exit
3. is_deviation: true if they exited before hitting their target/stop without a rational reevaluation — i.e., they acted against their own stated plan due to emotion
4. deviation_explanation: if is_deviation=true, a short plain-English explanation of what the deviation was (null otherwise)

Be conservative — only mark is_deviation=true if the evidence clearly shows emotional deviation from a stated plan.`
}

async function attempt(
  entryReasoning: string,
  exitReasoning: string,
  plannedTarget: number | null,
  plannedStop: number | null,
  entryPrice: number,
  exitPrice: number
): Promise<ExitAnalysis> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: exitAnalysisSchema,
    prompt: PROMPT(entryReasoning, exitReasoning, plannedTarget, plannedStop, entryPrice, exitPrice),
  })
  return object
}

export async function analyzeExit(
  entryReasoning: string,
  exitReasoning: string,
  plannedTarget: number | null,
  plannedStop: number | null,
  entryPrice: number,
  exitPrice: number
): Promise<ExitAnalysis> {
  const start = Date.now()
  logger.info("ai:analyzeExit:start", { entryChars: entryReasoning.length, exitChars: exitReasoning.length })

  try {
    const result = await attempt(entryReasoning, exitReasoning, plannedTarget, plannedStop, entryPrice, exitPrice)
    logger.info("ai:analyzeExit:success", { latencyMs: Date.now() - start, isDeviation: result.is_deviation })
    return result
  } catch (firstError) {
    logger.warn("ai:analyzeExit:retry", { error: String(firstError) })
    await new Promise((r) => setTimeout(r, 1000))

    try {
      const result = await attempt(entryReasoning, exitReasoning, plannedTarget, plannedStop, entryPrice, exitPrice)
      logger.info("ai:analyzeExit:success_on_retry", { latencyMs: Date.now() - start })
      return result
    } catch (secondError) {
      logger.error("ai:analyzeExit:fallback_used", {
        error: String(secondError),
        latencyMs: Date.now() - start,
      })
      return FALLBACK
    }
  }
}
