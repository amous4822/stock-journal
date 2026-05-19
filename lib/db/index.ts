// Drizzle ORM client — connects to Neon via the HTTP driver.
// The HTTP driver is preferred over WebSockets for serverless (Vercel Functions)
// because it doesn't hold open connections between requests.
// In production, logs flow to Vercel's log drain via lib/logger.ts.
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// DATABASE_URL must be set in every environment (local .env, Vercel env vars).
// The `!` cast is intentional — a missing URL means mis-configured deployment,
// which should fail loudly at startup rather than silently at query time.
const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })
