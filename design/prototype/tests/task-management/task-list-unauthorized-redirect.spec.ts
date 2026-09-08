/*
 * Traceability: specs/_archive/014-task-detail/spec.md FR-002a
 *   (annotator redirected to TASK_DETAIL_UNAUTHORIZED_REDIRECT must see the
 *   unauthorized-access hint on arrival — see issue #721)
 */
import { expect, test } from '@playwright/test';

const UNAUTHORIZED_REDIRECT_URL =
  '/pages/task-management/task-list.html?unauthorized=annotator';

test.describe('Task list unauthorized-redirect notice', () => {
  test('shows the unauthorized hint when arriving via the annotator redirect and clears the query param', async ({
    page,
  }) => {
    await page.goto(UNAUTHORIZED_REDIRECT_URL);

    await expect(page.locator('#toast')).toHaveClass(/show/);
    await expect(page.locator('#toast')).toHaveClass(/toast-error/);
    await expect(page.locator('#toastMsg')).toHaveText(
      '標記員無權限檢視任務設定，已為你返回任務列表。',
    );

    await expect
      .poll(() => new URL(page.url()).searchParams.get('unauthorized'))
      .toBeNull();
  });

  test('does not show the unauthorized hint on a plain visit', async ({
    page,
  }) => {
    await page.goto('/pages/task-management/task-list.html');

    await expect(page.locator('#toast')).not.toHaveClass(/show/);
  });
});
