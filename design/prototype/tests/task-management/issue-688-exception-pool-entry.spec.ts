/*
 * Traceability: openspec/changes/align-014-review-model/specs/task-management/014-task-detail/spec.md
 *   FR-018 (final exception pool entry), FR-008b (closure gate, condition 4
 *   only -- see task-detail.html's getClosureBlockers() header comment for
 *   why conditions 1/2/3/5 stay out of this PR group's scope).
 *
 * TDD Red for align-014-review-model tasks.md 2.1. Green (tasks 2.2/2.3)
 * implements the "最終例外池" section in
 * design/prototype/pages/task-management/task-detail.panels/annotation-progress.html
 * (rendered by task-detail.html's renderFinalExceptionPool()) and the
 * closure gate in task-detail.html's getClosureBlockers(), backed by
 * task-detail.data.js's getFinalExceptionPoolItems(). None of it exists
 * yet -- every assertion below MUST fail because the section/gate are
 * absent, not because of a selector typo or a thrown error.
 *
 * Fixture: T017 (design/prototype/pages/task-management/task-detail.data.js)
 * is the canonical review-flow demo task whose official_run sample
 * `oft-01-final-exception` is seeded by annotation-workspace.data.js's
 * seedReviewFlowDemo() as a real arbitration-rejected ("兩者皆非") review
 * unit: annotator `kioleemg12` answered `neutral`, reviewer `reviewer_wang`
 * modified it to `positive`, and arbiter `reviewer_chen` rejected both
 * sides with reason "語境不足以判斷情緒傾向，正面與中性難以取捨". T017 has
 * no dry_run data at all, which this file also uses to exercise FR-018
 * point 5's run_type filter (dry_run must show 0 for this task, and MUST
 * NOT feed the closure gate -- FR-008b's exception-pool condition counts
 * official_run only).
 *
 * ---------------------------------------------------------------------
 * Contract decided by this Red (selectors reused or newly picked below):
 *
 *   FR-018 point 1 (entry + count, no-hide-at-zero):
 *     - #finalExceptionPoolSection (BRAND NEW id -- distinct from the
 *       already-shipped, already-tested #exceptionPoolText /
 *       .exception-pool-row read-only COUNT row in member-management.html,
 *       which this task explicitly must not touch) is the section root.
 *     - #finalExceptionPoolTitle shows a "{count} 項待處置" pattern.
 *     - #finalExceptionPoolEmpty is visible with 最終例外池已清空 exactly
 *       when the filtered list is empty; the section itself stays visible
 *       either way (FR-018 point 1's "MUST NOT 隱藏整個區塊").
 *
 *   FR-018 point 2 (per-row fields): each row (.final-exception-pool-item)
 *     renders sample id, annotator id, reviewer id, the output type's
 *     display label (OUTPUT_TYPE_REGISTRY-driven, not a hardcoded string --
 *     Generalization-First), arbiter id, and the "兩者皆非" reason text.
 *
 *   FR-018 point 3 (navigation): each row carries a
 *     .final-exception-pool-navigate-link anchor whose href is the FR-095
 *     disposition screen URL with the full review-unit identity
 *     (task_id x run_type x annotator_id x sample_id), role=project_leader,
 *     no reviewer_id (mirrors tests/annotation/issue-596-exception-pool.spec.ts's
 *     buildProjectLeaderUrl(), which omits reviewer_id for this role).
 *
 *   FR-018 point 4 (permission): role=reviewer never sees the section.
 *
 *   FR-018 point 5 (run_type filter): #finalExceptionPoolRunTypeFilter
 *     switches between official_run/dry_run; T017 has 1 official_run item
 *     and 0 dry_run items.
 *
 *   FR-008b condition 4 (closure gate): #publishCompleteBtn is blocked via
 *     #toastMsg while T017's official_run pool has a pending item, and
 *     proceeds (status -> completed) once resolveExceptionPoolItem() clears
 *     it -- driven directly via LabelSuiteAnnotationWorkspaceData, the same
 *     read/write surface tests/annotation/issue-596-exception-pool.spec.ts
 *     already uses (014 itself never calls the write path).
 * ---------------------------------------------------------------------
 */
import { test, expect, type Page } from '@playwright/test';

const TASK_DETAIL_URL = '/pages/task-management/task-detail.html';
const PANEL_LOAD_TIMEOUT = 15000;
const TASK_ID = 'T017';
const SAMPLE_ID = 'oft-01-final-exception';
const ANNOTATOR_ID = 'kioleemg12';
const REVIEWER_ID = 'reviewer_wang';
const ARBITER_ID = 'reviewer_chen';
/* seedReviewFlowDemo()'s oft-01-final-exception is the only `arbReject: true`
 * fixture in the whole demo script (annotation-workspace.data.js, out of
 * this PR's file scope) and its submitArbitration() call passes no `reason`
 * on the reject vote -- '語境不足以判斷情緒傾向...' is the REVIEWER's modify
 * reason (a separate field, already covered by other tests), not the
 * arbiter's. So this fixture's reason cell has nothing to show and MUST
 * render the same '-' fallback every other empty cell in this table uses. */
const REASON_FALLBACK = '-';

async function openAnnotationProgressTab(page: Page) {
  await page.locator('#workLogPanel').waitFor({ state: 'attached', timeout: PANEL_LOAD_TIMEOUT });
  await page.locator('#tabAnnotationProgress').click();
  await expect(page.locator('#annotationProgressPanel')).not.toHaveClass(/hidden/);
}

type ExceptionPoolRecord = { action?: string; reason?: string; resolved_at?: string };
type WorkspaceData = {
  getExceptionPool: (taskId: string, runType: string, sampleId: string, identity: { annotatorId: string }) => Record<string, ExceptionPoolRecord>;
  resolveExceptionPoolItem: (
    taskId: string, runType: string, sampleId: string, identity: { annotatorId: string },
    outKey: string, action: string, value: unknown, reason: string
  ) => void;
};

function resolveT017Exception(page: Page): Promise<void> {
  return page.evaluate(({ taskId, sampleId, annotatorId }) => {
    (window as unknown as { LabelSuiteAnnotationWorkspaceData: WorkspaceData })
      .LabelSuiteAnnotationWorkspaceData.resolveExceptionPoolItem(
        taskId, 'official_run', sampleId, { annotatorId }, 'single_label', 'adopt_annotator', 'neutral', ''
      );
  }, { taskId: TASK_ID, sampleId: SAMPLE_ID, annotatorId: ANNOTATOR_ID });
}

test.describe('Final exception pool entry (FR-018, issue #688)', () => {
  test('section shows a count title and stays visible at zero (dry_run has no items for T017)', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=${TASK_ID}&role=project_leader`);
    await openAnnotationProgressTab(page);

    // Default filter is official_run: T017 has exactly 1 pending item.
    await expect(page.locator('#finalExceptionPoolSection')).toBeVisible();
    await expect(page.locator('#finalExceptionPoolTitle')).toHaveText(/1\s*項待處置/);
    await expect(page.locator('.final-exception-pool-item')).toHaveCount(1);
    await expect(page.locator('#finalExceptionPoolEmpty')).toBeHidden();

    // Switch to dry_run: T017 has no dry_run data at all, so the count is 0
    // -- the section itself MUST stay visible (FR-018 point 1), only the
    // table swaps for the empty-state message.
    await page.locator('#finalExceptionPoolRunTypeFilter').selectOption('dry_run');
    await expect(page.locator('#finalExceptionPoolSection')).toBeVisible();
    await expect(page.locator('#finalExceptionPoolTitle')).toHaveText(/0\s*項待處置/);
    await expect(page.locator('.final-exception-pool-item')).toHaveCount(0);
    await expect(page.locator('#finalExceptionPoolEmpty')).toBeVisible();
    await expect(page.locator('#finalExceptionPoolEmpty')).toContainText('最終例外池已清空');
  });

  test('the one row renders every FR-018 point-2 field', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=${TASK_ID}&role=project_leader`);
    await openAnnotationProgressTab(page);

    const row = page.locator('.final-exception-pool-item').first();
    await expect(row).toContainText(SAMPLE_ID);
    await expect(row).toContainText(ANNOTATOR_ID);
    await expect(row).toContainText(REVIEWER_ID);
    // Output type label is OUTPUT_TYPE_REGISTRY/TASK_TAXONOMY-driven, not a
    // hardcoded 'single_label' string (Generalization-First).
    await expect(row).toContainText('單一標籤');
    await expect(row).toContainText(ARBITER_ID);
    // See REASON_FALLBACK's comment: T017's fixture arbitration vote carries
    // no reason text, so the reason cell falls back to '-' like every other
    // empty cell in this table (annotatorId/reviewerId/outputType/arbiter
    // all render real values above, isolating this to the reason field).
    await expect(row.locator('td').nth(5)).toHaveText(REASON_FALLBACK);
  });

  test('the row link navigates to the FR-095 disposition screen with the full review-unit identity', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=${TASK_ID}&role=project_leader`);
    await openAnnotationProgressTab(page);

    const link = page.locator('.final-exception-pool-navigate-link').first();
    await expect(link).toHaveAttribute(
      'href',
      `../annotation/annotation-workspace.html?task_id=${TASK_ID}&sample_id=${SAMPLE_ID}&role=project_leader&run_type=official_run&annotator_id=${ANNOTATOR_ID}`
    );
  });

  test('non-project_leader roles never see the section', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=${TASK_ID}&role=reviewer`);
    await openAnnotationProgressTab(page);

    await expect(page.locator('#finalExceptionPoolSection')).toBeHidden();
  });
});

test.describe('Closure gate blocks on a non-empty official_run exception pool (FR-008b, issue #688)', () => {
  test('publishComplete is blocked while pending, then proceeds once resolved', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=${TASK_ID}&role=project_leader`);
    await page.locator('#workLogPanel').waitFor({ state: 'attached', timeout: PANEL_LOAD_TIMEOUT });

    await expect(page.locator('#publishCompleteBtn')).toBeVisible();
    await page.locator('#publishCompleteBtn').click();

    await expect(page.locator('#toastMsg')).toContainText('最終例外池尚有 1 項待處置');
    await expect(page.locator('#statusBadge')).not.toHaveText('已完成');

    await resolveT017Exception(page);
    await page.reload();
    await page.locator('#workLogPanel').waitFor({ state: 'attached', timeout: PANEL_LOAD_TIMEOUT });
    await page.locator('#publishCompleteBtn').click();

    await expect(page.locator('#statusBadge')).toHaveText('已完成');
  });
});
