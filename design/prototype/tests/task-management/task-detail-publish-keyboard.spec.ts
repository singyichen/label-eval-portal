/*
 * Traceability: specs/task-management/014-task-detail/spec.md
 *   FR-008, FR-013
 */
import { test, expect } from '@playwright/test';

const TASK_DETAIL_URL = '/pages/task-management/task-detail.html?task_id=T001';

/* w6-resilience-a11y.md A11Y-03 (positive control group): the high-impact
 * publish actions (發布試標 / 發布正式標記 / 標記完成) are native
 * `<button type="button">` elements inside #publishActionRow, so keyboard
 * Enter/Space must fire the same delegated click handler as a mouse click.
 * This pins the "native semantics are keyboard-operable by construction"
 * side of the a11y audit, deliberately separate from the modal focus-trap
 * gaps (F-11 / A11Y-01 / A11Y-02), which remain gated on the unfixed defect.
 *
 * T001 defaults to isolationEnabled=true, so no riskModal intercepts the
 * publish and the keyboard activation lands directly on publishDryRun()/
 * publishOfficialRun()/publishComplete() -- behaviour identical to the
 * mouse-click versions in task-detail-stage-flow.spec.ts.
 * Buttons are located via getByRole('button', { name }) on purpose: the
 * accessible name is part of what this scenario verifies. */

test.describe('Publish actions are keyboard-operable (A11Y-03)', () => {
  test('Enter on the focused 新增試標回合 button publishes a trial round', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL + '&status=draft');

    const dryRunBtn = page.getByRole('button', { name: '新增試標回合' });
    await expect(dryRunBtn).toBeVisible();
    await dryRunBtn.focus();
    await expect(dryRunBtn).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#trialRoundTimeline .round-timeline-item')).toHaveCount(1);
    await expect(page.locator('#trialRoundsUsedValue')).toHaveText('1');
  });

  test('Space on the focused 開始正式標記 button starts the official run', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL + '&status=waiting_iaa_confirmation');

    const officialRunBtn = page.getByRole('button', { name: '開始正式標記' });
    await expect(officialRunBtn).toBeVisible();
    await officialRunBtn.focus();
    await expect(officialRunBtn).toBeFocused();
    await page.keyboard.press('Space');

    await expect(page.locator('#statusBadge')).toHaveText('正式標記進行中');
  });

  test('Enter on the focused 標記完成 button completes the task', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL + '&status=official_run_in_progress');

    // issue #688 FR-008b: completion is now gated on five preconditions.
    // T001's DEFAULT_REVIEW_WORKLOAD/DEFAULT_ANNOTATION_PROGRESS seed a
    // demo dispute/pending backlog that isn't meant to represent "ready to
    // complete" -- clear it so this keyboard-activation scenario keeps
    // testing what it actually targets (Enter fires the same handler as a
    // click), not the unrelated gate.
    await page.evaluate(() => {
      const win = window as unknown as {
        REVIEW_WORKLOAD: { unassignedCount: number; disputeCount: number; byReviewer: Record<string, { pending: number }>; exceptionPoolItems?: unknown[] };
        ANNOTATION_PROGRESS: { official: { totalSamples: number; completedSamples: number; iaa: number | null } };
        UNASSIGNED_ANNOTATION_ASSIGNMENTS: unknown[];
      };
      win.REVIEW_WORKLOAD.unassignedCount = 0;
      win.REVIEW_WORKLOAD.disputeCount = 0;
      Object.values(win.REVIEW_WORKLOAD.byReviewer).forEach((load) => { load.pending = 0; });
      win.REVIEW_WORKLOAD.exceptionPoolItems = [];
      win.UNASSIGNED_ANNOTATION_ASSIGNMENTS.length = 0;
      win.ANNOTATION_PROGRESS.official.completedSamples = win.ANNOTATION_PROGRESS.official.totalSamples;
      win.ANNOTATION_PROGRESS.official.iaa = 0.8;
    });

    const completeBtn = page.getByRole('button', { name: '標記完成' });
    await expect(completeBtn).toBeVisible();
    await completeBtn.focus();
    await expect(completeBtn).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#statusBadge')).toHaveText('已完成');
  });
});
