import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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

  test('renders sequence_tagging quality panel in en, including type-scoped low-consistency / ranking / boundary sections', async ({ page }) => {
    await gotoWithLang(page, 'en', 'quality');

    await expect(page.locator('#bcCurrent')).toHaveText('Product Review Sequence Tagging');
    await expect(page.locator('#iaaMethodName')).toHaveText("Token-level Krippendorff's Alpha");
    await expect(page.locator('#seqTagMaskingNote')).toHaveText(
      'O-tag masking rule: tokens marked O by every annotator are excluded from the comparison unit, preventing background tokens from diluting the disagreement signal (mandatory, cannot be disabled).'
    );

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

    await expect(page.locator('#sequenceTaggingGroupAvg')).toHaveText('Group avg — Token Alpha: 0.78 / Avg speed: 44.0s/sent');
    await expect(page.locator('#consistencyNote')).toHaveText(
      'For sequence tagging, O-tag-masked tokens form the comparison pool. Boundary-level high_divergence samples remain separate flags.'
    );
  });
});
