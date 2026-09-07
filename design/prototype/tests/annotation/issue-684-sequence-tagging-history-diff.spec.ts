import { test, expect, type Page } from '@playwright/test';
import {
  buildWorkspaceUrl,
  skipGuidelineModal,
  trackPageErrors,
  assertNoPageErrors,
} from './_workspace-helpers';

/* issue #684 -- FR-087, position-bearing half, `sequence_tagging`.
 *
 * issue #581 change 2 (PR #657) moved this output type's previewState from
 * a token array to a `spans[]` of character offsets, but the shared
 * SPAN_EXTRACTORS entry in annotation-history.js kept reading the retired
 * `.tokens` field. That extractor silently returned an empty array (no
 * error, no warning), so the per-entity diff for this output type always
 * read "no changes" no matter what actually happened -- these tests pin
 * the per-entity kinds the same way issue-578's entity_recognition
 * coverage does, so a future shape change trips a real assertion instead
 * of quietly going back to an empty diff.
 */

const TASK = 'T006';
const SAMPLE = 'sequence-tagging-001';
/* task-detail.data.js T006/sequence-tagging-001: '台積電董事長魏哲家今天出席台北國際半導體論壇並發表主題演講' */

type Span = { start: number; end: number; label: string };

async function seedTwoSnapshots(page: Page, before: Span[], after: Span[]) {
  await page.evaluate(
    (a: { before: Span[]; after: Span[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (window as any).LabelSuiteAnnotationWorkspaceData;
      const payload = (spans: Span[]) => ({
        previewState: { sequence_tagging: { spans } },
      });
      const identity = { annotatorId: 'kioleemg12' };
      data.markSampleSaved('T006', 'annotator', 'official_run', 'sequence-tagging-001', payload(a.before), 'draft', identity);
      data.markSampleSubmitted('T006', 'annotator', 'official_run', 'sequence-tagging-001', payload(a.after), 'submit', identity);
    },
    { before, after }
  );
}

async function openHistory(page: Page) {
  await page.reload();
  await skipGuidelineModal(page);
  await page.getByTestId('ws-guideline-tab-history').click();
}

/* Newest-first panel, so the submit card is index 0. */
const latestCard = (page: Page) => page.locator('.history-item').first();

test.describe('issue #684 -- sequence_tagging position-bearing history diff', () => {
  test('a moved boundary plus a new span render as one boundary and one added item, not an empty diff', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE }));

    await seedTwoSnapshots(
      page,
      [{ start: 13, end: 15, label: 'LOC' }], // 台北
      [
        { start: 13, end: 17, label: 'LOC' }, // 台北國際 (boundary moved 15 -> 17)
        { start: 20, end: 22, label: 'ORG' }, // 論壇 (new)
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(2);

    const boundary = items.filter({ has: page.locator('[data-diff-kind="boundary"]') });
    await expect(boundary).toHaveCount(1);
    await expect(boundary).toContainText('15');
    await expect(boundary).toContainText('17');
    await expect(boundary).toContainText('台北國際');

    const added = items.filter({ has: page.locator('[data-diff-kind="added"]') });
    await expect(added).toHaveCount(1);
    await expect(added).toContainText('論壇');

    assertNoPageErrors(errors);
  });

  test('an equal span count with one different boundary still produces a non-empty diff', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE }));

    await seedTwoSnapshots(
      page,
      [{ start: 0, end: 3, label: 'ORG' }],
      [{ start: 0, end: 2, label: 'ORG' }]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(1);
    await expect(items.filter({ has: page.locator('[data-diff-kind="boundary"]') })).toHaveCount(1);
    assertNoPageErrors(errors);
  });
});
