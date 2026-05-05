import { expect, test } from "@playwright/test"

test("first paint is honest about auth or backend state", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByText(/JARVIS|Sign in|Backend unavailable|Loading/).first(),
  ).toBeVisible()

  await expect(page.getByText(/demo task|API Hook|fake workspace/i)).toHaveCount(0)
})
