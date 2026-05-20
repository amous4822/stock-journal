// AI function: analyzes a trader's entry reasoning and extracts structured tags.
// Uses Groq's function-calling API directly (bypasses AI SDK's json_schema, which
// llama-3.3-70b-versatile doesn't support). Has 1 retry with exponential backoff
// and a safe fallback — never blocks the createTrade action.
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
  planned_target_price: z.number().nullable(),
  planned_stop_loss: z.number().nullable(),
})

export type EntryAnalysis = z.infer<typeof entryAnalysisSchema>

const FALLBACK: EntryAnalysis = {
  primary_strategy: "other",
  emotional_state: "calm",
  planned_target_price: null,
  planned_stop_loss: null,
}

const MODEL = "llama-3.3-70b-versatile"
const API_URL = "https://api.groq.com/openai/v1/chat/completions"

// Groq function-calling call — returns the parsed object or throws.
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
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      // Groq function-calling via tool parameter
      tools: [
        {
          type: "function",
          function: {
            name: "analyze_entry",
            description: "Analyzes a trader's entry and extracts structured tags",
            parameters: JSON.parse(schemaJson),
          },
        },
      ],
      // Force the model to call the function
      tool_choice: { type: "function", function: { name: "analyze_entry" } },
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

async function attempt(reasoning: string): Promise<EntryAnalysis> {
  const prompt = `You are analyzing an Indian retail trader's note about a trade they just made. Extract:
1. Their primary strategy (technical = chart patterns/indicators; fundamental = earnings/valuation; news = recent news event; social_proof = Twitter/Reddit/friends tip; other = unclear)
2. Their emotional state (calm = rational; fomo = fear of missing out; revenge = trading to recover a loss; anxiety = worried/uncertain; confidence = very sure)
3. Any explicit target price they mentioned (number in INR, or null)
4. Any explicit stop loss they mentioned (number in INR, or null)

Be conservative — if strategy or emotion is not clear, default to 'other' and 'calm'. Only extract numeric targets/stops if the trader explicitly mentions them.

Trader's note: ${reasoning}`

  const raw = await groqFunctionCall(prompt, entryAnalysisSchema)
  return entryAnalysisSchema.parse(raw)
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

    // 1s backoff before retry — chosen to respect Groq rate limits without
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