/**
 * Forgot Password page prototype tests
 * Source spec: specs/account/004-forgot-reset-password/spec.md
 *
 * Tests that can be validated against the static HTML prototype:
 *   - US1 (FR-001)  Page contains all required UI elements
 *   - US1 (FR-004)  Submit shows generic success panel regardless of email existence
 *   - US1           Empty email → frontend error, request not sent
 *   - FR-009        Language toggle switches text immediately
 *   - FR-009        Responsive rendering at 375px / 768px / 1440px
 *   - Navigation    Back-to-login link → login.html
 *
 * Tests NOT covered here (require backend):
 *   - US1  POST /auth/forgot-password creates PasswordResetToken in DB
 *   - US1  Resend sends reset email for registered addresses
 *   - US1  No token created / no email sent for unregistered addresses
 *   - Already-logged-in user redirected to /dashboard
 */
import { test, expect } from '@playwright/test';

const FORGOT_URL = '/pages/account/forgot-password.html';

test.describe('Forgot Password page — UI elements (spec 004 FR-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FORGOT_URL);
  });

  test('contains email input', async ({ page }) => {
    await expect(page.getByTestId('email-input')).toBeVisible();
  });

  test('contains send-reset-link button', async ({ page }) => {
    await expect(page.getByTestId('send-reset-btn')).toBeVisible();
  });

  test('contains back-to-login link pointing to login.html', async ({ page }) => {
    const link = page.getByTestId('back-to-login-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /login\.html/);
  });

  test('success panel is hidden on initial load', async ({ page }) => {
    await expect(page.locator('#successPanel')).not.toHaveClass(/visible/);
  });
});

test.describe('Forgot Password page — language toggle (spec 004 FR-009)', () => {
  test('switches all text to English immediately without page reload', async ({ page }) => {
    await page.goto(FORGOT_URL);

    // Initial state: Traditional Chinese
    await expect(page.getByTestId('lang-label')).toHaveText(/ZH/);

    await page.getByTestId('lang-toggle').click();

    await expect(page.getByTestId('lang-label')).toHaveText(/EN/);
    await expect(page.getByTestId('send-reset-btn')).toContainText('Send Reset Link');
  });

  test('toggles back to Traditional Chinese on second click', async ({ page }) => {
    await page.goto(FORGOT_URL);
    await page.getByTestId('lang-toggle').click(); // ZH → EN
    await page.getByTestId('lang-toggle').click(); // EN → ZH
    await expect(page.getByTestId('lang-label')).toHaveText(/ZH/);
    await expect(page.getByTestId('send-reset-btn')).toContainText('寄送重設連結');
  });
});

test.describe('Forgot Password page — form validation (spec 004 US1 scenario 3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FORGOT_URL);
  });

  test('shows email required error when submitting empty email', async ({ page }) => {
    await page.getByTestId('send-reset-btn').click();
    const emailError = page.getByTestId('email-error');
    await expect(emailError).toBeVisible();
    await expect(emailError).not.toBeEmpty();
  });

  test('stays on page after validation failure', async ({ page }) => {
    await page.getByTestId('send-reset-btn').click();
    await expect(page).toHaveURL(/forgot-password\.html/);
  });

  test('clears email error after user starts typing', async ({ page }) => {
    await page.getByTestId('send-reset-btn').click();
    await expect(page.getByTestId('email-error')).toBeVisible();

    await page.getByTestId('email-input').fill('a');
    await expect(page.getByTestId('email-error')).not.toBeVisible();
  });
});

test.describe('Forgot Password page — loading lock (spec 004 FR-003 / SC-006)', () => {
  // The assertion sequence below routinely takes longer than the 1200ms
  // simulated submit delay under full-suite worker contention (issue #744).
  test.describe.configure({ retries: 2 });

  const languages = [
    { name: 'Traditional Chinese', toggle: false, loading: '載入中' },
    { name: 'English', toggle: true, loading: 'Loading' },
  ];

  for (const language of languages) {
    test(`locks full page with accessible ${language.name} status`, async ({ page }) => {
      // Catches the regression where only the submit button is disabled, leaving
      // the email field, language toggle, and page navigation interactive.
      await page.goto(FORGOT_URL);
      if (language.toggle) await page.getByTestId('lang-toggle').click();
      await page.getByTestId('email-input').fill('anyone@example.com');
      await page.getByTestId('send-reset-btn').click();

      const pageRoot = page.locator('body');
      const lockedRegions = [page.locator('.navbar'), page.locator('.main')];
      const pageControls = [
        page.getByTestId('email-input'),
        page.getByTestId('send-reset-btn'),
        page.getByTestId('lang-toggle'),
        page.locator('.navbar-brand'),
        page.getByTestId('back-to-login-link'),
        page.locator('#successBackLink'),
      ];

      expect(await pageRoot.getAttribute('aria-busy')).toBeNull();
      expect(await pageRoot.getAttribute('inert')).toBeNull();
      for (const region of lockedRegions) {
        await expect(region).toHaveAttribute('aria-busy', 'true');
        await expect(region).toHaveAttribute('inert', '');
      }
      const loadingStatus = page.getByTestId('loading-status');
      await expect(loadingStatus).toHaveAttribute('role', 'status');
      await expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
      await expect(loadingStatus).toHaveText(language.loading);
      expect(await loadingStatus.evaluate(element => element.closest('[inert]') === null)).toBe(true);
      expect(await loadingStatus.evaluate(element => element.closest('[aria-busy="true"]') === null)).toBe(true);
      for (const control of pageControls) {
        expect(await control.evaluate(element =>
          element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || element.closest('[inert]') !== null
        )).toBe(true);
      }

      await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
      for (const region of lockedRegions) {
        await expect(region).not.toHaveAttribute('aria-busy', 'true');
        await expect(region).not.toHaveAttribute('inert', '');
      }
      await expect(loadingStatus).toBeEmpty();
      await expect(page.locator('#successBackLink')).toBeEnabled();
    });
  }
});

test.describe('Forgot Password page — submit success (spec 004 FR-004)', () => {
  // Prototype simulates 1 200 ms API delay then always shows success panel
  // (generic message regardless of whether the email exists — SC-002)

  test('shows success panel after valid email is submitted', async ({ page }) => {
    await page.goto(FORGOT_URL);
    await page.getByTestId('email-input').fill('anyone@example.com');
    await page.getByTestId('send-reset-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
  });

  test('hides the form section after successful submit', async ({ page }) => {
    await page.goto(FORGOT_URL);
    await page.getByTestId('email-input').fill('anyone@example.com');
    await page.getByTestId('send-reset-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#formSection')).not.toBeVisible();
  });

  test('success panel contains back-to-login link pointing to login.html', async ({ page }) => {
    await page.goto(FORGOT_URL);
    await page.getByTestId('email-input').fill('anyone@example.com');
    await page.getByTestId('send-reset-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
    const backLink = page.locator('#successBackLink');
    await expect(backLink).toHaveAttribute('href', /login\.html/);
  });
});

test.describe('Forgot Password page — navigation (spec 004 User Flow)', () => {
  test('back-to-login link navigates to login page', async ({ page }) => {
    await page.goto(FORGOT_URL);
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('login.html')),
      page.getByTestId('back-to-login-link').click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/login\.html/);
  });
});

test.describe('Forgot Password page — responsive rendering (spec 004 FR-009)', () => {
  const viewports = [
    { name: '375px (mobile)', width: 375, height: 812 },
    { name: '768px (tablet)', width: 768, height: 1024 },
    { name: '1440px (desktop)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`renders without horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(FORGOT_URL);

      await expect(page.getByTestId('email-input')).toBeVisible();
      await expect(page.getByTestId('send-reset-btn')).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
