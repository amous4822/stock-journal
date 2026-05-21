/**
 * Playwright global setup.
 *
 * What it does:
 *   1. Upserts a deterministic test user into the DB (same email every run → idempotent).
 *   2. Generates a valid Auth.js v5 JWT session token (signed with AUTH_SECRET).
 *   3. Saves the session cookie to e2e/.auth/user.json so tests can load it via
 *      `storageState: "e2e/.auth/user.json"` without doing a real Google OAuth dance.
 *
 * Why this approach: Auth.js uses HttpOnly JWTs — we can't forge them in the browser.
 * We must mint a real token with the correct secret.
 */
import { chromium } from "@playwright/test"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { encode } from "next-auth/jwt"
import * as schema from "../lib/db/schema"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const IS_PRODUCTION = BASE_URL.startsWith("https://")

export const TEST_USER_ID = "test-e2e-user-00000000-0000-0000-0000-000000000002"
export const TEST_USER_EMAIL = "e2e-test@alphajournal.dev"

export default async function globalSetup() {
  // Skip session creation if AUTH_SECRET is not set (local dev without env)
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) {
    console.warn(
      "[e2e global-setup] AUTH_SECRET or DATABASE_URL not set — skipping auth setup. " +
      "The trade-flow test will be skipped."
    )
    return
  }

  // 1. Upsert test user
  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      name: "E2E Test User",
      email: TEST_USER_EMAIL,
      emailVerified: new Date(),
      image: null,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { name: "E2E Test User" },
    })

  // 2. Mint a valid Auth.js v5 JWT
  // Cookie name differs between http (dev) and https (prod).
  const cookieName = IS_PRODUCTION ? "__Secure-authjs.session-token" : "authjs.session-token"

  const token = await encode({
    token: {
      sub: TEST_USER_ID,
      name: "E2E Test User",
      email: TEST_USER_EMAIL,
      picture: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
    },
    secret: process.env.AUTH_SECRET,
    salt: cookieName,
  })

  // 3. Save storage state with the session cookie
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL: BASE_URL })

  await context.addCookies([
    {
      name: cookieName,
      value: token,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "Lax",
    },
  ])

  await context.storageState({ path: "e2e/.auth/user.json" })
  await browser.close()

  console.log("[e2e global-setup] Session cookie minted for", TEST_USER_EMAIL)
}
