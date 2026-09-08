import { test, expect, type Page } from '@playwright/test';
import {
  buildWorkspaceUrl,
  dismissGuidelineModal,
  patchDataFile,
  selectWorkspaceText,
  skipGuidelineModal,
} from './_workspace-helpers';

/* issue #590 / OpenSpec change carry-relation-span-offsets, FR-098 §1-§3, §7.
 *
 * `relation_identification`'s engine snapshot (`previewTriples`,
 * task-config.engine.js) today only carries three DISPLAY strings per
 * triple (`subj`/`rel`/`obj`) -- the machine-readable position is thrown
 * away at the moment the triple is built. This spec locks the contract that
 * the Green task (1.2) must satisfy, for the two source shapes that ARE
 * expected to gain offsets and the two that MUST stay `null`:
 *
 *   FR-098 §1 "MUST 於既有 subj／rel／obj 顯示字串之外，另行攜帶機器可讀的
 *              主體與客體起訖四欄位 subjStart、subjEnd、objStart、objEnd"
 *   FR-098 §2 "起訖之來源僅限本身已攜帶位置資訊的兩種輸入形狀 -- (a) 工作區
 *              關係建構器之互動標記 ... (b) 資料集匯入之物件形狀三元組"
 *   FR-098 §3 "來源資料未攜帶位置資訊時，四個欄位 MUST 為 null。MUST NOT 以
 *              答案字串回原始文本做字串比對推得 offset"
 *   FR-098 §7 "gold 形狀 ... 內建示範資料之字串串接形狀 ... MUST 維持 null"
 *
 * task-config.engine.js is loaded as a shared, non-module script by BOTH
 * task-new.html's wizard preview and annotation-workspace.html (see the
 * latter's own script tag list): the two source shapes with position data
 * are exercised through the real annotation workspace (T008/rel-001, the
 * same fixture annotation-workspace-relation-identification.spec.ts already
 * uses); the two without are exercised one through a synthetic upload on
 * the task-new wizard (no `gold`-shape fixture exists in this repo yet) and
 * one through the built-in ABSA demo profile (T013/absa-001).
 *
 * All four cases are Red today: `subjStart`/`subjEnd`/`objStart`/`objEnd`
 * do not exist anywhere on a `previewTriples` entry, so every
 * `toHaveProperty` assertion below fails first, before any value check
 * runs.
 */

declare global {
  interface Window {
    state?: Record<string, unknown>;
    revalidateCurrentStep?: () => void;
  }
}

interface Triple {
  subj: string;
  rel: string;
  obj: string;
  relType?: string | null;
  subjStart?: number | null;
  subjEnd?: number | null;
  objStart?: number | null;
  objEnd?: number | null;
}

interface PreviewEntity {
  text: string;
  type?: string;
  start: number;
  end: number;
}

interface EntitySlot {
  start: number;
  end: number;
}

function getState(page: Page, key: string) {
  return page.evaluate((k) => window.state?.[k], key);
}

/* Every field-having assertion below is deliberately a strict `toBeNull()`
 * (never merely "falsy" or "no exception"): a naive Green implementation
 * that guesses an offset via `text.indexOf(subj)` would produce a real
 * number, and a real number is never `null` -- so the strict equality
 * check fails against that implementation too, not just against the
 * current all-missing-fields state. */
function expectAllOffsetsNull(triple: Triple) {
  expect(triple).toHaveProperty('subjStart');
  expect(triple).toHaveProperty('subjEnd');
  expect(triple).toHaveProperty('objStart');
  expect(triple).toHaveProperty('objEnd');
  expect(triple.subjStart).toBeNull();
  expect(triple.subjEnd).toBeNull();
  expect(triple.objStart).toBeNull();
  expect(triple.objEnd).toBeNull();
}

test.describe.configure({ retries: 2 });

test.beforeEach(async ({ page }) => {
  await skipGuidelineModal(page);
});

/* rel-001's own "triples" field is an output-role prefill (013 FR-003g-5),
 * same helper as annotation-workspace-relation-identification.spec.ts --
 * stripped only for the interactive-builder case so the triple under test
 * is unambiguously the one this test built. */
async function stripTriplePrefill(page: Page) {
  await patchDataFile(page, 'task-detail.data.js', `
    window.LabelSuiteTaskDetailData.profiles.T008.datasetRecords[0].triples = [];
  `);
}

test.describe('FR-098 §1, §2(a) — interactive relation builder carries offsets (T008)', () => {
  test('a triple added through the sequential builder carries integer offsets matching the marked entity positions', async ({ page }) => {
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

    const triples = (await getState(page, 'previewTriples')) as Triple[];
    const entities = (await getState(page, 'previewEntities')) as PreviewEntity[];
    expect(triples).toHaveLength(1);

    const subjEntity = entities.find((e) => e.text === '高血壓');
    const objEntity = entities.find((e) => e.text === '動脈硬化');
    expect(subjEntity, '高血壓 must be a marked entity in this fixture').toBeDefined();
    expect(objEntity, '動脈硬化 must be a marked entity in this fixture').toBeDefined();

    const triple = triples[0];
    expect(triple).toHaveProperty('subjStart');
    expect(triple).toHaveProperty('subjEnd');
    expect(triple).toHaveProperty('objStart');
    expect(triple).toHaveProperty('objEnd');
    expect(Number.isInteger(triple.subjStart)).toBe(true);
    expect(Number.isInteger(triple.subjEnd)).toBe(true);
    expect(Number.isInteger(triple.objStart)).toBe(true);
    expect(Number.isInteger(triple.objEnd)).toBe(true);
    expect(triple.subjStart).toBe((subjEntity as EntitySlot).start);
    expect(triple.subjEnd).toBe((subjEntity as EntitySlot).end);
    expect(triple.objStart).toBe((objEntity as EntitySlot).start);
    expect(triple.objEnd).toBe((objEntity as EntitySlot).end);

    // Display string contract (FR-098 §1) must not regress in the same change.
    expect(triple.subj).toContain('高血壓');
    expect(triple.obj).toContain('動脈硬化');
  });
});

test.describe('FR-098 §1, §2(b) — object-shape dataset import carries offsets (T008)', () => {
  test('every output-role-prefilled triple carries integer offsets copied from entity1/entity2', async ({ page }) => {
    await page.goto(buildWorkspaceUrl({ task_id: 'T008', sample_id: 'rel-001' }));
    await dismissGuidelineModal(page);
    await expect(page.getByTestId('ws-ri-triple-item')).toHaveCount(4);

    const triples = (await getState(page, 'previewTriples')) as Triple[];
    const sourceTriples = (await page.evaluate(() => {
      const raw = window.state?.datasetRawFirstRow as { triples?: unknown } | undefined;
      return raw?.triples;
    })) as Array<{ entity1: EntitySlot; entity2: EntitySlot }>;

    expect(sourceTriples.length).toBeGreaterThanOrEqual(4);
    expect(triples).toHaveLength(sourceTriples.length);

    triples.forEach((triple, i) => {
      const source = sourceTriples[i];
      expect(triple).toHaveProperty('subjStart');
      expect(triple).toHaveProperty('subjEnd');
      expect(triple).toHaveProperty('objStart');
      expect(triple).toHaveProperty('objEnd');
      expect(triple.subjStart).toBe(source.entity1.start);
      expect(triple.subjEnd).toBe(source.entity1.end);
      expect(triple.objStart).toBe(source.entity2.start);
      expect(triple.objEnd).toBe(source.entity2.end);
    });
  });
});

test.describe('FR-098 §3, §7(a) — gold plain-string shape stays null (task-new wizard upload)', () => {
  const TASK_NEW_URL = '/pages/task-management/task-new.html';
  /* No fixture in this repo has the `gold` tripShapeOf shape ({subj, rel,
   * obj} as plain strings with no position data) as an output-role
   * dataset column, so it is supplied here as an in-memory upload -- this
   * does not add a fixture file, it is a Buffer built inline. */
  const TEXT = '台北是台灣的首都，巴黎是法國的首都。';

  test('a gold-shape triples column leaves every offset field null and never string-matched against the text', async ({ page }) => {
    await page.goto(TASK_NEW_URL, { waitUntil: 'load' });
    await page.waitForFunction(
      () => document.querySelectorAll('#taskCategoryChips [data-key]').length > 0,
      null,
      { timeout: 30000 },
    );

    await page.fill('#taskNameInput', 'issue-590-gold-shape-null-offsets');
    await page.locator('#taskCategoryChips [data-key="sequence"]').click();
    await page.locator('#taskInputTypeChips [data-key="single_item"]').click();
    await page.locator('#taskOutputTypeChips [data-key="relation_identification"]').click();

    await page.locator('#datasetFileInput').setInputFiles({
      name: 'issue-590-gold-triples.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        {
          id: 'gold-590-001',
          text: TEXT,
          triples: [
            { subj: '台北', rel: 'capital_of', obj: '台灣' },
            { subj: '巴黎', rel: 'capital_of', obj: '法國' },
          ],
        },
      ])),
    });
    await expect(page.locator('.inline-dataset-preview-wrap')).toBeVisible();
    await page.locator('.inline-preview-role-select[aria-label="角色：text"]').selectOption('input');
    await page.locator('.inline-preview-role-select[aria-label="角色：triples"]').selectOption('output');

    await page.evaluate(() => {
      window.revalidateCurrentStep?.();
    });
    await page.waitForTimeout(200);
    await page.locator('#nextBtn').click();
    await expect(page.locator('#step2Panel')).not.toHaveClass(/hidden/);

    const triples = (await getState(page, 'previewTriples')) as Triple[];
    expect(triples).toHaveLength(2);
    // Sanity: this really is the plain-string `gold` shape, not some other
    // tripShapeOf branch silently matching instead.
    expect(triples[0].subj).toBe('台北');
    expect(triples[0].obj).toBe('台灣');

    triples.forEach((triple) => {
      expectAllOffsetsNull(triple);
      // FR-098 §3 hard rule: MUST NOT guess via string comparison. Both
      // subj values really do occur in TEXT, so a naive
      // `TEXT.indexOf(subj)` implementation would return a real (wrong or
      // right) index here rather than failing loudly -- the strict
      // `toBeNull()` above is what catches that; this just documents why.
      expect(TEXT.indexOf(triple.subj)).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('FR-098 §3, §7(b) — built-in demo string-concatenation shape stays null (T013/absa-001)', () => {
  test('the ABSA demo triples leave every offset field null', async ({ page }) => {
    await page.goto(buildWorkspaceUrl({ task_id: 'T013', sample_id: 'absa-001' }));
    await dismissGuidelineModal(page);

    const triples = (await getState(page, 'previewTriples')) as Triple[];
    expect(triples.length).toBeGreaterThanOrEqual(1);
    // Sanity: this is the string-concatenation shape (`subj` is
    // "<text>/<entity-name>", not a text-file substring nor a plain gold
    // string) -- guards against the fixture drifting to a different
    // tripShapeOf branch and this test silently testing the wrong thing.
    expect(triples[0].subj).toContain('/');

    triples.forEach((triple) => {
      expectAllOffsetsNull(triple);
    });
  });
});
