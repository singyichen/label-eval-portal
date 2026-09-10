import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { buildWorkspaceUrl, fillArbitrationReasons, patchDataFile, skipGuidelineModal } from './_workspace-helpers';

/* issue #719 -- "審核送出後自動前進" (review/arbitration submit auto-advance).
 *
 * The annotator side already got this from issue #514 (handleSubmit() scans
 * findNextPendingUnit() and falls back to buildListReturnUrl()). The
 * reviewer/arbiter side never did: handleReviewSubmit() and
 * handleArbitrationSubmit() both end their tail with a toast and three
 * re-renders (renderSampleList/renderReviewerWorkspace/renderSampleNav) and
 * NOTHING ELSE -- no selectSample(), no window.location.href assignment. A
 * reviewer who finishes one unit is left staring at the same, now read-only,
 * unit with no cue where to go next.
 *
 * AC-3.55 / AC-3.56 (spec 015) promise the data layer already has what the
 * handlers are missing: findNextActionableReviewUnit(taskId, runType,
 * reviewerId) ranks every unit (pending/null = 1, an eligible-arbiter's
 * disputed = 2, everything else = 0) and returns the lowest-ranked one in
 * enumeration order -- the exact shape handleSubmit()'s
 * findNextPendingUnit() already models for the annotator side.
 *
 * Every scenario below pins the review-unit ENUMERATION with
 * REVIEWER_MOCK_ROWS.T001 (patched at runtime via patchDataFile, never the
 * source file) rather than relying on the demo T014-T017 seed: this file's
 * seedReviewFlowDemo() inline comments are stale against the current FR-093
 * single-owner-relay derivation (getReviewUnitStatus), and pinning the mock
 * rows is the only way to control enumeration ORDER deterministically, which
 * clause 3 below depends on.
 *
 * Every unit referenced anywhere in this file gets a REAL annotator
 * submission via markSampleSubmitted(..., 'annotator', ...) -- a unit with
 * no stored annotator submission derives status `null`, which
 * reviewUnitActionRank() ALSO ranks as actionable (rank 1), so relying on an
 * un-seeded mock row to mean "not actionable" would silently corrupt every
 * scenario's expected ranking.
 *
 * Traceability: specs/annotation/015-annotation-workspace/spec.md AC-3.55 /
 * AC-3.56, FR-060/FR-093 (single-owner relay + arbitration), FR-081
 * (list-return view state), issue #514 (buildListReturnUrl/annotator
 * pattern this mirrors).
 */

/* Not declared via `declare global` -- that augmentation is shared across
 * every spec file TypeScript compiles together, and this file's minimal
 * shape would conflict with the fuller one
 * annotation-workspace-arbitration.spec.ts already declares (TS2717:
 * "must have the same type"). An inline cast at each call site sidesteps
 * that, mirroring annotation-review-flow-demo-rows.spec.ts's pattern. */
type WorkspaceData = {
  markSampleSubmitted: (
    taskId: string, role: string, runType: string, sampleId: string,
    payload: unknown, historySummary: string,
    identity: { annotatorId?: string; reviewerId?: string }
  ) => void;
};

const TASK = 'T001';
const RUN_TYPE = 'official_run';
/* Roster (annotation-workspace.data.js REVIEWER_ROSTER): wang/li/chen/lin.
 * Only chen carries can_arbitrate: true (FR-060). */
const PARTICIPANT = 'reviewer_wang';
const ARBITER = 'reviewer_chen';

const labelPayload = (selected: string) => ({ previewState: { single_label: { selected } } });

function activeSampleItem(page: Page) {
  return page.locator('[data-testid="ws-sample-item"].active');
}

function seedSubmission(
  page: Page,
  role: 'annotator' | 'reviewer',
  sampleId: string,
  value: string,
  identity: { annotatorId?: string; reviewerId?: string }
): Promise<void> {
  return page.evaluate(
    (a) => {
      (window as unknown as { LabelSuiteAnnotationWorkspaceData: WorkspaceData })
        .LabelSuiteAnnotationWorkspaceData.markSampleSubmitted(
          a.task, a.role, a.runType, a.sampleId, a.payload, '', a.identity
        );
    },
    { task: TASK, role, runType: RUN_TYPE, sampleId, payload: labelPayload(value), identity }
  );
}

/* Pins the review-unit ENUMERATION to exactly the (sample, annotator) pairs
 * a scenario constructs, independent of T001's normal 3-annotator x
 * 5-sample demo grid. patchDataFile targets annotation-workspace.data.js's
 * OWN exported REVIEWER_MOCK_ROWS -- read through
 * window.LabelSuiteAnnotationWorkspaceData at CALL time by
 * getReviewerMockRows(), so the patch is live for every subsequent
 * listReviewUnits()/buildUnits() call, including the one
 * findNextActionableReviewUnit() makes inside the submit handlers under
 * test. Must be called before the first page.goto() in a test so the route
 * is registered before the script is first requested. */
function pinReviewUnits(page: Page, rows: Record<string, Array<{ annotator: string; answers: unknown }>>) {
  return patchDataFile(page, 'annotation-workspace.data.js', `
    window.LabelSuiteAnnotationWorkspaceData.REVIEWER_MOCK_ROWS.${TASK} = ${JSON.stringify(rows)};
  `);
}

/* Distinguishes an in-place same-page update (selectSample() ->
 * window.history.replaceState, fires no 'load' event and no request) from a
 * real navigation (window.location.href = ..., fires both) -- the mechanism
 * this whole suite hinges on to tell "advanced in place" apart from "didn't
 * move" apart from "left the page". */
function countLoads(page: Page): { value: number } {
  const counter = { value: 0 };
  page.on('load', () => { counter.value += 1; });
  return counter;
}

function workspaceUrl(params: {
  sampleId: string; role: 'reviewer'; annotatorId: string; reviewerId: string; extraQuery?: string;
}): string {
  return (
    buildWorkspaceUrl({
      task_id: TASK, sample_id: params.sampleId, role: params.role, run_type: RUN_TYPE,
      annotator_id: params.annotatorId, reviewer_id: params.reviewerId,
    }) + (params.extraQuery || '')
  );
}

test.beforeEach(async ({ page }) => {
  await skipGuidelineModal(page);
});

test.describe('AC-3.55 clauses 1-2: successful review submit advances in-place', () => {
  test('advances to findNextActionableReviewUnit(), syncs sample_id AND annotator_id in place, excludes the just-submitted unit', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'positive' } }],
      'sent-002': [{ annotator: '113450022', answers: { single_label: 'negative' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: PARTICIPANT }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'annotator', 'sent-002', 'joy', { annotatorId: '113450022' });
    await page.reload();

    const loads = countLoads(page);
    /* FR-099 §7 (delta 7d1df391): a row decided 通過 on every outKey
       finalizes the unit, which MUST stay put (AC-3.39/FR-053) rather than
       advance -- see the dedicated finalization-exemption test below. This
       scenario's premise is a submit that does NOT finalize, so it decides
       修正 (with its FR-089 required reason) instead, deriving 爭議中. */
    await page.getByTestId('ws-review-row').first().getByTestId('ws-review-row-modify').click();
    await page.getByTestId('ws-review-reason').fill('審核修正理由（測試）');
    await page.getByTestId('ws-review-submit-btn').click();

    // in-place advance: same page, both halves of the unit identity move together
    await expect.poll(() => activeSampleItem(page).getAttribute('data-sample-id')).toBe('sent-002');
    await expect.poll(() => activeSampleItem(page).getAttribute('data-annotator-id')).toBe('113450022');
    const url = new URL(page.url());
    expect(url.pathname).toContain('annotation-workspace.html');
    expect(url.searchParams.get('sample_id')).toBe('sent-002');
    expect(url.searchParams.get('annotator_id')).toBe('113450022');
    expect(loads.value).toBe(0);

    // the just-submitted unit must not be the one still shown as active
    const submittedRow = page.locator('[data-testid="ws-sample-item"][data-sample-id="sent-001"][data-annotator-id="kioleemg12"]');
    await expect(submittedRow).not.toHaveClass(/active/);
  });
});

test.describe('AC-3.55 clause 3: a pending unit wins over a disputed unit enumerated earlier', () => {
  test('an eligible-arbiter disputed unit enumerated first is skipped in favour of a later pending unit', async ({ page }) => {
    await pinReviewUnits(page, {
      // enumerated FIRST, disputed, reviewer_chen is an eligible arbiter (never reviewed it)
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'sad' } }],
      // enumerated SECOND, pending -- must still win over sent-001's rank-2 dispute
      'sent-002': [{ annotator: '113450022', answers: { single_label: 'positive' } }],
      // the unit reviewer_chen is actually about to submit on
      'sent-003': [{ annotator: 'tony0950127', answers: { single_label: 'neutral' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-003', role: 'reviewer', annotatorId: 'tony0950127', reviewerId: ARBITER }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'reviewer', 'sent-001', 'fear', { annotatorId: 'kioleemg12', reviewerId: PARTICIPANT });
    await seedSubmission(page, 'annotator', 'sent-002', 'positive', { annotatorId: '113450022' });
    await seedSubmission(page, 'annotator', 'sent-003', 'neutral', { annotatorId: 'tony0950127' });
    await page.reload();

    const loads = countLoads(page);
    // Non-finalizing decision (see FR-099 §7 note above): 修正, not 通過.
    await page.getByTestId('ws-review-row').first().getByTestId('ws-review-row-modify').click();
    await page.getByTestId('ws-review-reason').fill('審核修正理由（測試）');
    await page.getByTestId('ws-review-submit-btn').click();

    await expect.poll(() => activeSampleItem(page).getAttribute('data-sample-id')).toBe('sent-002');
    await expect.poll(() => activeSampleItem(page).getAttribute('data-annotator-id')).toBe('113450022');
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-002');
    expect(url.searchParams.get('annotator_id')).toBe('113450022');
    expect(loads.value).toBe(0);
  });
});

test.describe('AC-3.55 clause 4: no actionable units remain -> return to the list', () => {
  test('navigates to the REQUESTED annotation-list URL carrying the pre-submit view state plus notice=no_actionable_review, without sample_id', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'positive' } }],
    });
    await page.goto(
      workspaceUrl({
        sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: PARTICIPANT,
        extraQuery: '&status=pending&q=%E6%89%8B%E8%A1%93&limit=50&offset=0',
      })
    );
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await page.reload();

    // Non-finalizing decision (see FR-099 §7 note above): 修正, not 通過.
    await page.getByTestId('ws-review-row').first().getByTestId('ws-review-row-modify').click();
    await page.getByTestId('ws-review-reason').fill('審核修正理由（測試）');

    /* Assert on the REQUESTED navigation URL, not page.url() after landing:
       annotation-list.html re-normalises its own address on boot
       (UXC-11), which would measure the destination's normalisation
       instead of what the submit handler emitted -- the exact pitfall
       issue-514-submit-navigation.spec.ts's "buildListReturnUrl" test
       documents and this mirrors. */
    const returnRequest = page.waitForRequest((req) => req.url().includes('annotation-list.html'), { timeout: 5000 });
    await page.getByTestId('ws-review-submit-btn').click();

    const url = new URL((await returnRequest).url());
    expect(url.searchParams.get('task_id')).toBe(TASK);
    expect(url.searchParams.get('role')).toBe('reviewer');
    expect(url.searchParams.get('run_type')).toBe(RUN_TYPE);
    expect(url.searchParams.get('status')).toBe('pending');
    expect(url.searchParams.get('q')).toBe('手術');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.get('notice')).toBe('no_actionable_review');
    expect(url.searchParams.has('sample_id')).toBe(false);

    await expect(page).toHaveURL(/annotation-list\.html\?/);
    await expect(page.getByTestId('list-no-actionable-notice')).toBeVisible();
  });
});

test.describe('AC-3.55 clause 5 (reverse guard): a blocked review submit navigates nowhere', () => {
  test('FR-083 missing decision keeps the same unit and performs no navigation at all', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'positive' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: PARTICIPANT }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await page.reload();

    const loads = countLoads(page);
    // deliberately do NOT decide the row -- pendingReviewOutputKeys() blocks submit
    await page.getByTestId('ws-review-submit-btn').click();

    await expect(page.locator('#toastMsg')).toContainText('請完成以下輸出類型的審核決策');
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-001');
    expect(url.pathname).toContain('annotation-workspace.html');
    expect(loads.value).toBe(0);
  });
});

test.describe('AC-3.56 clause 6: a successful arbitration submit advances the same way', () => {
  test('a non-finalizing arbitration decision (含兩者皆非) advances in place to the next pending unit', async ({ page }) => {
    /* FR-099 §7 (delta 7d1df391): resolving every dispute item (adopt_a /
       adopt_b) finalizes the unit, which MUST stay put rather than advance
       -- see the dedicated finalization-exemption test below. This
       scenario's premise is an arbitration submit that does NOT finalize,
       so at least one item is voted 兩者皆非 (FR-061 §3 keeps the unit
       爭議中), proving the review path and the arbitration path share the
       same advance-in-place mechanism. */
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'sad' } }],
      'sent-002': [{ annotator: '113450022', answers: { single_label: 'positive' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: ARBITER }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'reviewer', 'sent-001', 'fear', { annotatorId: 'kioleemg12', reviewerId: PARTICIPANT });
    await seedSubmission(page, 'annotator', 'sent-002', 'positive', { annotatorId: '113450022' });
    await page.reload();

    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    const loads = countLoads(page);
    await page.getByTestId('ws-arbitration-choose-reject').click();
    await fillArbitrationReasons(page);
    await page.getByTestId('ws-arbitration-submit').click();

    await expect.poll(() => activeSampleItem(page).getAttribute('data-sample-id')).toBe('sent-002');
    await expect.poll(() => activeSampleItem(page).getAttribute('data-annotator-id')).toBe('113450022');
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-002');
    expect(url.searchParams.get('annotator_id')).toBe('113450022');
    expect(loads.value).toBe(0);
  });
});

test.describe('AC-3.56 clause 7: a not-yet-finalized 兩者皆非 vote keeps the arbiter eligible on the same unit', () => {
  test('the sole disputed unit the arbiter just voted 兩者皆非 on remains actionable and IS the next target -- the workspace stays on its arbitration view, it does not return to the list', async ({ page }) => {
    /* FR-099 §4 second bullet (delta 7d1df391): a 兩者皆非 vote leaves the
       unit 爭議中 (FR-061 §3) and writes NO reviewer bucket at all (FR-061
       §4). FR-060 §2's non-participant test is "no reviewer bucket under
       this reviewerId", so the voting arbiter still passes it and remains
       an eligible arbiter on this very unit (FR-065's re-vote semantics
       depend on exactly this). With no other actionable unit on the task,
       findNextActionableReviewUnit() MUST return this unit itself, and the
       workspace MUST stay on the arbitration view rather than navigate to
       annotation-list -- the opposite of what an earlier draft of this
       contract asserted before the delta was revised. */
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'sad' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: ARBITER }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'reviewer', 'sent-001', 'fear', { annotatorId: 'kioleemg12', reviewerId: PARTICIPANT });
    await page.reload();

    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    const loads = countLoads(page);
    let sawListReturn = false;
    page.on('request', (req) => {
      if (req.url().includes('annotation-list.html')) sawListReturn = true;
    });
    await page.getByTestId('ws-arbitration-choose-reject').click();
    await fillArbitrationReasons(page);
    await page.getByTestId('ws-arbitration-submit').click();

    // still on the same unit's arbitration view -- no switch, no navigation
    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-001');
    expect(loads.value).toBe(0);
    expect(sawListReturn).toBe(false);
    await expect(page.getByTestId('list-no-actionable-notice')).toHaveCount(0);
  });
});

test.describe('AC-3.56 clause 8 (reverse guard): a blocked arbitration submit navigates nowhere', () => {
  test('an incomplete arbitration decision keeps the same unit and performs no navigation at all', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'sad' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: ARBITER }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'reviewer', 'sent-001', 'fear', { annotatorId: 'kioleemg12', reviewerId: PARTICIPANT });
    await page.reload();

    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    const loads = countLoads(page);
    // deliberately do NOT choose A/B/reject for the sole dispute item
    await page.getByTestId('ws-arbitration-submit').click();

    await expect(page.locator('#toastMsg')).toContainText('請完成所有爭議項目的裁定');
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-001');
    expect(url.pathname).toContain('annotation-workspace.html');
    expect(loads.value).toBe(0);
  });
});

/* FR-099 §7 (delta 7d1df391): a submit that FINALIZES the unit is exempt
 * from this whole change -- AC-3.39/FR-053 already require it to stay put
 * and render the read-only finalized card in place. Both regression-floor
 * cases below pass under TODAY's code (no advance logic exists yet at
 * all), which is the point: they pin the exemption so a future advance
 * implementation cannot regress it by treating "finalizing" the same as
 * "not finalizing". */
test.describe('FR-099 clause 7 (finalization exemption): a review submit that finalizes the unit stays in place', () => {
  test('逐項全數 通過 finalizes the unit locally -- no advance to the other pending unit, no navigation, exactly one finalized card', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'positive' } }],
      'sent-002': [{ annotator: '113450022', answers: { single_label: 'negative' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: PARTICIPANT }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'annotator', 'sent-002', 'joy', { annotatorId: '113450022' });
    await page.reload();

    const loads = countLoads(page);
    await page.getByTestId('ws-review-row').first().getByTestId('ws-review-row-approve').click();
    await page.getByTestId('ws-review-submit-btn').click();

    await expect(page.getByTestId('ws-review-finalized-card')).toHaveCount(1);
    await expect.poll(() => activeSampleItem(page).getAttribute('data-sample-id')).toBe('sent-001');
    await expect.poll(() => activeSampleItem(page).getAttribute('data-annotator-id')).toBe('kioleemg12');
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-001');
    expect(url.searchParams.get('annotator_id')).toBe('kioleemg12');
    expect(loads.value).toBe(0);
  });
});

test.describe('FR-099 clause 7 (finalization exemption): an arbitration submit that finalizes the unit stays in place', () => {
  test('逐項採 A／採 B 全數落定 finalizes the unit locally -- no advance to the other pending unit, no navigation, exactly one finalized card', async ({ page }) => {
    await pinReviewUnits(page, {
      'sent-001': [{ annotator: 'kioleemg12', answers: { single_label: 'sad' } }],
      'sent-002': [{ annotator: '113450022', answers: { single_label: 'positive' } }],
    });
    await page.goto(workspaceUrl({ sampleId: 'sent-001', role: 'reviewer', annotatorId: 'kioleemg12', reviewerId: ARBITER }));
    await seedSubmission(page, 'annotator', 'sent-001', 'sad', { annotatorId: 'kioleemg12' });
    await seedSubmission(page, 'reviewer', 'sent-001', 'fear', { annotatorId: 'kioleemg12', reviewerId: PARTICIPANT });
    await seedSubmission(page, 'annotator', 'sent-002', 'positive', { annotatorId: '113450022' });
    await page.reload();

    await expect(page.getByTestId('ws-arbitration-card')).toBeVisible();
    const loads = countLoads(page);
    await page.getByTestId('ws-arbitration-choose-b').click();
    await fillArbitrationReasons(page);
    await page.getByTestId('ws-arbitration-submit').click();

    await expect(page.getByTestId('ws-review-finalized-card')).toHaveCount(1);
    const url = new URL(page.url());
    expect(url.searchParams.get('sample_id')).toBe('sent-001');
    expect(loads.value).toBe(0);
  });
});

/* SC-004Y clause 2 (spec 015): the review-submit and arbitration-submit
 * paths MUST derive "what's next" and "where does the list return go" from
 * the SAME two functions, and "which units are actionable" MUST have
 * exactly one implementation in the whole workspace. This is a structural
 * claim -- no sequence of clicks can prove a single shared function is
 * being called from two call sites versus two near-identical copies -- so
 * it is checked by scanning the source file itself, mirroring this
 * project's existing precedent for source-level ban-word/occurrence
 * assertions (shared/language-switch-consistency.spec.ts's
 * fs.readFileSync + path.resolve(__dirname, ...) pattern for reading a
 * page source file from a spec under tests/, and
 * annotation/issue-525-banner-simplify.spec.ts:206's
 * `text.split(needle).length - 1` occurrence-count idiom). */
test.describe('SC-004Y clause 2: one shared next-unit function, one shared list-return builder, one actionable-unit judgement', () => {
  const CONFIG_PATH = path.resolve(__dirname, '../../pages/annotation/annotation-workspace.config.js');
  const source = fs.readFileSync(CONFIG_PATH, 'utf8');

  function occurrences(needle: string): number {
    return source.split(needle).length - 1;
  }

  test('findNextActionableReviewUnit( is called exactly once -- both submit handlers must share one call site, not each carry their own copy', () => {
    // Currently 0: this is the missing-call Red evidence this task adds.
    // A future count of 2 would mean handleReviewSubmit() and
    // handleArbitrationSubmit() each grew their own private call instead
    // of sharing one, defeating the point of a single derivation function.
    expect(occurrences('findNextActionableReviewUnit(')).toBe(1);
  });

  test("'annotation-list.html?' appears exactly once -- buildListReturnUrl() must stay the sole writer of the list-return URL (FR-081 §3)", () => {
    // Already 1 today (inside buildListReturnUrl() itself) -- this is a
    // regression floor: it must not grow a second, independently-built
    // query string for either submit path to return to.
    expect(occurrences('annotation-list.html?')).toBe(1);
  });

  test('REVIEW_UNIT_ACTION_PRIORITY does not appear in the config file -- actionable-unit priority must live only in the data layer', () => {
    // Already 0 today -- regression floor. The action-rank table belongs
    // exclusively to annotation-workspace.data.js's
    // findNextActionableReviewUnit(); config.js may only call it.
    expect(occurrences('REVIEW_UNIT_ACTION_PRIORITY')).toBe(0);
  });

  test('reviewUnitActionRank does not appear in the config file -- there must be exactly one actionable-rank implementation, in the data layer', () => {
    // Already 0 today -- regression floor, same reasoning as the previous
    // assertion: a second ranking function in config.js would mean two
    // independent "what's actionable" judgements that can silently drift
    // apart.
    expect(occurrences('reviewUnitActionRank')).toBe(0);
  });
});
