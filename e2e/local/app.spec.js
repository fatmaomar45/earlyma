import { test, expect } from '@playwright/test'
import { registerFirstAdmin, expectNoHorizontalScroll } from '../helpers.js'

const PAGES = [
  ['/', /Welcome back/],
  ['/mothers', 'Pregnant Mothers'],
  ['/babies', 'Babies'],
  ['/visits', 'Clinic Visits'],
  ['/notifications', 'Notifications'],
  ['/calls', 'Call History'],
  ['/reports', 'Reports'],
  ['/workers', 'Community Health Workers'],
  ['/settings', 'Settings'],
]

test('every main page renders its heading', async ({ page }) => {
  await registerFirstAdmin(page)
  for (const [path, heading] of PAGES) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: typeof heading === 'string' })).toBeVisible()
  }
})

test('an administrator can add a community health worker', async ({ page }) => {
  await registerFirstAdmin(page)
  await page.goto('/workers')

  await page.getByRole('button', { name: 'Add community health worker' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByLabel('Full name').fill('Joseph Chw')
  await modal.getByLabel('Phone number').fill('0712345679')
  await modal.getByLabel('Assigned village').fill('Kisumu')
  await modal.getByLabel('Email address').fill('joseph@example.com')
  await modal.getByLabel('Temporary password').fill('Passw0rd1')
  await modal.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Joseph Chw', { exact: true })).toBeVisible()
})

test('a mother can be registered and opened', async ({ page }) => {
  await registerFirstAdmin(page)
  await page.goto('/mothers')

  await page.getByRole('button', { name: 'Register pregnant mother' }).first().click()
  await page.getByLabel("Mother's full name").fill('Neema Test')
  await page.getByLabel('Age (years)').fill('28')
  await page.getByLabel('Phone number').fill('0712345680')
  await page.getByLabel('Village / community').fill('Kisumu')
  await page.getByLabel('Expected delivery date').fill('2026-12-01')
  await page.getByLabel('Pregnancy registration date').fill('2026-11-01')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('Neema Test', { exact: true }).first()).toBeVisible()
})

test('the language switch translates the interface', async ({ page }) => {
  await registerFirstAdmin(page)
  await page.locator('.mantine-AppShell-header').getByText('SW', { exact: true }).click()
  await expect(page.getByRole('heading', { name: /Karibu tena/ })).toBeVisible()

  await page.locator('.mantine-AppShell-header').getByText('EN', { exact: true }).click()
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
})

test('the login page has no horizontal scroll on small phones', async ({ page }) => {
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
})

test('the dashboard has no horizontal scroll on small phones', async ({ page }) => {
  await registerFirstAdmin(page)
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
})

test('the bottom navigation works on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  await registerFirstAdmin(page)

  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav).toBeVisible()
  await nav.getByText('Pregnant Mothers', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pregnant Mothers', exact: true })).toBeVisible()
})