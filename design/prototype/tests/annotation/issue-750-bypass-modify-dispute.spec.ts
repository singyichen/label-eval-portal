import { test, expect, type Page } from '@playwright/test';
import { buildWorkspaceUrl, dismissGuidelineModal, skipGuidelineModal } from './_workspace-helpers';

/* issue #750: FR-051 (spec.md:740) and AC-4.52 both require that ANY outKey
 * decision of `modify` or `bypass` derives the review unit as `disputed`,
 * regardless of whether the submitted answer value actually differs from
 * the annotator's. anyReviewerChanged() only checked value equality plus a
 * dead `decision === 'reject'` clause (issue #551's naked-reject guard,
 * orphaned since issue #596 retired `reject` from REVIEW_DECISIONS in favor
 * of `['approve', 'modify', 'bypass']`). A reviewer who picks 無法判定
 * (bypass, which design.md D2 deliberately leaves the preview panel showing
 * the annotator's pre-filled answer) or who picks 修正 without actually
 * editing the pre-filled value is therefore misread as agreement and the
 * unit derives `已定稿` instead of `爭議中`.
 */

async function submitAsAnnotator(page: Page, taskId: string, sampleId: string, answer: () => Promise<void>) {
  await page.goto(buildWorkspaceUrl({ task_id: taskId, sample_id: sampleId, role: 'annotator' }));
  await dismissGuidelineModal(page);
  await answer();
  await page.getByTestId('ws-submit-btn').click();
}

function reviewerUrl(taskId: string, sampleId: string): string {
  return buildWorkspaceUrl({ task_id: taskId, sample_id: sampleId, role: 'reviewer', run_type: 'official_run' });
}

test.beforeEach(async ({ page }) => {
  await skipGuidelineModal(page);
  // Two full workspace navigations per case (annotator then reviewer) can
  // exceed the default 30s in this sandbox's slower page-load conditions.
  test.setTimeout(60_000);
});

/* Non-participant, can_arbitrate demo roster identity (same convention as
 * issue-596-arbitration.spec.ts's ARBITER) -- the default reviewer identity
 * DEFAULT_REVIEWER_ID resolves to REVIEWER_ROSTER[0] ('reviewer_wang'), so
 * 'reviewer_chen' is eligible to arbitrate a unit that reviewer submitted. */
function arbiterUrl(taskId: string, sampleId: string): string {
  return buildWorkspaceUrl({
    task_id: taskId, sample_id: sampleId, role: 'reviewer', run_type: 'official_run', reviewer_id: 'reviewer_chen',
  });
}

test.describe('issue #750: bypass/modify without an edited answer still derives 爭議中', () => {
  test('無法判定（bypass）with the preview panel left untouched derives 爭議中, not 已定稿', async ({ page }) => {
    await submitAsAnnotator(page, 'T001', 'sent-001', async () => {
      await page.getByTestId('ws-single-label-chip-negative').click();
    });
    await page.goto(reviewerUrl('T001', 'sent-001'));
    await dismissGuidelineModal(page);

    const row = page.getByTestId('ws-review-row').first();
    await row.getByTestId('ws-review-row-bypass').click();
    await row.getByTestId('ws-review-reason').fill('無法判定（測試理由）');
    await page.getByTestId('ws-review-submit-btn').click();
    await expect(page.locator('#toastMsg')).toHaveText('審核已送出');

    await expect(page.locator('[data-testid="ws-review-unit-context"] .rv-unit-state'))
      .toHaveText('爭議中 · 未定稿，待仲裁');

    /* Codex review on PR #752: the status pill alone doesn't prove the
     * synthesized dispute item (getDisputeItems()'s new `bypass` branch,
     * `reviewer: null`) is actually arbitrable -- an item with no B value to
     * render, or one the legacy convergence helper silently "resolves" on
     * its own (issue #753-adjacent: resolveDisputeConvergence() previously
     * treated a lone `null` vote as a converged winner at N=1), would leave
     * the unit stuck in `disputed` forever with no way to reach `finalized`.
     * Drive the arbitration UI end to end and assert both: B renders the
     * 無法判定 wording (not a raw null/empty value), and adopting A converges
     * the unit to `已定稿`. */
    await page.goto(arbiterUrl('T001', 'sent-001'));
    await dismissGuidelineModal(page);
    const item = page.getByTestId('ws-arbitration-item').first();
    await expect(item).toContainText('無法判定');
    await item.getByTestId('ws-arbitration-choose-a').click();
    await page.getByTestId('ws-arbitration-submit').click();
    await expect(page.locator('#toastMsg')).toHaveText('仲裁已提交');
    await expect(page.getByTestId('ws-review-finalized-card')).toBeVisible();
  });

  test('修正（modify）without actually changing the answer still derives 爭議中, not 已定稿', async ({ page }) => {
    await submitAsAnnotator(page, 'T001', 'sent-001', async () => {
      await page.getByTestId('ws-single-label-chip-negative').click();
    });
    await page.goto(reviewerUrl('T001', 'sent-001'));
    await dismissGuidelineModal(page);

    const row = page.getByTestId('ws-review-row').first();
    await row.getByTestId('ws-review-row-modify').click();
    await row.getByTestId('ws-review-reason').fill('修正（測試理由，未變更答案）');
    await page.getByTestId('ws-review-submit-btn').click();
    await expect(page.locator('#toastMsg')).toHaveText('審核已送出');

    await expect(page.locator('[data-testid="ws-review-unit-context"] .rv-unit-state'))
      .toHaveText('爭議中 · 未定稿，待仲裁');

    /* Same arbitrability proof as the bypass case above, for the `modify`
     * branch's synthesized item (`reviewer: <the reviewer's own submitted
     * value>`, which here equals the annotator's -- adopting B must still
     * converge the unit, not loop back to an identical unresolved state. */
    await page.goto(arbiterUrl('T001', 'sent-001'));
    await dismissGuidelineModal(page);
    const item = page.getByTestId('ws-arbitration-item').first();
    await item.getByTestId('ws-arbitration-choose-b').click();
    await page.getByTestId('ws-arbitration-submit').click();
    await expect(page.locator('#toastMsg')).toHaveText('仲裁已提交');
    await expect(page.getByTestId('ws-review-finalized-card')).toBeVisible();
  });
});
