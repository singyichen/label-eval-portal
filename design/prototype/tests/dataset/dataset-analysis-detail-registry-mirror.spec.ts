/**
 * Detail TASK_META mirrors the list's 13-task registry (issue #183 audit).
 *
 * Before the fix the detail page carried an unrelated 9-task fixture set:
 * shared ids resolved to contradictory titles/output types (list T001
 * "醫療文本情感分類" opened as "新聞標題多標籤分類") and list-only ids
 * (T010–T013) silently fell back to the default task.
 */
import { test, expect } from '@playwright/test';

const LIST_URL = '/pages/dataset/dataset-analysis-list.html';
const DETAIL_URL = '/pages/dataset/dataset-analysis-detail.html';

test.describe('Dataset detail — registry mirror coherence', () => {
  test('opening the first list row shows the same task name on the detail page', async ({ page }) => {
    await page.goto(LIST_URL);
    const firstRow = page.locator('#taskTableBody tr.task-row').first();
    const listName = (await firstRow.locator('.task-name-cell').innerText()).trim();

    await firstRow.click();
    await page.waitForURL(/dataset-analysis-detail\.html\?task_id=/);
    await expect(page.locator('#bcCurrent')).toHaveText(listName);
  });

  test('a list-only composite id (T013) resolves to its own entry instead of the default task', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T013&tab=quality`);
    await expect(page.locator('#bcCurrent')).toHaveText('ABSA + 情緒回歸（YouTube 留言）');
    await expect(page).toHaveURL(/task_id=T013/);
  });

  test('a two-output registry id (T010) keeps its id and title', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T010&tab=stats`);
    await expect(page.locator('#bcCurrent')).toHaveText('醫療實體與關係辨識');
    await expect(page).toHaveURL(/task_id=T010/);
  });

  test('an unknown id redirects to the list with an error toast (issue #261 drift, FR-002)', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T999`);
    await page.waitForURL(/dataset-analysis-list\.html/);
    await expect(page.locator('#toast')).toHaveClass(/toast-error/);
    await expect(page.locator('#toast')).toHaveClass(/visible/);
    await expect(page.locator('#toastMsg')).toHaveText('找不到指定的任務，或您沒有該任務的存取權限。');
  });

  test('a missing task_id redirects to the list with an error toast (issue #261 drift, FR-002)', async ({ page }) => {
    await page.goto(DETAIL_URL);
    await page.waitForURL(/dataset-analysis-list\.html/);
    await expect(page.locator('#toast')).toHaveClass(/toast-error/);
  });
});

/**
 * Task-level composite IAA badge denominator must exclude both
 * IAA_GATE_EXCLUDED_TYPES (free_text) and IAA_UNCALIBRATED_TYPES
 * (sequence_tagging, spec 017 FR-024A/FR-013/FR-043, AC-3.9/AC-3.8).
 *
 * No shipped registry task (T001–T017, T101–T109) combines sequence_tagging
 * with a thresholded output type, so these exercise the real
 * computeCompositeBadge()/compositeBadgeText()/applyRouteTask() functions
 * with a synthetic taskMeta — same technique already established by
 * dataset-analysis-detail-composite-badge.spec.ts:125-146 for the
 * pending-state branch, which likewise has no shipped fixture.
 */
type CompositeBadgeResult = { state: string; x: number | null; y: number; excludedCount: number };

async function computeBadge(
  page: import('@playwright/test').Page,
  taskMeta: { outputs: string[]; iaaData: Record<string, { pass?: boolean; n?: number }> }
): Promise<{ result: CompositeBadgeResult; text: string }> {
  const payload = await page.evaluate((meta) => {
    const w = window as unknown as {
      computeCompositeBadge: (m: unknown) => CompositeBadgeResult;
      compositeBadgeText: (r: unknown) => string;
    };
    const result = w.computeCompositeBadge(meta);
    const text = w.compositeBadgeText(result);
    return JSON.stringify({ result, text });
  }, taskMeta);
  return JSON.parse(payload) as { result: CompositeBadgeResult; text: string };
}

test.describe('Dataset detail — composite badge denominator excludes uncalibrated types (AC-3.9, AC-3.8)', () => {
  test('AC-3.9: x/y denominator excludes both gate-excluded and uncalibrated types, and the exclusion suffix counts both sets', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T001&tab=quality`);

    // single_label has a real threshold and passes; sequence_tagging is
    // IAA_UNCALIBRATED_TYPES and free_text is IAA_GATE_EXCLUDED_TYPES — both
    // MUST be excluded from x and y, and BOTH must be reflected in the
    // "N 型排除" suffix count (N = 2, not 1).
    const { result, text } = await computeBadge(page, {
      outputs: ['single_label', 'sequence_tagging', 'free_text'],
      iaaData: {
        single_label: { pass: true, n: 20 },
        sequence_tagging: { pass: true, n: 18 },
      },
    });

    expect(result.y).toBe(1);
    expect(result.x).toBe(1);
    expect(result.excludedCount).toBe(2);
    expect(result.state).toBe('pass');
    expect(text).toBe('1/1 達標 · 2 型排除');
  });

  test('AC-3.9: task-level summary is not_applicable (never 0/0) when every output type is gate-excluded or uncalibrated', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T001&tab=quality`);

    const { result, text } = await computeBadge(page, {
      outputs: ['sequence_tagging', 'free_text'],
      iaaData: { sequence_tagging: { pass: true, n: 18 } },
    });

    expect(result.y).toBe(0);
    expect(result.state).toBe('not_applicable');
    expect(text).toBe('不適用');
    expect(text).not.toMatch(/\d+\/\d+/);
  });

  test('AC-3.8: sequence_tagging renders a distinct neutral note from free_text and neither carries a pass/fail color', async ({ page }) => {
    await page.goto(`${DETAIL_URL}?task_id=T001&tab=quality`);

    await page.evaluate((taskMeta) => {
      const w = window as unknown as {
        TASK_META: Record<string, unknown>;
        applyRouteTask: (id: string) => Promise<unknown>;
      };
      w.TASK_META['RT-AC38'] = taskMeta;
      return w.applyRouteTask('RT-AC38');
    }, {
      outputs: ['sequence_tagging', 'free_text'],
      iaaData: { sequence_tagging: { pass: true, n: 18 } },
      title: { zh: 'AC-3.8 合成任務', en: 'AC-3.8 synthetic task' },
    });

    // sequence_tagging is outputs[0] (primary, mounted in full) here, so its
    // FR-043 calibration note keeps its un-namespaced id.
    const primaryNote = page.locator('section[aria-labelledby="iaaTitle"] .group-avg-note');
    // free_text is outputs[1] (secondary, via buildSecondaryIaaBlock).
    const secondaryNote = page.locator('section[data-output-type="free_text"] .iaa-not-applicable-note p').first();

    await expect(primaryNote).toContainText('待實證校準');
    await expect(secondaryNote).toHaveText('不適用—由審核員評估');

    // AC-3.8 §2: the sequence_tagging block MUST still show its primary
    // metric's point estimate (u-alpha), not just the neutral note — a
    // wrong implementation that blanked the score card while keeping the
    // calibration text would otherwise still pass the assertion above.
    const primaryValue = page
      .locator('section[aria-labelledby="iaaTitle"] .iaa-score-card .iaa-card-value')
      .first();
    await expect(primaryValue).toBeVisible();
    expect((await primaryValue.innerText()).trim()).toMatch(/^\d+(\.\d+)?$/);

    const primaryText = await primaryNote.innerText();
    const secondaryText = await secondaryNote.innerText();
    expect(primaryText).not.toBe(secondaryText);

    // AC-3.8 §4: the sequence_tagging block MUST NOT reuse the free_text
    // wording. `!==` above is only a necessary condition (e.g. renaming
    // free_text's copy, or appending this string alongside the calibration
    // note, would still satisfy inequality) — assert the retired string is
    // literally absent from the primary section.
    await expect(page.locator('section[aria-labelledby="iaaTitle"]')).not.toContainText(
      '不適用—由審核員評估'
    );

    await expect(
      page.locator('section[aria-labelledby="iaaTitle"] .pass, section[aria-labelledby="iaaTitle"] .fail')
    ).toHaveCount(0);
    await expect(
      page.locator('section[data-output-type="free_text"] .pass, section[data-output-type="free_text"] .fail')
    ).toHaveCount(0);
  });
});
