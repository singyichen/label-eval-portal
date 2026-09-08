/*
 * Traceability: specs/task-management/014-task-detail/spec.md
 *   FR-010o, FR-010o-1, FR-010q, FR-014a, SC-018
 */
import { test, expect } from '@playwright/test';

const TASK_DETAIL_URL = '/pages/task-management/task-detail.html';

test.describe('Task detail sampling edit state', () => {
  test('shows separated sampling section with view/edit mode', async ({ page }) => {
    await page.goto(TASK_DETAIL_URL);

    await expect(page.locator('#executionTitle')).toHaveText('任務狀態與執行控制');
    await expect(page.locator('#samplingTitle')).toHaveText('抽樣設定');

    const editBtn = page.locator('#samplingEditBtn');
    const saveBtn = page.locator('#samplingSaveBtn');
    const cancelBtn = page.locator('#samplingCancelBtn');

    await expect(editBtn).toBeVisible();
    await expect(editBtn).toBeEnabled();
    await expect(saveBtn).toBeHidden();
    await expect(cancelBtn).toBeHidden();
    await expect(page.locator('#samplingSummaryView')).toBeVisible();
    await expect(page.locator('#labelTrialRoundControl')).toHaveText('試標回合');
    await expect(page.locator('#valueTrialRoundControl')).not.toBeEmpty();
    await expect(page.locator('#samplingEditForm')).toHaveClass(/hidden/);

    // IAA_METHOD_ENUM dropdown removed (task-management-014 IAA strategy v2).
    await expect(page.locator('#iaaMethodSelect')).toHaveCount(0);
    await expect(page.locator('#targetAgreementInput')).toHaveCount(0);

    await editBtn.click();

    await expect(editBtn).toBeHidden();
    await expect(saveBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();
    await expect(page.locator('#samplingSummaryView')).toHaveClass(/hidden/);
    await expect(page.locator('#samplingEditForm')).not.toHaveClass(/hidden/);
    await expect(page.locator('#samplingValue')).toBeEnabled();
    await expect(page.locator('#samplingRoundInput')).toHaveCount(0);
    await expect(page.locator('#minAnnotatorsInput')).toBeEnabled();
    await expect(page.locator('#isolationToggle')).toBeEnabled();

    const firstRowFields = page.locator('#samplingEditForm .sampling-fields').first().locator('.field-group');
    await expect(firstRowFields).toHaveCount(2);
    await expect(firstRowFields.nth(0).locator('label')).toContainText('抽樣筆數');
    await expect(firstRowFields.nth(1).locator('label')).toContainText('最少標記者數');
    await expect(page.locator('#samplingValueHint')).toHaveClass(/tooltip-bubble/);
    await expect(page.locator('#samplingValueHint')).toHaveText('筆數需 >= 1 且 < 資料集總筆數');
    await expect(page.locator('#samplingValueHint')).toBeHidden();

    await page.locator('#samplingValueHelp').hover();
    await expect(page.locator('#samplingValueHint')).toBeVisible();

    // T001 (default seed) has a single `single_label` output — one read-only
    // registry-driven row with an editable target-agreement input.
    const iaaRows = page.locator('#samplingIaaEditRows .sampling-iaa-type-row');
    await expect(iaaRows).toHaveCount(1);
    await expect(iaaRows.nth(0)).toContainText("Krippendorff's Alpha（nominal）");
    await expect(iaaRows.nth(0).locator('.iaa-override-input')).toHaveValue('0.80');

    const samplingBox = await firstRowFields.nth(0).boundingBox();
    const minAnnotatorsBox = await firstRowFields.nth(1).boundingBox();

    expect(samplingBox).not.toBeNull();
    expect(minAnnotatorsBox).not.toBeNull();
    expect(Math.abs((samplingBox?.y ?? 0) - (minAnnotatorsBox?.y ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.abs(((samplingBox?.y ?? 0) + (samplingBox?.height ?? 0)) - ((minAnnotatorsBox?.y ?? 0) + (minAnnotatorsBox?.height ?? 0)))).toBeLessThanOrEqual(2);
  });

  test('renders one read-only IAA metric row per output type, sourced from OUTPUT_TYPE_IAA_REGISTRY', async ({ page }) => {
    // T010 = entity_recognition + relation_identification.
    await page.goto(`${TASK_DETAIL_URL}?task_id=T010`);

    const summaryRows = page.locator('#samplingIaaSummaryList .kv-dl-row');
    await expect(summaryRows).toHaveCount(2);
    await expect(summaryRows.nth(0)).toContainText('Span F1（嚴格）');
    await expect(summaryRows.nth(0)).toContainText('0.80');
    await expect(summaryRows.nth(1)).toContainText('Triple F1');
    await expect(summaryRows.nth(1)).toContainText('0.75');

    await page.locator('#samplingEditBtn').click();

    const iaaRows = page.locator('#samplingIaaEditRows .sampling-iaa-type-row');
    await expect(iaaRows).toHaveCount(2);
    await expect(iaaRows.nth(0)).toContainText('Span F1（嚴格）');
    await expect(iaaRows.nth(0).locator('.iaa-override-input')).toHaveValue('0.80');
    await expect(iaaRows.nth(1)).toContainText('Triple F1');
    await expect(iaaRows.nth(1).locator('.iaa-override-input')).toHaveValue('0.75');
  });

  test('shows not-applicable IAA state for free_text outputs with no override input', async ({ page }) => {
    // T009 = free_text only (no automatic IAA metric).
    await page.goto(`${TASK_DETAIL_URL}?task_id=T009`);

    const summaryRows = page.locator('#samplingIaaSummaryList .kv-dl-row');
    await expect(summaryRows).toHaveCount(1);
    await expect(summaryRows.nth(0)).toContainText('不適用');

    await page.locator('#samplingEditBtn').click();

    const iaaRows = page.locator('#samplingIaaEditRows .sampling-iaa-type-row');
    await expect(iaaRows).toHaveCount(1);
    await expect(iaaRows.nth(0)).toContainText('不適用');
    await expect(iaaRows.nth(0).locator('.iaa-override-input')).toHaveCount(0);
  });

  test('edits per-output-type target agreement override, validates 0..1 bounds, and persists on save', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T001`);
    await page.locator('#samplingEditBtn').click();

    const overrideInput = page.locator('#samplingIaaEditRows .iaa-override-input').first();
    await overrideInput.fill('0.85');
    await page.locator('#samplingSaveBtn').click();

    await expect(page.locator('#samplingIaaSummaryList .kv-dl-row').first()).toContainText('0.85');

    await page.locator('#samplingEditBtn').click();
    await page.locator('#samplingIaaEditRows .iaa-override-input').first().fill('1.5');
    await page.locator('#samplingSaveBtn').click();

    await expect(page.locator('#samplingError')).toHaveText('目標 IAA 需介於 0..1。');
    await expect(page.locator('#samplingError')).toHaveClass(/show/);
  });

  test('translates IAA metric labels and not-applicable text to English', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T009`);

    // #langToggle is in static markup but its listener binds only after every
    // tab panel fetch resolves; the summary row is rendered later still, so
    // waiting for it closes the click-before-bind race seen under CI load.
    await expect(page.locator('#samplingIaaSummaryList .kv-dl-row').first()).toContainText('不適用');

    await page.locator('#langToggle').click();

    await expect(page.locator('#samplingIaaSummaryList .kv-dl-row').first()).toContainText('Not applicable');

    await page.locator('#samplingEditBtn').click();
    await expect(page.locator('#samplingIaaEditRows .sampling-iaa-type-row').first()).toContainText('Not applicable');
  });

  // openspec/changes/seq-tagging-span-export-metrics/specs/dataset/017-dataset-analysis-detail/spec.md
  //   FR-012L (line 111): sequence_tagging MUST register its primary metric as
  //   span-unit u-α in OUTPUT_TYPE_IAA_REGISTRY, with an empty threshold field;
  //   the legacy Token-level Alpha / IAA_THRESHOLD_TOKEN = 0.75 pairing is
  //   retired (BREAKING) and MUST NOT be reintroduced under any name.
  //   FR-043 §2 (line 70): the registry / UI MUST NOT smuggle in any default,
  //   fallback, or suggested threshold number for an IAA_UNCALIBRATED_TYPES
  //   member such as sequence_tagging.
  // T006 (design/prototype/pages/task-management/task-detail.data.js:333) is a
  // single-output sequence_tagging task, so its sampling summary/edit rows are
  // driven by exactly one OUTPUT_TYPE_IAA_REGISTRY entry.
  test('registers sequence_tagging as span-unit u-alpha with no leaked threshold in the sampling summary (FR-012L, FR-043 §2)', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T006`);

    const summaryRows = page.locator('#samplingIaaSummaryList .kv-dl-row');
    await expect(summaryRows).toHaveCount(1);

    const summaryValue = summaryRows.nth(0).locator('.kv-dl-value');
    // The legacy Token-level Alpha entry renders "...（目標 IAA 0.75）"; a
    // span-unit u-α entry with an empty threshold field must not render any
    // target-agreement number at all, so this string must never appear.
    await expect(summaryValue).not.toContainText('0.75');
    // Positive literal check: the registered primary metric name must be
    // Krippendorff's unitizing alpha (u-α) ...
    await expect(summaryValue).toContainText(/u-α/i);
    // ... explicitly computed at the span level, not the retired token level.
    await expect(summaryValue).toContainText(/span/i);
  });

  test('leaves the target-agreement override input empty for sequence_tagging in the sampling edit form (FR-012L, FR-043 §2)', async ({ page }) => {
    await page.goto(`${TASK_DETAIL_URL}?task_id=T006`);
    await page.locator('#samplingEditBtn').click();

    const iaaRows = page.locator('#samplingIaaEditRows .sampling-iaa-type-row');
    await expect(iaaRows).toHaveCount(1);

    const row = iaaRows.nth(0);
    // FR-012L: "該型別的門檻欄位 MUST 為空" — sequence_tagging has no
    // threshold to override, so no `.iaa-override-input` may be rendered at
    // all (mirrors the free_text notApplicable row's no-input treatment,
    // without reusing free_text's "not applicable" wording per FR-043 §3).
    await expect(row.locator('.iaa-override-input')).toHaveCount(0);
    // Even with the input removed, the row's own text (metric name / hint)
    // must not leak the retired 0.75 default threshold value anywhere.
    await expect(row).not.toContainText('0.75');
    // The row must still name the new primary metric literally as u-α.
    await expect(row).toContainText(/u-α/i);
  });
});
