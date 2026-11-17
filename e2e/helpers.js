import { expect } from '@playwright/test'

export const ADMIN_EMAIL = 'admin@example.com'
export const ADMIN_PASSWORD = 'Admin12345'

export async function registerFirstAdmin(page, overrides = {}) {
  const email = overrides.email ?? ADMIN_EMAIL
  const password = overrides.password ?? ADMIN_PASSWORD

  await page.goto('/')
  await page.getByLabel('Full name').fill(overrides.fullName ?? 'Amina Admin')
  await page.getByLabel('Phone number').fill(overrides.phone ?? '0712345678')
  await page.getByLabel('Assigned village').fill(overrides.village ?? 'Kisumu')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
  return { email, password }
}

export async function signOut(page) {
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await page.getByText('Log out', { exact: true }).click()
  await expect(page.getByLabel('Email address')).toBeVisible()
}

export async function signIn(page, email, password) {
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible()
}

export async function switchToRegister(page) {
  await page.locator('.mantine-SegmentedControl-label', { hasText: 'Create account' }).click()
  await expect(page.getByLabel('Full name')).toBeVisible()
}

export async function expectNoHorizontalScroll(page) {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(
    sizes.scroll,
    `horizontal overflow: scrollWidth ${sizes.scroll} > clientWidth ${sizes.client}`,
  ).toBeLessThanOrEqual(sizes.client + 1)
}