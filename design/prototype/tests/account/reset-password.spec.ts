/**
 * Reset Password page prototype tests
 * Source spec: specs/account/004-forgot-reset-password/spec.md
 *
 * Tests that can be validated against the static HTML prototype:
 *   - US2 (FR-005)  Valid token state: form renders correctly
 *   - US2 (FR-005)  Invalid/expired token: token error panel shown, form hidden
 *   - US2 (spec US2 scenario 4)  Password mismatch → frontend error
 *   - US2 (spec US2 scenarios 2-3)  Prototype state toggle simulates token error states
 *   - FR-009        Language toggle switches text immediately
 *   - FR-009        Responsive rendering at 375px / 768px / 1440px
 *   - Navigation    Back-to-login link; reapply link → forgot-password.html
 *
 * Tests NOT covered here (require backend):
 *   - US2 scenario 1  Valid token → password updated in DB, redirected to /login
 *   - US2 scenario 2  Reusing a consumed token returns error
 *   - US2 scenario 3  Expired token (> 30 min) returns error
 *   - FR-006  bcrypt hash stored, old password invalid after reset
 *   - Already-logged-in user redirected to /dashboard
 */
import { test, expect } from '@playwright/test';

const RESET_URL = '/pages/account/reset-password.html';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Switch the prototype to a given token state using the toggle bar. */
async function setProtoState(
  page: import('@playwright/test').Page,
  state: '有效 token' | '已過期' | '已使用'
) {
  await page.getByRole('button', { name: state }).click();
}

// ---------------------------------------------------------------------------

test.describe('Reset Password page — valid token state UI elements (spec 004 FR-005)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RESET_URL);
    // Default state is valid token; explicitly set for clarity
    await setProtoState(page, '有效 token');
  });

  test('new-password input is visible', async ({ page }) => {
    await expect(page.getByTestId('new-password-input')).toBeVisible();
  });

  test('confirm-password input is visible', async ({ page }) => {
    await expect(page.getByTestId('confirm-password-input')).toBeVisible();
  });

  test('update-password button is visible', async ({ page }) => {
    await expect(page.getByTestId('update-password-btn')).toBeVisible();
  });

  test('back-to-login link is visible and points to login.html', async ({ page }) => {
    const link = page.getByTestId('back-to-login-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /login\.html/);
  });

  test('token error panel is hidden in valid state', async ({ page }) => {
    await expect(page.locator('#tokenErrorPanel')).not.toHaveClass(/visible/);
  });

  test('success panel is hidden on initial load', async ({ page }) => {
    await expect(page.locator('#successPanel')).not.toHaveClass(/visible/);
  });
});

test.describe('Reset Password page — token error states (spec 004 FR-005, US2 scenarios 2–3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RESET_URL);
  });

  test('expired state hides the form and shows token error panel', async ({ page }) => {
    await setProtoState(page, '已過期');
    await expect(page.locator('#formSection')).not.toBeVisible();
    await expect(page.locator('#tokenErrorPanel')).toHaveClass(/visible/);
  });

  test('used state hides the form and shows token error panel', async ({ page }) => {
    await setProtoState(page, '已使用');
    await expect(page.locator('#formSection')).not.toBeVisible();
    await expect(page.locator('#tokenErrorPanel')).toHaveClass(/visible/);
  });

  test('switching back to valid state restores the form', async ({ page }) => {
    await setProtoState(page, '已過期');
    await setProtoState(page, '有效 token');
    await expect(page.locator('#formSection')).toBeVisible();
    await expect(page.locator('#tokenErrorPanel')).not.toHaveClass(/visible/);
  });

  test('reapply link in error panel points to forgot-password.html', async ({ page }) => {
    await setProtoState(page, '已過期');
    const link = page.getByTestId('reapply-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /forgot-password\.html/);
  });
});

test.describe('Reset Password page — form validation (spec 004 US2 scenario 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(RESET_URL);
    await setProtoState(page, '有效 token');
  });

  test('shows new-password required error when new password is empty', async ({ page }) => {
    await page.getByTestId('confirm-password-input').fill('password123');
    await page.getByTestId('update-password-btn').click();

    const error = page.getByTestId('new-password-error');
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
  });

  test('shows confirm-password required error when confirm field is empty', async ({ page }) => {
    await page.getByTestId('new-password-input').fill('password123');
    await page.getByTestId('update-password-btn').click();

    const error = page.getByTestId('confirm-password-error');
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
  });

  test('shows mismatch error when passwords do not match', async ({ page }) => {
    await page.getByTestId('new-password-input').fill('password123');
    await page.getByTestId('confirm-password-input').fill('different456');
    await page.getByTestId('update-password-btn').click();

    const error = page.getByTestId('confirm-password-error');
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
  });

  test('stays on page after validation failure', async ({ page }) => {
    await page.getByTestId('update-password-btn').click();
    await expect(page).toHaveURL(/reset-password\.html/);
  });

  test('clears new-password error after user starts typing', async ({ page }) => {
    await page.getByTestId('update-password-btn').click();
    await expect(page.getByTestId('new-password-error')).toBeVisible();

    await page.getByTestId('new-password-input').fill('a');
    await expect(page.getByTestId('new-password-error')).not.toBeVisible();
  });

  test('clears confirm-password error after user starts typing', async ({ page }) => {
    await page.getByTestId('new-password-input').fill('password123');
    await page.getByTestId('update-password-btn').click();
    await expect(page.getByTestId('confirm-password-error')).toBeVisible();

    await page.getByTestId('confirm-password-input').fill('a');
    await expect(page.getByTestId('confirm-password-error')).not.toBeVisible();
  });
});

test.describe('Reset Password page — loading lock (spec 004 FR-008 / SC-006)', () => {
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
      // password fields, visibility toggles, token-state controls, language, and navigation interactive.
      await page.goto(RESET_URL);
      await setProtoState(page, '有效 token');
      if (language.toggle) await page.getByTestId('lang-toggle').click();
      await page.getByTestId('new-password-input').fill('newpassword123');
      await page.getByTestId('confirm-password-input').fill('newpassword123');
      await page.getByTestId('update-password-btn').click();

      const pageRoot = page.locator('body');
      const lockedRegions = [
        page.locator('.navbar'),
        page.locator('.main'),
        page.locator('.proto-toggle-bar'),
      ];
      const pageControls = [
        page.getByTestId('new-password-input'),
        page.getByTestId('confirm-password-input'),
        page.locator('#eyeToggleNew'),
        page.locator('#eyeToggleConfirm'),
        page.getByTestId('update-password-btn'),
        page.getByTestId('lang-toggle'),
        page.locator('.navbar-brand'),
        page.getByTestId('back-to-login-link'),
        page.locator('#successBackLink'),
        page.getByTestId('reapply-link'),
        page.locator('#btnValid'),
        page.locator('#btnExpired'),
        page.locator('#btnUsed'),
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

test.describe('Reset Password page — submit success (spec 004 FR-007)', () => {
  // Prototype simulates an API call and then shows the success panel.
  // Actual redirect to /login + DB update requires backend (not tested here).

  test('shows success panel after valid passwords are submitted', async ({ page }) => {
    await page.goto(RESET_URL);
    await setProtoState(page, '有效 token');

    await page.getByTestId('new-password-input').fill('newpassword123');
    await page.getByTestId('confirm-password-input').fill('newpassword123');
    await page.getByTestId('update-password-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
  });

  test('hides the form after successful submit', async ({ page }) => {
    await page.goto(RESET_URL);
    await setProtoState(page, '有效 token');

    await page.getByTestId('new-password-input').fill('newpassword123');
    await page.getByTestId('confirm-password-input').fill('newpassword123');
    await page.getByTestId('update-password-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#formSection')).not.toBeVisible();
  });

  test('success panel contains go-to-login link pointing to login.html', async ({ page }) => {
    await page.goto(RESET_URL);
    await setProtoState(page, '有效 token');

    await page.getByTestId('new-password-input').fill('newpassword123');
    await page.getByTestId('confirm-password-input').fill('newpassword123');
    await page.getByTestId('update-password-btn').click();

    await expect(page.locator('#successPanel')).toHaveClass(/visible/, { timeout: 5000 });
    await expect(page.locator('#successBackLink')).toHaveAttribute('href', /login\.html/);
  });
});

test.describe('Reset Password page — language toggle (spec 004 FR-009)', () => {
  test('switches all text to English immediately without page reload', async ({ page }) => {
    await page.goto(RESET_URL);

    await expect(page.getByTestId('lang-label')).toHaveText(/ZH/);

    await page.getByTestId('lang-toggle').click();

    await expect(page.getByTestId('lang-label')).toHaveText(/EN/);
    await expect(page.getByTestId('update-password-btn')).toContainText('Update Password');
  });

  test('toggles back to Traditional Chinese on second click', async ({ page }) => {
    await page.goto(RESET_URL);
    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('lang-toggle').click();
    await expect(page.getByTestId('lang-label')).toHaveText(/ZH/);
    await expect(page.getByTestId('update-password-btn')).toContainText('更新密碼');
  });
});

test.describe('Reset Password page — responsive rendering (spec 004 FR-009)', () => {
  const viewports = [
    { name: '375px (mobile)', width: 375, height: 812 },
    { name: '768px (tablet)', width: 768, height: 1024 },
    { name: '1440px (desktop)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`renders without horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(RESET_URL);

      await expect(page.getByTestId('new-password-input')).toBeVisible();
      await expect(page.getByTestId('update-password-btn')).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
