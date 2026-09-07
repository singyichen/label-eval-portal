/* Shared annotation-history event model (spec 015 v5.0.0, issues #578/#596).
 *
 * The prototype grew three unconnected history mechanisms -- the workspace
 * 歷程 panel (spec 015 FR-016B), task-detail's per-annotator review timeline
 * (spec 014 FR-015d-4) and its dry-run round history -- each with its own
 * notion of what an event is. This module is the single place the shared
 * parts live, following the same window.LabelSuite* pattern as sidebar.js
 * and modal-focus.js, so a second consumer never has to restate them.
 *
 * Scope is the RENDER side only. Event construction, result_snapshot and
 * FR-090 masking belong to annotation-workspace.data.js: that module writes
 * history at load time (seedReviewFlowDemo) on all six pages that include
 * it, so a dependency in this direction would have to be wired into every
 * one of them, while it is already the data layer they all share.
 *
 * FR-086: `action` is a closed set. Every value owns exactly one badge
 * modifier class, and that mapping is data, not a render-site branch -- the
 * three-way ternary it replaces silently rendered `skipped` as `submitted`.
 * A value outside the set (an event written by an older build) keeps the
 * neutral base badge rather than borrowing another action's meaning.
 */
(function (global) {
  'use strict';

  /* spec 015 v5.0.0 (issue #596): the single-owner relay retires REJECTED and
     adds three values. There is no rework loop for a reviewer to send an
     annotation back into, so a `rejected` event can no longer be produced;
     in its place a reviewer who cannot decide records BYPASSED, an arbiter
     closing an exception records EXCEPTION_RESOLVED, and a unit dropped from
     the run records EXCLUDED. Declaration order is the relay's own order and
     is what the render side reads. */
  var ACTIONS = {
    DRAFT_SAVED: 'draft_saved',
    SUBMITTED: 'submitted',
    SKIPPED: 'skipped',
    MODIFIED: 'modified',
    ACCEPTED: 'accepted',
    BYPASSED: 'bypassed',
    ADJUDICATED: 'adjudicated',
    EXCEPTION_RESOLVED: 'exception_resolved',
    EXCLUDED: 'excluded',
  };

  /* action -> badge modifier class. The colors themselves live in the page's
     .history-action-badge.<modifier> rules so both themes resolve through
     tokens; this table only decides which one applies. */
  var BADGE_CLASS = {
    draft_saved: 'draft-saved',
    submitted: 'submitted',
    skipped: 'skipped',
    modified: 'modified',
    accepted: 'accepted',
    bypassed: 'bypassed',
    adjudicated: 'adjudicated',
    exception_resolved: 'exception-resolved',
    excluded: 'excluded',
  };

  var ACTION_VALUES = Object.keys(BADGE_CLASS);

  function isKnownAction(action) {
    return Object.prototype.hasOwnProperty.call(BADGE_CLASS, action);
  }

  /* '' for anything outside the set, so the caller renders the neutral base
     badge without needing its own fallback branch. */
  function badgeClassFor(action) {
    return isKnownAction(action) ? BADGE_CLASS[action] : '';
  }

  /* action -> localized display label (issue #600). The values themselves
     stay English (FR-086 data contract, already written to localStorage), so
     translation lives here rather than on the constant.

     Deliberately wider than ACTIONS: `rejected` left the set in v5.0.0 but
     events carrying it are already in people's localStorage, and a label is
     the one thing they can still be given. They keep the neutral badge --
     BADGE_CLASS is the set's real gate -- which is what marks them as
     pre-relay, while the words stay readable instead of regressing to a bare
     English identifier. */
  var ACTION_LABEL = {
    draft_saved: '已存草稿',
    submitted: '已提交',
    skipped: '已跳過',
    modified: '審核修正',
    accepted: '審核通過',
    bypassed: '無法判定',
    adjudicated: '仲裁定案',
    exception_resolved: '例外收尾',
    excluded: '已排除',
    rejected: '審核退回',
  };

  /* the action itself for anything outside the label table, so an event from
     an older build still shows something meaningful instead of a blank
     label. Keyed on ACTION_LABEL, not isKnownAction(), so a retired value
     that kept its label keeps it. */
  function actionLabelFor(action) {
    return Object.prototype.hasOwnProperty.call(ACTION_LABEL, action) ? ACTION_LABEL[action] : action;
  }

  /* issue #601: markSampleSubmitted() is shared by both roles, so a reviewer
     submit writes an envelope `submitted` event and then one decision event
     per approved outKey. The envelope deliberately carries no answer -- the
     data layer omits its snapshot because the decision events already hold
     it -- so beside them it reads as a bare duplicate, and #596 adds two
     more reviewer actions to the same trail.

     Folded away here rather than at the write site: the events already in
     localStorage would otherwise keep their duplicate card until someone
     cleared their browser, and the envelope still carries FR-088 timing and
     the audit fact that a submit happened.

     Dropped only when that same reviewer's next act was a decision. A
     reviewer who recorded no decision at all emits none, leaving the
     envelope as their only trace in the reviewer bucket. The annotator's
     `submitted` is never dropped -- it is the one event carrying their
     answer.

     `bypassed` counts as a decision (issue #596): it is written per outKey
     exactly like the other two, so leaving it out would resurrect the
     duplicate envelope for every reviewer who could not decide. The other
     new values do not -- `adjudicated`, `exception_resolved` and `excluded`
     close a unit rather than answer one of its outputs, and none is written
     behind a submit envelope. */
  var REVIEW_DECISION_ACTIONS = { accepted: true, modified: true, bypassed: true };

  function isReviewDecision(action) {
    return Object.prototype.hasOwnProperty.call(REVIEW_DECISION_ACTIONS, action);
  }

  /* The next event by this same actor, skipping anyone else's -- events from
     several buckets merge by timestamp, so "what this reviewer did next" is
     not always the adjacent element. */
  function nextActionByActor(events, fromIdx, actorId) {
    for (var i = fromIdx + 1; i < events.length; i += 1) {
      if (events[i].actorId === actorId) return events[i].action;
    }
    return null;
  }

  /* Takes the merged trail in ascending time order (as getSampleHistory
     returns it) and returns the events that earn a card. */
  function collapseHistory(events) {
    return events.filter(function (event, idx) {
      if (event.action !== ACTIONS.SUBMITTED || event.role !== 'reviewer') return true;
      return !isReviewDecision(nextActionByActor(events, idx, event.actorId));
    });
  }

  /* FR-087 (position-bearing half): a span-aligned comparator, registered
     per OUTPUT_TYPE_REGISTRY output-type key rather than per task. The
     plain-value path compares one stringified answer per key, which for a
     span type reads "unchanged" whenever an entity keeps its text and moves
     its boundary -- the single most common review correction there is.

     Alignment rule: an entity is the same entity when its start point AND
     its label both match, so a changed `end` is a boundary change while a
     changed label is a delete plus an add. Pairing on the label too is
     deliberate: collapsing a relabel into a boundary change would hide the
     error the reviewer actually corrected. */
  var SPAN_EXTRACTORS = {
    entity_recognition: function (snapshot) {
      return (snapshot.previewEntities || []).map(function (entity) {
        return { start: entity.start, end: entity.end, label: entity.type, text: entity.text };
      });
    },
    /* issue #581 change 2 (PR #657) moved this output type off the token
       grid: previewState.sequence_tagging now holds `spans[]` of half-open
       character offsets, the same shape entity_recognition already used.
       `text` is left for the caller to resolve (this module has no access
       to the sample's source text), matching the entity_recognition entries
       above only where a snapshot happens to carry it already. */
    sequence_tagging: function (snapshot) {
      var spans = ((snapshot.previewState || {}).sequence_tagging || {}).spans;
      return (Array.isArray(spans) ? spans : []).map(function (span) {
        return { start: span.start, end: span.end, label: span.label };
      });
    },
  };

  function isPositionalOutput(outKey) {
    return Object.prototype.hasOwnProperty.call(SPAN_EXTRACTORS, outKey);
  }

  function indexSpans(snapshot, outKey) {
    return SPAN_EXTRACTORS[outKey](snapshot || {}).reduce(function (byKey, span) {
      byKey[span.start + '\u0000' + span.label] = span;
      return byKey;
    }, {});
  }

  /* Returns per-entity changes for a position-bearing output type, or null
     when the type is not one. An empty array means genuinely no change --
     the caller must not read that as "nothing to compare". */
  function diffPositional(outKey, before, after) {
    if (!isPositionalOutput(outKey)) return null;
    var was = indexSpans(before, outKey);
    var now = indexSpans(after, outKey);
    var changes = [];
    Object.keys(now).forEach(function (key) {
      var current = now[key];
      var previous = was[key];
      if (!previous) changes.push({ kind: 'added', span: current });
      else if (previous.end !== current.end) changes.push({ kind: 'boundary', span: current, from: previous });
    });
    Object.keys(was).forEach(function (key) {
      if (!now[key]) changes.push({ kind: 'removed', span: was[key] });
    });
    return changes.sort(function (a, b) {
      return a.span.start - b.span.start;
    });
  }

  /* FR-088 duration formatting. Whole seconds under a minute, m:ss above
     it -- both consumers answer "was this quick or slow", and a millisecond
     figure only adds noise there. It lives here rather than in either page
     because the workspace history panel and the annotation-list summary
     must never disagree about what 90000ms reads as. */
  /* FR-088 total across a set of events (issue #606).

     A plain sum is wrong because lead_time is not per-event: it is the
     running page-visible accumulator for one OPEN SESSION, stamped with the
     started_at of that opening and copied verbatim onto every event a single
     submit writes -- the envelope plus one decision per outKey. Summing the
     column therefore multiplies a reviewer's time by their output count.

     So group by session and sum the groups. The session is (actorId,
     started_at): started_at alone would merge two people who happened to
     open the sample at the same instant, and actorId alone would merge the
     two openings of one reviewer who came back to the sample later -- which
     is real additional work and must still add up.

     Within a group take the largest value, not the first or the last. The
     accumulator only grows while the session is open, so the largest is the
     session's final duration regardless of what order the events merged in.
     This is deliberately NOT a global maximum: that would collapse the two
     sessions the grouping just kept apart.

     Events with no started_at each count on their own. They predate FR-088
     and carry no session identity, so there is nothing to group them by, and
     assuming they share one would silently shrink historical totals. */
  function totalLeadTime(events) {
    var sessions = {};
    var total = 0;
    (events || []).forEach(function (event) {
      var lead = event && typeof event.lead_time === 'number' ? event.lead_time : 0;
      if (!lead) return;
      if (!event.started_at) {
        total += lead;
        return;
      }
      /* NUL-joined: neither an actor id nor a timestamp can contain one, so
         two different pairs can never collide into one key. */
      var key = (event.actorId || '') + '\u0000' + event.started_at;
      if (!Object.prototype.hasOwnProperty.call(sessions, key) || sessions[key] < lead) {
        sessions[key] = lead;
      }
    });
    Object.keys(sessions).forEach(function (key) { total += sessions[key]; });
    return total;
  }

  function formatLeadTime(ms) {
    var totalSeconds = Math.max(0, Math.round(ms / 1000));
    if (totalSeconds < 60) return totalSeconds + 's';
    var seconds = totalSeconds % 60;
    return Math.floor(totalSeconds / 60) + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
  }

  global.LabelSuiteAnnotationHistory = {
    ACTIONS: ACTIONS,
    ACTION_VALUES: ACTION_VALUES,
    isKnownAction: isKnownAction,
    badgeClassFor: badgeClassFor,
    ACTION_LABEL: ACTION_LABEL,
    actionLabelFor: actionLabelFor,
    collapseHistory: collapseHistory,
    isPositionalOutput: isPositionalOutput,
    diffPositional: diffPositional,
    totalLeadTime: totalLeadTime,
    formatLeadTime: formatLeadTime,
  };
})(window);
