/**
 * Auth redirect spec.
 *
 * Bug class caught: if the middleware or (authenticated) layout guard is removed or broken,
 * an unauthenticated user would land on a blank/errored dashboard instead of the signin page.
 * This is the most important E2E safety net — it doesn't need a DB or OAuth secrets to run.
 */
import { test, expect } from "@playwright/test"

test.describe("unauthenticated access", () => {
  test("visiting /dashboard redirects to the sign-in page", async ({ page }) => {
    await page.goto("/dashboard")

    // Auth.js redirects to /auth/signin (exact path defined in auth.ts)
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  test("visiting a trade detail redirects to the sign-in page", async ({ page }) => {
    await page.goto("/dashboard/trades/00000000-0000-0000-0000-000000000000")

    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  test("the sign-in page shows a Google sign-in option", async ({ page }) => {
    await page.goto("/auth/signin")

    // Landing page is shown to unauthenticated users redirected here
    await expect(page.locator("text=Sign in with Google")).toBeVisible()
  })
})
