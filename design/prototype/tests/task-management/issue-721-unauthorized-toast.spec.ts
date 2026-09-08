/*
 * Traceability: specs/task-management/010-task-list/spec.md
 */
import { test, expect } from '@playwright/test';

const TASK_LIST_URL = '/pages/task-management/task-list.html';

/* Issue #721: task-detail.html redirects an annotator opening a task's
 * settings back here with ?unauthorized=annotator, but nothing ever read
 * the param -- the user just saw an unexplained bounce back to the list.
 * The fix reads the param once, shows a toast explaining what happened,
 * and lets the existing syncUrl() cycle drop the param so a refresh does
 * not repeat the toast. */

test.describe('Task list unauthorized-redirect toast (issue #721)', () => {
  test('shows an explanatory toast when redirected with ?unauthorized=annotator', async ({ page }) => {
    await page.goto(`${TASK_LIST_URL}?unauthorized=annotator`);

    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/toast-error/);
    await expect(page.locator('#toastMsg')).toContainText('你目前的角色無法檢視任務設定');
  });

  test('clears the unauthorized param from the URL after showing the toast', async ({ page }) => {
    await page.goto(`${TASK_LIST_URL}?unauthorized=annotator`);

    await expect(page.locator('#toastMsg')).toContainText('你目前的角色無法檢視任務設定');
    await expect(page).not.toHaveURL(/unauthorized=/);
  });

  test('an unrecognized unauthorized value is ignored (safe default, no toast)', async ({ page }) => {
    await page.goto(`${TASK_LIST_URL}?unauthorized=bogus`);

    await expect(page.locator('#toast')).not.toHaveClass(/show/);
    await expect(page.locator('#tableWrap')).toBeVisible();
  });
});
