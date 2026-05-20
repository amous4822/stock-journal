// Zod schemas shared between form (client) and server actions.
// z.coerce.* is used so <input type="number"> string values are auto-converted.
// Note: Zod v4 removed invalid_type_error — use chained validation for custom messages.
import { z } from "zod"

export const createTradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  action: z.enum(["buy", "sell"], { error: "Choose buy or sell" }),
  quantity: z.coerce.number().int("Must be a whole number").positive("Must be greater than 0"),
  entryPrice: z.coerce.number().positive("Must be greater than 0"),
  entryDate: z.coerce.date(),
  entryReasoning: z
    .string()
    .min(10, "Add at least 10 characters — the more detail, the better the AI tags"),
  plannedTargetPrice: z.coerce.number().positive().nullable().optional(),
  plannedStopLoss: z.coerce.number().positive().nullable().optional(),
})

export type CreateTradeInput = z.infer<typeof createTradeSchema>

export const closeTradeSchema = z.object({
  tradeId: z.string().uuid(),
  exitPrice: z.coerce.number().positive("Must be greater than 0"),
  exitDate: z.coerce.date(),
  exitReasoning: z
    .string()
    .min(10, "Add at least 10 characters — this helps the AI classify deviation"),
})

export type CloseTradeInput = z.infer<typeof closeTradeSchema>
