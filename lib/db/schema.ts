// Drizzle ORM schema — single source of truth for all database types.
// Auth.js adapter tables must match @auth/drizzle-adapter expectations exactly.
import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

// ── Auth.js required tables ──────────────────────────────────────────────────
// Table names (singular) match what @auth/drizzle-adapter expects internally.

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // App-specific addition — tracks when user first signed up
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

// ── App-specific enums ───────────────────────────────────────────────────────

export const actionEnum = pgEnum("action", ["buy", "sell"])

export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"])

export const primaryStrategyEnum = pgEnum("primary_strategy", [
  "technical",
  "fundamental",
  "news",
  "social_proof",
  "other",
])

// Shared by both entry and exit emotional state fields
export const emotionalStateEnum = pgEnum("emotional_state", [
  "calm",
  "fomo",
  "revenge",
  "anxiety",
  "confidence",
])

export const exitReasonEnum = pgEnum("exit_reason", [
  "hit_target",
  "hit_stop",
  "panic",
  "anxiety",
  "reevaluation",
  "other",
])

// ── trades ───────────────────────────────────────────────────────────────────

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(), // NSE ticker, e.g. "RELIANCE"
    action: actionEnum("action").notNull(),
    quantity: integer("quantity").notNull(), // must be positive — enforced by Zod
    entryPrice: numeric("entry_price", { precision: 10, scale: 2 }).notNull(),
    entryDate: timestamp("entry_date", { withTimezone: true }).notNull(),
    exitPrice: numeric("exit_price", { precision: 10, scale: 2 }),
    exitDate: timestamp("exit_date", { withTimezone: true }),
    status: tradeStatusEnum("status").notNull().default("open"),
    entryReasoning: text("entry_reasoning").notNull(),
    exitReasoning: text("exit_reasoning"),
    primaryStrategy: primaryStrategyEnum("primary_strategy").notNull(),
    emotionalStateEntry: emotionalStateEnum("emotional_state_entry").notNull(),
    plannedTargetPrice: numeric("planned_target_price", { precision: 10, scale: 2 }),
    plannedStopLoss: numeric("planned_stop_loss", { precision: 10, scale: 2 }),
    exitReason: exitReasonEnum("exit_reason"),
    emotionalStateExit: emotionalStateEnum("emotional_state_exit"),
    // Computed at close: (exit_price - entry_price) * quantity * direction
    realizedPnl: numeric("realized_pnl", { precision: 10, scale: 2 }),
    // True when the user exited outside their stated plan (target/stop)
    isDeviation: boolean("is_deviation").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Query pattern: "show me this user's open trades"
    index("trades_user_id_status_idx").on(t.userId, t.status),
    // Query pattern: "show me this user's trades sorted by most recent"
    index("trades_user_id_entry_date_idx").on(t.userId, t.entryDate.desc()),
  ]
)

// ── shadow_outcomes ──────────────────────────────────────────────────────────
// One row per trade. Populated only when a trade closes with is_deviation=true.

export const shadowOutcomes = pgTable("shadow_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id")
    .notNull()
    .unique() // one shadow outcome per trade
    .references(() => trades.id, { onDelete: "cascade" }),
  shadowExitPrice: numeric("shadow_exit_price", { precision: 10, scale: 2 }).notNull(),
  shadowExitDate: timestamp("shadow_exit_date", { withTimezone: true }).notNull(),
  shadowPnl: numeric("shadow_pnl", { precision: 10, scale: 2 }).notNull(),
  // Positive = user left money on the table; negative = deviation actually saved them
  pnlDelta: numeric("pnl_delta", { precision: 10, scale: 2 }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
})

// ── bias_reports ─────────────────────────────────────────────────────────────
// One report per user per week. Upserted each time "Refresh Report" is clicked.

export const biasReports = pgTable(
  "bias_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    // Disposition Effect: ratio > 1 means user holds losers longer than winners
    dispositionRatio: numeric("disposition_ratio", { precision: 5, scale: 2 }),
    dispositionCost: numeric("disposition_cost", { precision: 10, scale: 2 }),
    // Revenge Trading: 2-state Markov — baseline vs post-loss conditional win rate
    revengeBaselineWinrate: numeric("revenge_baseline_winrate", { precision: 5, scale: 4 }),
    revengeConditionalWinrate: numeric("revenge_conditional_winrate", { precision: 5, scale: 4 }),
    revengeTradesCount: integer("revenge_trades_count"),
    // FOMO: P&L of social_proof-tagged trades vs everything else
    fomoStrategyPnl: numeric("fomo_strategy_pnl", { precision: 10, scale: 2 }),
    // AI-generated plain-English narrative (2 paragraphs)
    aiNarrative: text("ai_narrative"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Rate-limit query: "does a report already exist for this user+week?"
    uniqueIndex("bias_reports_user_id_week_start_idx").on(t.userId, t.weekStart),
  ]
)

// ── Inferred types (re-exported for consumers) ───────────────────────────────
// These flow from schema → server actions → client — never duplicate manually.

export type User = typeof users.$inferSelect
export type Trade = typeof trades.$inferSelect
export type NewTrade = typeof trades.$inferInsert
export type ShadowOutcome = typeof shadowOutcomes.$inferSelect
export type BiasReport = typeof biasReports.$inferSelect
