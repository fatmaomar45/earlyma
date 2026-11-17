import { test, expect } from '@playwright/test'
import {
  registerFirstAdmin,
  signOut,
  switchToRegister,
} from '../helpers.js'

test('remote auth registers, signs out and signs back in', async ({ page }) => {
  const email = 'remote1@example.com'
  const password = 'Admin12345'
  await registerFirstAdmin(page, { email, password })

  // The server mirrored the profile locally; the session cookie is HttpOnly.
  const cookies = await page.context().cookies()
  expect(cookies.some((cookie) => cookie.name === 'earlyma_session' && cookie.httpOnly)).toBe(true)

  await signOut(page)

  await page.getByLabel('Email address').fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
})

test('remote server rejects a duplicate account', async ({ page }) => {
  const email = 'remote2@example.com'
  await registerFirstAdmin(page, { email, phone: '0712345999' })
  await signOut(page)
  await switchToRegister(page)

  await page.getByLabel('Full name').fill('Duplicate Person')
  await page.getByLabel('Phone number').fill('0712345000')
  await page.getByLabel('Assigned village').fill('Kisumu')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel(/^Password/).fill('AnotherPass1')
  await page.getByLabel('Confirm password').fill('AnotherPass1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByText('This email address is already registered.')).toBeVisible()
})