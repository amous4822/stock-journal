// AI function: analyzes a trader's exit and classifies the reason + deviation.
// A "deviation" is when the trader exited outside their stated plan (target/stop).
// Uses Groq's function-calling API directly (bypasses AI SDK's json_schema, which
// llama-3.3-70b-versatile doesn't support). Same retry/fallback pattern as analyzeEntry.
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

const MODEL = "llama-3.3-70b-versatile"
const API_URL = "https://api.groq.com/openai/v1/chat/completions"

async function groqFunctionCall(
  prompt: string,
  schema: z.ZodTypeAny
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY is not set")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemaJson = JSON.stringify((schema as any).toJSONSchema?.() ?? schema)

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_exit",
            description: "Analyzes a trader's exit and classifies deviation from plan",
            parameters: JSON.parse(schemaJson),
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "analyze_exit" } },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq API error ${response.status}: ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{
      message: {
        tool_calls?: Array<{
          function: { arguments: string }
        }>
      }
    }>
  }

  const toolCall = data.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall) throw new Error("No tool call in Groq response")

  return JSON.parse(toolCall.function.arguments)
}

function buildPrompt(
  entryReasoning: string,
  exitReasoning: string,
  plannedTarget: number | null,
  plannedStop: number | null,
  entryPrice: number,
  exitPrice: number
): string {
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
  const prompt = buildPrompt(entryReasoning, exitReasoning, plannedTarget, plannedStop, entryPrice, exitPrice)
  const raw = await groqFunctionCall(prompt, exitAnalysisSchema)
  return exitAnalysisSchema.parse(raw)
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