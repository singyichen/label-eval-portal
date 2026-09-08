import { test, expect, type Page } from '@playwright/test';
import {
  assertNoPageErrors,
  buildWorkspaceUrl,
  dismissGuidelineModal,
  patchDataFile,
  selectWorkspaceText,
  skipGuidelineModal,
  trackPageErrors,
} from './_workspace-helpers';

/* issue #590 / OpenSpec change carry-relation-span-offsets, tasks.md 2.1
 * (FR-098 §4, serialization half only).
 *
 * FR-098 §4 (current wording, after the maintainer's relType ruling):
 * "`relation_identification` 之 CompactAnswer 自 `{ subj, rel, obj }`
 * 擴充為 `{ subj, rel, obj, relType, subjStart, subjEnd, objStart,
 * objEnd }`。序列化端（引擎快照 → CompactAnswer）與回填端（CompactAnswer →
 * 引擎快照）MUST 對稱保留新增的這五個欄位——任一端遺漏，即使上游已產生起訖，
 * 位置維度亦到不了差異比對層。`relType` 之所以必須隨往返存活，是因為 §5 之
 * `relationKey` 於 `relType` 非空時優先取 `relType`：若 CompactAnswer 不攜帶
 * `relType`，回填後的引擎快照該欄位恆為 `null`，§5 的優先分支在此路徑上永遠
 * 走不到...`relType` 型別為非空字串或 `null`...既有僅含三鍵之 CompactAnswer
 * MUST 可讀，缺鍵一律視同 `null`，不得因缺鍵而中斷渲染或往返。"
 *
 * This file locks ONLY the serialization direction (engine snapshot ->
 * CompactAnswer), i.e. `convertSubmissionAnswer()`'s `relation_identification`
 * branch at annotation-workspace.data.js:1664-1665, which today discards
 * everything except `subj`/`rel`/`obj`:
 *   return (submission.previewTriples || []).map(function (tr) {
 *     return { subj: tr.subj, rel: tr.rel, obj: tr.obj };
 *   });
 * Group 1 (issue-590-relation-offsets-engine.spec.ts, commit 104767d7)
 * already made `previewTriples` carry `subjStart`/`subjEnd`/`objStart`/
 * `objEnd` (real integers when the source has position data, explicit
 * `null` otherwise) -- this file locks that those four fields, PLUS
 * `relType` (already present on the engine snapshot, written only by the
 * interactive triple row's 類型/type selector -- task-config.engine.js:2338
 * `onSetType`), survive one step further, into the CompactAnswer a
 * submission actually persists.
 *
 * The REHYDRATION direction (回填端：CompactAnswer -> 引擎快照,
 * `applyCompactAnswerToState()` in annotation-workspace.config.js:2722) is
 * tasks.md 2.3's Red, added to this same file by a LATER task -- see the two
 * `test.describe` blocks at the bottom of this file for that half of the
 * contract; everything above this point stays scoped to submission ->
 * CompactAnswer only.
 *
 * Two cases cover both directions of "對稱保留" on the serialization side:
 *   - AC-A: a triple whose source HAS position data (T008/rel-001,
 *     interactive builder -- the same fixture group 1's own Red/Green use)
 *     MUST serialize four real integer offsets, not just the three display
 *     strings. The chosen entity (高血壓, entity1 start:0/end:2 in
 *     task-detail.data.js) deliberately has a zero start (Red strength
 *     rule: a `tr.subjStart || null` bug at this NEW code point would
 *     silently turn a real `0` into `null` here, and nowhere else in this
 *     fixture would catch it). This same test ALSO drives the row's own
 *     類型/type selector (`ws-ri-triple-type-btn` -> the `causes` menu
 *     item) to set a real, non-empty `relType` on the engine snapshot --
 *     the ONLY source FR-098 §4 permits -- so that a Green which adds all
 *     eight keys but hardcodes `relType: null` in the serializer (passing
 *     every offset assertion and the key-shape check below) is still
 *     caught: it cannot produce anything but `null` here, where the source
 *     of truth is `'causes'`.
 *   - AC-B: a triple whose source has NO position data (T013/absa-001,
 *     the built-in ABSA string-concatenation shape group 1 pinned to
 *     `null` at the engine layer for the four offsets) MUST still
 *     serialize four EXPLICIT `null`s for the offsets -- tasks.md 2.2's own
 *     wording is "缺值時輸出 null" (output null when missing), not "omit
 *     the key when missing". This same source shape (task-config.engine.js
 *     :1878-1879) never sets `relType` on the engine snapshot at all --the
 *     key is fully ABSENT (`undefined`), not explicitly `null` -- which
 *     pins FR-098 §4's own "缺鍵一律視同 null" clause: the CompactAnswer
 *     MUST still carry an explicit `relType: null` key, not omit it and not
 *     leave it `undefined`. An omitted or `undefined` key would make AC-B's
 *     `toHaveProperty`/`toBeNull` assertions fail exactly like a
 *     dropped-key bug would for AC-A, so the two cases together pin every
 *     failure mode of a partial Green.
 *
 * Both cases also assert the CompactAnswer is EXACTLY the eight-key shape
 * FR-098 §4 enumerates -- no fewer (the current three-key bug, or a Green
 * that adds only the four offset fields and forgets `relType` entirely) and
 * no more.
 *
 * All assertions below are Red today: the `relation_identification` branch
 * of `convertSubmissionAnswer` has no offset fields and no `relType` field
 * at all, so every `toHaveProperty('relType' | 'subjStart' | 'subjEnd' |
 * 'objStart' | 'objEnd')` below fails first, before any value or null check
 * runs.
 */

/* Cast rather than `declare global` for `LabelSuiteAnnotationWorkspaceData`:
 * annotation-workspace-arbitration.spec.ts already augments
 * `Window.LabelSuiteAnnotationWorkspaceData` with a differently shaped
 * WorkspaceData, and TS requires merged global declarations to be
 * structurally identical (same pattern as issue-199-arbitration-vote-dedup.
 * spec.ts). `state` has no such collision -- every other file in this
 * directory that declares it uses the same `Record<string, unknown>`
 * shape, so it stays a normal global augmentation. */
declare global {
  interface Window {
    state?: Record<string, unknown>;
  }
}

interface EngineTriple {
  subj: string;
  rel: string;
  obj: string;
  relType?: string | null;
  subjStart?: number | null;
  subjEnd?: number | null;
  objStart?: number | null;
  objEnd?: number | null;
}

interface CompactRelationTriple {
  subj: string;
  rel: string;
  obj: string;
  relType?: string | null;
  subjStart?: number | null;
  subjEnd?: number | null;
  objStart?: number | null;
  objEnd?: number | null;
}

type WorkspaceData = {
  getSubmission: (
    taskId: string,
    role: string,
    runType: string,
    sampleId: string,
    identity: { annotatorId?: string; reviewerId?: string }
  ) => { previewTriples?: EngineTriple[] } | null;
  convertSubmissionAnswer: (
    outKey: string,
    submission: { previewTriples?: EngineTriple[] }
  ) => CompactRelationTriple[];
};

function getState(page: Page, key: string) {
  return page.evaluate((k) => window.state?.[k], key);
}

/* FR-098 §4's full eight-key CompactAnswer contract, asserted by exact
 * sorted-key-set equality (not merely "has at least these keys"): a Green
 * that adds only the four offset fields and forgets `relType` entirely, or
 * one that adds some other unlisted key, both fail this check. This check
 * alone does NOT catch a Green that includes the `relType` key but always
 * writes `null` to it -- that failure mode is caught separately, by the
 * non-null `relType` value assertions in the AC-A test below. */
function expectEightKeyShape(triple: CompactRelationTriple) {
  expect(Object.keys(triple).sort()).toEqual(
    ['obj', 'objEnd', 'objStart', 'rel', 'relType', 'subj', 'subjEnd', 'subjStart']
  );
}

test.describe.configure({ retries: 2 });

test.beforeEach(async ({ page }) => {
  await skipGuidelineModal(page);
});

/* rel-001's own "triples" field is an output-role prefill (013 FR-003g-5),
 * same helper as annotation-workspace-relation-identification.spec.ts --
 * stripped so the triple under test is unambiguously the one this test
 * built and submitted. */
async function stripTriplePrefill(page: Page) {
  await patchDataFile(page, 'task-detail.data.js', `
    window.LabelSuiteTaskDetailData.profiles.T008.datasetRecords[0].triples = [];
  `);
}

test.describe('FR-098 §4 — submitted CompactAnswer carries offsets and relType through serialization (T008)', () => {
  test('a submitted triple built from position-carrying entities serializes to the eight-key shape with real integer offsets and a non-empty relType', async ({ page }) => {
    await stripTriplePrefill(page);
    await page.goto(buildWorkspaceUrl({ task_id: 'T008', sample_id: 'rel-001' }));
    await dismissGuidelineModal(page);

    await selectWorkspaceText(page, 'ws-input-content', '高血壓');
    await page.getByTestId('ws-ri-e1-btn').click();
    await selectWorkspaceText(page, 'ws-input-content', '導致');
    await page.getByTestId('ws-ri-relation-btn').click();
    await selectWorkspaceText(page, 'ws-input-content', '動脈硬化');
    await page.getByTestId('ws-ri-e2-btn').click();
    await page.getByTestId('ws-ri-add-btn').click();
    await expect(page.getByTestId('ws-ri-triple-item')).toHaveCount(1);

    /* T008's own output config lists `relation_types: ['causes', 'treats',
     * 'prevents', 'diagnoses', 'located_in']` (task-detail.data.js:442), so
     * the row's 類型/type selector (task-config.engine.js:2087-2116) is
     * live here. This is the ONLY source FR-098 §4 permits for `relType`
     * ("互動標記之關係型別選擇器所寫入") -- select `causes` through it,
     * exactly the way `onSetType` (task-config.engine.js:2338) writes
     * `state.previewTriples[i].relType`. */
    const tripleItem = page.getByTestId('ws-ri-triple-item');
    await tripleItem.getByTestId('ws-ri-triple-type-btn').click();
    await tripleItem.getByText('causes', { exact: true }).click();
    await expect(tripleItem).toContainText('類型：causes');

    /* Sanity (not this file's contract): the engine snapshot really does
     * carry the offsets this test depends on (group 1, commit 104767d7)
     * plus the relType just set through the UI. If this block fails, the
     * bug is upstream of the code this file targets and Task 2.1's own
     * assertions below would be Red for the wrong reason. */
    const engineTriples = (await getState(page, 'previewTriples')) as EngineTriple[];
    expect(engineTriples).toHaveLength(1);
    expect(engineTriples[0].relType).toBe('causes');
    expect(engineTriples[0].subjStart).toBe(0);
    expect(engineTriples[0].subjEnd).toBe(2);
    expect(engineTriples[0].objStart).toBe(14);
    expect(engineTriples[0].objEnd).toBe(17);

    await page.getByTestId('ws-submit-btn').click();
    await expect(page.getByTestId('ws-sample-item').first()).toHaveAttribute('data-submitted', 'true');

    const compactTriples = await page.evaluate(() => {
      const data = (window as unknown as { LabelSuiteAnnotationWorkspaceData: WorkspaceData })
        .LabelSuiteAnnotationWorkspaceData;
      const submission = data.getSubmission('T008', 'annotator', 'official_run', 'rel-001', {});
      return data.convertSubmissionAnswer('relation_identification', submission || {});
    });
    expect(compactTriples).toHaveLength(1);
    const triple = compactTriples[0];

    expectEightKeyShape(triple);
    expect(triple).toHaveProperty('subjStart');
    expect(triple).toHaveProperty('subjEnd');
    expect(triple).toHaveProperty('objStart');
    expect(triple).toHaveProperty('objEnd');
    expect(Number.isInteger(triple.subjStart)).toBe(true);
    expect(Number.isInteger(triple.subjEnd)).toBe(true);
    expect(Number.isInteger(triple.objStart)).toBe(true);
    expect(Number.isInteger(triple.objEnd)).toBe(true);
    expect(triple.subjStart).toBe(0);
    expect(triple.subjEnd).toBe(2);
    expect(triple.objStart).toBe(14);
    expect(triple.objEnd).toBe(17);

    /* Red-strength assertion for `relType`: a Green that adds all eight
     * keys but hardcodes `relType: null` in the serializer passes every
     * assertion above (including expectEightKeyShape) but fails here,
     * because the source of truth set through the UI is `'causes'`, not
     * `null`. */
    expect(triple).toHaveProperty('relType');
    expect(triple.relType).toBe('causes');

    // Display-string contract (FR-098 §1) must not regress in the same
    // change -- the serialization step must not drop or rewrite them.
    expect(triple.subj).toContain('高血壓');
    expect(triple.rel).toContain('導致');
    expect(triple.obj).toContain('動脈硬化');
  });
});

test.describe('FR-098 §4 — position-less source serializes offsets and relType as explicit null, not an omitted or undefined key (T013)', () => {
  test('the built-in ABSA demo triples serialize through convertSubmissionAnswer with four explicit offset nulls and an explicit relType null per triple', async ({ page }) => {
    await page.goto(buildWorkspaceUrl({ task_id: 'T013', sample_id: 'absa-001' }));
    await dismissGuidelineModal(page);

    const engineTriples = (await getState(page, 'previewTriples')) as EngineTriple[];
    expect(engineTriples.length).toBeGreaterThanOrEqual(1);
    /* Sanity: this really is the null-offset string-concatenation shape
     * group 1 pinned (`subj` is "<text>/<entity-name>", not a text-file
     * substring) -- guards against the fixture drifting to a different
     * tripShapeOf branch and this test silently testing the wrong thing. */
    expect(engineTriples[0].subj).toContain('/');
    expect(engineTriples[0].subjStart).toBeNull();
    /* Sanity: this source shape (task-config.engine.js:1878-1879) never
     * sets `relType` on the engine snapshot at all -- the key is fully
     * ABSENT here, not explicitly `null`. This is the precondition for
     * FR-098 §4's "缺鍵一律視同 null" clause: the serializer must turn a
     * missing source key into an explicit `null` key on the CompactAnswer,
     * not merely pass an `undefined` value through. */
    expect(engineTriples[0]).not.toHaveProperty('relType');

    const compactTriples = await page.evaluate((triples: EngineTriple[]) => {
      const data = (window as unknown as { LabelSuiteAnnotationWorkspaceData: WorkspaceData })
        .LabelSuiteAnnotationWorkspaceData;
      return data.convertSubmissionAnswer('relation_identification', { previewTriples: triples });
    }, engineTriples);

    expect(compactTriples).toHaveLength(engineTriples.length);
    compactTriples.forEach((triple: CompactRelationTriple) => {
      expectEightKeyShape(triple);
      expect(triple).toHaveProperty('subjStart');
      expect(triple).toHaveProperty('subjEnd');
      expect(triple).toHaveProperty('objStart');
      expect(triple).toHaveProperty('objEnd');
      expect(triple.subjStart).toBeNull();
      expect(triple.subjEnd).toBeNull();
      expect(triple.objStart).toBeNull();
      expect(triple.objEnd).toBeNull();

      /* Red-strength assertion for `relType`'s missing-key case: a Green
       * that copies `tr.relType` verbatim (`undefined` in, `undefined`
       * out, still present as an own key from an object-literal
       * assignment) would pass expectEightKeyShape but fail here, because
       * `toBeNull()` rejects `undefined`. */
      expect(triple).toHaveProperty('relType');
      expect(triple.relType).toBeNull();
    });
  });
});

/* Task 2.3 (issue #590 / OpenSpec change carry-relation-span-offsets,
 * tasks.md 2.3, 回填端契約). FR-098 §4's symmetric-preservation clause,
 * pinned from the OTHER direction: applying an eight-key CompactAnswer back
 * onto workspace state MUST regenerate `relType` and all four offsets on
 * `state.previewTriples`; an existing three-key-only CompactAnswer MUST
 * still rehydrate (missing fields -> explicit `null`) WITHOUT breaking the
 * triple row's render ("既有僅含三鍵之 CompactAnswer MUST 可讀，缺鍵一律視同
 * `null`，不得因缺鍵而中斷渲染或往返").
 *
 * Both tests below lock `applyCompactAnswerToState()`'s
 * `relation_identification` branch (annotation-workspace.config.js
 * :2722-2724), which today discards everything except `subj`/`rel`/`obj`:
 *   state.previewTriples = (mergedValue || []).map(function (tr) {
 *     return { subj: tr.subj, rel: tr.rel, obj: tr.obj };
 *   });
 *
 * This branch is reachable ONLY through the FR-044a demo-annotator-row
 * review fallback -- seedReviewRow(outKey, submission) at
 * annotation-workspace.config.js:3223 calls seedReviewState(outKey, answer,
 * true) with demoAnnotatorRow()'s canned answer ONLY when
 * getAnnotatorSubmission() (a real submission) is null; seedReviewState
 * only calls applyCompactAnswerToState() on that `isCompactAnswer === true`
 * path (annotation-workspace.config.js:3002-3022). A real annotator's own
 * submission takes the OTHER branch (isCompactAnswer: false, full
 * OutputAnswer/state restore via describeOutputAnswer) and never reaches
 * this function at all. Both tests therefore open the REVIEWER view of a
 * sample nobody has actually submitted an answer for, exactly like
 * annotation-workspace-relation-identification.spec.ts's own reviewer
 * tests and its `patchDataFile(page, 'annotation-workspace.data.js', ...)`
 * technique for overriding REVIEWER_MOCK_ROWS.
 */
test.describe('FR-098 §4 — an eight-key CompactAnswer rehydrates relType and all four offsets back onto the engine snapshot (T008)', () => {
  test('reviewing a demo-row answer with all eight keys regenerates relType and every offset on previewTriples, not derived from rel', async ({ page }) => {
    /* `rel` deliberately does NOT match `relType`'s semantics: '導致' means
     * "causes" in Chinese, while relType is set to 'prevents' -- a
     * mismatched pair, both drawn from T008's own configured
     * `relation_types` (task-detail.data.js:442). Any implementation that
     * tried to "recover" relType by deriving/translating it from the `rel`
     * display string would produce 'causes', not 'prevents', so the
     * exact-value assertion on relType below fails such an implementation.
     * subjStart is a real zero (高血壓 sits at offset 0 in T008/rel-001's
     * own text -- the same fixture position the AC-A test above and group 1
     * already established) -- Red-strength guard against a
     * `tr.subjStart || null` rehydration bug that would silently turn a
     * real `0` into `null`. */
    await patchDataFile(page, 'annotation-workspace.data.js', `
      var data = window.LabelSuiteAnnotationWorkspaceData;
      data.REVIEWER_MOCK_ROWS.T008['rel-001'][0].answers.relation_identification = [
        { subj: '高血壓', rel: '導致', relType: 'prevents', obj: '動脈硬化', subjStart: 0, subjEnd: 2, objStart: 14, objEnd: 17 }
      ];
    `);
    await page.goto(
      buildWorkspaceUrl({ task_id: 'T008', sample_id: 'rel-001', role: 'reviewer' })
    );
    await dismissGuidelineModal(page);

    const panel = page.getByTestId('ws-review-correct-relation_identification');
    await expect(panel.getByTestId('ws-ri-triple-item')).toHaveCount(1);

    const engineTriples = (await getState(page, 'previewTriples')) as EngineTriple[];
    expect(engineTriples).toHaveLength(1);
    const triple = engineTriples[0];

    /* Red-strength assertion for `relType`: a Green that backfills only the
     * four offsets and omits relType fails `toHaveProperty`; one that
     * backfills all eight keys but hardcodes `relType: null` passes the
     * property check but fails the exact-value check, because the source
     * of truth carried by the CompactAnswer is `'prevents'`. */
    expect(triple).toHaveProperty('relType');
    expect(triple.relType).toBe('prevents');
    expect(triple).toHaveProperty('subjStart');
    expect(triple).toHaveProperty('subjEnd');
    expect(triple).toHaveProperty('objStart');
    expect(triple).toHaveProperty('objEnd');
    expect(triple.subjStart).toBe(0);
    expect(triple.subjEnd).toBe(2);
    expect(triple.objStart).toBe(14);
    expect(triple.objEnd).toBe(17);
  });
});

test.describe('FR-098 §4 — an existing three-key-only CompactAnswer still rehydrates without breaking the triple row render (T008)', () => {
  test('reviewing an un-patched three-key demo-row answer defaults relType and all four offsets to null and still renders every triple', async ({ page }) => {
    /* Attach before navigation (see trackPageErrors's own doc comment):
     * Red-strength guard against an implementation that crashes while
     * rehydrating old three-key data instead of defaulting the missing
     * fields to null. */
    const pageErrors = trackPageErrors(page);

    /* T008's own REVIEWER_MOCK_ROWS['rel-001'][0] fixture is already the old
     * three-key shape (`{ subj, rel, obj }`, annotation-workspace.data.js
     * :1027-1036) -- no patch needed. Its `rel` field happens to already be
     * a valid relType enum value ('causes'), which makes this the sharpest
     * available catch for a "derive relType from rel" implementation: such
     * a bug would slip past a naive truthiness check by accident, but fails
     * the explicit `toBeNull()` below -- a missing key MUST become `null`,
     * never the coincidentally-matching `rel` value. */
    await page.goto(
      buildWorkspaceUrl({ task_id: 'T008', sample_id: 'rel-001', role: 'reviewer' })
    );
    await dismissGuidelineModal(page);

    const panel = page.getByTestId('ws-review-correct-relation_identification');
    /* The actual rendering assertion FR-098 §4's "不得因缺鍵而中斷渲染" calls
     * for: all four of rel-001's mock triples must still appear as rows,
     * not just a state-level null check. */
    await expect(panel.getByTestId('ws-ri-triple-item')).toHaveCount(4);
    await expect(panel.getByTestId('ws-ri-triple-item').first()).toContainText('高血壓');
    await expect(panel.getByTestId('ws-ri-triple-item').first()).toContainText('動脈硬化');

    const engineTriples = (await getState(page, 'previewTriples')) as EngineTriple[];
    expect(engineTriples).toHaveLength(4);
    engineTriples.forEach((triple) => {
      expect(triple).toHaveProperty('relType');
      expect(triple.relType).toBeNull();
      expect(triple).toHaveProperty('subjStart');
      expect(triple).toHaveProperty('subjEnd');
      expect(triple).toHaveProperty('objStart');
      expect(triple).toHaveProperty('objEnd');
      expect(triple.subjStart).toBeNull();
      expect(triple.subjEnd).toBeNull();
      expect(triple.objStart).toBeNull();
      expect(triple.objEnd).toBeNull();
    });

    assertNoPageErrors(pageErrors);
  });
});
