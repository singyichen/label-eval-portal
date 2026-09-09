/**
 * Traceability: openspec/changes/seq-tagging-span-export-metrics/specs/dataset/017-dataset-analysis-detail/spec.md
 *   FR-041 (AC-5.1, AC-5.2)
 *
 * issue #581 change 3, group 3, task 3.1 -- character-level half.
 *
 * FR-041 makes 017 the single authority for turning a `sequence_tagging`
 * `spans[]` into a tag sequence. Ruling D4 puts that derivation in
 * design/prototype/pages/shared/, and ruling D3 (plus ruling H) keeps every
 * screen-observable clause out of this change, so these assertions talk to
 * the module directly rather than through an export dialog: the dialog is
 * issue #742's job and does not exist yet.
 *
 * The module is injected with addScriptTag instead of being pulled in by a
 * page, because no page consumes it in this change -- wiring a <script> into
 * a page just to reach it from a test would add a product file the task does
 * not own.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ retries: 2 });

const HOST_URL = '/pages/dataset/dataset-analysis-detail.html?task_id=T006&tab=stats';
const MODULE_URL = '/pages/shared/span-tagging-export.js';

/* FR-041 AC-5.1 works this exact sample: 8 characters, one ORG span over the
 * first three. Keeping the literal here (rather than deriving it) means a
 * change to the sample is a visible diff, not a silently shifted expectation. */
const TEXT = '台積電董事長出席';
const ORG_SPAN = { start: 0, end: 3, label: 'ORG' };

type Span = { start: number; end: number; label: string };
type DerivedSequence = {
  tags: string[];
  tagging_scheme: string;
  token_unit: string;
  expansions: unknown[];
  tokenizer?: unknown;
};

async function loadModule(page: Page): Promise<void> {
  await page.goto(HOST_URL);
  await page.addScriptTag({ url: MODULE_URL });
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).LabelSuiteSpanTaggingExport))
    .toBe('object');
}

async function derive(
  page: Page,
  text: string,
  spans: Span[],
  options?: Record<string, unknown>
): Promise<DerivedSequence> {
  return page.evaluate(
    (input: { text: string; spans: Span[]; options?: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (window as any).LabelSuiteSpanTaggingExport;
      return mod.deriveSequence(input.text, input.spans, input.options);
    },
    { text, spans, options }
  );
}

test.describe('FR-041 span-to-sequence derivation, character level', () => {
  test('AC-5.1: the closed enumerations and defaults are the ones FR-041 names', async ({ page }) => {
    await loadModule(page);

    const constants = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (window as any).LabelSuiteSpanTaggingExport;
      return {
        schemes: mod.EXPORT_TAGGING_SCHEMES,
        defaultScheme: mod.EXPORT_DEFAULT_TAGGING_SCHEME,
        units: mod.EXPORT_TOKEN_UNITS,
        defaultUnit: mod.EXPORT_DEFAULT_TOKEN_UNIT,
        alignment: mod.SPAN_TOKEN_ALIGNMENT_MODE,
      };
    });

    /* Closed sets: an extra member is as wrong as a missing one. SINGLE was
     * retired by ruling D5(b) and must not come back through this door. */
    expect(constants.schemes).toEqual(['BIO', 'BIOES', 'IOB2']);
    expect(constants.units).toEqual(['character', 'word']);
    expect(constants.defaultScheme).toBe('BIO');
    expect(constants.defaultUnit).toBe('character');
    expect(constants.alignment).toBe('expand');
  });

  test('AC-5.1: BIO is the default and needs no tokenizer', async ({ page }) => {
    await loadModule(page);

    const result = await derive(page, TEXT, [ORG_SPAN]);

    expect(result.tags).toEqual(['B-ORG', 'I-ORG', 'I-ORG', 'O', 'O', 'O', 'O', 'O']);
    expect(result.tags).toHaveLength(TEXT.length);
    expect(result.tagging_scheme).toBe('BIO');
    expect(result.token_unit).toBe('character');
    /* AC-5.1: the character path writes no tokenizer metadata at all -- an
     * `undefined` value would still serialise into an export file's metadata
     * object, so the key itself must be absent. */
    expect(Object.prototype.hasOwnProperty.call(result, 'tokenizer')).toBe(false);
    expect(result.expansions).toEqual([]);
  });

  test('AC-5.1: BIOES marks the last character of a span with E- and a lone character with S-', async ({ page }) => {
    await loadModule(page);

    const multi = await derive(page, TEXT, [ORG_SPAN], { tagging_scheme: 'BIOES' });
    expect(multi.tags).toEqual(['B-ORG', 'I-ORG', 'E-ORG', 'O', 'O', 'O', 'O', 'O']);
    expect(multi.tagging_scheme).toBe('BIOES');

    const single = await derive(page, TEXT, [{ start: 6, end: 7, label: 'ACT' }], {
      tagging_scheme: 'BIOES',
    });
    expect(single.tags).toEqual(['O', 'O', 'O', 'O', 'O', 'O', 'S-ACT', 'O']);
  });

  test('AC-5.1: IOB2 and BIO produce the same sequence from the same spans', async ({ page }) => {
    await loadModule(page);

    const spans = [ORG_SPAN, { start: 6, end: 8, label: 'ACT' }];
    const bio = await derive(page, TEXT, spans, { tagging_scheme: 'BIO' });
    const iob2 = await derive(page, TEXT, spans, { tagging_scheme: 'IOB2' });

    expect(bio.tags).toEqual(['B-ORG', 'I-ORG', 'I-ORG', 'O', 'O', 'O', 'B-ACT', 'I-ACT']);
    expect(iob2.tags).toEqual(bio.tags);
    /* The scheme still travels into the export metadata: identical sequences
     * must not collapse the two names into one recorded value. */
    expect(iob2.tagging_scheme).toBe('IOB2');
  });

  test('AC-5.1: re-exporting under another scheme leaves the stored spans untouched', async ({ page }) => {
    await loadModule(page);

    const stored = await page.evaluate(
      (input: { text: string; span: Span }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (window as any).LabelSuiteSpanTaggingExport;
        const spans = [{ ...input.span }];
        mod.deriveSequence(input.text, spans, { tagging_scheme: 'BIO' });
        mod.deriveSequence(input.text, spans, { tagging_scheme: 'BIOES' });
        mod.deriveSequence(input.text, spans, { tagging_scheme: 'IOB2' });
        return spans;
      },
      { text: TEXT, span: ORG_SPAN }
    );

    expect(stored).toEqual([ORG_SPAN]);
  });

  test('AC-5.2: the same input derives the same sequence every time', async ({ page }) => {
    await loadModule(page);

    const spans = [ORG_SPAN, { start: 6, end: 8, label: 'ACT' }];
    const first = await derive(page, TEXT, spans);
    const second = await derive(page, TEXT, spans);
    expect(second).toEqual(first);

    /* A repeated call in one browser cannot catch a clock, a random seed or a
     * host locale leaking into the output -- it would agree with itself. The
     * inputs FR-041 forbids are named here so a future edit that reaches for
     * one trips this assertion instead of a flaky comparison months later. */
    const source = await (await page.request.get(MODULE_URL)).text();
    for (const forbidden of ['Date.now', 'new Date', 'Math.random', 'navigator.language', 'toLocaleString']) {
      expect(source).not.toContain(forbidden);
    }
  });

  test('AC-5.2: a sample with no spans still yields a full-length all-O sequence', async ({ page }) => {
    await loadModule(page);

    const empty = await derive(page, TEXT, []);

    expect(empty.tags).toEqual(['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O']);
    expect(empty.tags).toHaveLength(TEXT.length);
    /* "MUST NOT 省略該樣本或輸出空陣列" -- both failure shapes are named so
     * neither can pass as the other. */
    expect(empty.tags).not.toEqual([]);
    expect(empty.tagging_scheme).toBe('BIO');
    expect(empty.token_unit).toBe('character');
  });
});
