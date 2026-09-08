/*
 * issue #721 / FR-005a clarification.
 *
 * `task-detail.html`'s `parseRole()` redirects an annotator away from the
 * page it has no access to via `window.location.href =
 * './task-list.html?unauthorized=annotator'` (task-detail.html:4753), but
 * `task-list.html` never reads the `unauthorized` param -- the user lands
 * back on the list with no explanation at all (silent redirect, no error,
 * no signal). FR-005a already requires the same "無權限檢視任務詳情" toast
 * for the click-time check inside task-list.html itself
 * (`navigateToTaskDetail()`'s `toastNoPermission` branch); this spec locks
 * the same toast for the redirect-time entry path.
 *
 * Traceability: specs/task-management/010-task-list/spec.md FR-005a
 */
import { test, expect } from '@playwright/test';

test.describe('FR-005a — unauthorized redirect from task-detail shows a toast on task-list', () => {
  test('landing on task-list with ?unauthorized=annotator shows the no-permission toast and strips the param', async ({ page }) => {
    await page.goto('/pages/task-management/task-list.html?unauthorized=annotator');

    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toastMsg')).toContainText('無權限檢視任務詳情');

    // Must not repeat the toast on a refresh: the param is stripped from
    // the URL after being consumed once.
    await expect(page).not.toHaveURL(/unauthorized/);
  });

  test('the full redirect round-trip from task-detail (annotator role) surfaces the same toast', async ({ page }) => {
    await page.goto('/pages/task-management/task-detail.html?task_id=T001&task_role=annotator');

    // task-list.html's own syncUrl() strips any param it doesn't model
    // (including `unauthorized`) on its very first render, so by the time
    // this assertion runs the query string is already gone -- only the
    // path and the toast are asserted here.
    await expect(page).toHaveURL(/\/task-list\.html$/);
    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toastMsg')).toContainText('無權限檢視任務詳情');
  });

  test('a plain task-list visit without the param shows no toast', async ({ page }) => {
    await page.goto('/pages/task-management/task-list.html');

    await expect(page.locator('#toast')).not.toHaveClass(/show/);
  });
});
