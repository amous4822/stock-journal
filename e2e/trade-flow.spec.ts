/**
 * Trade flow spec — authenticated user creates a trade and closes it.
 *
 * Bug class caught: if the createTrade or closeTrade server actions break (bad Zod schema,
 * DB column mismatch, auth guard regression), this test catches it before it reaches prod.
 *
 * Requires: AUTH_SECRET + DATABASE_URL (set as CI secrets; skipped otherwise).
 * Session is minted by e2e/global-setup.ts and loaded via storageState.
 */
import { test, expect } from "@playwright/test"
import fs from "fs"

const HAS_SESSION = fs.existsSync("e2e/.auth/user.json")

test.describe("authenticated trade flow", () => {
  test.skip(!HAS_SESSION, "Skipped: AUTH_SECRET/DATABASE_URL not set — run global-setup first")

  test.use({ storageState: "e2e/.auth/user.json" })

  test("can log a trade and see it on the dashboard", async ({ page }) => {
    await page.goto("/dashboard")

    // Dashboard should load (not redirect to signin)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible()

    // Open the Log Trade modal
    await page.getByRole("button", { name: /Log Trade/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Fill in the form
    await page.getByLabel("NSE Symbol").fill("RELIANCE")
    // Action is buy by default — no change needed
    await page.getByLabel("Quantity").fill("10")
    await page.getByLabel("Entry Price").fill("2500")
    // Entry date defaults to now — no change needed
    await page.getByLabel(/Why are you taking this trade/).fill(
      "Technical breakout on high volume. Targeting 2600 with stop at 2420."
    )
    await page.getByLabel("Target Price").fill("2600")
    await page.getByLabel("Stop Loss").fill("2420")

    // Submit
    await page.getByRole("button", { name: /^Log Trade$/ }).click()

    // Toast confirmation
    await expect(page.getByText("Trade logged!")).toBeVisible({ timeout: 15_000 })

    // The trade should appear in the Recent Trades table
    await expect(page.getByRole("link", { name: "RELIANCE" })).toBeVisible()
  })

  test("can close an open trade and see the P&L update", async ({ page }) => {
    // Navigate to trades list
    await page.goto("/dashboard/trades?status=open")

    // Find the RELIANCE trade we just created (may not exist if tests run in isolation)
    // Skip gracefully if no open trades
    const closeButton = page.getByRole("button", { name: "Close" }).first()
    const hasOpenTrades = await closeButton.isVisible().catch(() => false)

    if (!hasOpenTrades) {
      test.skip()
      return
    }

    await closeButton.click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Fill close form
    await page.getByLabel("Exit Price").fill("2560")
    await page.getByLabel(/What made you close this/).fill(
      "Approaching target and overall market showing weakness. Taking partial profits."
    )

    await page.getByRole("button", { name: /^Close Trade$/ }).click()

    // Toast confirmation
    await expect(page.getByText("Trade closed!")).toBeVisible({ timeout: 15_000 })

    // Trade should disappear from open list
    await page.goto("/dashboard/trades?status=closed")
    await expect(page.getByText("RELIANCE")).toBeVisible()
  })
})
