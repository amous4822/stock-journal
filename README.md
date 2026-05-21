# AlphaJournal

A trade journal for Indian retail traders that outputs the financial cost of cognitive biases. Most retail investors underperform the Nifty 50 not because they pick bad stocks, but because they make predictable behavioural mistakes i.e. holding losers too long, revenge trading after losses, chasing tips. AlphaJournal puts a rupee figure for each of those mistakes.

**[Live Demo →](https://stock-journal-mu.vercel.app)**

---

## Demo

Sign in with any Google account to start journaling immediately. To see a pre-populated journal with all bias patterns visible, click the button on top right to load demo data to your account. The demo trades demonstrates the following aspects of the product -

**Trades 1 + 4 + 7 — "Good behavior" baseline**
RELIANCE (hit target), INFY (hit stop), BAJFINANCE (hit stop). These show the product working for disciplined traders — no deviation, Shadow Portfolio delta is small, bias report doesn't penalize them. 

**Trades 2 + 5 + 9 — The Shadow Portfolio showcase**
TCS (panic exit before target), TATAMOTORS (panic exit before target), ASIANPAINT (anxiety exit before stop). These are the three is_deviation = true trades. Each one has a meaningful pnl_delta — the Shadow Portfolio shows exactly how much money the emotional exit cost.

**Trades 3 + 8 — FOMO/social proof**
HDFCBANK ("saw on Twitter"), ITC ("finfluencer on YouTube"). These feed the FOMO P&L card in the Bias Report showing that social proof driven trades underperform thesis driven ones. Two trades tagged social_proof gives the calculation enough data to show a meaningful comparison.

**Trade 6 — Revenge trade**
MARUTI, entered exactly 45 minutes after the TCS loss. This is the only trade that fires the Markov model. The entry reasoning explicitly says "just lost money on TCS" so the story is clear.

**Trade 10 — Open position**
ICICIBANK, still open. To shows the product looks for tracking live positions. The dashboard "open positions" counter shows 1. You can close it to see how the flow works.


---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | Server Components make auth-gated pages trivial; Server Actions replace a REST layer entirely |
| Language | TypeScript (strict) | Drizzle types flow end-to-end; eliminates a class of runtime bugs at the DB boundary |
| Database | PostgreSQL on Neon | Serverless driver works in Next.js edge/serverless without connection pooling config |
| ORM | Drizzle | SQL-close enough to reason about queries; migrations are plain SQL files you can audit |
| Auth | Auth.js v5 | Google OAuth in ~30 lines; session propagated to all server components automatically |
| AI | Groq (llama-3.3-70b) | Free for dev purposes. Fast enough for live tagging on submit. API returns structured output |
| Styling | Tailwind + shadcn/ui | Quick setup and faster build time. Can focus more on functionality than UI |
| Validation | Zod | Shared between server actions and client forms. Schema is the documentation |
| Price data | Yahoo Finance + mock fallback | Free, no API key required. Mock data makes the app work without internet |

---

## Architecture

```mermaid
graph TD
    Browser -->|Server Component| Next["Next.js App Router"]
    Next -->|requireAuth| Auth["Auth.js v5 · Google OAuth"]
    Auth -->|session| DB[(Neon PostgreSQL)]
    Next -->|Server Action| Action["createTrade / closeTrade\ncomputeBiasReport"]
    Action -->|analyzeEntry / analyzeExit| Groq["Groq API\nllama-3.3-70b"]
    Action -->|getDailyPrices| Yahoo["Yahoo Finance\n+ mock fallback"]
    Action -->|Drizzle ORM| DB
    DB --> Schema["trades · shadow_outcomes\nbias_reports · sessions"]
```

**Log trade flow:** User submits form → `createTrade` validates with Zod → `analyzeEntry` calls Groq (function-calling) → Drizzle inserts → `revalidatePath` triggers RSC re-render.

**Close trade flow:** `closeTrade` validates → `analyzeExit` calls Groq → if `is_deviation`, `computeShadow` fetches OHLC and simulates the disciplined exit → shadow outcome persisted → dashboard Shadow Portfolio widget updates.

---

## Setup

```bash
# Clone
git clone https://github.com/amous4822/stock-journal.git
cd stock-journal

# Install
pnpm install

# Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, GROQ_API_KEY

# Push schema to database
pnpm db:push

# Start dev server
pnpm dev
```

Visit `http://localhost:3000` and sign in with Google.

---

## Project structure

```
.
├── app/
│   ├── (authenticated)/
│   │   ├── dashboard/
│   │   │   ├── bias-report/       # Bias report page, refresh button, server action
│   │   │   ├── trades/            # Trade list, log modal, close modal, server actions
│   │   │   │   └── [id]/          # Trade detail + close modal
│   │   │   ├── error.tsx          # Dashboard error boundary
│   │   │   ├── loading.tsx        # Dashboard skeleton
│   │   │   └── page.tsx           # Main dashboard: stats + shadow portfolio
│   │   └── layout.tsx             # Auth gate (shared across all dashboard routes)
│   ├── api/auth/[...nextauth]/    # Auth.js API route
│   ├── auth/signin/               # Google sign-in page
│   └── page.tsx                   # Public landing page
├── components/
│   ├── dashboard/sidebar.tsx      # Responsive sidebar (hamburger on mobile)
│   └── ui/                        # shadcn/ui components + VoiceTextarea
├── lib/
│   ├── ai/                        # analyzeEntry, analyzeExit, generateBiasNarrative
│   ├── bias/                      # disposition.ts, revenge.ts, fomo.ts (pure functions)
│   ├── db/                        # Drizzle instance + schema (all tables)
│   ├── prices/                    # Yahoo Finance fetch + synthetic OHLC mock data
│   ├── shadow/                    # computeShadow — simulates the disciplined exit
│   ├── auth.ts                    # Auth.js config + requireAuth / requireAuthForAction
│   ├── logger.ts                  # Structured JSON logger (stdout → Vercel log drain)
│   └── utils.ts                   # formatINR, formatDate, cn, toDatetimeLocal
├── scripts/seed.ts                # Demo data seeder (gated to non-production)
├── .github/workflows/ci.yml       # CI: lint → tsc → build (master branch only)
└── drizzle.config.ts
```

---

## AI integration

Three functions in `lib/ai/`, all using Groq's `llama-3.3-70b-versatile`:

**`analyzeEntry(reasoning)`** — Called on trade creation. Extracts `primary_strategy` (technical / fundamental / news / social_proof / other), `emotional_state` (calm / fomo / revenge / anxiety / confidence), and any explicit target or stop-loss price mentioned in the trader's free-text note. Uses Groq function-calling; response validated with Zod.

**`analyzeExit(entryReasoning, exitReasoning, target, stop, entryPrice, exitPrice)`** — Called on trade close. Determines `exit_reason`, `emotional_state`, and whether `is_deviation` is true. A deviation means the trader exited outside their stated plan due to emotion, not a rational reevaluation. When `is_deviation = true`, `computeShadow` runs automatically.

**`generateBiasNarrative(stats)`** — Called when the bias report is refreshed. Generates two paragraphs of plain-English coaching: what the biggest bias cost was this week, and one concrete action to take next week. Uses plain chat completions (free-form text, no function-calling needed).

---

## The optimistc math involved - not tested enough to be proven. 

### Disposition effect

```
ratio = avg_hold_losers_hours / avg_hold_winners_hours

for each losing trade:
  extra_hold = max(0, loser_hold - avg_winner_hold)
  loss_per_hr = |realized_pnl| / loser_hold_hours
  cost += loss_per_hr × extra_hold
```

`ratio > 1` means the trader held losers longer than winners. `cost` is the estimated rupee cost of that extra time.

### Revenge trading

```
sort trades by exit_date ascending
baseline_winrate = total_wins / total_trades
revenge_trades = trades where a loss occurred in the prior 60 minutes
conditional_winrate = wins_in_revenge / count_revenge
penalty = baseline_winrate - conditional_winrate
```

Requires ≥ 5 revenge trades for a meaningful result, shows "insufficient data" otherwise.

### Shadow portfolio

```
walk daily OHLC bars from entry_date to exit_date:
  buy  trade: target hit when high ≥ target; stop hit when low ≤ stop
  sell trade: target hit when low ≤ target;  stop hit when high ≥ stop
  if neither > shadow exits at latest close

shadow_pnl = (shadow_exit_price - entry_price) × quantity × direction
pnl_delta = shadow_pnl - realized_pnl   # positive = left money in trade
```

---

## CI

GitHub Actions runs on every push and pull request to `master`: lint (`eslint`) → type-check (`tsc --noEmit`) → build (`next build`). All three must pass for a merge.

---

## Future work

**Broker API integration.** The highest-impact improvement is pulling trade data directly from Zerodha Kite Connect or HDFC Sky rather than manual entry. Manual logging is the biggest friction point. The architecture supports this — `createTrade` is a server action that could equally be called by a broker webhook.

**Real-time intraday price feeds.** The current Yahoo Finance integration provides end-of-day OHLC. Most NSE retail traders make intraday trades, so the Shadow Portfolio simulation would be more accurate with tick-level data (Upstox WebSocket or NSE Bhavcopy). Only `lib/prices/fetch.ts` needs to change — the interface is stable.

**Real-time revenge trade circuit breaker.** Currently the analysis is weekly. A more actionable version would push a notification within 5 minutes of detecting a revenge pattern — before the next entry, not after.

---

## About

Built by **Albin Joseph** — [GitHub](https://github.com/amous4822) · [LinkedIn](https://www.linkedin.com/in/albinj-ooz/)
