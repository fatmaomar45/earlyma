import { test, expect } from '@playwright/test'
import { registerFirstAdmin, signIn, signOut } from '../helpers.js'

test('the app served by the node server uses same-origin remote auth', async ({ page }) => {
  await page.goto('/')

  // The server injects this meta tag, which turns on remote auth.
  await expect(page.locator('meta[name="earlyma-auth-api"]')).toHaveCount(1)

  await registerFirstAdmin(page, { email: 'single@example.com' })

  const cookies = await page.context().cookies()
  expect(cookies.some((cookie) => cookie.name === 'earlyma_session' && cookie.httpOnly)).toBe(true)

  // The session survives a reload.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()

  await signOut(page)
  await signIn(page, 'single@example.com', 'Admin12345')
})