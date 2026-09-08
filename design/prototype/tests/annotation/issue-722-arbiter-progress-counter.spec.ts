/**
 * Issue #722 -- the arbiter's workspace progress counter ("我的審核提交
 * {done} / {total} 個審核單位") must count arbitration submissions, and must
 * refresh immediately after one is submitted.
 *
 * Before this fix: countSubmittedUnits() (annotation-workspace.config.js)
 * only ever consulted isSampleSubmitted(..., 'reviewer', ...) for the
 * reviewer role, which is blind to arbitration votes (a completely
 * different write path, submitArbitration()). Worse, handleArbitrationSubmit()
 * never called renderSampleNav() at all, so even a counting fix alone would
 * not repaint the number until some other action (e.g. prev/next) did.
 *
 * Fixture mirrors annotation-workspace-arbitration.spec.ts: T001/sent-001,
 * annotator kioleemg12 says 'sad', the unit's one assigned reviewer
 * (reviewer_wang) says 'fear' -> disputed with a single dispute item.
 * reviewer_chen (can_arbitrate: true, not a participant) is FR-060 eligible
 * to arbitrate it.
 */
import { test, expect, type Page } from '@playwright/test';
import { buildWorkspaceUrl, fillArbitrationReasons, skipGuidelineModal } from './_workspace-helpers';

const TASK = 'T001';
const SAMPLE = 'sent-001';
const ANNOTATOR = 'kioleemg12';
const PARTICIPANT = 'reviewer_wang';
const ARBITER = 'reviewer_chen'; // can_arbitrate: true
const labelPayload = (selected: string) => ({ previewState: { single_label: { selected } } });

type WorkspaceData = {
  markSampleSubmitted: (
    taskId: string, role: string, runType: string, sampleId: string,
    payload: unknown, historySummary: string,
    identity: { annotatorId?: string; reviewerId?: string }
  ) => void;
};

declare global {
  interface Window {
    LabelSuiteAnnotationWorkspaceData: WorkspaceData;
  }
}

function seedUnit(page: Page): Promise<void> {
  return page.evaluate(
    (a) => {
      window.LabelSuiteAnnotationWorkspaceData.markSampleSubmitted(
        a.task, 'annotator', 'official_run', a.sample, a.annotatorPayload, '', { annotatorId: a.annotator }
      );
      window.LabelSuiteAnnotationWorkspaceData.markSampleSubmitted(
        a.task, 'reviewer', 'official_run', a.sample, a.reviewerPayload, '',
        { annotatorId: a.annotator, reviewerId: a.participant }
      );
    },
    {
      task: TASK, sample: SAMPLE, annotator: ANNOTATOR, participant: PARTICIPANT,
      annotatorPayload: labelPayload('sad'), reviewerPayload: labelPayload('fear'),
    }
  );
}

function gotoWorkspace(page: Page) {
  return page.goto(buildWorkspaceUrl({
    task_id: TASK, sample_id: SAMPLE, role: 'reviewer', run_type: 'official_run',
    annotator_id: ANNOTATOR, reviewer_id: ARBITER,
  }));
}

test.describe("issue #722 — arbiter's progress counter counts arbitration submissions", () => {
  test.beforeEach(async ({ page }) => {
    await skipGuidelineModal(page);
    await gotoWorkspace(page);
    await seedUnit(page);
    await page.reload();
  });

  test('the counter is 0 before any arbitration is submitted', async ({ page }) => {
    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    await expect(page.getByTestId('ws-progress-text')).toHaveText(/^我的審核提交 0 \/ 15 個審核單位$/);
  });

  test('submitting arbitration advances the counter WITHOUT a reload', async ({ page }) => {
    await page.getByTestId('ws-arbitration-choose-b').click();
    await fillArbitrationReasons(page);
    await page.getByTestId('ws-arbitration-submit').click();

    await expect(page.getByTestId('ws-progress-text')).toHaveText(/^我的審核提交 1 \/ 15 個審核單位$/);
  });

  /* Persistence itself is not new behaviour under test here -- both
     isSampleSubmitted() and isArbitrationSubmitted() read straight from
     localStorage on every render, so a value that is correct immediately
     after submit (previous test) is trivially still correct on the next
     render, reload or not. Covering the same claim via an actual
     page.reload() is redundant with that and the API-level assertions
     already in annotation-workspace-arbitration.spec.ts. */
});
