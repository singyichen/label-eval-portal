/**
 * Traceability: specs/dataset/017-dataset-analysis-detail/spec.md
 *   FR-009, FR-009F, FR-009I, FR-019, FR-009L (AC-2.7)
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ retries: 2 });

const DETAIL_URL = '/pages/dataset/dataset-analysis-detail.html';

async function gotoStatsWithLang(page: Page, taskId: string, lang: 'zh' | 'en') {
  await page.addInitScript((storedLang: 'zh' | 'en') => {
    window.localStorage.setItem('labelsuite.lang', storedLang);
  }, lang);

  await page.goto(`${DETAIL_URL}?task_id=${taskId}&tab=stats`);
}

test.describe('Dataset analysis detail stats i18n across task types', () => {
  test('renders VA statistics overview in English mode', async ({ page }) => {
    await gotoStatsWithLang(page, 'T102', 'en');

    const histogram = page.locator('section[aria-labelledby="statsVAHistTitle"]');

    await expect(page.locator('#bcCurrent')).toHaveText('Sentiment VA Dual-axis Scoring');
    await expect(histogram.locator('.panel-title')).toHaveText('Valence / Arousal Distribution');
    await expect(page.locator('#statsVALblValence')).toHaveText('Valence (V)');
    await expect(page.locator('#statsVALblArousal')).toHaveText('Arousal (A)');
    await expect(page.locator('svg[data-i18n-aria-label="statsVAValenceAria"]')).toHaveAttribute(
      'aria-label',
      'Valence histogram'
    );
    await expect(page.locator('svg[data-i18n-aria-label="statsVAArousalAria"]')).toHaveAttribute(
      'aria-label',
      'Arousal histogram'
    );
    await expect(page.locator('svg[data-i18n-aria-label="statsVAScatterAria"]')).toHaveAttribute(
      'aria-label',
      'V-A 2D scatter plot'
    );
    await expect(histogram).not.toContainText(/[分佈直方圖標記員評分量表]/);
  });

  test('renders sequence statistics overview labels in English mode without mixed Chinese labels', async ({ page }) => {
    await gotoStatsWithLang(page, 'T106', 'en');

    const entityDistribution = page.locator('section[aria-labelledby="statsSeqEntityDistTitle"]');

    await expect(page.locator('#bcCurrent')).toHaveText('NER Named Entity Recognition');
    await expect(entityDistribution.locator('.panel-title')).toHaveText('Entity Type Distribution');
    await expect(entityDistribution.locator('.stats-hbar-label')).toHaveText([
      'PER',
      'ORG',
      'LOC',
      'MISC',
    ]);
    await expect(entityDistribution).not.toContainText(/[人名組織地點其他]/);
    await expect(page.locator('svg[data-i18n-aria-label="statsSeqSpanLenAria"]')).toHaveAttribute(
      'aria-label',
      'Entity span length histogram'
    );
  });

  test('renders single_label statistics overview labels in English mode without mixed Chinese labels', async ({ page }) => {
    await gotoStatsWithLang(page, 'T105', 'en');

    const distribution = page.locator('section[aria-labelledby="statsSingleLabelDistTitle"]');

    await expect(page.locator('#bcCurrent')).toHaveText('Customer Service Sentiment Single-label Classification');
    await expect(distribution.locator('.panel-title')).toHaveText('Label Distribution');
    await expect(distribution.locator('.stats-hbar-label')).toHaveText([
      'Positive',
      'Neutral',
      'Negative',
      'Mixed',
    ]);
    await expect(distribution).not.toContainText(/[正向中立負向混合]/);
  });

  // AC-2.7 (specs/dataset/017-dataset-analysis-detail/spec.md FR-009L): stats
  // must switch sequence_tagging's population from token sequences to the
  // submitted span set. Red today because the partial still renders a
  // token/tag-prefix distribution (O, B-PER, I-PER, B-ORG) and has no
  // span-count or character-length sections at all.
  test('renders sequence_tagging label-type distribution without tag prefixes or an O bucket (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const labelDistribution = page.locator('section[aria-labelledby="statsSeqTagDistTitle"]');
    const labelTexts = await labelDistribution.locator('.stats-hbar-label').allTextContents();

    expect(labelTexts.length).toBeGreaterThan(0);
    for (const rawLabel of labelTexts) {
      const label = rawLabel.trim();
      expect(label).not.toMatch(/^(B-|I-|E-|S-)/);
      expect(label).not.toBe('O');
    }
  });

  test('reports sequence_tagging average marked spans per sentence as a span-count section (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const avgSpanSection = page.locator('section[aria-labelledby="statsSeqTagAvgSpanTitle"]');
    expect(await avgSpanSection.count()).toBe(1);
  });

  test('buckets sequence_tagging span length distribution by character length, not token length (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const spanLenSection = page.locator('section[aria-labelledby="statsSeqTagSpanLenTitle"]');
    expect(await spanLenSection.count()).toBe(1);
  });

  // --- Round 2 (strengthened contracts, AC-2.7's remaining AND-clauses) ---
  //
  // `stats-sequence_tagging.html` is a single static partial shared by every
  // task whose `outputs[]` includes `sequence_tagging` (see
  // dataset-analysis-detail.html:1106) — there is no per-task computed
  // surface to assert against. Equivalent verifiable contract used below:
  // T103 is defined, for the purposes of this spec's sole canonical
  // sequence_tagging demo, to literally instantiate AC-2.7's own GIVEN
  // example (one 3-char `ORG` span + one 2-char `TITLE` span). Green MUST
  // hand-write those literal numbers into the partial. This directly blocks
  // a "write character length as the count" bug (e.g. ORG rendered as `3`
  // instead of `1`) because the expected values (1, 1, total 2) are exactly
  // the AC's own numbers, not a derived invariant that a consistently wrong
  // implementation could still satisfy.

  test('locks sequence_tagging label-type distribution to span-count semantics per AC-2.7 GIVEN: ORG 1, TITLE 1, not char-inflated (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const labelDistribution = page.locator('section[aria-labelledby="statsSeqTagDistTitle"]');
    const rows = labelDistribution.locator('.stats-hbar-row');
    const orgRow = rows.filter({ has: page.locator('.stats-hbar-label', { hasText: /^ORG$/ }) });
    const titleRow = rows.filter({ has: page.locator('.stats-hbar-label', { hasText: /^TITLE$/ }) });

    expect(await orgRow.count()).toBe(1);
    expect(await titleRow.count()).toBe(1);

    const extractCount = (text: string) => {
      const match = text.trim().match(/([\d,]+)\s*$/);
      return match ? match[1].replace(/,/g, '') : null;
    };
    const orgValue = await orgRow.locator('.stats-hbar-value').innerText();
    const titleValue = await titleRow.locator('.stats-hbar-value').innerText();

    // AC-2.7: "標籤類型分佈顯示 ORG 1 筆、TITLE 1 筆" — a 3-char ORG span and a
    // 2-char TITLE span must each count as 1 instance, not 3 / 2.
    expect(extractCount(orgValue)).toBe('1');
    expect(extractCount(titleValue)).toBe('1');
  });

  test('reports sequence_tagging total marked spans for the AC-2.7 GIVEN sample as 2, not 5 from char-inflation (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const avgSpanSection = page.locator('section[aria-labelledby="statsSeqTagAvgSpanTitle"]');
    // Guard with a non-retrying count() first (matches the established
    // convention in this file for asserting on locators known to be absent
    // today) so this test fails fast instead of hitting the default 30s
    // auto-retry timeout on innerText() against a nonexistent section.
    expect(await avgSpanSection.count()).toBe(1);

    const sectionText = await avgSpanSection.innerText();

    // AC-2.7: "該樣本的標記片段數為 2，未因字元數被放大為 5" — one 3-char ORG span
    // plus one 2-char TITLE span is 2 span instances, not 3+2=5 characters.
    expect(sectionText).toMatch(/(^|\D)2(\D|$)/);
    expect(sectionText).not.toMatch(/(^|\D)5(\D|$)/);
  });

  test('purges token-population vocabulary ("token", "O tag") from every sequence_tagging stats section (AC-2.7 / FR-009L)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const labelDistribution = page.locator('section[aria-labelledby="statsSeqTagDistTitle"]');
    const avgSpanSection = page.locator('section[aria-labelledby="statsSeqTagAvgSpanTitle"]');
    const spanLenSection = page.locator('section[aria-labelledby="statsSeqTagSpanLenTitle"]');

    // FR-009L (delta :91, :95, :99): the token population and the `O` tag
    // are removed, BREAKING changes — including the pre-existing
    // statsSeqTagDistDesc/statsSeqTagDistNote copy (current partial :6, :31)
    // that today reads "token 數量" / "O tag 佔全體 token 71%". This also
    // guards against copying stats-entity_recognition.html's span-length
    // section verbatim (":67", ":93": "以 token 數計算" / "Span 長度（token 數）"),
    // which is the sibling pattern Green is most likely to reuse.
    for (const section of [labelDistribution, avgSpanSection, spanLenSection]) {
      await expect(section).not.toContainText(/token/i);
      await expect(section).not.toContainText(/O\s*tag/i);
    }
  });

  test('uses character-length vocabulary (not token) for the sequence_tagging span-length distribution wording (AC-2.7)', async ({ page }) => {
    await gotoStatsWithLang(page, 'T103', 'en');

    const spanLenSection = page.locator('section[aria-labelledby="statsSeqTagSpanLenTitle"]');

    // AC-2.7's last AND-clause: "標記片段長度分佈以字元長度分桶，畫面未出現任何以
    // token 為單位的長度說明". FR-009L bullet 3 (delta :97) requires bucketing
    // by character length (`end - start`). The English-mode copy must name
    // the population as "character".
    await expect(spanLenSection).toContainText(/character/i);
    await expect(spanLenSection).not.toContainText(/token/i);
  });
});
