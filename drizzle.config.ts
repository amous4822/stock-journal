// Drizzle Kit configuration — used by `drizzle-kit generate` and `drizzle-kit migrate`.
// Drizzle Kit reads .env automatically in local dev; Vercel CI exports env vars natively.
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
