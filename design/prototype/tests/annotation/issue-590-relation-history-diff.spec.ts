import { test, expect, type Page } from '@playwright/test';
import {
  buildWorkspaceUrl,
  skipGuidelineModal,
  trackPageErrors,
  assertNoPageErrors,
} from './_workspace-helpers';

/* issue #590 / OpenSpec change carry-relation-span-offsets, tasks.md 3.1
 * (FR-098 §5, position-bearing per-entity diff for `relation_identification`).
 *
 * FR-098 §5 (spec 015): once `relation_identification` is registered as a
 * position-bearing output type, its span extraction MUST produce exactly two
 * entities per triple -- subject and object -- never a third one for `rel`
 * (the relation type / trigger word is a display field, not an alignable
 * span). Each span's label MUST be `role + '@' + relationKey`, where `role`
 * is `subj` or `obj` and `relationKey` is `relType` when non-empty, else the
 * `rel` display string. Embedding the relation key into the label is what
 * keeps two different relation types sharing the same subject/object start
 * from colliding into a single index-map entry -- WITHOUT it, indexSpans()
 * (annotation-history.js:186, keyed on `start + NUL + label`) would
 * silently drop one of the two triples' entities, exactly the way it drops
 * one of two SAME-relType triples today (FR-098 §5's own documented residual
 * collision -- not what these tests exercise; only the CROSS-relType case,
 * which a correct label format makes collision-free, is covered).
 *
 * Today (this file's Red state) `relation_identification` is absent from
 * SPAN_EXTRACTORS (annotation-history.js:162) and isPositionalOutput()
 * (annotation-history.js:182-184) therefore returns false for it, so
 * buildHistoryDiff() (annotation-workspace.config.js:1753-1764) falls back
 * to the plain-value path: one before/after string diff per triple set,
 * with no `data-diff-kind` attribute and no per-entity breakdown at all.
 * Every assertion below that inspects `data-diff-kind` or expects more than
 * one `.history-diff-item` therefore fails against that fallback.
 *
 * Offsets below are independently verified against T008/rel-001's own text
 * (task-detail.data.js:461) -- NOT copied from that fixture's own `entities`
 * array, which uses an inconsistent (non-half-open) offset convention for
 * this record. Using self-verified correct half-open `[start, end)` offsets
 * means the expected display text matches regardless of whether the future
 * SPAN_EXTRACTORS.relation_identification entry denormalizes `text` from
 * `tr.subj`/`tr.obj` directly (matching entity_recognition's own pattern) or
 * falls back to a dataset-text substring (matching sequence_tagging's
 * pattern) -- this file does not need to assume which.
 */

const TASK = 'T008';
const SAMPLE = 'rel-001';
const ANNOTATOR = 'kioleemg12';
/* task-detail.data.js T008/rel-001 text (verified via node substring, not
 * copied from the record's own `entities` offsets):
 * '高血壓若未妥善控制，可能導致動脈硬化，進而引發冠狀動脈心臟病或腦中風。長期服用降壓藥物如 Amlodipine 有助於控制血壓，降低併發症風險。'
 * text.substring(0,3)   === '高血壓'
 * text.substring(0,4)   === '高血壓若'
 * text.substring(14,18) === '動脈硬化'
 * text.substring(45,55) === 'Amlodipine'
 */

type Triple = {
  subj: string;
  rel: string;
  relType: string | null;
  obj: string;
  subjStart: number | null;
  subjEnd: number | null;
  objStart: number | null;
  objEnd: number | null;
};

async function seedTwoSnapshots(page: Page, before: Triple[], after: Triple[]) {
  await page.evaluate(
    (a: { task: string; sample: string; before: Triple[]; after: Triple[] }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (window as any).LabelSuiteAnnotationWorkspaceData;
      const payload = (triples: Triple[]) => ({
        previewState: { relation_identification: {} },
        previewTriples: triples,
      });
      const identity = { annotatorId: 'kioleemg12' };
      data.markSampleSaved(a.task, 'annotator', 'official_run', a.sample, payload(a.before), 'draft', identity);
      data.markSampleSubmitted(a.task, 'annotator', 'official_run', a.sample, payload(a.after), 'submit', identity);
    },
    { task: TASK, sample: SAMPLE, before, after }
  );
}

async function openHistory(page: Page) {
  await page.reload();
  await skipGuidelineModal(page);
  await page.getByTestId('ws-guideline-tab-history').click();
}

/* Newest-first panel, so the submit card is index 0. */
const latestCard = (page: Page) => page.locator('.history-item').first();

test.describe.configure({ retries: 2 });

test.describe('issue #590 -- relation_identification position-bearing history diff (FR-098 §5)', () => {
  test('a moved subject boundary plus a new triple render as one boundary (with before/after ranges) and two added entities', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: 0, subjEnd: 3, objStart: 14, objEnd: 18 },
      ],
      [
        /* subject boundary moved 3 -> 4 ('高血壓' -> '高血壓若'); object unchanged. */
        { subj: '高血壓若', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: 0, subjEnd: 4, objStart: 14, objEnd: 18 },
        /* a wholly new triple, reusing start=0 for its OBJECT role under a
           different relationKey than the first triple's subject -- this is
           NOT the cross-relType-same-role case (that is the next test); it
           only exercises "added", so a role@relationKey collision here would
           be a different bug than the one the next test targets. */
        { subj: 'Amlodipine', rel: '控制', relType: 'treats', obj: '高血壓', subjStart: 45, subjEnd: 55, objStart: 0, objEnd: 3 },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(3);

    const boundary = items.filter({ has: page.locator('[data-diff-kind="boundary"]') });
    await expect(boundary).toHaveCount(1);
    await expect(boundary).toContainText('subj@causes');
    await expect(boundary).toContainText('[0,3]');
    await expect(boundary).toContainText('[0,4]');
    await expect(boundary).toContainText('高血壓若');

    const added = items.filter({ has: page.locator('[data-diff-kind="added"]') });
    await expect(added).toHaveCount(2);

    const addedSubj = added.filter({ hasText: 'subj@treats' });
    await expect(addedSubj).toHaveCount(1);
    await expect(addedSubj).toContainText('Amlodipine');

    const addedObj = added.filter({ hasText: 'obj@treats' });
    await expect(addedObj).toHaveCount(1);
    await expect(addedObj).toContainText('高血壓');

    await expect(items.filter({ has: page.locator('[data-diff-kind="removed"]') })).toHaveCount(0);
    assertNoPageErrors(errors);
  });

  test('the same subject start under two different relation types lists both triples separately instead of one overwriting the other', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [],
      [
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: 0, subjEnd: 3, objStart: 14, objEnd: 18 },
        /* Same subject text AND same subjStart (0) as the triple above, but a
           different relType -- a label formula that drops relationKey (e.g.
           `role` alone) collides both subjects into the single indexSpans()
           key `0<NUL>subj`, silently losing one of the two triples' subject
           entity from the diff. */
        { subj: '高血壓', rel: '有助於控制', relType: 'treats', obj: 'Amlodipine', subjStart: 0, subjEnd: 3, objStart: 45, objEnd: 55 },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(4);

    const added = items.filter({ has: page.locator('[data-diff-kind="added"]') });
    await expect(added).toHaveCount(4);
    await expect(items.filter({ has: page.locator('[data-diff-kind="boundary"]') })).toHaveCount(0);
    await expect(items.filter({ has: page.locator('[data-diff-kind="removed"]') })).toHaveCount(0);

    const subjCauses = added.filter({ hasText: 'subj@causes' });
    await expect(subjCauses).toHaveCount(1);
    await expect(subjCauses).toContainText('高血壓');

    const objCauses = added.filter({ hasText: 'obj@causes' });
    await expect(objCauses).toHaveCount(1);
    await expect(objCauses).toContainText('動脈硬化');

    const subjTreats = added.filter({ hasText: 'subj@treats' });
    await expect(subjTreats).toHaveCount(1);
    await expect(subjTreats).toContainText('高血壓');

    const objTreats = added.filter({ hasText: 'obj@treats' });
    await expect(objTreats).toHaveCount(1);
    await expect(objTreats).toContainText('Amlodipine');

    assertNoPageErrors(errors);
  });

  test('a single new triple renders exactly two entities (subject and object), never a third one for the relation type or trigger word', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [],
      [
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: 0, subjEnd: 3, objStart: 14, objEnd: 18 },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    /* The hard lock: exactly two entities for one triple, not three. A span
       extractor that also emits a `rel` entry (with a fabricated or
       undefined start/end, since previewTriples carries no relStart/relEnd
       field at all under FR-098 §2) would fail this count. */
    await expect(items).toHaveCount(2);

    const added = items.filter({ has: page.locator('[data-diff-kind="added"]') });
    await expect(added).toHaveCount(2);
    await expect(items.filter({ has: page.locator('[data-diff-kind="boundary"]') })).toHaveCount(0);
    await expect(items.filter({ has: page.locator('[data-diff-kind="removed"]') })).toHaveCount(0);

    const subjItem = added.filter({ hasText: 'subj@causes' });
    await expect(subjItem).toHaveCount(1);
    await expect(subjItem).toContainText('高血壓');

    const objItem = added.filter({ hasText: 'obj@causes' });
    await expect(objItem).toHaveCount(1);
    await expect(objItem).toContainText('動脈硬化');

    /* Negative guard: the trigger word itself ('導致') must not surface as
       its own row -- it is a display string on the triple, not an alignable
       span (FR-098 §5). */
    await expect(items.filter({ hasText: '導致' })).toHaveCount(0);

    assertNoPageErrors(errors);
  });

  /* issue #590 / OpenSpec change carry-relation-span-offsets, tasks.md 3.3
   * (FR-098 §6, per-snapshot-pair fallback to plain-value comparison).
   *
   * FR-098 §6: the per-entity diff above is only trustworthy when BOTH the
   * before and after snapshot produced at least one triple with a real
   * offset. `hasComparablePositions()` (annotation-history.js:233) already
   * encodes that check and is exported, but as of 3.2 nothing calls it --
   * `buildHistoryDiff()` (annotation-workspace.config.js:1753) dispatches on
   * `isPositionalOutput()` alone, which is true for `relation_identification`
   * unconditionally once 3.2 registered its extractor. FR-098 §6's own
   * rationale: skipping this fallback does not merely "not improve" the two
   * known no-offset source shapes (gold plain-string triples,
   * task-config.engine.js:1867-1873; the built-in ABSA demo's string
   * concatenation, task-config.engine.js:1874-1880) -- it makes them WORSE
   * than before FR-098, degrading from "today's plain-value diff" to a
   * silent EMPTY diff, because every triple's index key
   * (`start + NUL + label`, annotation-history.js:218) collapses to the
   * same `"null" + NUL + label` on both sides whenever the relation key is
   * unchanged, so `diffPositional` sees identical keys with identical (null)
   * `end` values and emits nothing.
   *
   * The three tests below seed exactly that shape directly through
   * `data.markSampleSaved`/`markSampleSubmitted` (same seeding path 3.1
   * already established for this file) rather than driving the task-new
   * wizard UI, but every triple's field values are independently computed
   * from the SAME two engine branches / demo record FR-098 §7 names as the
   * known gap, so the shape itself is the one those branches actually
   * produce, not an invented one:
   *
   * - "gold" test: matches task-config.engine.js:1868-1873's `tripShape ===
   *   'gold'` branch output verbatim (subj/rel/obj passed through, relType
   *   from `relation_type`, all four offsets hard-`null`).
   * - "built-in demo" test: matches task-config.engine.js:1874-1880's
   *   `tripShape === 'absa'` branch output verbatim for T013's own
   *   `absa-001` record (task-detail.data.js) and T013's own
   *   `relation_identification` config (`relation_types: ['has_aspect',
   *   'has_opinion']`) and `entity_recognition` config (entity names
   *   `Target`/`Aspect`), producing `subj: 'Note 10 plus/Target'`, `obj:
   *   '過熱問題/Aspect'`, `rel: 'has_aspect'`, all four offsets `null` (that
   *   branch never sets `relType` at all, so this file writes it as
   *   explicit `null` per the same "hard-null over omitted key" convention
   *   task 1.2's evidence already used). These are rendered inside T008's
   *   workspace purely as a seeding host -- `buildHistoryDiff` and
   *   `SPAN_EXTRACTORS.relation_identification` read only the snapshot's
   *   own `previewTriples`/`previewState`, never the hosting task's config,
   *   so which task_id renders the panel does not change what is under
   *   test here.
   * - "mixed" test: one side reuses test 1's own already-verified
   *   `subjStart:0/subjEnd:3/objStart:14/objEnd:18`; the other side is the
   *   null-offset "gold" shape above. FR-098 §6 requires BOTH snapshots to
   *   have a comparable span before trusting the per-entity diff, so a
   *   real position on only one side must also fall back.
   *
   * All three keep each triple's relationKey (relType, since every triple
   * here sets one) IDENTICAL between before and after, and change only a
   * display-string field (`subj`/`obj`) -- so a correct implementation must
   * detect the change via the plain-value string compare, not via the
   * index-key machinery, which by construction cannot see it.
   *
   * Today (this test's Red state), the "gold" and "built-in demo" cases
   * degrade to a silently empty diff (`.history-diff-item` count 0, not the
   * expected 1), and the "mixed" case wrongly emits 4 position-tagged
   * add/remove rows (2 "removed" from the position-bearing side, 2 "added"
   * with null positions from the other) instead of collapsing to one
   * plain-value row -- both are the FR-098 §6 gap this task locks.
   */
  test('gold-shaped plain-string triples with no offsets on either snapshot fall back to a single plain-value diff line instead of degrading to an empty diff', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: null, subjEnd: null, objStart: null, objEnd: null },
      ],
      [
        /* Only the subject's display text changes; relationKey ('causes')
           is unchanged on both sides, so the index-key path sees no change
           at all and would silently drop this edit without the fallback. */
        { subj: '高血壓合併症', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: null, subjEnd: null, objStart: null, objEnd: null },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(1);

    await expect(items.filter({ has: page.locator('[data-diff-kind]') })).toHaveCount(0);
    await expect(items).toContainText('relation_identification:');
    await expect(items).toContainText('高血壓 -> 導致 -> 動脈硬化');
    await expect(items).toContainText('高血壓合併症 -> 導致 -> 動脈硬化');
    await expect(items).toContainText('→');

    assertNoPageErrors(errors);
  });

  test('a built-in ABSA demo relation (string-concatenated, no offsets) also falls back to a single plain-value diff line instead of an empty diff', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [
        /* task-config.engine.js:1874-1880 absa branch output for T013's
           absa-001 gold_triplets[0] (target_text 'Note 10 plus', aspect_text
           '過熱問題') under T013's own entity names (Target/Aspect) and
           relation_types[0] ('has_aspect'). relType is explicit null: the
           absa branch never sets that key at all. */
        { subj: 'Note 10 plus/Target', rel: 'has_aspect', relType: null, obj: '過熱問題/Aspect', subjStart: null, subjEnd: null, objStart: null, objEnd: null },
      ],
      [
        /* Same relationKey ('has_aspect', since relType stays null on both
           sides); only the aspect's concatenated display text is corrected. */
        { subj: 'Note 10 plus/Target', rel: 'has_aspect', relType: null, obj: '過熱與當機問題/Aspect', subjStart: null, subjEnd: null, objStart: null, objEnd: null },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(1);

    await expect(items.filter({ has: page.locator('[data-diff-kind]') })).toHaveCount(0);
    await expect(items).toContainText('relation_identification:');
    await expect(items).toContainText('Note 10 plus/Target -> has_aspect -> 過熱問題/Aspect');
    await expect(items).toContainText('Note 10 plus/Target -> has_aspect -> 過熱與當機問題/Aspect');
    await expect(items).toContainText('→');

    assertNoPageErrors(errors);
  });

  test('a snapshot pair where only one side has comparable positions also falls back to a single plain-value diff line instead of mismatched position-tagged rows', async ({ page }) => {
    const errors = trackPageErrors(page);
    await skipGuidelineModal(page);
    await page.goto(buildWorkspaceUrl({ task_id: TASK, sample_id: SAMPLE, annotator_id: ANNOTATOR }));

    await seedTwoSnapshots(
      page,
      [
        /* Same offsets as test 1's own before-snapshot triple, already
           independently verified against T008/rel-001's text. */
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化', subjStart: 0, subjEnd: 3, objStart: 14, objEnd: 18 },
      ],
      [
        /* relationKey ('causes') unchanged; the object's display text is
           corrected AND this snapshot carries no offsets at all, so only
           one side (the "before" one) has a comparable position. */
        { subj: '高血壓', rel: '導致', relType: 'causes', obj: '動脈硬化併發症', subjStart: null, subjEnd: null, objStart: null, objEnd: null },
      ]
    );
    await openHistory(page);

    const items = latestCard(page).locator('.history-diff-item');
    await expect(items).toHaveCount(1);

    await expect(items.filter({ has: page.locator('[data-diff-kind]') })).toHaveCount(0);
    await expect(items).toContainText('relation_identification:');
    await expect(items).toContainText('高血壓 -> 導致 -> 動脈硬化');
    await expect(items).toContainText('高血壓 -> 導致 -> 動脈硬化併發症');
    await expect(items).toContainText('→');

    assertNoPageErrors(errors);
  });
});
