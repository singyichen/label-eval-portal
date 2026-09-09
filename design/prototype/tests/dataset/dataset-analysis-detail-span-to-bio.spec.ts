/**
 * Traceability: openspec/changes/seq-tagging-span-export-metrics/specs/dataset/017-dataset-analysis-detail/spec.md
 *   FR-041 (AC-5.1, AC-5.2), FR-042 (AC-5.3, AC-5.4)
 *
 * issue #581 change 3, group 3, tasks 3.1 (character level) and 3.3 (word
 * level). Ruling H keeps the screen-observable half of AC-5.3/AC-5.4 -- the
 * expansion summary, its disclosure, the blocked-export notice -- in issue
 * #742; only the data the screen would read is asserted here.
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

/* AC-5.3 names the boundary that matters: an engine that keeps 董事長 as one
 * token, against a span that stops inside it. The module is handed token
 * boundaries rather than an engine handle -- FR-041 rule 2 forbids any
 * environment-dependent input, and a tokenizer called at derive time would be
 * exactly that. Naming the engine and version is still required by FR-042
 * rule 1, so both travel as plain metadata. */
const TOKENS = [
  { start: 0, end: 3 },
  { start: 3, end: 6 },
  { start: 6, end: 8 },
];
const TOKENIZER = { engine: 'fixture-jieba', version: '0.42.1' };

type Span = { start: number; end: number; label: string };
type DerivedSequence = {
  tags: string[];
  tagging_scheme: string;
  token_unit: string;
  expansions: unknown[];
  tokenizer?: unknown;
};
/* The word path can answer in two shapes -- a derived sequence, or the refusal
 * AC-5.4 requires -- so every field is optional here and each test says which
 * shape it expects. */
type WordResult = {
  tags?: string[];
  tagging_scheme?: string;
  token_unit?: string;
  tokenizer?: { engine?: string; version?: string };
  alignment_mode?: string;
  expanded_span_count?: number;
  expansions?: unknown[];
  blocked?: boolean;
  reason?: string;
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

async function deriveWord(
  page: Page,
  spans: Span[],
  options: Record<string, unknown>
): Promise<WordResult> {
  return page.evaluate(
    (input: { text: string; spans: Span[]; options: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = (window as any).LabelSuiteSpanTaggingExport;
      return mod.deriveSequence(input.text, input.spans, input.options);
    },
    { text: TEXT, spans, options }
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

test.describe('FR-042 word-level alignment and tokenizer metadata', () => {
  test('AC-5.3: a span ending inside a token expands to the whole token and is reported', async ({ page }) => {
    await loadModule(page);

    /* 董事 (3..5) stops inside 董事長 (3..6). FR-042 rule 2 allows exactly one
     * outcome: grow to the token. Truncating to 3..5, dropping the span and
     * skipping the sample are each forbidden by name. */
    const result = await deriveWord(page, [{ start: 3, end: 5, label: 'TITLE' }], {
      token_unit: 'word',
      tokenizer: TOKENIZER,
      tokens: TOKENS,
    });

    /* One tag per token, not per character: the unit of the sequence is what
     * `token_unit` selects, so a character-length array here would mean the
     * option was recorded but never applied. */
    expect(result.tags).toEqual(['O', 'B-TITLE', 'O']);
    expect(result.tags).toHaveLength(TOKENS.length);
    expect(result.token_unit).toBe('word');
    expect(result.tokenizer).toEqual(TOKENIZER);
    expect(result.alignment_mode).toBe('expand');
    expect(result.expanded_span_count).toBe(1);
    /* AC-5.3 requires the original text, the expanded text and the offset
     * deltas to be individually listable, so the record is compared whole --
     * a count without the per-item detail cannot satisfy the AC. Deltas are
     * expanded minus original, so growth reads negative at the start edge and
     * positive at the end edge. */
    expect(result.expansions).toEqual([
      {
        label: 'TITLE',
        original_start: 3,
        original_end: 5,
        original_text: '董事',
        expanded_start: 3,
        expanded_end: 6,
        expanded_text: '董事長',
        start_delta: 0,
        end_delta: 1,
      },
    ]);
  });

  test('AC-5.3: expansion crosses token boundaries, and an aligned span reports nothing', async ({ page }) => {
    await loadModule(page);

    /* 積電董事 (1..5) starts inside 台積電 and ends inside 董事長, so it must
     * cover both tokens rather than pick the better-overlapping one. */
    const crossing = await deriveWord(page, [{ start: 1, end: 5, label: 'ORG' }], {
      token_unit: 'word',
      tokenizer: TOKENIZER,
      tokens: TOKENS,
    });
    expect(crossing.tags).toEqual(['B-ORG', 'I-ORG', 'O']);
    expect(crossing.expanded_span_count).toBe(1);
    expect(crossing.expansions).toEqual([
      {
        label: 'ORG',
        original_start: 1,
        original_end: 5,
        original_text: '積電董事',
        expanded_start: 0,
        expanded_end: 6,
        expanded_text: '台積電董事長',
        start_delta: -1,
        end_delta: 1,
      },
    ]);

    /* 出席 (6..8) already sits on token boundaries. FR-042 rule 3 makes 0 the
     * value that suppresses the summary, so it must be a real 0 and an empty
     * list -- not a missing field the screen would have to guess about. */
    const aligned = await deriveWord(page, [{ start: 6, end: 8, label: 'ACT' }], {
      token_unit: 'word',
      tokenizer: TOKENIZER,
      tokens: TOKENS,
    });
    expect(aligned.tags).toEqual(['O', 'O', 'B-ACT']);
    expect(aligned.expanded_span_count).toBe(0);
    expect(aligned.expansions).toEqual([]);
  });

  test('AC-5.3: expanding for export never writes back to the stored spans', async ({ page }) => {
    await loadModule(page);

    const stored = await page.evaluate(
      (input: { text: string; tokens: unknown; tokenizer: unknown }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (window as any).LabelSuiteSpanTaggingExport;
        const spans = [{ start: 3, end: 5, label: 'TITLE' }];
        const options = {
          token_unit: 'word',
          tokenizer: input.tokenizer,
          tokens: input.tokens,
        };
        mod.deriveSequence(input.text, spans, options);
        mod.deriveSequence(input.text, spans, options);
        return spans;
      },
      { text: TEXT, tokens: TOKENS, tokenizer: TOKENIZER }
    );

    /* FR-042 rule 4: the annotator's character offsets stay authoritative.
     * Comparing the whole array catches an in-place widening that a length
     * check would sail past. */
    expect(stored).toEqual([{ start: 3, end: 5, label: 'TITLE' }]);
  });

  test('AC-5.4: a missing tokenizer version or engine blocks the derivation outright', async ({ page }) => {
    await loadModule(page);

    const noVersion = await deriveWord(page, [{ start: 3, end: 5, label: 'TITLE' }], {
      token_unit: 'word',
      tokenizer: { engine: TOKENIZER.engine },
      tokens: TOKENS,
    });
    expect(noVersion.blocked).toBe(true);
    /* "未產生任何匯出檔" at the data layer means no sequence to write: a
     * blocked answer that still carries tags would let a caller export it. */
    expect(Object.prototype.hasOwnProperty.call(noVersion, 'tags')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(noVersion, 'expansions')).toBe(false);
    /* The reason names the missing field so issue #742 can render something
     * more useful than "export failed"; the wording itself is #742's call. */
    expect(noVersion.reason).toContain('version');

    const noEngine = await deriveWord(page, [{ start: 3, end: 5, label: 'TITLE' }], {
      token_unit: 'word',
      tokenizer: { version: TOKENIZER.version },
      tokens: TOKENS,
    });
    expect(noEngine.blocked).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(noEngine, 'tags')).toBe(false);
    expect(noEngine.reason).toContain('engine');
  });

  test('AC-5.4: falling back to character level succeeds and carries no word-level metadata', async ({ page }) => {
    await loadModule(page);

    const blocked = await deriveWord(page, [{ start: 3, end: 5, label: 'TITLE' }], {
      token_unit: 'word',
      tokenizer: { engine: TOKENIZER.engine },
      tokens: TOKENS,
    });
    expect(blocked.blocked).toBe(true);

    /* The same call with the word-level options still attached: FR-042 rule 5
     * makes the character path drop them, so an implementation that copies
     * whatever it was handed into the metadata is caught here rather than in
     * a downstream file that claims a tokenizer it never used. */
    const fallback = await deriveWord(page, [{ start: 3, end: 5, label: 'TITLE' }], {
      token_unit: 'character',
      tokenizer: TOKENIZER,
      tokens: TOKENS,
    });
    expect(fallback.blocked).toBeUndefined();
    expect(fallback.tags).toEqual(['O', 'O', 'O', 'B-TITLE', 'I-TITLE', 'O', 'O', 'O']);
    expect(fallback.tags).toHaveLength(TEXT.length);
    expect(Object.prototype.hasOwnProperty.call(fallback, 'tokenizer')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fallback, 'alignment_mode')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(fallback, 'expanded_span_count')).toBe(false);
    expect(fallback.expansions).toEqual([]);
  });
});
