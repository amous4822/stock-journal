import { z } from "zod"

export const GROQ_MODEL = "llama-3.3-70b-versatile"
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

// Groq's llama-3.3-70b doesn't support the AI SDK's json_schema response format,
// so we use function-calling directly to get structured output.
export async function groqFunctionCall(
  prompt: string,
  fnName: string,
  fnDescription: string,
  schema: z.ZodTypeAny
): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error("GROQ_API_KEY is not set")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemaJson = JSON.stringify((schema as any).toJSONSchema?.() ?? schema)

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "function",
          function: { name: fnName, description: fnDescription, parameters: JSON.parse(schemaJson) },
        },
      ],
      tool_choice: { type: "function", function: { name: fnName } },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Groq API error ${response.status}: ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { tool_calls?: Array<{ function: { arguments: string } }> } }>
  }

  const toolCall = data.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall) throw new Error("No tool call in Groq response")
  return JSON.parse(toolCall.function.arguments)
}
