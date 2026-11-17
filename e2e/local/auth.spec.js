import { test, expect } from '@playwright/test'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  registerFirstAdmin,
  signIn,
  signOut,
  switchToRegister,
} from '../helpers.js'

test('first account registers as administrator and reaches the dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome to Earlyma' })).toBeVisible()

  await registerFirstAdmin(page)

  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(page.getByText('Administrator').first()).toBeVisible()
})

test('a registered user can sign out and sign back in', async ({ page }) => {
  await registerFirstAdmin(page)
  await signOut(page)
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD)
})

test('a wrong password is rejected with a helpful message', async ({ page }) => {
  await registerFirstAdmin(page)
  await signOut(page)

  await page.getByLabel('Email address').fill(ADMIN_EMAIL)
  await page.getByLabel(/^Password/).fill('WrongPassword1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.getByText('Invalid email or password. Check your details or create an account.')).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
})

test('a user can reset a forgotten password with email and phone', async ({ page }) => {
  await registerFirstAdmin(page)
  await signOut(page)

  await page.getByText('Forgot password?', { exact: true }).click()
  await page.getByLabel('Email address').fill(ADMIN_EMAIL)
  await page.getByLabel('Phone number').fill('0712345678')
  await page.getByLabel(/^New password/).fill('BrandNew123')
  await page.getByLabel('Confirm new password').fill('BrandNew123')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()

  await expect(page.getByText('Password updated. You can sign in now.').first()).toBeVisible()
  await signIn(page, ADMIN_EMAIL, 'BrandNew123')
})

test('duplicate registration is rejected', async ({ page }) => {
  await registerFirstAdmin(page)
  await signOut(page)
  await switchToRegister(page)

  await page.getByLabel('Full name').fill('Second Person')
  await page.getByLabel('Phone number').fill('0712345699')
  await page.getByLabel('Assigned village').fill('Kisumu')
  await page.getByLabel('Email address').fill(ADMIN_EMAIL)
  await page.getByLabel(/^Password/).fill('AnotherPass1')
  await page.getByLabel('Confirm password').fill('AnotherPass1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByText('This email address is already registered.')).toBeVisible()
})