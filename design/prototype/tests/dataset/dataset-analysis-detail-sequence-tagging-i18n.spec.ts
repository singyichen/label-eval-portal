/**
 * Traceability: specs/dataset/017-dataset-analysis-detail/spec.md
 *   FR-012L, FR-035, FR-036, FR-043 (AC-3.7, AC-3.18, AC-3.13, AC-3.14)
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ retries: 2 });

const DETAIL_URL = '/pages/dataset/dataset-analysis-detail.html?task_id=T103';

async function gotoWithLang(page: Page, lang: 'zh' | 'en', tab: 'stats' | 'quality') {
  await page.addInitScript((storedLang: 'zh' | 'en') => {
    window.localStorage.setItem('labelsuite.lang', storedLang);
  }, lang);

  await page.goto(`${DETAIL_URL}&tab=${tab}`);
}

test.describe('Dataset analysis detail sequence_tagging i18n', () => {
  test('renders sequence_tagging stats panel in zh', async ({ page }) => {
    await gotoWithLang(page, 'zh', 'stats');

    await expect(page.locator('#bcCurrent')).toHaveText('產品評論序列標記');
    await expect(page.locator('#pageTitle')).toHaveText('任務詳情');
    await expect(page.locator('#pageSubtitle')).toHaveText('檢視統計總覽與品質監控');
    await expect(page.locator('#statsSeqTagDistTitle')).toHaveText('標籤類型分佈');
    await expect(page.locator('#statsSeqTagDistDesc')).toHaveText('各標籤類型在已提交標記片段中的筆數與比例');
  });

  test('renders sequence_tagging stats panel in en without mixed Chinese labels', async ({ page }) => {
    await gotoWithLang(page, 'en', 'stats');

    const tagDistribution = page.locator('section[aria-labelledby="statsSeqTagDistTitle"]');

    await expect(page.locator('#bcCurrent')).toHaveText('Product Review Sequence Tagging');
    await expect(page.locator('#pageTitle')).toHaveText('Task detail');
    await expect(page.locator('#pageSubtitle')).toHaveText('Review statistics and quality monitoring');
    await expect(page.locator('#statsSeqTagDistTitle')).toHaveText('Label Type Distribution');
    await expect(tagDistribution).not.toContainText(/[標記類型分佈全體]/);
  });

  test('renders sequence_tagging quality panel in zh: u-alpha primary metric, no threshold, pairwise F1 divergence, f1_to_merged_reference ranking', async ({ page }) => {
    await gotoWithLang(page, 'zh', 'quality');

    await expect(page.locator('#bcCurrent')).toHaveText('產品評論序列標記');

    const qualityContainer = page.locator('#qualityReady');
    const iaaPanel = page.locator('section[aria-labelledby="iaaTitle"]');
    const lowConsistencySection = page.locator('section[aria-labelledby="lowConsistencyTitle"]');
    const rankingSection = page.locator('section[aria-labelledby="rankingTitle"]');

    // FR-012L / AC-3.7: primary metric is Krippendorff u-α, computation unit is span.
    await expect(page.locator('#iaaMethodName')).toContainText(/u-α/i);
    await expect(page.locator('.iaa-method-row')).toContainText(/span/i);

    // AC-3.7: `Token-level Alpha` wording, `IAA_THRESHOLD_TOKEN`, and any threshold value must be gone.
    await expect(qualityContainer).not.toContainText('Token-level Alpha');
    await expect(qualityContainer).not.toContainText('IAA_THRESHOLD_TOKEN');
    await expect(iaaPanel.locator('.iaa-threshold-row')).toHaveCount(0);
    await expect(iaaPanel).not.toContainText(/門檻\s*0?\.\d+/);
    await expect(iaaPanel).not.toContainText(/通過|未達/);
    await expect(iaaPanel.locator('[class*="pass"], [class*="fail"]')).toHaveCount(0);

    // AC-3.7: the "O-tag masking" rule (or any equivalent wording) no longer applies to span-based u-α.
    await expect(page.locator('#seqTagMaskingNote')).toHaveCount(0);
    await expect(iaaPanel).not.toContainText(/遮罩/);

    // FR-043 / AC-3.18: neutral "pending empirical calibration" note, textually distinct from free_text's
    // "不適用—由審核員評估" (IAA_GATE_EXCLUDED_TYPES semantics must not be reused for IAA_UNCALIBRATED_TYPES).
    const calibrationNote = page.locator('#seqTagCalibrationNote');
    await expect(calibrationNote).toContainText('待實證校準');
    await expect(calibrationNote).not.toContainText('不適用');

    // AC-3.18: ranking still renders for the uncalibrated type (only the threshold judgment is withheld).
    await expect(page.locator('#rankingTitle')).toHaveText('標記員品質排名');

    // FR-035 / AC-3.13: divergence metric is pairwise_f1; no token-unit disagreement wording remains.
    await expect(lowConsistencySection).not.toContainText('non_o_token_disagreement_rate');
    await expect(lowConsistencySection).not.toContainText(/\d+\s*個?\s*token/i);
    await expect(lowConsistencySection).toContainText(/pairwise/i);
    await expect(lowConsistencySection).toContainText(/F1/);

    // FR-036 / AC-3.14: ranking metric is f1_to_merged_reference (same wording as entity_recognition).
    const rankMetricCells = rankingSection.locator('td[data-i18n="sequenceTaggingListRank.rankMetricName"]');
    await expect(rankMetricCells.first()).toHaveText('與合併聚合參考值 F1');
    await expect(rankingSection).not.toContainText('token_majority_agreement_rate');
    await expect(rankingSection).not.toContainText('與多數決 token 標記一致率');
  });

  test('renders sequence_tagging quality panel in en, including type-scoped low-consistency / ranking / boundary sections', async ({ page }) => {
    await gotoWithLang(page, 'en', 'quality');

    await expect(page.locator('#bcCurrent')).toHaveText('Product Review Sequence Tagging');

    // FR-035/FR-036/FR-037: sequence_tagging is in-scope for all three type-scoped panels.
    await expect(page.locator('#lowConsistencyTitle')).toHaveText('Low-consistency Sample List');
    await expect(page.locator('#rankingTitle')).toHaveText('Annotator Quality Ranking');
    await expect(page.locator('#boundaryTitle')).toHaveText('Boundary Disagreement Analysis');

    // Ordering: IAA card -> low-consistency -> ranking -> boundary -> shared 區塊B (spec.md:316).
    const titles = await page.locator('#qualityReady .panel .panel-title').allTextContents();
    expect(titles.indexOf('Low-consistency Sample List')).toBeGreaterThan(titles.indexOf('IAA Report'));
    expect(titles.indexOf('Annotator Quality Ranking')).toBeGreaterThan(titles.indexOf('Low-consistency Sample List'));
    expect(titles.indexOf('Boundary Disagreement Analysis')).toBeGreaterThan(titles.indexOf('Annotator Quality Ranking'));
    expect(titles.indexOf('Anomaly Detection')).toBeGreaterThan(titles.indexOf('Boundary Disagreement Analysis'));

    const qualityContainer = page.locator('#qualityReady');
    const iaaPanel = page.locator('section[aria-labelledby="iaaTitle"]');
    const lowConsistencySection = page.locator('section[aria-labelledby="lowConsistencyTitle"]');
    const rankingSection = page.locator('section[aria-labelledby="rankingTitle"]');

    // FR-012L / AC-3.7: primary metric is Krippendorff u-α, computation unit is span.
    await expect(page.locator('#iaaMethodName')).toContainText(/u-α/i);
    await expect(page.locator('.iaa-method-row')).toContainText(/span/i);

    // AC-3.7: `Token-level Alpha` wording, `IAA_THRESHOLD_TOKEN`, and any threshold value must be gone.
    await expect(qualityContainer).not.toContainText('Token-level Alpha');
    await expect(qualityContainer).not.toContainText('IAA_THRESHOLD_TOKEN');
    await expect(iaaPanel.locator('.iaa-threshold-row')).toHaveCount(0);
    await expect(iaaPanel).not.toContainText(/Threshold\s*0?\.\d+/i);
    await expect(iaaPanel).not.toContainText(/\bPass\b|\bFail\b/);
    await expect(iaaPanel.locator('[class*="pass"], [class*="fail"]')).toHaveCount(0);

    // AC-3.7: the "O-tag masking" rule (or any equivalent wording) no longer applies to span-based u-α.
    await expect(page.locator('#seqTagMaskingNote')).toHaveCount(0);
    await expect(iaaPanel).not.toContainText(/masking/i);

    // FR-043 / AC-3.18: neutral "pending empirical calibration" note, textually distinct from free_text's
    // "Not applicable — assessed by reviewer" (IAA_GATE_EXCLUDED_TYPES semantics must not be reused for
    // IAA_UNCALIBRATED_TYPES).
    const calibrationNote = page.locator('#seqTagCalibrationNote');
    await expect(calibrationNote).toContainText(/calibrat/i);
    await expect(calibrationNote).not.toContainText(/not applicable/i);

    // FR-035 / AC-3.13: divergence metric is pairwise_f1; no token-unit disagreement wording remains.
    await expect(lowConsistencySection).not.toContainText('non_o_token_disagreement_rate');
    await expect(lowConsistencySection).not.toContainText(/\d+\s*tokens?\b/i);
    await expect(lowConsistencySection).toContainText(/pairwise/i);
    await expect(lowConsistencySection).toContainText(/F1/);

    // FR-036 / AC-3.14: ranking metric is f1_to_merged_reference (same wording as entity_recognition).
    const rankMetricCells = rankingSection.locator('td[data-i18n="sequenceTaggingListRank.rankMetricName"]');
    await expect(rankMetricCells.first()).toHaveText('F1 vs. merged aggregate reference');
    await expect(rankingSection).not.toContainText('token_majority_agreement_rate');
    await expect(rankingSection).not.toContainText('Token majority agreement rate');
  });
});
