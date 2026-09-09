/* Shared span-to-sequence export derivation (spec 017 v3.0.0, issue #581).
 *
 * FR-041 makes spec 017 the single authority for turning a `sequence_tagging`
 * `spans[]` into a tag sequence: 013's FR-003d-1 and 015's FR-024A-3 both
 * point here rather than restating the rules, so the two consumers cannot
 * drift on what `BIOES` means or where a span boundary lands.
 *
 * It lives in pages/shared/ (ruling D4) for the same reason
 * annotation-history.js does -- the export entry on the 014 task-detail page
 * and the statistics on the 017 analysis page derive the same sequences, and
 * a second copy is exactly how two definitions of `E-` appear.
 *
 * The derivation is a pure function of (text, spans, options). FR-041 rule 2
 * rules out the clock, randomness and host locale as inputs: an exported
 * dataset that cannot be reproduced byte for byte is not a dataset anyone can
 * cite. Nothing here reads the DOM or triggers an export -- the dialog that
 * does belongs to the 014 companion change (issue #742).
 *
 * Correctness rests on spans not overlapping, which 013's
 * SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE guarantees for `sequence_tagging` by
 * locking `allow_overlapping` to false. `entity_recognition` allows nesting
 * and must not be run through this module (FR-041 rule 1).
 */
(function (global) {
  'use strict';

  var EXPORT_TAGGING_SCHEMES = ['BIO', 'BIOES', 'IOB2'];
  var EXPORT_DEFAULT_TAGGING_SCHEME = 'BIO';
  var EXPORT_TOKEN_UNITS = ['character', 'word'];
  var EXPORT_DEFAULT_TOKEN_UNIT = 'character';
  /* FR-041: expand is the only alignment mode -- truncating a span or
   * dropping it are both forbidden, so there is nothing to choose between. */
  var SPAN_TOKEN_ALIGNMENT_MODE = 'expand';

  var OUTSIDE_TAG = 'O';

  function resolveScheme(options) {
    var scheme = options.tagging_scheme || EXPORT_DEFAULT_TAGGING_SCHEME;
    if (EXPORT_TAGGING_SCHEMES.indexOf(scheme) === -1) {
      throw new Error('span-tagging-export: unknown tagging_scheme ' + scheme);
    }
    return scheme;
  }

  function resolveUnit(options) {
    var unit = options.token_unit || EXPORT_DEFAULT_TOKEN_UNIT;
    if (EXPORT_TOKEN_UNITS.indexOf(unit) === -1) {
      throw new Error('span-tagging-export: unknown token_unit ' + unit);
    }
    return unit;
  }

  /* FR-042 rule 1: the same spans run through a different tokenizer, or a
   * different version of one, yield a different sequence. Without both fields
   * the export cannot be reproduced, so it does not happen at all. The refusal
   * is a returned value rather than a thrown error -- a blocked export is an
   * expected outcome the caller reports, not a programming mistake. */
  function missingTokenizerField(tokenizer) {
    var meta = tokenizer || {};
    if (!meta.engine) return 'engine';
    if (!meta.version) return 'version';
    return null;
  }

  /* FR-042 rule 2: a span boundary inside a token grows to the whole token.
   * Truncating, dropping the span and skipping the sample are each ruled out
   * by name, so any overlap at all pulls the token in. */
  function expandToTokens(span, tokens) {
    var first = -1;
    var last = -1;
    var i;
    for (i = 0; i < tokens.length; i += 1) {
      if (tokens[i].end <= span.start || tokens[i].start >= span.end) continue;
      if (first === -1) first = i;
      last = i;
    }
    if (first === -1) return null;
    return { first: first, last: last, start: tokens[first].start, end: tokens[last].end };
  }

  function deriveWordSequence(source, list, scheme, opts) {
    var missing = missingTokenizerField(opts.tokenizer);
    var tokens = opts.tokens || [];
    var tags = [];
    var expansions = [];
    var i;
    var span;
    var range;
    var prefixes;
    var offset;

    if (missing) {
      /* Nothing derived, nothing to export: a refusal that still carried tags
       * would let a caller write the file it was told not to write. */
      return {
        blocked: true,
        reason: 'span-tagging-export: tokenizer.' + missing + ' is required for token_unit word',
      };
    }

    for (i = 0; i < tokens.length; i += 1) tags.push(OUTSIDE_TAG);

    for (i = 0; i < list.length; i += 1) {
      span = list[i];
      if (!span || span.end <= span.start) continue;
      range = expandToTokens(span, tokens);
      if (!range) continue;
      prefixes = tagsForSpan(scheme, range.last - range.first + 1);
      for (offset = 0; offset < prefixes.length; offset += 1) {
        tags[range.first + offset] = prefixes[offset] + '-' + span.label;
      }
      /* FR-042 rule 3: an expansion the annotator cannot see is an edit made
       * on their behalf. Deltas are expanded minus original, so the direction
       * of the growth stays readable at each edge. */
      if (range.start !== span.start || range.end !== span.end) {
        expansions.push({
          label: span.label,
          original_start: span.start,
          original_end: span.end,
          original_text: source.slice(span.start, span.end),
          expanded_start: range.start,
          expanded_end: range.end,
          expanded_text: source.slice(range.start, range.end),
          start_delta: range.start - span.start,
          end_delta: range.end - span.end,
        });
      }
    }

    return {
      tags: tags,
      tagging_scheme: scheme,
      token_unit: 'word',
      tokenizer: { engine: opts.tokenizer.engine, version: opts.tokenizer.version },
      alignment_mode: SPAN_TOKEN_ALIGNMENT_MODE,
      expanded_span_count: expansions.length,
      expansions: expansions,
    };
  }

  /* FR-041 rule 5: the three schemes are presentation differences over one
   * derivation. BIO and IOB2 share a tag set outright; BIOES renames the
   * last position of a span, and a one-token span is its own last position. */
  function tagsForSpan(scheme, length) {
    var tags = [];
    var i;
    if (scheme === 'BIOES' && length === 1) return ['S'];
    for (i = 0; i < length; i += 1) {
      if (i === 0) tags.push('B');
      else if (scheme === 'BIOES' && i === length - 1) tags.push('E');
      else tags.push('I');
    }
    return tags;
  }

  function deriveSequence(text, spans, options) {
    var opts = options || {};
    var scheme = resolveScheme(opts);
    var unit = resolveUnit(opts);
    var source = text == null ? '' : String(text);
    var list = spans || [];
    var tags = [];
    var i;
    var span;
    var prefixes;
    var offset;

    if (unit === 'word') return deriveWordSequence(source, list, scheme, opts);

    /* FR-041 rule 6: a sample with no spans is still a sample. It gets a
     * full-length all-O sequence, never an empty array and never a skip. */
    for (i = 0; i < source.length; i += 1) tags.push(OUTSIDE_TAG);

    for (i = 0; i < list.length; i += 1) {
      span = list[i];
      if (!span || span.end <= span.start) continue;
      prefixes = tagsForSpan(scheme, span.end - span.start);
      for (offset = 0; offset < prefixes.length; offset += 1) {
        tags[span.start + offset] = prefixes[offset] + '-' + span.label;
      }
    }

    /* The stored spans are never touched: 015's FR-052 makes the annotator's
     * character offsets the authoritative value, and re-exporting under a
     * different scheme must not require re-annotating (FR-041 rule 3). */
    /* FR-042 rule 5: the character path writes no tokenizer metadata, no
     * alignment mode and no expansion count, even when the caller handed them
     * over -- a file claiming a tokenizer it never ran is worse than one that
     * says nothing. Expansions stay an empty list because a character can not
     * be expanded, which is also what suppresses the summary. */
    return {
      tags: tags,
      tagging_scheme: scheme,
      token_unit: unit,
      expansions: [],
    };
  }

  global.LabelSuiteSpanTaggingExport = {
    EXPORT_TAGGING_SCHEMES: EXPORT_TAGGING_SCHEMES,
    EXPORT_DEFAULT_TAGGING_SCHEME: EXPORT_DEFAULT_TAGGING_SCHEME,
    EXPORT_TOKEN_UNITS: EXPORT_TOKEN_UNITS,
    EXPORT_DEFAULT_TOKEN_UNIT: EXPORT_DEFAULT_TOKEN_UNIT,
    SPAN_TOKEN_ALIGNMENT_MODE: SPAN_TOKEN_ALIGNMENT_MODE,
    deriveSequence: deriveSequence,
  };
})(window);
