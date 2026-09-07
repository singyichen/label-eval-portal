/*
 * Traceability: openspec/changes/align-014-review-model/specs/task-management/014-task-detail/spec.md
 *   FR-018 (final exception pool entry point), FR-008b (task completion
 *   gate, point 4), FR-010t (arbiter-empty publish warning -- regression
 *   only, see note below).
 *
 * TDD Red for tasks.md 2.1 (PR group 2). NONE of the following exists yet:
 * `#exceptionPoolSection` / `#exceptionPoolSectionTitle` /
 * `#exceptionPoolBody` / `#exceptionPoolRunTypeFilter` /
 * `#exceptionPoolEmpty` have no prior art in annotation-progress.html
 * (confirmed by grep), and `publishComplete()` (task-detail.html) currently
 * sets `TASK_DATA.status = 'completed'` unconditionally with no gap-message
 * gate. Every case below fails because the section/gate does not exist,
 * never because of a selector typo.
 *
 * ---------------------------------------------------------------------
 * Judgment call (task 2.1's Red-writer must document, per issue #688
 * dispatch instructions): FR-010t's no-arbiter publish warning is NOT
 * covered here. It already exists and is already Green --
 * `renderPublishArbiterWarning()` (task-detail.html) plus its dedicated
 * test in issue-596-assignment-readonly.spec.ts:131 ("does not block
 * publish but shows a persistent arbiter-gap warning when arbiter_ids is
 * empty") predate this change (PR #609). Adding a duplicate assertion here
 * would make this Red file NOT "全數失敗" (tasks.md 2.1's own success
 * criterion), since that behavior is already implemented. Task 2.4's "FR-
 * 010t 之無仲裁者發布警示" scope is therefore satisfied by *not regressing*
 * that existing test, verified by the group's full regression run (task
 * 2.5), not by new coverage in this file.
 * ---------------------------------------------------------------------
 *
 * Seed data used below (task-detail.html REVIEW_WORKLOAD_BY_TASK.T017):
 * one real seeded item, 'oft-01-final-exception' (its own REVIEW_FLOW_UNITS
 * name already implies a final exception; T017's own review guideline text
 * calls it a tie needing arbitration -- task-detail.data.js:1211-1213), an
 * `official_run` item since T017 has no dry-run rounds. Precise multi-item
 * counts and the run_type filter/closure-gate isolation cases inject data
 * directly via page.evaluate() (same idiom as issue-90-falsy-zero-score.
 * spec.ts) rather than growing production seed data further -- those are
 * exact-number/isolated-precondition assertions, not "does the real demo
 * task tell a coherent story" assertions.
 */
import { test, expect, type Page } from '@playwright/test';

const TASK_DETAIL_URL = '/pages/task-management/task-detail.html';
const PANEL_LOAD_TIMEOUT = 15000;

async function waitForBoot(page: Page) {
  await page.locator('#workLogPanel').waitFor({ state: 'attached', timeout: PANEL_LOAD_TIMEOUT });
}

async function openAnnotationProgressTab(page: Page) {
  await waitForBoot(page);
  await page.locator('#tabAnnotationProgress').click();
  await expect(page.locator('#annotationProgressPanel')).not.toHaveClass(/hidden/);
}

type ExceptionPoolItem = {
  sampleId: string;
  runType: 'dry_run' | 'official_run';
  annotatorId: string;
  reviewerId: string;
  disputeOutputType: string;
  arbiterId: string;
  arbiterReason: string;
  enteredAt: string;
};

type ReviewWorkload = {
  unassignedCount: number;
  disputeCount: number;
  byReviewer: Record<string, { pending: number; done: number }>;
  exceptionPoolItems: ExceptionPoolItem[];
};

type AnnotationProgressOfficial = { totalSamples: number; completedSamples: number; iaa: number | null };

type PageWindow = {
  REVIEW_WORKLOAD: ReviewWorkload;
  ANNOTATION_PROGRESS: { official: AnnotationProgressOfficial };
  TASK_DATA: { status: string };
  renderAnnotationProgress: () => void;
};

test.describe('Final exception pool entry point (FR-018, issue #688)', () => {
  test('title shows the pending count and the section is not hidden for project_leader', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017`);
    await openAnnotationProgressTab(page);

    await expect(page.locator('#exceptionPoolSection')).not.toHaveClass(/hidden/);
    await expect(page.locator('#exceptionPoolSectionTitle')).toHaveText(/1\s*項待處置/);
  });

  test('lists sample id, annotator, reviewer, dispute output type, and arbiter with reason per row', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017`);
    await openAnnotationProgressTab(page);

    const row = page.locator('#exceptionPoolBody tr').first();
    await expect(row).toContainText('oft-01-final-exception');
    await expect(row).toContainText('kioleemg12');
    await expect(row).toContainText('reviewer_wang');
    await expect(row).toContainText('single_label');
    await expect(row).toContainText('reviewer_chen');
    await expect(row).toContainText('兩者皆非');
  });

  test('renders an empty state instead of hiding the section when the pool has zero items', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T015`);
    await openAnnotationProgressTab(page);

    await expect(page.locator('#exceptionPoolSection')).not.toHaveClass(/hidden/);
    await expect(page.locator('#exceptionPoolSectionTitle')).toHaveText(/0\s*項待處置/);
    await expect(page.locator('#exceptionPoolBody tr')).toHaveCount(0);
    await expect(page.locator('#exceptionPoolEmpty')).toBeVisible();
    await expect(page.locator('#exceptionPoolEmpty')).toHaveText('最終例外池已清空');
  });

  test('reviewer browsing annotation-progress normally never sees the section', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017&task_role=reviewer`);
    await openAnnotationProgressTab(page);

    await expect(page.locator('#exceptionPoolSection')).toHaveClass(/hidden/);
  });

  test('reviewer direct-linking the exception-pool focus is redirected to overview with a permission toast (FR-006)', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017&task_role=reviewer&tab=annotation-progress&focus=exception-pool`);
    await waitForBoot(page);

    await expect(page.locator('#overviewPanel')).not.toHaveClass(/hidden/);
    await expect(page.locator('#annotationProgressPanel')).toHaveClass(/hidden/);
    await expect(page.locator('#toastMsg')).toContainText('無權限');
  });

  test('run_type filter narrows both the title count and the rows independently per run', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017`);
    await openAnnotationProgressTab(page);

    await page.evaluate(() => {
      const win = window as unknown as PageWindow;
      win.REVIEW_WORKLOAD.exceptionPoolItems = [
        { sampleId: 'dry-sample-1', runType: 'dry_run', annotatorId: 'a1', reviewerId: 'r1', disputeOutputType: 'single_label', arbiterId: 'arb1', arbiterReason: 'x', enteredAt: '2026-08-01 00:00' },
        { sampleId: 'off-sample-1', runType: 'official_run', annotatorId: 'a2', reviewerId: 'r2', disputeOutputType: 'single_label', arbiterId: 'arb2', arbiterReason: 'x', enteredAt: '2026-08-02 00:00' },
        { sampleId: 'off-sample-2', runType: 'official_run', annotatorId: 'a3', reviewerId: 'r3', disputeOutputType: 'single_label', arbiterId: 'arb3', arbiterReason: 'x', enteredAt: '2026-08-03 00:00' },
      ];
      win.renderAnnotationProgress();
    });

    await expect(page.locator('#exceptionPoolSectionTitle')).toHaveText(/3\s*項待處置/);
    await expect(page.locator('#exceptionPoolBody tr')).toHaveCount(3);

    await page.locator('#exceptionPoolRunTypeFilter').selectOption('official_run');
    await expect(page.locator('#exceptionPoolSectionTitle')).toHaveText(/2\s*項待處置/);
    await expect(page.locator('#exceptionPoolBody tr')).toHaveCount(2);

    await page.locator('#exceptionPoolRunTypeFilter').selectOption('dry_run');
    await expect(page.locator('#exceptionPoolSectionTitle')).toHaveText(/1\s*項待處置/);
    await expect(page.locator('#exceptionPoolBody tr')).toHaveCount(1);
  });

  test('clicking a row action navigates to the disposition screen carrying the full review-unit identity', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017`);
    await openAnnotationProgressTab(page);

    await page.locator('#exceptionPoolBody tr').first().getByRole('button').click();
    await page.waitForURL(/annotation-workspace\.html/);

    const url = new URL(page.url());
    expect(url.searchParams.get('task_id')).toBe('T017');
    expect(url.searchParams.get('run_type')).toBe('official_run');
    expect(url.searchParams.get('annotator_id')).toBe('kioleemg12');
    expect(url.searchParams.get('sample_id')).toBe('oft-01-final-exception');
  });
});

test.describe('Task completion gate blocked by the final exception pool (FR-008b point 4, issue #688)', () => {
  test('blocks 標記完成 with an itemized reason while official_run items are pending, and allows it once cleared', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T017&status=official_run_in_progress`);
    await waitForBoot(page);

    // Isolate the exception-pool precondition: clear every other FR-008b
    // gap so the itemized reason below is unambiguously attributable to it.
    await page.evaluate(() => {
      const win = window as unknown as PageWindow;
      win.REVIEW_WORKLOAD.unassignedCount = 0;
      win.REVIEW_WORKLOAD.disputeCount = 0;
      Object.keys(win.REVIEW_WORKLOAD.byReviewer).forEach((id) => {
        win.REVIEW_WORKLOAD.byReviewer[id].pending = 0;
      });
      win.REVIEW_WORKLOAD.exceptionPoolItems = [
        { sampleId: 's1', runType: 'official_run', annotatorId: 'a1', reviewerId: 'r1', disputeOutputType: 'single_label', arbiterId: 'arb1', arbiterReason: 'x', enteredAt: '2026-08-01 00:00' },
        { sampleId: 's2', runType: 'official_run', annotatorId: 'a2', reviewerId: 'r2', disputeOutputType: 'single_label', arbiterId: 'arb2', arbiterReason: 'x', enteredAt: '2026-08-02 00:00' },
      ];
      win.ANNOTATION_PROGRESS.official.completedSamples = win.ANNOTATION_PROGRESS.official.totalSamples;
      win.ANNOTATION_PROGRESS.official.iaa = 0.7;
    });

    await page.locator('#tabOverview').click();
    await page.locator('#publishCompleteBtn').click();

    await expect(page.locator('#toastMsg')).toContainText('最終例外池尚有 2 項待處置');
    expect(await page.evaluate(() => (window as unknown as PageWindow).TASK_DATA.status)).toBe('official_run_in_progress');

    await page.evaluate(() => {
      const win = window as unknown as PageWindow;
      win.REVIEW_WORKLOAD.exceptionPoolItems = [];
    });
    await page.locator('#publishCompleteBtn').click();

    expect(await page.evaluate(() => (window as unknown as PageWindow).TASK_DATA.status)).toBe('completed');
  });
});
