/* annotation-workspace.config.js
 * Host glue for the Annotation Workspace page (spec 015 v2.0.0). Mounts the
 * shared task-config engine (task-config.{data,yaml,dataset,engine}.js) the
 * same way task-detail.config.js does for the task-detail page: supplies
 * the required globals (state, t, el, setText, ...), seeds engine state
 * from a resolved TaskProfile, and renders the outputs[]-driven annotation
 * preview via updateAnnotationPreview()/renderOutputPreview().
 *
 * Every output-type panel the engine renders is registry-driven; this file
 * only *relabels* (data-testid/aria-pressed/data-value-set) the DOM the
 * engine already produced -- it never hardcodes per-task_id branches
 * (constitution: Generalization-First).
 */
(function () {
  'use strict';

  /* ── i18n ─────────────────────────────────────────────────────── */
  var I18N = {
    zh: {
      sampleListTitle: '標記清單',
      submitLabel: '提交',
      saveLabel: '儲存草稿',
      wsSaveSuccess: '已儲存',
      skipLabel: '跳過',
      skipReasonPlaceholder: '跳過理由（必填）',
      skipNeedsReason: '請先填寫跳過理由，再跳過這一筆',
      skipSuccess: '已跳過這一筆',
      arbitrationReasonPlaceholder: '裁定理由（必填）',
      arbitrationNeedsReason: '請先填寫裁定理由再送出，尚未填寫的項目',
      wsPrevBtnLabel: '上一筆',
      wsNextBtnLabel: '下一筆',
      wsProgressText: '{done} / {total} 已提交',
      wsProgressTextReview: '我的審核提交 {done} / {total} 個審核單位',
      wsAutosaveInitial: '尚未儲存',
      wsAutosaveDirty: '尚未儲存的變更',
      wsAutosaveSavedAt: '上次儲存於 {time}',
      wsTabGuideline: '說明與檔案',
      wsTabHistory: '歷程',
      wsStatusSubmitted: '已提交',
      wsStatusSaved: '已儲存',
      wsStatusPending: '待標記',
      wsHistoryEmpty: '此筆樣本尚無歷程紀錄',
      wsHistoryRoleAnnotator: '標記員',
      wsHistoryRoleReviewer: '審核員',
      wsHistoryReasonLabel: '理由：',
      wsHistoryLeadTimeLabel: '耗時：',
      wsHistoryDiffAdded: '新增',
      wsHistoryDiffRemoved: '刪除',
      wsHistoryDiffBoundary: '邊界變更',
      guidelineModalTitle: '請先閱讀任務說明',
      guidelineModalConfirm: '我已閱讀，開始標記',
      guidelineSummaryTitle: '任務說明',
      guidelineFileActionPreview: '預覽',
      mobileDrawerTitle: '說明與檔案',
      guidelineImageModalCloseAria: '關閉圖片預覽',
      guidelinePdfModalCloseAria: '關閉 PDF 預覽',
      guidelineMdModalCloseAria: '關閉 Markdown 預覽',
      wsSubmitIncomplete: '請完成所有標記項目後再提交',
      wsSubmitSuccess: '已提交',
      reviewSubmitLabel: '送出審核',
      reviewApproveLabel: '通過',
      reviewModifyLabel: '修正',
      reviewBypassLabel: '無法判定',
      wsReviewSubmitSuccess: '審核已送出',
      reviewNoAnswer: '（無）',
      reviewNote: '通過：該項直接定稿，正式標記中即成為最終答案。修正：您的修正不會立即生效，該項進入爭議池待仲裁。無法判定：同樣進入爭議池，仲裁者採用審核員側即定案為無法判定。試標與正式標記皆不會將樣本送回給標記員重做。',
      reviewNoteDryRunExtra: '試標的定稿只彙總一致性與被修改率，不產生最終答案。',
      reviewNoteTriggerLabel: '審核決策說明',
      reviewReasonLabel: '理由（必填）',
      reviewReasonPlaceholder: '請說明理由',
      toastReasonRequired: '請填寫以下輸出類型的理由：{list}',
      reviewCorrectionTitle: '直接修正（Reviewer 修正後答案）',
      toastSelectDecision: '請完成以下輸出類型的審核決策：{list}',
      toastReviewCorrectionReset: '偵測到直接修正的內容因重新整理而遺失，對應的審核決策已重置，請重新確認後再送出',
      toastResolveDivergent: '請先裁定所有分歧項目',
      arbitrationTitle: '爭議仲裁',
      arbitrationNote: '此審核單位已進入爭議池。請逐項裁定採用 A（標記員）、B（審核員）或兩者皆非；仲裁不重新標記，僅逐爭議項選定定稿值。',
      arbitrationAgreedTitle: '標記內容（唯讀）',
      arbitrationSubmitLabel: '送出仲裁',
      toastArbitrationIncomplete: '請完成所有爭議項目的裁定',
      wsArbitrationSubmitSuccess: '仲裁已提交',
      arbitrationChoiceA: 'A・標記員',
      arbitrationChoiceB: 'B・審核員',
      arbitrationChoiceBBypass: 'B・審核員 Bypass（無法判定）',
      arbitrationChoiceReject: '兩者皆非',
      arbitrationPureRejectLabel: '審核員退回（無替代值）',
      historyActionOverridden: '已覆寫',
      historyActionGoldConfirmed: '已確認標準答案',
      historyActionGoldReopened: '重新開放標準答案',
      unitCtxRunDry: '試標',
      unitCtxRunDryRound: '試標 R{round}',
      unitCtxRunOfficial: '正式標記',
      crumbWorkAreaReviewer: '審核作業',
      crumbWorkAreaAnnotator: '標記作業',
      crumbTaskTpl: '{name}（{run}）',
      crumbUnitTpl: '審核單位 {sample} · {annotator}',
      crumbSamplePosTpl: '樣本 {i} / {n}',
      wsSampleGroupCount: '{n} 位標記員',
      wsSampleGroupAria: '樣本 {sample}，{n} 位標記員',
      wsSampleUnitAria: '樣本 {sample}，標記員 {annotator}，{state}',
      unitStatePending: '待審',
      unitStateDisputed: '爭議中',
      unitStateFinalized: '已定稿',
      unitStateNone: '尚無標記提交',
      reviewEmptyUnitNote: '此標記員尚未提交此樣本，暫無可審核的內容。',
      reviewFinalizedTitle: '審核已定稿',
      reviewFinalizedNote: '此審核單位已定稿，結果為唯讀。',
      traceLabel: '歷程：',
      traceAnnotator: '標記',
      traceReviewer: '審核',
      traceArbitration: '仲裁',
      traceExceptionPool: '例外池',
      traceDecisionTpl: '（{decision}）',
      exceptionActionAdoptAnnotator: '採用標記員答案',
      exceptionActionAdoptReviewer: '採用審核員答案',
      exceptionActionCustomAnswer: '自訂答案',
      exceptionActionExcludeFromDataset: '排除於資料集',
      wsExceptionPoolTitle: '例外池收尾',
      wsExceptionPoolNote: '仲裁判定兩者皆非的爭議項，由專案負責人逐項決定最終處置。',
      exceptionPoolContextTpl: '標記員：{a} · 審核員：{b}',
      exceptionPoolReasonPlaceholder: '處置理由（必填）',
      exceptionPoolReasonRequired: '請先填寫理由再確認',
      exceptionPoolConfirmLabel: '確認',
      wsExceptionPoolResolveSuccess: '已完成處置',
      wsHistoryRoleProjectLeader: '專案負責人',
      unitStateDisputedNote: '未定稿，待仲裁',
      trackAria: '審核單位狀態',
      trackMarker: '目前：',
      trackBranchSame: '審核通過',
      trackBranchDiffering: '修正或無法判定',
      trackBranchArbitrated: '仲裁後',
      flowDrawerOpen: '了解審核流程',
      flowDrawerTitle: '審核流程',
      flowDrawerCloseAria: '關閉審核流程',
      unitStateFinalizedNote: '已鎖定',
      unitStateAria: '審核單位狀態：{state}',
      unitStateAriaFinalized: '審核單位狀態：{state}，內容已鎖定',
      reviewOriginalAnswerLabel: '標記員原答案：',
      reviewCorrectedAnswerLabel: 'Reviewer 修正後答案：',
      toastReviewDecisionResetOnEdit: '直接修正的值已變更，對應的審核決策已重置，請重新確認後再送出',
    },
    en: {
      sampleListTitle: 'Samples',
      submitLabel: 'Submit',
      saveLabel: 'Save draft',
      wsSaveSuccess: 'Saved',
      skipLabel: 'Skip',
      skipReasonPlaceholder: 'Reason for skipping (required)',
      skipNeedsReason: 'Give a reason before skipping this sample',
      skipSuccess: 'Sample skipped',
      arbitrationReasonPlaceholder: 'Reason for this decision (required)',
      arbitrationNeedsReason: 'Give a reason before finalizing. Still missing',
      wsPrevBtnLabel: 'Previous',
      wsNextBtnLabel: 'Next',
      wsProgressText: '{done} / {total} submitted',
      wsProgressTextReview: 'My review submissions {done} / {total} review units',
      wsAutosaveInitial: 'Not saved yet',
      wsAutosaveDirty: 'Unsaved changes',
      wsAutosaveSavedAt: 'Last saved at {time}',
      wsTabGuideline: 'Guidelines & Files',
      wsTabHistory: 'History',
      wsStatusSubmitted: 'Submitted',
      wsStatusSaved: 'Saved',
      wsStatusPending: 'Pending',
      wsHistoryEmpty: 'No history for this sample yet',
      wsHistoryRoleAnnotator: 'Annotator',
      wsHistoryRoleReviewer: 'Reviewer',
      wsHistoryReasonLabel: 'Reason: ',
      wsHistoryLeadTimeLabel: 'Time spent: ',
      wsHistoryDiffAdded: 'Added',
      wsHistoryDiffRemoved: 'Removed',
      wsHistoryDiffBoundary: 'Boundary',
      guidelineModalTitle: 'Please read the task guideline first',
      guidelineModalConfirm: "I've read it, start annotating",
      guidelineSummaryTitle: 'Task Guideline',
      guidelineFileActionPreview: 'Preview',
      mobileDrawerTitle: 'Guidelines & Files',
      guidelineImageModalCloseAria: 'Close image preview',
      guidelinePdfModalCloseAria: 'Close PDF preview',
      guidelineMdModalCloseAria: 'Close Markdown preview',
      wsSubmitIncomplete: 'Please answer every output before submitting',
      wsSubmitSuccess: 'Submitted',
      reviewSubmitLabel: 'Submit review',
      reviewApproveLabel: 'Approve',
      reviewModifyLabel: 'Modify',
      reviewBypassLabel: 'Cannot determine',
      wsReviewSubmitSuccess: 'Review submitted',
      reviewNoAnswer: '(none)',
      reviewNote: 'Approve: the item is finalized as it stands, and in an official run that value becomes the final answer. Modify: your correction does not take effect immediately; the item enters the dispute pool for arbitration. Cannot determine: the item also enters the dispute pool, and an arbiter adopting the reviewer side settles it as undecidable. Neither a dry run nor an official run sends the sample back to the annotator to redo it.',
      reviewNoteDryRunExtra: ' A dry-run finalization produces no final answer; it only aggregates agreement and the modification rate.',
      reviewNoteTriggerLabel: 'Review decision guidance',
      reviewReasonLabel: 'Reason (required)',
      reviewReasonPlaceholder: 'Explain the reason',
      toastReasonRequired: 'Please give a reason for the following output types: {list}',
      reviewCorrectionTitle: "Direct correction (reviewer's corrected answer)",
      toastSelectDecision: 'Please decide on the following output types before submitting: {list}',
      toastReviewCorrectionReset: 'The direct correction was lost on reload, so the matching review decision was reset -- please re-confirm before submitting',
      toastResolveDivergent: 'Please resolve every divergent item first',
      arbitrationTitle: 'Dispute arbitration',
      arbitrationNote: 'This review unit is in the dispute pool. Decide each item as A (annotator), B (reviewer), or neither; arbitration does not re-annotate, it only settles a final value per disputed item.',
      arbitrationAgreedTitle: 'Annotation (read-only)',
      arbitrationSubmitLabel: 'Submit arbitration',
      toastArbitrationIncomplete: 'Please decide every dispute item first',
      wsArbitrationSubmitSuccess: 'Arbitration submitted',
      arbitrationChoiceA: 'A · Annotator',
      arbitrationChoiceB: 'B · Reviewer',
      arbitrationChoiceBBypass: 'B · Reviewer Bypass (undecidable)',
      arbitrationChoiceReject: 'Neither (reject both)',
      arbitrationPureRejectLabel: 'Reviewer rejected (no replacement value)',
      historyActionOverridden: 'Overridden',
      historyActionGoldConfirmed: 'Gold confirmed',
      historyActionGoldReopened: 'Gold reopened',
      unitCtxRunDry: 'Dry Run',
      unitCtxRunDryRound: 'Dry Run R{round}',
      unitCtxRunOfficial: 'Official Run',
      crumbWorkAreaReviewer: 'Review',
      crumbWorkAreaAnnotator: 'Annotate',
      crumbTaskTpl: '{name} ({run})',
      crumbUnitTpl: 'Review unit {sample} · {annotator}',
      crumbSamplePosTpl: 'Sample {i} of {n}',
      wsSampleGroupCount: '{n} annotators',
      wsSampleGroupAria: 'Sample {sample}, {n} annotators',
      wsSampleUnitAria: 'Sample {sample}, annotator {annotator}, {state}',
      unitStatePending: 'Pending review',
      unitStateDisputed: 'Disputed',
      unitStateFinalized: 'Finalized',
      unitStateNone: 'No submission yet',
      reviewEmptyUnitNote: 'This annotator has not submitted this sample yet; there is nothing to review.',
      reviewFinalizedTitle: 'Review finalized',
      reviewFinalizedNote: 'This review unit is finalized; results are read-only.',
      traceLabel: 'Trace: ',
      traceAnnotator: 'Annotated',
      traceReviewer: 'Reviewed',
      traceArbitration: 'Arbitrated',
      traceExceptionPool: 'Exception pool',
      traceDecisionTpl: ' ({decision})',
      exceptionActionAdoptAnnotator: 'Adopt annotator answer',
      exceptionActionAdoptReviewer: 'Adopt reviewer answer',
      exceptionActionCustomAnswer: 'Custom answer',
      exceptionActionExcludeFromDataset: 'Exclude from dataset',
      wsExceptionPoolTitle: 'Exception pool disposition',
      wsExceptionPoolNote: 'Dispute items arbitration marked neither side adoptable, decided one at a time by a project leader.',
      exceptionPoolContextTpl: 'Annotator: {a} · Reviewer: {b}',
      exceptionPoolReasonPlaceholder: 'Reason for this disposition (required)',
      exceptionPoolReasonRequired: 'Give a reason before confirming',
      exceptionPoolConfirmLabel: 'Confirm',
      wsExceptionPoolResolveSuccess: 'Disposition recorded',
      wsHistoryRoleProjectLeader: 'Project leader',
      unitStateDisputedNote: 'not finalized, awaiting arbitration',
      trackAria: 'Review unit status',
      trackMarker: 'Now:',
      trackBranchSame: 'Review approved',
      trackBranchDiffering: 'Modified or undecidable',
      trackBranchArbitrated: 'After arbitration',
      flowDrawerOpen: 'Review flow',
      flowDrawerTitle: 'Review flow',
      flowDrawerCloseAria: 'Close the review flow',
      unitStateFinalizedNote: 'locked',
      unitStateAria: 'Review unit status: {state}',
      unitStateAriaFinalized: 'Review unit status: {state}, locked',
      reviewOriginalAnswerLabel: "Annotator's original answer: ",
      reviewCorrectedAnswerLabel: "Reviewer's corrected answer: ",
      toastReviewDecisionResetOnEdit: 'The direct correction changed, so the matching review decision was reset -- please re-confirm before submitting',
    },
  };
  if (window.TASK_CONFIG_I18N) {
    Object.assign(I18N.zh, window.TASK_CONFIG_I18N.zh);
    Object.assign(I18N.en, window.TASK_CONFIG_I18N.en);
  }

  /* ── shared engine state (see task-config.engine.js header comment for
     the full list of fields the engine reads) ────────────────────── */
  var state = {
    lang: 'zh',
    selectedOutputTypes: [],
    outputConfigs: {},
    previewState: {},
    previewEntities: [],
    previewTriples: [],
    previewBypass: {},
    relDraft: { e1: null, rel: null, e2: null },
    activeEntityType: null,
    previewInited: false,
    datasetParsedColumns: [],
    datasetFieldProfile: {},
    datasetRawFirstRow: {},
    datasetPreviewRawRows: [],
    datasetParsedRows: [],
    datasetColumnUniqueValues: {},
    datasetTotalRecords: 0,
    fieldRoleMap: {},
    columnOutputTypeMap: {},
    itemPairLabels: null,
    taskInputTypes: ['single_item'],
    codeDraftDirty: false,
    _datasetRoots: [],
    datasetFiles: [],
    datasetRecordPath: '$',
  };

  /* ── required engine host globals ────────────────────────────────
     (task-config.engine.js header comment: state, t, el, setText,
     markDirty, revalidateCurrentStep, showFieldError, showToast, track,
     onChipSelectionChange, showTaxonomyDeleteModal/hideTaxonomyDeleteModal,
     getDatasetTotalEstimate).
     engine.js is a plain (non-module) top-level script: its functions close
     over the *true* global scope, not this IIFE's local scope, so every
     name on that contract must be attached to `window` explicitly -- a
     bare `var`/`function` declaration in here is invisible to it. */
  function t(key) {
    return (I18N[state.lang] || I18N.zh)[key] || key;
  }
  function el(id) {
    return document.getElementById(id);
  }
  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }
  function markDirty() {}
  function revalidateCurrentStep() {}
  function showFieldError() {}
  var toastTimer = null;
  /* Auto-dismiss per UXC-07: Error never auto-dismisses (manual close only). */
  var TOAST_DURATIONS = { success: 3000, info: 5000, warning: 8000, error: 0 };
  function showToast(msg, variant) {
    var toast = document.getElementById('toast');
    var toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    var v = TOAST_DURATIONS.hasOwnProperty(variant) ? variant : 'success';
    toast.className = 'toast toast-' + v + ' visible';
    toastMsg.textContent = msg || '';
    clearTimeout(toastTimer);
    if (TOAST_DURATIONS[v] > 0) {
      toastTimer = setTimeout(function () {
        toast.classList.remove('visible');
      }, TOAST_DURATIONS[v]);
    }
  }
  function hideToast() {
    var toast = document.getElementById('toast');
    if (toast) toast.classList.remove('visible');
    clearTimeout(toastTimer);
  }
  var toastCloseBtn = document.getElementById('toastClose');
  if (toastCloseBtn) toastCloseBtn.addEventListener('click', hideToast);
  function track() {}
  function onChipSelectionChange() {}
  function showTaxonomyDeleteModal(descendantCount, onConfirm) {
    if (typeof onConfirm === 'function') onConfirm();
  }
  function hideTaxonomyDeleteModal() {}
  function getDatasetTotalEstimate() {
    return currentProfile ? currentProfile.datasetRecords.length : 0;
  }

  window.state = state;
  window.t = t;
  window.el = el;
  window.setText = setText;
  window.markDirty = markDirty;
  window.revalidateCurrentStep = revalidateCurrentStep;
  window.showFieldError = showFieldError;
  window.showToast = showToast;
  window.renderMarkdown = renderMarkdown;
  window.track = track;
  window.onChipSelectionChange = onChipSelectionChange;
  window.showTaxonomyDeleteModal = showTaxonomyDeleteModal;
  window.hideTaxonomyDeleteModal = hideTaxonomyDeleteModal;
  window.getDatasetTotalEstimate = getDatasetTotalEstimate;

  /* ── testid-patch monkeypatch of renderOutputPreview ─────────────
     Captured BEFORE the override assignment below (var-hoisting of a
     later `function renderOutputPreview(){}` declaration in this same
     script would otherwise clobber the engine's original before this
     line runs -- using a plain assignment to a *new* name sidesteps
     that hoisting hazard entirely). */
  var originalRenderOutputPreview = renderOutputPreview;
  function patchedRenderOutputPreview(container, outKey) {
    container.setAttribute('data-testid', 'ws-output-panel-' + outKey);
    originalRenderOutputPreview(container, outKey);
    patchOutputPanel(outKey, container);
    /* relation_identification's bypass chip lives inside the unified
       entity+relation preview (patched separately by the
       renderAbsaUnifiedPreview monkeypatch below), not in this container. */
    if (outKey !== 'relation_identification') patchBypassChip(container, outKey);
  }
  renderOutputPreview = patchedRenderOutputPreview;

  /* ── card-regrouping monkeypatch of updateAnnotationPreview ──────
     The engine re-runs updateAnnotationPreview() from its own interaction
     handlers (chip clicks, taxonomy picks, ...), each time rebuilding
     #annotationPreview as flat siblings. The question-vs-annotation card
     split (spec 015 v2.3.0, 區塊 B) must therefore live on the patched
     function itself -- patching only renderWorkspace() would lose the
     cards on the first in-panel interaction. */
  var originalUpdateAnnotationPreview = updateAnnotationPreview;
  function patchedUpdateAnnotationPreview() {
    originalUpdateAnnotationPreview();
    if (!currentProfile || currentRole === 'reviewer') return;
    patchEvidenceAndInputContent();
    renderEvidenceReferenceCard();
    patchItemPairLayout();
    wrapAnnotatorCards();
  }
  updateAnnotationPreview = patchedUpdateAnnotationPreview;

  /* Regroup the engine's flat sibling output into two content-cards: the
     question block (evidence + input text) and the annotation block (all
     output-type panels). The boundary is found structurally -- the first
     .preview-unified wrap or ws-output-panel-* container, stepping back
     over the title/divider the engine renders immediately before it --
     never by task_id or output-type name (Generalization-First). */
  function wrapAnnotatorCards() {
    var preview = document.getElementById('annotationPreview');
    if (!preview || preview.children.length === 0) return;
    var first = preview.children[0];
    if (first.getAttribute && /^ws-(question|annotation)-card$/.test(first.getAttribute('data-testid') || '')) return;
    var children = Array.prototype.slice.call(preview.children);
    var boundary = children.length;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var testid = (child.getAttribute && child.getAttribute('data-testid')) || '';
      if ((child.classList && child.classList.contains('preview-unified')) || /^ws-output-panel-/.test(testid)) {
        boundary = i;
        break;
      }
    }
    while (boundary > 0) {
      var prev = children[boundary - 1];
      var isTitleOrDivider =
        prev.classList &&
        (prev.classList.contains('annotation-preview-task-title') ||
          prev.classList.contains('annotation-preview-divider'));
      if (!isTitleOrDivider) break;
      boundary--;
    }
    var questionEls = children.slice(0, boundary);
    var outputEls = children.slice(boundary);
    if (questionEls.length > 0) {
      var questionCard = document.createElement('div');
      questionCard.className = 'content-card';
      questionCard.setAttribute('data-testid', 'ws-question-card');
      questionEls.forEach(function (node) { questionCard.appendChild(node); });
      preview.appendChild(questionCard);
    }
    if (outputEls.length > 0) {
      var annotationCard = document.createElement('div');
      annotationCard.className = 'content-card';
      annotationCard.setAttribute('data-testid', 'ws-annotation-card');
      outputEls.forEach(function (node) { annotationCard.appendChild(node); });
      preview.appendChild(annotationCard);
    }
  }

  function patchOutputPanel(outKey, container) {
    if (outKey === 'single_label') patchSingleLabelPanel(container);
    else if (outKey === 'single_dim') patchSingleDimPanel(container);
    else if (outKey === 'free_text') patchFreeTextPanel(container);
    else if (outKey === 'multi_label') patchMultiLabelPanel(container);
    else if (outKey === 'multi_dim') patchMultiDimPanel(container);
    else if (outKey === 'sequence_tagging') patchSequenceTaggingPanel(container);
    else if (outKey === 'entity_recognition') patchSpanOnlyPanel(container);
    /* relation_identification routes entirely through
       renderAbsaUnifiedPreview -- patched by its own monkeypatch. */
  }

  /* ── shared bypass-chip patching (all output types) ──────────────
     makeBypassChip()/appendBypassControl() (task-config.engine.js) always
     emit the same fixed bilingual label text, so it's found the same way
     for every output type -- no per-type lookup needed. Playwright's
     .check()/.uncheck() require a native checkbox/radio input OR an ARIA
     checkbox/radio/switch role with aria-checked; the engine's chip is a
     plain <button aria-pressed>, so role+aria-checked are added here,
     mirroring aria-pressed on every render (the chip is recreated fresh
     each render, so this must re-run every time, not just once). */
  var BYPASS_LABEL_ZH = '無法判定 (Bypass)';
  var BYPASS_LABEL_EN = 'Unable to determine (Bypass)';
  function findBypassChip(container) {
    var buttons = container.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      /* Use substring match, not exact equality: makeBypassChip() prepends
         a "✓" glyph to the chip's own textContent once active/bypassed, so
         an exact-equality check would only match the chip on its very
         first (never-yet-bypassed) render and silently miss it afterward. */
      var text = buttons[i].textContent.trim();
      if (text.indexOf(BYPASS_LABEL_ZH) >= 0 || text.indexOf(BYPASS_LABEL_EN) >= 0) return buttons[i];
    }
    return null;
  }
  /* Native `.disabled` on every interactive descendant except the bypass
     chip itself (which must stay clickable so the annotator can un-bypass).
     The engine's own disableBypassedArea() only sets CSS opacity/
     pointerEvents, never the native `disabled` property Playwright's
     toBeDisabled() checks. */
  function applyBypassDisabledState(container, excludeEl) {
    var interactive = container.querySelectorAll('button, input, select, textarea');
    Array.prototype.forEach.call(interactive, function (node) {
      if (node === excludeEl) return;
      node.disabled = true;
    });
  }
  function patchBypassChip(container, outKey) {
    var chip = findBypassChip(container);
    if (!chip) return;
    chip.setAttribute('data-testid', 'ws-bypass-' + outKey);
    chip.setAttribute('role', 'checkbox');
    chip.setAttribute('aria-checked', chip.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
    /* The taxonomy selector dialog (multi_label) is absolutely positioned
       with z-index:40 and overlays whatever renders after it in the same
       container (the bypass control included) while open -- the same
       visual contract as task-new Step 2. Do NOT lift the bypass row above
       it: the engine's outside-click handler already closes the dialog on
       the first click outside the selector, so the control is reachable by
       simply dismissing the dialog first. */
    if (state.previewBypass[outKey]) applyBypassDisabledState(container, chip);
  }

  function patchSingleLabelPanel(container) {
    var ps = state.previewState.single_label || {};
    var buttons = container.querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function (chip) {
      /* The bypass chip already sets its own aria-pressed (makeBypassChip);
         leave it alone here -- it gets its ws-bypass-{type} testid in
         Phase 2. */
      if (chip.hasAttribute('aria-pressed')) return;
      var label = chip.textContent.trim();
      if (!label) return;
      chip.setAttribute('data-testid', 'ws-single-label-chip-' + label);
      chip.setAttribute('aria-pressed', ps.selected === label ? 'true' : 'false');
    });
  }

  function patchSingleDimPanel(container) {
    var slider = container.querySelector('[data-testid="single-dim-slider"]');
    if (!slider) return;
    var valueEl = container.querySelector('[data-testid="single-dim-value-tooltip"]');
    var input = container.querySelector('[data-testid="single-dim-value-input"]');
    slider.setAttribute('data-testid', 'ws-single-dim-slider');
    if (valueEl) valueEl.setAttribute('data-testid', 'ws-single-dim-value');
    if (input) input.setAttribute('data-testid', 'ws-single-dim-input');

    var ps = state.previewState.single_dim || {};
    /* The value label always mirrors the slider's current number (prefill
       per FR-024M, or the engine's midpoint start position), matching the
       number input beside it -- the engine's own task-new Step 2 behavior.
       "Unanswered" is enforced at the submit gate (isOutputAnswered reads
       ps._touched/ps._seeded), not by dashing the display. The one state
       that dashes the label is bypass: the answer is explicitly cleared,
       so no number may show. */
    if (state.previewBypass.single_dim) {
      slider.dataset.valueSet = 'false';
      if (valueEl) valueEl.textContent = '—';
    } else {
      slider.dataset.valueSet = 'true';
    }

    slider.addEventListener('input', function () {
      ps._touched = true;
      slider.dataset.valueSet = 'true';
    });
    if (input) {
      input.addEventListener('input', function () {
        ps._touched = true;
        slider.dataset.valueSet = 'true';
      });
    }
  }

  function patchFreeTextPanel(container) {
    /* free_text is the only current output type with rendersInputPreview:true,
       so its container embeds the input-preview block ahead of the actual
       answer control. Tag it directly (engine.js ~3199-3201 always renders
       generation-input-preview inside this same container when free_text
       owns the input preview) instead of depending on the annotator-only
       patchEvidenceAndInputContent() -- buildReviewRow() reuses this same
       renderOutputPreview() dispatch for the reviewer's correction control,
       which never calls that annotator-only patch. Move the
       ws-output-panel-free_text testid off the container (which would
       otherwise start at the same y as the input preview it wraps) onto the
       response-area sub-tree, so it represents only the answer control --
       matching every other output type, whose container IS the answer
       control since they don't own an input preview. */
    var inputPreview = container.querySelector('[data-testid="generation-input-preview"]');
    if (inputPreview) inputPreview.setAttribute('data-testid', 'ws-input-content');
    var responseArea = container.querySelector('[data-testid="free-text-response-area"]');
    if (responseArea) {
      container.removeAttribute('data-testid');
      responseArea.setAttribute('data-testid', 'ws-output-panel-free_text');
    }
    var textarea = container.querySelector('[data-testid="generation-answer-input"]');
    if (!textarea) return;
    textarea.setAttribute('data-testid', 'ws-free-text-input');
    var counter = textarea.nextElementSibling;
    if (!counter) return;
    counter.setAttribute('data-testid', 'ws-free-text-counter');
    var cfg = state.outputConfigs.free_text || {};
    var maxLen = cfg.max_length || 512;
    function refreshCounter() {
      counter.textContent = textarea.value.length + '/' + maxLen;
    }
    refreshCounter();
    textarea.addEventListener('input', refreshCounter);
  }

  /* multi_label: the trigger+dialog UI is reused verbatim from task-new
     Step 2's preview (see claude-progress.md 裁決 2026-08-07) -- this only
     relabels testids on the engine-produced DOM, it never builds a custom
     chip bar. ws-multi-label-chip-{id} is the *selected-path* chip
     (taxonomy-selected-path), not a standalone toggle. */
  function patchMultiLabelPanel(container) {
    var ps = state.previewState.multi_label || {};
    var selected = Array.isArray(ps.selected) ? ps.selected : [];

    function tagOptions() {
      var options = container.querySelectorAll('[data-testid="taxonomy-preview-option"]');
      Array.prototype.forEach.call(options, function (option) {
        var nodeId = option.getAttribute('data-node-id');
        if (nodeId != null) option.setAttribute('data-testid', 'ws-multi-label-node-' + nodeId);
      });
    }
    tagOptions();

    var trigger = container.querySelector('[data-testid="taxonomy-selector-trigger"]');
    if (trigger) {
      trigger.setAttribute('data-testid', 'ws-multi-label-selector-toggle');
      /* Opening the dialog calls the engine's own renderChoices() directly
         (not refreshOutputPreview), rebuilding every option node without
         going through this monkeypatch -- re-tag after the engine's own
         (synchronously-registered-first) click handler has already run. */
      trigger.addEventListener('click', tagOptions);
    }

    /* Selected-path chips render in the same order as ps.selected; the leaf
       id (last entry of each idPath) is the chip's testid suffix. */
    var chips = container.querySelectorAll('[data-testid="taxonomy-selected-path"]');
    Array.prototype.forEach.call(chips, function (chip, idx) {
      var path = selected[idx];
      var leafId = Array.isArray(path) && path.length ? path[path.length - 1] : null;
      if (leafId != null) chip.setAttribute('data-testid', 'ws-multi-label-chip-' + leafId);
    });

    /* The engine proactively aria-disables options once max_selections is
       reached (no native "limit hit" hint) -- surface one here so the
       annotator gets the same feedback the disabled state implies. */
    var cfg = state.outputConfigs.multi_label || {};
    var maxSetting = Number(cfg.max_selections) || 0;
    if (maxSetting > 0 && selected.length >= maxSetting) {
      var hint = document.createElement('div');
      hint.className = 'field-hint';
      hint.setAttribute('data-testid', 'ws-multi-label-limit-hint');
      hint.textContent =
        state.lang === 'zh'
          ? '已達最多可選數量（' + maxSetting + '）'
          : 'You can select at most ' + maxSetting + ' labels';
      container.appendChild(hint);
    }
  }

  /* renderMultiDimPreview() (engine.js ~1772-1821) gives every dimension's
     slider/value/numeric-input the SAME fixed testid ('multi-dim-slider' /
     'multi-dim-value-tooltip' / 'multi-dim-value-input') and re-seeds every
     slider from the gold output column (or the range midpoint) on every
     render -- it owns no per-dimension previewState of its own, unlike
     single_dim/single_label. Positional zip against state.outputConfigs
     .multi_dim's dims array (same order the engine iterated in) gives each
     control its per-dimension testid, and ps.dims{} (this host's own nested
     previewState, persisted/restored generically like any other output
     type's previewState) tracks which dimensions the annotator has actually
     touched -- the submit gate (isOutputAnswered) needs that distinction;
     the value label itself keeps the engine's always-numeric display
     (prefill or midpoint), dashing only while bypassed. */
  function patchMultiDimPanel(container) {
    var cfg = state.outputConfigs.multi_dim || {};
    var dims = Array.isArray(cfg.dimensions) ? cfg.dimensions : (Array.isArray(cfg.va_dimensions) ? cfg.va_dimensions : []);
    /* Unlike single_dim/single_label, the engine never calls its own
       ensurePreviewState('multi_dim', ...) -- `|| {}` here would otherwise
       build a throwaway object every render, silently discarding ps.dims
       on the very next re-render. Assign back explicitly so this host's
       own multi_dim state is the one persisted/restored by
       snapshotCurrentSample()/restoreSample() like every other output
       type's previewState entry. */
    if (!state.previewState.multi_dim) state.previewState.multi_dim = {};
    var ps = state.previewState.multi_dim;
    ps.dims = ps.dims || {};

    var controls = container.querySelectorAll('[data-testid="multi-dim-control"]');
    Array.prototype.forEach.call(controls, function (control, idx) {
      var dim = dims[idx];
      var name = dim && dim.name;
      if (!name) return;
      var slider = control.querySelector('[data-testid="multi-dim-slider"]');
      var valueEl = control.querySelector('[data-testid="multi-dim-value-tooltip"]');
      var input = control.querySelector('[data-testid="multi-dim-value-input"]');
      if (slider) slider.setAttribute('data-testid', 'ws-multi-dim-slider-' + name);
      if (valueEl) valueEl.setAttribute('data-testid', 'ws-multi-dim-value-' + name);
      if (input) input.setAttribute('data-testid', 'ws-multi-dim-value-input-' + name);

      var saved = ps.dims[name];
      if (saved && saved.touched) {
        if (slider) slider.value = saved.value;
        if (valueEl) valueEl.textContent = saved.value;
        if (input) input.value = saved.value;
      } else if (state.previewBypass.multi_dim && valueEl) {
        /* Bypass clears the answer (ps.dims included), so the label may not
           show a number; every other state keeps the engine's numeric
           display -- see the block comment above. */
        valueEl.textContent = '—';
      }

      function markTouched() {
        ps.dims[name] = { value: slider ? slider.value : null, touched: true };
      }
      if (slider) slider.addEventListener('input', markTouched);
      if (input) input.addEventListener('input', markTouched);
    });
  }

  /* renderSpanTaggingPreview() (engine.js) already implements the whole
     span interaction the workspace needs -- drag over the untokenized text,
     pick a label type, undo from the marked-span list -- so this host only
     relabels its anchors, exactly as patchSpanOnlyPanel does for
     entity_recognition. Nothing here re-binds a listener: cloning a node to
     strip one (what the retired token-grid patch did) would also strip the
     engine's own span handlers. */
  function patchSequenceTaggingPanel(container) {
    /* sequence_tagging (registry: rendersInputPreview:true, same as
       entity_recognition) suppresses updateAnnotationPreview()'s generic
       top-level input block, but renderSpanTaggingPreview() tags its own raw
       text element with data-testid="sequence-source-text" (unlike
       renderSpanOnlyPreview, whose equivalent element patchSpanOnlyPanel
       relabels positionally). Relabel that testid'd element in place --
       setAttribute keeps the mouseup handler the drag depends on. */
    var textEl = container.querySelector('[data-testid="sequence-source-text"]');
    if (textEl) textEl.setAttribute('data-testid', 'ws-input-content');

    var chips = container.querySelectorAll('[data-testid="sequence-label-option"]');
    Array.prototype.forEach.call(chips, function (chip) {
      chip.setAttribute('data-testid', 'ws-seq-label-btn-' + chip.textContent.trim());
    });

    var rows = container.querySelectorAll('[data-testid="sequence-span-item"]');
    Array.prototype.forEach.call(rows, function (row) {
      row.setAttribute('data-testid', 'ws-seq-span-item');
      var del = row.querySelector('[data-testid="sequence-span-item-delete"]');
      if (del) del.setAttribute('data-testid', 'ws-seq-span-delete');
    });

    /* FR-024A-1: word snapping is a landing-point aid the browser may not be
       able to provide. snapSelectionToWordBoundaries() already falls back to
       the raw offsets, which is silent -- say it out loud instead, so an
       annotator on such a browser reads the unsnapped result as expected
       behaviour. The task's snap_unit is reported, never rewritten. */
    var snapUnit = (state.outputConfigs.sequence_tagging || {}).snap_unit;
    var segmenterMissing = typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function';
    if (snapUnit === 'word' && segmenterMissing) {
      var notice = document.createElement('div');
      notice.setAttribute('data-testid', 'ws-seq-snap-degraded');
      notice.setAttribute('role', 'note');
      notice.style.cssText = 'margin-top:8px;font-size:0.78rem;line-height:1.5;color:var(--color-text-soft);';
      notice.textContent = state.lang === 'zh'
        ? '此瀏覽器不支援詞界判定，圈選會停在放開滑鼠的位置，請自行對齊詞的起訖。'
        : 'This browser cannot detect word boundaries, so a selection stops where you release it -- align it to the word yourself.';
      container.appendChild(notice);
    }
  }

  /* entity_recognition (registry: rendersInputPreview:true, task-config.data.js)
     already suppresses updateAnnotationPreview()'s generic top-level input
     block, but renderSpanOnlyPreview() (engine.js) never tags its own
     equivalent text element with a testid the way renderFreeTextPreview()
     does for free_text -- so patchEvidenceAndInputContent()'s lookup finds
     nothing and ws-input-content would never exist. Relabel the panel's own
     text element directly instead; its native mouseup->entity-creation
     handler is reused completely untouched (span selection, entity type
     legend, entity list all stay engine-driven). Buttons are told apart by
     textContent against the configured entity type names, not DOM position,
     since the entity list (and its own delete buttons) only renders once at
     least one entity exists. */
  function patchSpanOnlyPanel(container) {
    var cfg = state.outputConfigs.entity_recognition || {};
    var typeNames = {};
    (Array.isArray(cfg.entities) ? cfg.entities : []).forEach(function (e) {
      if (e && e.name) typeNames[e.name] = true;
    });

    /* In reviewer mode buildReviewRow() renders one independent row per
       selected output type, so when relation_identification is ALSO
       selected, renderOutputPreview('relation_identification') separately
       renders the full integrated absa-unified preview (patchAbsaUnifiedPreview
       already tags its own ws-input-content there) -- skip the duplicate
       tag here so only one ws-input-content locator exists on the page.
       (In annotator mode this branch never runs for the composed case at
       all -- updateAnnotationPreview() bypasses renderSpanOnlyPreview
       entirely and calls the unified preview directly -- so this check is a
       no-op there.) */
    var relAlsoSelected = state.selectedOutputTypes.indexOf('relation_identification') >= 0;
    var textEl = container.firstElementChild;
    if (textEl && !relAlsoSelected) textEl.setAttribute('data-testid', 'ws-input-content');

    /* The engine's own bypass-chip append (originalRenderOutputPreview's
       tail, part of the untouched engine render) already ran by this point
       -- exclude it from the button classification below, or it gets
       misread as a stray entity-list delete button. */
    var bypassChip = findBypassChip(container);

    var buttons = container.querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function (btn) {
      if (btn === bypassChip) return;
      var text = btn.textContent.trim();
      if (typeNames[text]) {
        btn.setAttribute('data-testid', 'ws-er-type-btn-' + text);
        return;
      }
      /* Not a type chip -> the per-entity delete button inside an entity
         list row; tag the row itself and the button. */
      var row = btn.parentElement;
      if (row) row.setAttribute('data-testid', 'ws-er-entity-item');
      btn.setAttribute('data-testid', 'ws-er-entity-delete');
    });
  }

  /* ── relation_identification (pure & integrated-with-entity_recognition
     modes) ──────────────────────────────────────────────────────────
     Both modes render through the SAME shared renderAbsaUnifiedPreview()
     (task-config.engine.js): pure mode reaches it via renderOutputPreview's
     per-type dispatch (patched above), integrated mode is called DIRECTLY
     from updateAnnotationPreview()'s dependency-chain branch, bypassing that
     dispatch entirely. A second, separate monkeypatch is required for that
     reason -- captured the same way as originalRenderOutputPreview above,
     and for the same reason (top-level script global closure). */
  var originalRenderAbsaUnifiedPreview = renderAbsaUnifiedPreview;
  function patchedRenderAbsaUnifiedPreview(container) {
    originalRenderAbsaUnifiedPreview(container);
    patchAbsaUnifiedPreview(container);
  }
  renderAbsaUnifiedPreview = patchedRenderAbsaUnifiedPreview;

  function fmtEntityForTriple(ent) {
    var entityLabel = ent.text || '?';
    if (ent.start != null && ent.end != null) entityLabel += ' (' + ent.start + ',' + ent.end + ')';
    return entityLabel;
  }
  function tripleReferencesEntity(triple, ent) {
    var label = fmtEntityForTriple(ent);
    return triple.subj === label || triple.obj === label;
  }

  /* Entity type legend chips + entity list rows only render when
     entity_recognition is also selected (allowEntityEditing, i.e. this IS
     the integrated mode) -- pure relation_identification never groups an
     entity region at all. Cascade-deletes any triple that referenced the
     removed entity, since the engine's own delete handler only removes the
     entity itself -- replacing (not stacking onto) its click listener keeps
     entity-splice + triple-cascade + refresh as a single atomic step. */
  function patchAbsaEntityRegion(container, entityWrap) {
    var tc = getPreviewTypeColorMap();
    var typeNames = {};
    (tc.order || []).forEach(function (name) {
      typeNames[name] = true;
    });
    var buttons = entityWrap.querySelectorAll('button');
    Array.prototype.forEach.call(buttons, function (btn) {
      var text = btn.textContent.trim();
      if (typeNames[text]) {
        btn.setAttribute('data-testid', 'ws-er-type-btn-' + text);
        return;
      }
      var row = btn.parentElement;
      if (!row || !row.parentElement) return;
      row.setAttribute('data-testid', 'ws-er-entity-item');
      var idx = Array.prototype.indexOf.call(row.parentElement.children, row);
      var deletedEntity = state.previewEntities[idx];
      var newBtn = btn.cloneNode(true);
      newBtn.setAttribute('data-testid', 'ws-er-entity-delete');
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', function () {
        var i = state.previewEntities.indexOf(deletedEntity);
        if (i < 0) return;
        state.previewEntities.splice(i, 1);
        state.previewTriples = state.previewTriples.filter(function (tr) {
          return !tripleReferencesEntity(tr, deletedEntity);
        });
        renderAbsaUnifiedPreview_refresh(container);
      });
    });
  }

  /* The relation builder itself is the engine's own sequential state
     machine (buildRelationStateMachine: passage selection → E1/Arg1 →
     Relation → E2/Arg2 → 退回/新增, plus the per-row 類型/刪除 controls on
     the triple list) — the exact control task-new Step 2 and task-detail
     標記設定 render. The workspace only relabels it with the ws-ri-*
     testid contract; it must not swap in a different builder UI.
     state.previewEntities/previewTriples/relDraft stay the single source
     of truth, so cross-sample persistence keeps working via the existing
     snapshotCurrentSample()/restoreSample() deep-clone mechanism. */
  function patchRelationSection(relSection) {
    var relList = relSection.querySelector('.absa-relation-list');

    /* Draft status chips render in fixed order E1 / Rel / E2 ahead of the
       button row (buildRelationStateMachine's status div) -- located by the
       'E1：' chip text rather than child position. */
    var statusEl = Array.prototype.find.call(relSection.children, function (child) {
      var first = child.firstElementChild;
      return first && first.tagName === 'SPAN' && first.textContent.indexOf('E1') === 0;
    });
    if (statusEl && statusEl.children.length >= 3) {
      ['e1', 'rel', 'e2'].forEach(function (key, i) {
        statusEl.children[i].setAttribute('data-testid', 'ws-ri-slot-' + key);
      });
    }

    var builderBtnIds = {};
    builderBtnIds['E1/Arg1'] = 'ws-ri-e1-btn';
    builderBtnIds['Relation'] = 'ws-ri-relation-btn';
    builderBtnIds['E2/Arg2'] = 'ws-ri-e2-btn';
    builderBtnIds[state.lang === 'zh' ? '退回' : 'Undo'] = 'ws-ri-undo-btn';
    builderBtnIds[state.lang === 'zh' ? '新增' : 'Add'] = 'ws-ri-add-btn';
    Array.prototype.forEach.call(relSection.querySelectorAll('button'), function (btn) {
      if (relList && relList.contains(btn)) return;
      var id = builderBtnIds[btn.textContent.trim()];
      if (!id) return;
      btn.setAttribute('data-testid', id);
      if (id === 'ws-ri-undo-btn') {
        btn.setAttribute('aria-label', state.lang === 'zh' ? '撤銷' : 'Undo');
      }
    });

    if (relList) {
      Array.prototype.forEach.call(relList.children, function (row) {
        if (!row.classList || !row.classList.contains('absa-relation-row')) return;
        row.setAttribute('data-testid', 'ws-ri-triple-item');
        Array.prototype.forEach.call(row.querySelectorAll('button'), function (btn) {
          var text = btn.textContent.trim();
          if (text === '類型' || text === 'type') {
            btn.setAttribute('data-testid', 'ws-ri-triple-type-btn');
          } else if (text === '刪除' || text === 'Del') {
            btn.setAttribute('data-testid', 'ws-ri-triple-delete');
          }
        });
      });
    }
  }

  /* Bypass chips for this unified view are appended last, one per selected
     output type sharing it, in push order entity_recognition then
     relation_identification (renderAbsaUnifiedPreview's own bypassChips
     array) -- reused here to assign testids positionally rather than by
     text match, since both chips can share the exact same label text when
     only one output type is present. */
  function patchAbsaBypassChips(container, entityWrap, relSection, hasSpanOut, hasRelOut) {
    var last = container.lastElementChild;
    if (!last || last === entityWrap || last === relSection) return;
    var buttons = last.querySelectorAll('button');
    if (buttons.length === 0) return;
    var isBypassWrap = Array.prototype.some.call(buttons, function (b) {
      var text = b.textContent.trim();
      return text.indexOf(BYPASS_LABEL_ZH) >= 0 || text.indexOf(BYPASS_LABEL_EN) >= 0;
    });
    if (!isBypassWrap) return;
    var order = [];
    if (hasSpanOut) order.push('entity_recognition');
    if (hasRelOut) order.push('relation_identification');
    Array.prototype.forEach.call(buttons, function (btn, i) {
      var outKey = order[i];
      if (!outKey) return;
      btn.setAttribute('data-testid', 'ws-bypass-' + outKey);
      btn.setAttribute('role', 'checkbox');
      btn.setAttribute('aria-checked', btn.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
    });
  }

  function patchAbsaUnifiedPreview(container) {
    /* renderAbsaUnifiedPreview() (engine.js ~2076) never tags its own raw-text
       node with a testid at all (unlike free_text's generation-input-preview
       or sequence_tagging's sequence-source-text) -- relabel it directly by
       its fixed CSS class, the same shape it renders in both pure
       relation_identification and integrated entity_recognition+
       relation_identification modes. */
    var textEl = container.querySelector('.absa-preview-text');
    if (textEl) textEl.setAttribute('data-testid', 'ws-input-content');

    var hasSpanOut = state.selectedOutputTypes.indexOf('entity_recognition') >= 0;
    var hasRelOut = state.selectedOutputTypes.indexOf('relation_identification') >= 0;

    var relListEl = container.querySelector('.absa-relation-list');
    var relSection = relListEl ? relListEl.parentElement : null;

    /* Group the shared text + (when present) entity legend/list into their
       own ws-output-panel-entity_recognition region -- only meaningful when
       entity_recognition is actually composed alongside relation_identification
       (i.e. this IS the integrated mode); pure relation_identification never
       renders that region at all, and its own ws-output-panel-* testid
       already comes from the outer renderOutputPreview dispatch instead. */
    var entityWrap = null;
    if (hasSpanOut) {
      var divider = container.querySelector('.annotation-preview-divider');
      if (divider) {
        entityWrap = document.createElement('div');
        entityWrap.setAttribute('data-testid', 'ws-output-panel-entity_recognition');
        var node = container.firstChild;
        while (node && node !== divider) {
          var next = node.nextSibling;
          entityWrap.appendChild(node);
          node = next;
        }
        container.insertBefore(entityWrap, divider);
      }
      patchAbsaEntityRegion(container, entityWrap || container);
      if (relSection) relSection.setAttribute('data-testid', 'ws-output-panel-relation_identification');
    }

    if (relSection && hasRelOut) patchRelationSection(relSection);

    patchAbsaBypassChips(container, entityWrap, relSection, hasSpanOut, hasRelOut);
  }

  /* Rename the evidence-card / generic input-content wraps that
     updateAnnotationPreview() builds directly (i.e. outside of the
     per-output-type renderOutputPreview dispatch patched above). */
  function patchEvidenceAndInputContent() {
    var preview = document.getElementById('annotationPreview');
    if (!preview) return;

    var evidence = preview.querySelector('[data-testid="generation-evidence-preview"]');
    if (evidence) evidence.setAttribute('data-testid', 'ws-evidence-card');

    var inputPreview = preview.querySelector('[data-testid="generation-input-preview"]');
    if (inputPreview) {
      inputPreview.setAttribute('data-testid', 'ws-input-content');
      return;
    }
    /* No output type owns rendersInputPreview/rendersEvidencePreview (e.g.
       plain single_label): updateAnnotationPreview()'s generic input block
       renders without a testid in that configuration. Tag its direct-child
       .annotation-preview-sample structurally instead of hardcoding a
       task_id branch. */
    var fallback = Array.prototype.find.call(preview.children, function (child) {
      return (
        child.classList &&
        child.classList.contains('annotation-preview-sample') &&
        !child.hasAttribute('data-testid')
      );
    });
    if (fallback) fallback.setAttribute('data-testid', 'ws-input-content');
  }

  /* ── evidence-role reference card, general fallback (FR-024N, issue #89) ──
     task-config.engine.js's updateAnnotationPreview() only builds the
     generation-evidence-preview wrap (renamed to ws-evidence-card above)
     when the selected output type's registry entry declares
     rendersEvidencePreview: true -- today only free_text (FR-024H,
     AC-2B.3). task-new Step 2 preview intentionally suppresses Evidence for
     every other output type (013 FR-003g-2) and defers its display to this
     workspace instead (013 v3.1.0 changelog) -- that promise has no landing
     spot for the other 7 OUTPUT_TYPE_KEYS without this patch. Left as a
     patch here rather than a change to the shared engine gate, since that
     gate must stay untouched for task-new's own preview. Read-only: plain
     text nodes only, no input/editable control. */
  function renderEvidenceReferenceCard() {
    var preview = document.getElementById('annotationPreview');
    if (!preview) return;
    if (preview.querySelector('[data-testid="ws-evidence-card"]')) return;
    var evidenceCols = getFieldsByRole('evidence');
    if (evidenceCols.length === 0) return;

    var evidenceWrap = document.createElement('div');
    evidenceWrap.setAttribute('data-testid', 'ws-evidence-card');

    var heading = document.createElement('div');
    heading.className = 'annotation-preview-task-title';
    heading.style.marginBottom = '8px';
    heading.textContent = t('previewEvidenceHeading');
    evidenceWrap.appendChild(heading);

    evidenceCols.forEach(function (col) {
      if (evidenceCols.length > 1) {
        var label = document.createElement('div');
        label.className = 'annotation-preview-pair-label';
        label.textContent = col;
        evidenceWrap.appendChild(label);
      }
      var raw = state.datasetRawFirstRow ? state.datasetRawFirstRow[col] : undefined;
      var text = raw === undefined || raw === null ? '' : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
      var content = document.createElement('div');
      content.className = 'annotation-preview-sample';
      content.textContent = text.length > 500 ? text.substring(0, 500) + '…' : text;
      evidenceWrap.appendChild(content);
    });

    preview.insertBefore(evidenceWrap, preview.firstChild);
  }

  /* ── item_pair input layout (FR-024K / US2B) ─────────────────────
     taskInputTypes:['item_pair'] tasks (e.g. NLI: Premise/Hypothesis) show
     the two 'input'-role columns side by side instead of the single joined
     text block updateAnnotationPreview() renders generically. The two
     columns are picked by fieldRoleMap declaration order (not by hardcoded
     column names), and their display labels come from the task-creator's
     itemPairLabels when set, else fall back to the raw column names. */
  function buildItemPairColumn(label, value, testidPrefix) {
    var wrap = document.createElement('div');
    wrap.className = 'item-pair-column';
    var labelEl = document.createElement('div');
    labelEl.className = 'item-pair-label';
    labelEl.setAttribute('data-testid', testidPrefix + '-label');
    labelEl.textContent = label;
    wrap.appendChild(labelEl);
    var contentEl = document.createElement('div');
    contentEl.className = 'item-pair-content';
    contentEl.setAttribute('data-testid', testidPrefix);
    contentEl.textContent = value != null ? String(value) : '';
    wrap.appendChild(contentEl);
    return wrap;
  }
  function patchItemPairLayout() {
    if (state.taskInputTypes.indexOf('item_pair') < 0) return;
    /* updateAnnotationPreview() renders item_pair input as its own
       .annotation-preview-pair wrapper (a sibling structure to the generic
       single-field block patchEvidenceAndInputContent()'s fallback looks
       for), so it's located directly rather than through ws-input-content. */
    var container = document.querySelector('#annotationPreview .annotation-preview-pair');
    if (!container) return;
    var inputCols = Object.keys(state.fieldRoleMap).filter(function (col) {
      return state.fieldRoleMap[col] === 'input';
    });
    var leftCol = inputCols[0];
    var rightCol = inputCols[1];
    if (!leftCol || !rightCol) return;
    var labels =
      Array.isArray(state.itemPairLabels) && state.itemPairLabels.length >= 2
        ? state.itemPairLabels
        : [leftCol, rightCol];
    while (container.firstChild) container.removeChild(container.firstChild);
    var leftColumn = buildItemPairColumn(labels[0], state.datasetRawFirstRow[leftCol], 'ws-item-pair-left');
    /* The generic dashboard sweep (dashboard-output-types.spec.ts) looks up
       a single ws-input-content locator for every task regardless of input
       layout -- tag the wrap (not the inner ws-item-pair-left content node,
       which the item_pair-specific spec already owns) so both testids
       resolve to distinct elements without a data-testid collision. */
    leftColumn.setAttribute('data-testid', 'ws-input-content');
    container.appendChild(leftColumn);
    container.appendChild(
      buildItemPairColumn(labels[1], state.datasetRawFirstRow[rightCol], 'ws-item-pair-right')
    );
  }

  /* ── Data Fairness exception: output-role prefill (013 FR-003g-5) ────
     sanitizeRecordForAnnotator() (data.js) is the actual enforcement
     boundary: it strips every field that is NOT declared in
     profile.fieldRoleMap at all, hiding any undeclared ground truth from
     the annotator/reviewer. That stays unconditional.
     Fields that ARE explicitly declared 'output' role are, by definition,
     annotator-visible preannotation scaffolding, not held-out ground
     truth -- 013 FR-003g-5 requires this to prefill the corresponding
     input UI for every output type ("single_label 預選匹配的標籤；
     single_dim 滑桿設於實際分數值"), mirroring task-new Step 2's own
     preview via the shared engine's initPreviewState()
     (task-config.engine.js:1824). This applies uniformly across all 8
     output types -- entity_recognition/relation_identification's
     list-of-object columns, free_text/single_label's scalar columns, and
     single_dim/multi_label/multi_dim/sequence_tagging alike -- keyed
     purely off fieldRoleMap, never off task_id or output-type name.
     ANNOTATOR ONLY (issue #161). The reviewer reviews one annotator's
     submitted answer, and FR-044a's seed precedence has no dataset-column
     term at all -- but every engine renderer default-merges from
     getOutputFieldValue(), which reads these very columns off
     datasetRawFirstRow. Re-injecting them for a reviewer therefore let the
     creator's gold value win wherever the annotator's own answer did not
     fill the slot: on T001/sent-001 the panel showed `positive` while the
     reviewed annotator had submitted `negative`, so the reviewer approved
     an answer nobody gave and FR-051/FR-052's review-unit status was
     computed off that wrong comparison (AC-3.35). Withholding the columns
     at the record boundary fixes every output type at once, because all
     nine prefill readers funnel through getOutputFieldValue(); a per-type
     guard would have to be re-added for each new type. */
  function looksLikeEntityList(value) {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] &&
      typeof value[0] === 'object' &&
      value[0].text != null &&
      (value[0].start != null || value[0].type != null)
    );
  }
  function looksLikeTripleList(value) {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value[0] &&
      typeof value[0] === 'object' &&
      !!(value[0].entity1 || value[0].subj || value[0].target_text)
    );
  }
  function buildAnnotatorRecord(record, profile) {
    var sanitized = window.LabelSuiteAnnotationWorkspaceData.sanitizeRecordForAnnotator(
      record,
      profile.fieldRoleMap
    );
    if (currentRole !== 'reviewer') {
      Object.keys(profile.fieldRoleMap || {}).forEach(function (col) {
        if (profile.fieldRoleMap[col] !== 'output') return;
        if (record[col] === undefined) return;
        sanitized[col] = deepClone(record[col]);
      });
    }
    return sanitized;
  }

  /* ── TaskProfile / sample state ──────────────────────────────────── */
  var currentProfile = null;
  var currentRole = 'annotator';
  var currentRunType = 'dry_run';
  /* {annotatorId, reviewerId} resolved from the query params in boot();
     every submission-store call carries it so the workspace and the list it
     came from address the same bucket (spec 015 v3.8.0, FR-049). */
  var currentIdentity = null;
  var currentSampleId = null;
  var sampleAnswers = {};

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* The in-memory answer snapshot is keyed by REVIEW UNIT, not by sample
     (spec 015 v4.3.0, FR-056): a reviewer moving from sent-001 × kioleemg12
     to sent-001 × 113450022 stays on the same sample_id, so a sample-keyed
     map handed the second annotator the corrections made to the first --
     the reviewer would see their own edit attributed to someone who never
     gave it. For annotators the two keys are identical by construction
     (one unit per record), so their behaviour is unchanged. */
  function unitKey(sampleId, annotatorId) {
    if (currentRole !== 'reviewer') return String(sampleId);
    return String(sampleId) + '::' + (annotatorId || currentAnnotatorId());
  }

  function snapshotCurrentSample() {
    if (!currentSampleId) return;
    sampleAnswers[unitKey(currentSampleId)] = {
      previewState: deepClone(state.previewState),
      previewEntities: deepClone(state.previewEntities),
      previewTriples: deepClone(state.previewTriples),
      previewBypass: deepClone(state.previewBypass),
      relDraft: deepClone(state.relDraft),
      activeEntityType: state.activeEntityType,
      previewInited: state.previewInited,
    };
  }

  function restoreSample(sampleId) {
    var snap = sampleAnswers[unitKey(sampleId)];
    /* FR-026 cross-visit restore: with no in-memory snapshot (fresh page
       load), an annotator's persisted answers -- saved draft or earlier
       submission -- seed the controls instead of a blank state.
       Annotator-only: reviewer mode seeds from the annotator's submission
       via seedReviewState(), never from the reviewer's own bucket. */
    if (!snap && currentRole === 'annotator') {
      var stored = window.LabelSuiteAnnotationWorkspaceData.getSampleAnswers(
        currentProfile.id,
        currentRole,
        currentRunType,
        sampleId,
        currentIdentity
      );
      if (stored && stored.previewState) {
        snap = {
          previewState: stored.previewState,
          previewEntities: stored.previewEntities || [],
          previewTriples: stored.previewTriples || [],
          previewBypass: stored.previewBypass || {},
          relDraft: { e1: null, rel: null, e2: null },
          activeEntityType: null,
          /* Restored answers must not be overwritten by the engine's
             prefill re-seed on first render. */
          previewInited: true,
        };
      }
    }
    if (snap) {
      state.previewState = deepClone(snap.previewState);
      state.previewEntities = deepClone(snap.previewEntities);
      state.previewTriples = deepClone(snap.previewTriples);
      state.previewBypass = deepClone(snap.previewBypass);
      state.relDraft = deepClone(snap.relDraft);
      state.activeEntityType = snap.activeEntityType;
      state.previewInited = snap.previewInited;
    } else {
      state.previewState = {};
      state.previewEntities = [];
      state.previewTriples = [];
      state.previewBypass = {};
      state.relDraft = { e1: null, rel: null, e2: null };
      state.activeEntityType = null;
      state.previewInited = false;
    }
  }

  function seedEngineState(profile) {
    state.lang = state.lang || 'zh';
    state.selectedOutputTypes = profile.outputs.map(function (out) {
      return out.type;
    });
    state.outputConfigs = {};
    profile.outputs.forEach(function (out) {
      state.outputConfigs[out.type] = normalizeOutputConfig(out.type, out.config || {}, state.lang);
    });
    state.taskInputTypes = profile.taskInputTypes || ['single_item'];
    state.itemPairLabels = profile.itemPairLabels || null;
    state.columnOutputTypeMap = {};
    state.datasetFiles = [{ name: profile.datasetFileName || 'dataset.json' }];

    var sanitizedRecords = profile.datasetRecords.map(function (record) {
      return buildAnnotatorRecord(record, profile);
    });
    state._datasetRoots = [sanitizedRecords];
    state.datasetRecordPath = '$';
    state.fieldRoleMap = {};
    analyzeDataset();
    /* Wholesale-assign the profile's declared roles; getFieldsByRole()
       only ever consults roles for columns present in
       datasetParsedColumns, so a role entry pointing at a column that was
       stripped out during sanitization (i.e. any 'output'-role column) is
       simply never visited -- see task-config.engine.js:getFieldsByRole. */
    state.fieldRoleMap = Object.assign({}, profile.fieldRoleMap);
    /* getDatasetPreviewText() (engine.js) joins every 'input'-role column's
       String(value) into one preview-text blob. That's only meaningful for
       scalar (string-able) columns; an 'input'-role column whose value is
       an array or object (e.g. sequence_tagging's sibling pre-tokenized
       `tokens` column, kept alongside `text`) gets Array#toString()'d into
       comma-joined garbage and silently corrupts the token count. Demote
       any 'input' role whose first record's value isn't a scalar so it's
       excluded from that join -- this is a generic guard (any non-scalar
       input-role column, not just `tokens`), and it only affects
       getFieldsByRole('input')/preview-text joining; datasetRawFirstRow and
       datasetParsedColumns are unaffected. */
    var firstRawRow = state.datasetRawFirstRow || {};
    Object.keys(state.fieldRoleMap).forEach(function (col) {
      if (state.fieldRoleMap[col] !== 'input') return;
      var v = firstRawRow[col];
      if (v !== null && typeof v === 'object') delete state.fieldRoleMap[col];
    });
  }

  /*
   * Entry breadcrumb (issue #456, FR-080). The workspace shell carries no
   * page header, so without this nothing on screen names the task or the
   * run: FR-064's context banner is scoped to one review unit and never
   * carries the task name, leaving two deep-linked demo tasks visually
   * identical. Every level is derived from the URL context, so a cold deep
   * link renders the same trail as an in-app navigation (FR-080 AC-4.31).
   *
   * Level 1 links to the dashboard rather than to a task-less
   * annotation-list.html, because that URL is a not-found state whose own
   * recovery CTA already points at the dashboard.
   */
  /* FR-081 (issue #456 AC-4): annotation-list.html's UXC-11 view state rides
     in on the URL and has to ride back out, or a return link drops the user
     on an unfiltered page 1 -- exactly the page someone who filtered their
     way to this unit does not want. The other two return paths (the sidebar's
     標記作業 link and boot()'s unknown-task_id redirect) forward
     window.location.search verbatim and inherit it for free; the paths that
     rebuild their query from scratch all come through here, so every
     "back to the list" on screen resolves to the same place. */
  var LIST_VIEW_STATE_KEYS = ['status', 'q', 'limit', 'offset'];
  /* FR-049 (issue #545): the identity pair is what decides WHICH SUBMISSION
     BUCKET each page reads, so it has to make the return trip for the same
     reason the view state above does -- a visitor who is not the default
     roster identity would otherwise land on a list computing someone else's
     progress under their own name. Forwarded, never stamped: FR-049 gives an
     absent param the meaning "fall back to the default identity", and the
     two pages only agree on that while the absence is preserved. */
  var LIST_IDENTITY_KEYS = ['annotator_id', 'reviewer_id'];

  function buildListReturnUrl() {
    var listParams = new URLSearchParams();
    listParams.set('task_id', currentProfile.id);
    listParams.set('role', currentRole);
    listParams.set('run_type', currentRunType);
    var incoming = new URLSearchParams(window.location.search);
    LIST_VIEW_STATE_KEYS.concat(LIST_IDENTITY_KEYS).forEach(function (key) {
      var value = incoming.get(key);
      if (value) listParams.set(key, value);
    });
    return 'annotation-list.html?' + listParams.toString();
  }

  function renderEntryBreadcrumb() {
    var nav = document.getElementById('entryBreadcrumb');
    if (!nav) return;
    nav.innerHTML = '';

    appendCrumbLink(nav, '../dashboard/dashboard.html',
      t(currentRole === 'reviewer' ? 'crumbWorkAreaReviewer' : 'crumbWorkAreaAnnotator'));
    appendCrumbSep(nav);
    appendCrumbLink(nav, buildListReturnUrl(),
      t('crumbTaskTpl')
        .replace('{name}', (state.lang === 'en' && currentProfile.nameEn)
          ? currentProfile.nameEn : currentProfile.nameZh)
        .replace('{run}', t(currentRunType === 'official_run' ? 'unitCtxRunOfficial' : 'unitCtxRunDry')));
    appendCrumbSep(nav);

    /* An annotator IS the annotator, so naming them back at themselves adds
       a level that carries no information. They also get a QUEUE POSITION
       rather than the raw record id: on seeds like T011/T012 the id field is
       unassigned metadata (`ID`, `article_id`), and Data Fairness forbids
       unassigned fields from reaching annotator-facing DOM (FR-023/FR-024M).
       A reviewer addresses a named unit and is not under that restriction. */
    var current = document.createElement('span');
    current.setAttribute('aria-current', 'page');
    if (currentRole === 'reviewer') {
      current.textContent = t('crumbUnitTpl')
        .replace('{sample}', currentSampleId)
        .replace('{annotator}', currentAnnotatorId());
    } else {
      var records = currentProfile.datasetRecords || [];
      var idx = 0;
      for (var i = 0; i < records.length; i += 1) {
        if (window.LabelSuiteAnnotationWorkspaceData.getRecordId(records[i], i) === currentSampleId) {
          idx = i;
          break;
        }
      }
      current.textContent = t('crumbSamplePosTpl')
        .replace('{i}', String(idx + 1))
        .replace('{n}', String(records.length));
    }
    nav.appendChild(current);
  }

  function appendCrumbLink(nav, href, text) {
    var link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    nav.appendChild(link);
  }

  function appendCrumbSep(nav) {
    var sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '\u203A';
    nav.appendChild(sep);
  }

  function renderWorkspace() {
    renderEntryBreadcrumb();
    if (currentRole === 'reviewer') {
      renderReviewerWorkspace();
    } else if (currentRole === 'project_leader') {
      renderExceptionPoolScreen();
    } else {
      /* patched: original render + testid patches + question/annotation
         card regrouping (patchedUpdateAnnotationPreview above) */
      updateAnnotationPreview();
    }
    renderSampleList();
    renderSampleNav();
    renderHistoryPanel();
    renderAutosaveStatus();
  }

  /* The unit the left column, the nav and the review card all address
     (spec 015 v4.3.0, FR-056). For a reviewer it is sample × annotator --
     the same flattening annotation-list.html applies, off the same
     getReviewerMockRows() roster, so the two pages can never disagree on
     how many units a task holds. For an annotator the record IS the unit,
     which is why every annotator-facing behaviour below is unchanged. */
  function buildUnits() {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    var units = [];
    currentProfile.datasetRecords.forEach(function (record, idx) {
      var recordId = data.getRecordId(record, idx);
      if (currentRole !== 'reviewer') {
        units.push({ record: record, recordId: recordId, annotatorId: currentAnnotatorId() });
        return;
      }
      data.getReviewerMockRows(currentProfile.id, recordId).forEach(function (row) {
        units.push({ record: record, recordId: recordId, annotatorId: row.annotator });
      });
    });
    return units;
  }

  function unitIdentity(unit) {
    if (currentRole !== 'reviewer') return currentIdentity;
    return { annotatorId: unit.annotatorId, reviewerId: currentIdentity.reviewerId };
  }

  /* REVIEW_UNIT_STATUS -> i18n key, shared by the context banner (FR-064)
     and the reviewer left column (issue #309): both must speak the same
     vocabulary annotation-list settled on. issue #596 narrowed that
     vocabulary to THREE states -- 已同意／已修改 only ever described a unit
     waiting for more reviewers to reach a quorum, and FR-093 gives every
     unit exactly one reviewer, so there is nothing left for them to name. */
  var REVIEW_STATE_I18N_KEYS = {
    pending: 'unitStatePending',
    disputed: 'unitStateDisputed',
    finalized: 'unitStateFinalized',
  };

  /* Mirrors annotation-list's buildReviewUnitRows(): getReviewUnitStatus
     returns null while the annotator has no STORED submission, but the mock
     row IS that annotator's answer, so an un-stored unit is still awaiting
     review (pending), not absent. */
  function reviewUnitState(unit) {
    return (
      window.LabelSuiteAnnotationWorkspaceData.getReviewUnitStatus(
        currentProfile.id,
        currentRunType,
        unit.recordId,
        unitIdentity(unit),
        state.selectedOutputTypes,
        { minReviewers: currentProfile.minReviewers || 1 }
      ) || 'pending'
    );
  }

  function isCurrentUnit(unit) {
    if (unit.recordId !== String(currentSampleId)) return false;
    return currentRole !== 'reviewer' || unit.annotatorId === currentAnnotatorId();
  }

  function currentUnitIndex(units) {
    for (var i = 0; i < units.length; i++) {
      if (isCurrentUnit(units[i])) return i;
    }
    return 0;
  }

  /* Submissions live in per-identity buckets, so a reviewer walking three
     annotators of one sample has three buckets to consult -- the single
     getSubmittedSampleCount() call the annotator path uses would only ever
     see the annotator the URL happened to open on. */
  function countSubmittedUnits(units) {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    if (currentRole !== 'reviewer') {
      return data.getSubmittedSampleCount(currentProfile.id, currentRole, currentRunType, currentIdentity);
    }
    return units.filter(function (unit) {
      return data.isSampleSubmitted(currentProfile.id, 'reviewer', currentRunType, unit.recordId, unitIdentity(unit));
    }).length;
  }

  /* Top-of-column sample nav (區塊 B 上方導覽列): prev/next + submitted
     progress. Progress counts THIS role+run's submissions over the seeded
     unit list, matching what the prev/next buttons can actually reach. */
  function renderSampleNav() {
    var units = buildUnits();
    var total = units.length;
    var done = countSubmittedUnits(units);
    if (done > total) done = total;
    /* issue #309: a reviewer's count is reviewed units, not their own
       submissions -- the annotator's N 已提交 wording is wrong for them. */
    setText(
      'wsProgressText',
      t(currentRole === 'reviewer' ? 'wsProgressTextReview' : 'wsProgressText')
        .replace('{done}', String(done))
        .replace('{total}', String(total))
    );
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var fill = document.getElementById('wsProgressFill');
    if (fill) fill.style.width = pct + '%';
    var track = document.getElementById('wsProgressTrack');
    if (track) track.setAttribute('aria-valuenow', String(pct));
    var idx = currentUnitIndex(units);
    var prevBtn = document.getElementById('wsPrevBtn');
    var nextBtn = document.getElementById('wsNextBtn');
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= total - 1;
  }

  /* Bottom-bar autosave indicator (issue #470): three honest, per-sample
     states -- INITIAL (never saved/submitted, no edit since load), DIRTY
     (edited since load, not yet persisted) and SAVED (the time of an
     actual persisted write, read back via getSampleSavedAt -- never a
     fabricated flash). currentSampleDirty tracks only the CURRENTLY
     DISPLAYED sample so a sample switch cannot carry over another
     sample's dirty state or timestamp; the tab-scoped hasUnsavedChanges
     flag below keeps its own separate UXC-03 navigation-guard meaning.
     Hidden entirely for role=reviewer, who has no 儲存草稿 button and
     persists through persistReviewDraft() instead. */
  var currentSampleDirty = false;
  function renderAutosaveStatus() {
    var statusEl = document.querySelector('.autosave-status');
    if (currentRole === 'reviewer') {
      if (statusEl) statusEl.classList.add('hidden');
      return;
    }
    if (statusEl) statusEl.classList.remove('hidden');
    var dot = document.getElementById('wsAutosaveDot');
    if (!dot) return;
    if (currentSampleDirty) {
      dot.className = 'autosave-dot dirty';
      setText('wsAutosaveLabel', t('wsAutosaveDirty'));
      return;
    }
    var savedAt = window.LabelSuiteAnnotationWorkspaceData.getSampleSavedAt(
      currentProfile.id,
      currentRole,
      currentRunType,
      currentSampleId,
      currentIdentity
    );
    if (savedAt) {
      dot.className = 'autosave-dot saved';
      setText('wsAutosaveLabel', t('wsAutosaveSavedAt').replace('{time}', formatHistoryTime(savedAt)));
    } else {
      dot.className = 'autosave-dot initial';
      setText('wsAutosaveLabel', t('wsAutosaveInitial'));
    }
  }

  /* UXC-03: browser-navigation guard while the work column holds edits
     that 儲存草稿/提交 has not persisted (see renderAutosaveStatus for the
     honest, per-sample visible indicator this flag no longer doubles as).
     Any interaction inside .col-content counts as an edit signal; the
     three persistence paths clear it. */
  var hasUnsavedChanges = false;
  function markUnsaved() {
    hasUnsavedChanges = true;
    /* issue #470: the visible indicator must flip to DIRTY on the same
       interaction that arms the navigation guard, not lag behind it. */
    currentSampleDirty = true;
    renderAutosaveStatus();
  }
  function clearUnsaved() {
    hasUnsavedChanges = false;
    currentSampleDirty = false;
  }
  var workColumn = document.querySelector('.col-content');
  if (workColumn) {
    workColumn.addEventListener('input', markUnsaved, true);
    workColumn.addEventListener('change', markUnsaved, true);
    workColumn.addEventListener('click', markUnsaved, true);
  }
  window.addEventListener('beforeunload', function (event) {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
  });

  /* Right-column 歷程 tab (FR-016 / AC-3.8): renders the merged
     annotator+reviewer event chain for the current sample. */
  function formatHistoryTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* FR-087: an event's answer is shown against the one before it -- the
     first snapshot in a trail has nothing to compare to and reads as whole
     content, every later one reads as before → after for the output types
     that actually changed. Built in a forward pass because the panel paints
     newest-first, and returned by event index so the render loop stays a
     plain map from event to block. Only plain-value output types diff here;
     the position-type comparator is registry-driven and lands with FR-087's
     position half. */
  function buildHistoryAnswerBlocks(events) {
    var blocks = [];
    var previous = null;
    events.forEach(function (event, idx) {
      var snapshot = event.result_snapshot;
      if (!snapshot) {
        blocks[idx] = null;
        return;
      }
      blocks[idx] = previous ? buildHistoryDiff(previous, snapshot) : buildHistorySnapshot(snapshot);
      previous = snapshot;
    });
    return blocks;
  }

  function historyOutputKeys() {
    var seen = {};
    return Array.prototype.slice.call(arguments).reduce(function (keys, snapshot) {
      Object.keys((snapshot && snapshot.previewState) || {}).forEach(function (outKey) {
        if (seen[outKey]) return;
        seen[outKey] = true;
        keys.push(outKey);
      });
      return keys;
    }, []);
  }

  function buildHistorySnapshot(snapshot) {
    var lines = historyOutputKeys(snapshot)
      .map(function (outKey) {
        var described = describeOutputAnswer(outKey, snapshot);
        return described ? outKey + ': ' + described : '';
      })
      .filter(Boolean);
    if (!lines.length) return null;
    var block = document.createElement('div');
    block.className = 'history-snapshot';
    block.textContent = lines.join('\n');
    return block;
  }

  var DIFF_KIND_LABELS = {
    added: 'wsHistoryDiffAdded',
    removed: 'wsHistoryDiffRemoved',
    boundary: 'wsHistoryDiffBoundary',
  };

  function spanRange(span) {
    return '[' + span.start + ',' + span.end + ']';
  }

  /* `kind` is null for plain-value diffs: those read as one before/after
     line and have no add/delete/boundary distinction to name. */
  function diffItem(kind, text) {
    var item = document.createElement('div');
    item.className = 'history-diff-item';
    if (kind) {
      var marker = document.createElement('span');
      marker.className = 'history-diff-kind';
      marker.setAttribute('data-diff-kind', kind);
      marker.textContent = t(DIFF_KIND_LABELS[kind]) + ' ';
      item.appendChild(marker);
    }
    var body = document.createElement('span');
    body.textContent = text;
    item.appendChild(body);
    return item;
  }

  /* FR-087: position-bearing types list one row per entity, so a boundary
     that moved is visible even when the entity count did not change. The
     comparator itself lives in the shared history module -- this only
     decides how a change reads.

     entity_recognition spans already carry `text` (denormalized at
     creation, per placeCompactEntities); sequence_tagging spans do not
     (the shared module has no access to the sample's source text), so it
     is resolved here the same way buildSequencePairsFromSpans() does. */
  function positionalDiffText(span) {
    if (span.text != null) return span.text;
    return (getDatasetPreviewText() || '').substring(span.start, span.end);
  }
  function positionalDiffItems(outKey, before, after) {
    return window.LabelSuiteAnnotationHistory.diffPositional(outKey, before, after).map(function (change) {
      var label = outKey + ': ' + change.span.label + ' ' + positionalDiffText(change.span) + ' ';
      return diffItem(
        change.kind,
        change.kind === 'boundary'
          ? label + spanRange(change.from) + ' → ' + spanRange(change.span)
          : label + spanRange(change.span)
      );
    });
  }

  function buildHistoryDiff(before, after) {
    var items = [];
    historyOutputKeys(before, after).forEach(function (outKey) {
      if (window.LabelSuiteAnnotationHistory.isPositionalOutput(outKey)) {
        items = items.concat(positionalDiffItems(outKey, before, after));
        return;
      }
      var from = describeOutputAnswer(outKey, before);
      var to = describeOutputAnswer(outKey, after);
      if (from === to) return;
      items.push(diffItem(null, outKey + ': ' + (from || t('reviewNoAnswer')) + ' → ' + (to || t('reviewNoAnswer'))));
    });
    if (!items.length) return null;
    var block = document.createElement('div');
    block.className = 'history-diff';
    items.forEach(function (item) {
      block.appendChild(item);
    });
    return block;
  }

  function renderHistoryPanel() {
    var container = document.getElementById('wsHistoryContainer');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    /* FR-090: the viewer is an argument to the data supply layer, not a
       render flag -- a masked event must never reach this function at all. */
    /* issue #601: the reviewer's envelope `submitted` event is folded away
       when their own next act was a decision, so the trail reads as one card
       per thing that happened rather than a bare 提交 beside the decision
       that carries the result. Applied before the answer blocks are built:
       those are indexed by event, and the folded event carries no snapshot
       (the data layer omits it precisely because the decision events hold
       it), so no diff chain is affected. */
    var events = window.LabelSuiteAnnotationHistory.collapseHistory(
      window.LabelSuiteAnnotationWorkspaceData.getSampleHistory(
        currentProfile.id,
        currentRunType,
        currentSampleId,
        currentIdentity,
        {
          role: currentRole,
          actorId: currentRole === 'reviewer' ? (currentIdentity && currentIdentity.reviewerId) : currentAnnotatorId(),
        }
      )
    );
    if (events.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = t('wsHistoryEmpty');
      container.appendChild(empty);
      return;
    }
    var answerBlocks = buildHistoryAnswerBlocks(events);
    var list = document.createElement('div');
    list.className = 'history-list';
    events.slice().reverse().forEach(function (event, reversedIdx) {
      var answer = answerBlocks[events.length - 1 - reversedIdx];
      var card = document.createElement('div');
      card.className = 'history-item';
      var header = document.createElement('div');
      header.className = 'history-item-header';
      var actor = document.createElement('span');
      actor.className = 'history-actor';
      /* FR-050: the role alone never answered "who did this" -- an official_run
         trail read 標記員 / 審核員 with no way to tell two reviewers apart.
         Events written before v3.8.0 carry no actorId, so the role stands alone. */
      var roleLabel =
        event.role === 'reviewer'
          ? t('wsHistoryRoleReviewer')
          : event.role === 'project_leader'
            ? t('wsHistoryRoleProjectLeader')
            : t('wsHistoryRoleAnnotator');
      actor.textContent = event.actorId ? roleLabel + ' · ' + event.actorId : roleLabel;
      var meta = document.createElement('div');
      meta.className = 'history-meta';
      var time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = formatHistoryTime(event.at);
      var badge = document.createElement('span');
      /* FR-086: the modifier comes from the shared action table, never from a
         render-site branch -- the ternary this replaces mapped every value it
         did not name onto the `submitted` badge, so a `skipped` event read as
         a submission. An action outside the set resolves to '' and keeps the
         neutral base badge. */
      var badgeModifier = window.LabelSuiteAnnotationHistory.badgeClassFor(event.action);
      badge.className = 'history-action-badge' + (badgeModifier ? ' ' + badgeModifier : '');
      badge.setAttribute('data-action', event.action);
      badge.textContent = window.LabelSuiteAnnotationHistory.actionLabelFor(event.action);
      meta.appendChild(time);
      meta.appendChild(badge);
      header.appendChild(actor);
      header.appendChild(meta);
      card.appendChild(header);
      if (event.summary) {
        var summary = document.createElement('div');
        summary.className = 'history-summary';
        summary.textContent = event.summary;
        card.appendChild(summary);
      }
      if (answer) card.appendChild(answer);
      /* FR-088 visibility: the annotator must never see a duration. Seeing
         a running score changes how people answer, and this number is meant
         to measure sample difficulty, not to be optimised against. The
         reviewer and the task-level statistics are where it belongs. */
      if (currentRole !== 'annotator' && typeof event.lead_time === 'number') {
        var leadTime = document.createElement('div');
        leadTime.className = 'history-lead-time';
        leadTime.setAttribute('data-testid', 'ws-history-lead-time');
        leadTime.textContent = t('wsHistoryLeadTimeLabel') + window.LabelSuiteAnnotationHistory.formatLeadTime(event.lead_time);
        card.appendChild(leadTime);
      }
      /* FR-089: the reason the actor typed, on the event it justifies. */
      if (event.reason) {
        var reason = document.createElement('div');
        reason.className = 'history-reason';
        reason.textContent = t('wsHistoryReasonLabel') + event.reason;
        card.appendChild(reason);
      }
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  /* FR-088: `lead_time` is accumulated page-visible time, never the
     wall-clock gap between `started_at` and `at`. The number exists to feed
     difficulty analysis, and a sample left open in a background tab would
     otherwise read as the hardest sample in the set. Both signals are
     observed because they answer different questions: `visibilitychange`
     covers a tab switch, `blur`/`focus` covers the window losing focus
     while the tab stays visible.

     `since` is null exactly when the clock is paused, so pause and resume
     are both idempotent -- the two signals commonly fire together. */
  var leadTimer = { startedAt: null, accumulated: 0, since: null };

  function startLeadTimer() {
    leadTimer = {
      startedAt: new Date().toISOString(),
      accumulated: 0,
      since: document.visibilityState === 'hidden' ? null : Date.now(),
    };
  }

  function pauseLeadTimer() {
    if (leadTimer.since == null) return;
    leadTimer.accumulated += Date.now() - leadTimer.since;
    leadTimer.since = null;
  }

  function resumeLeadTimer() {
    if (leadTimer.startedAt && leadTimer.since == null) leadTimer.since = Date.now();
  }

  /* Reads the accumulator without stopping it: a save is a checkpoint in the
     middle of the sample, not the end of it. Returns null before any sample
     has been opened, so the caller writes no timing fields at all rather
     than a zero that would read as "answered instantly". */
  function readLeadTiming() {
    if (!leadTimer.startedAt) return null;
    var elapsed = leadTimer.accumulated + (leadTimer.since == null ? 0 : Date.now() - leadTimer.since);
    return { startedAt: leadTimer.startedAt, leadTime: elapsed };
  }

  function bindLeadTimerSignals() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') pauseLeadTimer();
      else resumeLeadTimer();
    });
    window.addEventListener('blur', pauseLeadTimer);
    window.addEventListener('focus', resumeLeadTimer);
  }

  function findRecordById(sampleId) {
    return currentProfile.datasetRecords.find(function (record, idx) {
      return window.LabelSuiteAnnotationWorkspaceData.getRecordId(record, idx) === String(sampleId);
    });
  }

  /* `annotatorId` is the second half of the review unit (FR-056); omitted,
     the currently reviewed annotator is kept, which is what every annotator
     call site and the boot call rely on. Snapshotting happens BEFORE the
     identity moves so the outgoing unit's answers are filed under it. */
  function selectSample(sampleId, annotatorId) {
    var record = findRecordById(sampleId) || currentProfile.datasetRecords[0];
    if (!record) return;
    var recordIdx = currentProfile.datasetRecords.indexOf(record);
    snapshotCurrentSample();
    currentSampleId = window.LabelSuiteAnnotationWorkspaceData.getRecordId(record, recordIdx);
    /* FR-088: the timer is per sample -- moving to the next sample starts a
       fresh measurement rather than carrying the previous one forward. */
    startLeadTimer();
    /* issue #470: the autosave indicator is derived PER SAMPLE -- a fresh
       selection starts undirtied regardless of the outgoing sample's
       state; renderWorkspace() below recomputes INITIAL/SAVED for the
       newly loaded sample from persisted data. */
    currentSampleDirty = false;
    if (annotatorId && currentRole === 'reviewer') currentIdentity.annotatorId = annotatorId;
    reviewRowSeeded = {};
    state.datasetRawFirstRow = buildAnnotatorRecord(record, currentProfile);
    /* The engine only rebuilds columnOutputTypeMap inside its own
       renderSchemaFields() (a task-new Step 2 path this host never runs);
       without it getOutputFieldValue(outKey) falls back to the first
       output column whenever a task maps several, mis-seeding prefill on
       multi-output tasks. */
    rebuildColumnOutputTypeMap();
    restoreSample(currentSampleId);
    syncUrlToUnit();
    renderWorkspace();
    renderSkipControl();
  }

  /* A workspace URL addresses one REVIEW UNIT, so every switch writes the
     displayed unit back into the address bar (issue #151); the page read
     `sample_id` at boot and never wrote it, leaving reload / bookmark /
     shared link pinned to whichever record the visitor entered on.

     `replaceState`, not `pushState`: stepping through T001's 15 reviewer
     units would otherwise bury the list page under 15 Backs.

     The query string is mutated in place rather than rebuilt from known
     keys, so any param this page does not read survives the rewrite. */
  function syncUrlToUnit() {
    var params = new URLSearchParams(window.location.search);
    params.set('sample_id', currentSampleId);
    /* Only a reviewer's annotator moves while stepping (FR-056). Writing it
       for an annotator would add a param their entry link never carried. */
    if (currentRole === 'reviewer') params.set('annotator_id', currentAnnotatorId());
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
  }

  /* Reviewer-only sample group wrapper (issue #455). One review unit per
     row (FR-056) means a 3-annotator sample renders three rows whose ONLY
     difference is the annotator account -- the record snippet above it is
     byte-identical three times over, and in a 256px column it is the
     snippet that wins the reviewer's attention. Hoisting the sample
     identity plus the shared snippet into one header per sample lets each
     row below it carry only what actually differs (annotator + review
     state), and gives the sample boundary a structural marker instead of
     asking the reviewer to diff three lines of small print.
     `role="group"` + `aria-label` is the ARIA-sanctioned way to partition a
     listbox, so the grouping is exposed to AT rather than being purely
     visual (the annotation-list counterpart, FR-067, only had table rows to
     work with and had to settle for a border + de-emphasis). */
  function buildSampleGroup(record, recordId, unitCount) {
    var group = document.createElement('div');
    group.className = 'sample-group';
    group.setAttribute('role', 'group');
    group.setAttribute('data-testid', 'ws-sample-group');
    group.setAttribute('data-sample-id', recordId);
    group.setAttribute(
      'aria-label',
      t('wsSampleGroupAria').replace('{sample}', recordId).replace('{n}', String(unitCount))
    );

    var header = document.createElement('div');
    header.className = 'sample-group-header';

    var title = document.createElement('div');
    title.className = 'sample-group-title';
    var idEl = document.createElement('span');
    idEl.className = 'sample-group-id';
    idEl.setAttribute('data-testid', 'ws-sample-group-id');
    /* The column is narrow enough to ellipsise a realistic sample_id, so the
       full value has to stay reachable without leaving the page. */
    idEl.setAttribute('title', recordId);
    idEl.textContent = recordId;
    var countEl = document.createElement('span');
    countEl.className = 'sample-group-count';
    countEl.setAttribute('data-testid', 'ws-sample-group-count');
    countEl.textContent = t('wsSampleGroupCount').replace('{n}', String(unitCount));
    title.appendChild(idEl);
    title.appendChild(countEl);
    header.appendChild(title);

    var snippet = document.createElement('div');
    snippet.className = 'sample-group-snippet';
    snippet.setAttribute('data-testid', 'ws-sample-group-snippet');
    snippet.textContent = window.LabelSuiteAnnotationWorkspaceData.getRecordPreviewText(
      record,
      currentProfile.fieldRoleMap
    );
    header.appendChild(snippet);

    group.appendChild(header);
    return group;
  }

  function renderSampleList() {
    var listEl = document.getElementById('sampleList');
    var countEl = document.getElementById('sampleListCount');
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    var units = buildUnits();
    /* Spec 015 line "筆數仍需依 materialized run context 顯示": the count
       reflects the run's materialized list size when the profile declares
       one for the current run_type; the rendered rows stay the seed
       records (prototype subset). Title stays a fixed 標記清單 -- run
       labels in the column title are forbidden by the same clause.
       Reviewers are the exception (FR-056): a materialized run counts
       SAMPLES, which is the annotator's workload, while the reviewer's is
       one unit per annotator per sample -- so their count is the rendered
       unit count, matching annotation-list's 共 N 筆. */
    var runCtx = currentProfile.materializedRuns && currentProfile.materializedRuns[currentRunType];
    var totalCount =
      currentRole === 'reviewer' || !runCtx || typeof runCtx.total !== 'number' ? units.length : runCtx.total;
    if (countEl) countEl.textContent = totalCount + (state.lang === 'zh' ? ' 筆' : ' items');

    /* Group size is the roster size of that sample, counted off the same
       flattened `units` the rows come from -- never re-derived from the
       profile, so the header can never disagree with the rows under it. */
    var unitsPerSample = {};
    units.forEach(function (unit) {
      unitsPerSample[unit.recordId] = (unitsPerSample[unit.recordId] || 0) + 1;
    });
    var openGroupId = null;
    var openGroupEl = null;

    units.forEach(function (unit, idx) {
      var record = unit.record;
      var recordId = unit.recordId;
      /* Tri-state per sample (submitted / saved / pending) drives both the
         index-badge tint and the text status label under the snippet. */
      var status = window.LabelSuiteAnnotationWorkspaceData.getSampleStatus(
        currentProfile.id,
        currentRole,
        currentRunType,
        recordId,
        unitIdentity(unit)
      );
      var isActive = isCurrentUnit(unit);
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'sample-item' + (isActive ? ' active' : '');
      if (status === 'submitted') item.classList.add('status-submitted');
      else if (status === 'saved') item.classList.add('status-saved');
      item.setAttribute('data-testid', 'ws-sample-item');
      item.setAttribute('data-submitted', status === 'submitted' ? 'true' : 'false');
      /* Both halves of the review unit are addressable on the entry itself
         (issue #455), so "which unit am I on" no longer depends on reading
         two truncated text spans. */
      item.setAttribute('data-sample-id', recordId);
      item.setAttribute('data-annotator-id', unit.annotatorId);

      var indexBadge = document.createElement('span');
      indexBadge.className = 'sample-index';
      indexBadge.textContent = String(idx + 1);
      item.appendChild(indexBadge);

      var meta = document.createElement('div');
      meta.className = 'sample-meta';
      /* Reviewer entries drop the snippet: it is identical for every unit of
         the sample and now lives once in the group header (issue #455).
         Annotator entries keep it -- one entry per record, nothing repeats. */
      if (currentRole !== 'reviewer') {
        var snippet = document.createElement('div');
        snippet.className = 'sample-snippet';
        snippet.textContent = window.LabelSuiteAnnotationWorkspaceData.getRecordPreviewText(
          record,
          currentProfile.fieldRoleMap
        );
        meta.appendChild(snippet);
      } else {
        /* Only the annotator: it is the one dimension that varies inside a
           group. The sample ID already sits once in the group header, and
           the entry's data-sample-id / aria-label keep it addressable and
           readable out of context (issue #557 dropped the muted echo that
           repeated it on every row). */
        var unitLine = document.createElement('div');
        unitLine.className = 'sample-unit-line';
        var unitAnnotator = document.createElement('span');
        unitAnnotator.className = 'sample-unit-annotator';
        unitAnnotator.setAttribute('data-testid', 'ws-sample-annotator');
        unitAnnotator.setAttribute('title', unit.annotatorId);
        unitAnnotator.textContent = unit.annotatorId;
        unitLine.appendChild(unitAnnotator);
        meta.appendChild(unitLine);
      }
      var statusLabel = document.createElement('span');
      statusLabel.className = 'sample-status-label status-color-' + status;
      statusLabel.setAttribute('data-testid', 'ws-sample-status');
      /* issue #309: a reviewer's entry is a review unit, so its label is the
         REVIEW_UNIT_STATUS five-state (待審/已同意/已修改/爭議中/已定稿),
         never the annotator tri-state. The tri-state keeps driving the badge
         tint / data-submitted above for both roles. */
      statusLabel.textContent =
        currentRole === 'reviewer'
          ? t(REVIEW_STATE_I18N_KEYS[reviewUnitState(unit)])
          : status === 'submitted' ? t('wsStatusSubmitted') : status === 'saved' ? t('wsStatusSaved') : t('wsStatusPending');
      meta.appendChild(statusLabel);
      item.appendChild(meta);
      /* The visible entry no longer repeats the snippet, so its accessible
         name is spelled out rather than left to concatenated text nodes --
         a screen-reader user must still hear the full sample AND annotator,
         neither of which is guaranteed to be untruncated on screen. */
      if (currentRole === 'reviewer') {
        item.setAttribute(
          'aria-label',
          t('wsSampleUnitAria')
            .replace('{sample}', recordId)
            .replace('{annotator}', unit.annotatorId)
            .replace('{state}', statusLabel.textContent)
        );
      }

      item.addEventListener('click', function () {
        selectSample(recordId, unit.annotatorId);
      });

      if (currentRole !== 'reviewer') {
        listEl.appendChild(item);
        return;
      }
      if (openGroupId !== recordId) {
        openGroupId = recordId;
        openGroupEl = buildSampleGroup(record, recordId, unitsPerSample[recordId]);
        listEl.appendChild(openGroupEl);
      }
      if (isActive) openGroupEl.classList.add('has-active');
      openGroupEl.appendChild(item);
    });
  }

  /* ── submit ───────────────────────────────────────────────────────── */
  /* Spec 015 AC-2A.10: every outputs[] entry must be answered or bypassed
     before submit. FR-024M output-role prefill counts as answered for
     every type -- most types carry the prefill in previewState/
     previewEntities/previewTriples already, but multi_dim's engine-seeded
     sliders are DOM-only (ps.dims never sees the prefill), so it checks
     the raw output column instead. */
  function isOutputAnswered(outKey) {
    if (state.previewBypass[outKey]) return true;
    var ps = state.previewState[outKey];
    switch (outKey) {
      case 'single_label':
        return !!(ps && ps.selected);
      case 'multi_label':
        return !!(ps && Array.isArray(ps.selected) && ps.selected.length > 0);
      case 'single_dim':
        return !!(ps && (ps._touched || ps._seeded));
      case 'multi_dim': {
        var cfg = state.outputConfigs.multi_dim || {};
        var dims = Array.isArray(cfg.dimensions)
          ? cfg.dimensions
          : Array.isArray(cfg.va_dimensions) ? cfg.va_dimensions : [];
        if (dims.length === 0) return true;
        var dimState = (ps && ps.dims) || {};
        var allTouched = dims.every(function (dim) {
          return dimState[dim.name] && dimState[dim.name].touched;
        });
        if (allTouched) return true;
        var record = findRecordById(currentSampleId);
        var prefill = record ? findRawOutputValue('multi_dim', record) : null;
        return !!(prefill && typeof prefill === 'object');
      }
      case 'sequence_tagging':
        /* Any marked span (the annotator's own or a well-formed prefill)
           counts as answered; an out-of-range prefill is not one, since the
           engine routes it to prefillErrors rather than into spans[]. */
        return !!(ps && Array.isArray(ps.spans) && ps.spans.length > 0);
      case 'entity_recognition':
        return state.previewEntities.length > 0;
      case 'relation_identification':
        return state.previewTriples.length > 0;
      case 'free_text':
        return !!(ps && ps.text && ps.text.trim().length > 0);
      default:
        return true;
    }
  }

  function clearAllPanelErrors() {
    state.selectedOutputTypes.forEach(function (outKey) {
      var panel = document.querySelector('[data-testid="ws-output-panel-' + outKey + '"]');
      if (panel) panel.removeAttribute('data-error');
    });
  }

  /* The persisted OutputAnswer payload -- same shape for submit, draft
     save (AC-2.3), and the reviewer decision write, and the same fields
     snapshotCurrentSample()/restoreSample() round-trip in memory. */
  function collectAnswerPayload() {
    var previewState = deepClone(state.previewState);
    /* FR-024A-3: snap_unit travels inside the sequence_tagging answer
       instead of being read back from the task config, so a stored payload
       still says which landing rule produced its offsets after the task is
       reconfigured. The engine owns the rest of the entry; only this one
       field is a property of the submission rather than of the preview. */
    if (previewState.sequence_tagging) {
      previewState.sequence_tagging.snap_unit =
        (state.outputConfigs.sequence_tagging || {}).snap_unit === 'word' ? 'word' : 'character';
    }
    return {
      previewState: previewState,
      previewEntities: deepClone(state.previewEntities),
      previewTriples: deepClone(state.previewTriples),
      previewBypass: deepClone(state.previewBypass),
      /* FR-088: how long this answer took, travelling with the answer it
         describes. The data layer lifts it onto the history event; the
         result snapshot's whitelist deliberately does not pick it up. */
      timing: readLeadTiming(),
    };
  }

  /* Per-output textual answer summary attached to every history event
     (FR-016 對應輸出類型 + 修改內容), reusing the reviewer diff's own
     describeOutputAnswer() rather than a second formatter. */
  function buildHistorySummary() {
    return state.selectedOutputTypes
      .map(function (outKey) {
        var described = describeOutputAnswer(outKey, {
          previewState: state.previewState,
          previewEntities: state.previewEntities,
          previewTriples: state.previewTriples,
        });
        return outKey + ': ' + (described || t('reviewNoAnswer'));
      })
      .join('\n');
  }

  /* ── Annotator skip (issue #578, FR-089 / AC-2.20) ──────────────────
     The control is detached rather than hidden when it does not apply: a
     reviewer must not merely be unable to click it (FR-089 says their view
     never renders it), and a submitted sample offers no skip at all --
     FR-013A's three states decide, so `pending` and `saved` keep it and
     `submitted` loses it. Skipping does NOT change the sample's status;
     it appends one `skipped` history event, leaving "I set this aside"
     and "how far I got" as two facts that never overwrite each other. */
  var skipGroupNode = null;
  var skipGroupParent = null;
  var skipGroupAnchor = null;

  function skipReasonText() {
    var input = document.getElementById('wsSkipReason');
    return input ? input.value.trim() : '';
  }

  /* Blocked-not-disabled, the same convention issue #552 set for the
     reviewer submit: dimmed via [data-submit-blocked], but the click still
     reaches the handler so the toast can say what is missing. */
  function refreshSkipBlocker() {
    var btn = document.getElementById('wsSkipBtn');
    if (!btn) return;
    if (skipReasonText()) btn.removeAttribute('data-submit-blocked');
    else btn.setAttribute('data-submit-blocked', 'reason');
  }

  function renderSkipControl() {
    if (!skipGroupNode) return;
    var applies =
      currentRole === 'annotator' &&
      !window.LabelSuiteAnnotationWorkspaceData.isSampleSubmitted(
        currentProfile.id, currentRole, currentRunType, currentSampleId, currentIdentity
      );
    if (applies) {
      if (!skipGroupNode.parentNode) skipGroupParent.insertBefore(skipGroupNode, skipGroupAnchor);
      refreshSkipBlocker();
    } else if (skipGroupNode.parentNode) {
      skipGroupNode.remove();
    }
  }

  function handleSkip() {
    var reason = skipReasonText();
    if (!reason) {
      showToast(t('skipNeedsReason'), 'warning');
      return;
    }
    window.LabelSuiteAnnotationWorkspaceData.markSampleSkipped(
      currentProfile.id,
      currentRunType,
      currentSampleId,
      reason,
      buildHistorySummary(),
      currentIdentity
    );
    var input = document.getElementById('wsSkipReason');
    if (input) input.value = '';
    refreshSkipBlocker();
    renderSampleList();
    renderHistoryPanel();
    showToast(t('skipSuccess'));
    /* FR-089: a skip lands on the next sample by the SAME rule a submit
       does (FR-022A, and FR-022C when nothing is left), rather than a
       second navigation scheme of its own. */
    var nextUnit = findNextPendingUnit(buildUnits());
    if (nextUnit) selectSample(nextUnit.recordId);
    else window.location.href = buildListReturnUrl();
  }

  function handleSave() {
    window.LabelSuiteAnnotationWorkspaceData.markSampleSaved(
      currentProfile.id,
      currentRole,
      currentRunType,
      currentSampleId,
      collectAnswerPayload(),
      buildHistorySummary(),
      currentIdentity
    );
    clearUnsaved();
    renderAutosaveStatus();
    renderSampleList();
    renderHistoryPanel();
    showToast(t('wsSaveSuccess'));
  }

  /* FR-022A / SUBMIT_DEFAULT_ACTION = go-to-next-sample: the sample to land
     on after a submit is deliberately NOT units[i+1]. An annotator who
     works out of order (or resumes a half-finished task) has submitted
     neighbours, and stepping onto one drops them on a finished sample with
     nothing to do -- the same reasoning issue #456 recorded for the
     reviewer side. The scan therefore walks forward past submitted units
     and wraps around once; `null` means every unit is submitted, which is
     FR-022C's redirect condition. The current unit is reached last and is
     already submitted by the time this runs, so it never self-selects. */
  function findNextPendingUnit(units) {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    var start = currentUnitIndex(units);
    for (var step = 1; step <= units.length; step += 1) {
      var unit = units[(start + step) % units.length];
      if (!data.isSampleSubmitted(currentProfile.id, currentRole, currentRunType, unit.recordId, unitIdentity(unit))) {
        return unit;
      }
    }
    return null;
  }

  function handleSubmit() {
    /* Double-click guard (issue #201 / w6 DUP-01): a busy flag plus a
       temporary native disable so a rapid second click is inert instead of
       re-running the submit flow (backed by the appendHistoryEvent dedupe
       in annotation-workspace.data.js, which catches any click that still
       slips through). */
    if (state.submitBusy) return;
    state.submitBusy = true;
    var submitBtnEl = document.getElementById('wsSubmitBtn');
    if (submitBtnEl) submitBtnEl.disabled = true;

    clearAllPanelErrors();
    var allAnswered = true;
    state.selectedOutputTypes.forEach(function (outKey) {
      if (!isOutputAnswered(outKey)) {
        allAnswered = false;
        var panel = document.querySelector('[data-testid="ws-output-panel-' + outKey + '"]');
        if (panel) panel.setAttribute('data-error', 'true');
      }
    });
    if (!allAnswered) {
      showToast(t('wsSubmitIncomplete'), 'warning');
      state.submitBusy = false;
      if (submitBtnEl) submitBtnEl.disabled = false;
      return;
    }
    window.LabelSuiteAnnotationWorkspaceData.markSampleSubmitted(currentProfile.id, currentRole, currentRunType, currentSampleId, collectAnswerPayload(), buildHistorySummary(), currentIdentity);
    clearUnsaved();
    /* task-detail.html's dry-run status sync (waiting_iaa_confirmation once
       every sample is submitted) reads this key -- see
       annotation-workspace.data.js's syncDryRunProgress() doc comment. */
    window.LabelSuiteAnnotationWorkspaceData.syncDryRunProgress(
      currentProfile.id,
      currentRole,
      currentRunType,
      currentProfile.datasetRecords.length,
      currentIdentity
    );
    renderSampleList();
    renderSampleNav();
    renderHistoryPanel();
    /* issue #470: a submit is a real persisted write too (getSampleSavedAt
       falls back to submittedAt), so the indicator must reflect it even
       when the annotator submits without ever clicking 儲存草稿 first. */
    renderAutosaveStatus();
    showToast(t('wsSubmitSuccess'));
    state.submitBusy = false;
    if (submitBtnEl) submitBtnEl.disabled = false;

    /* issue #514: the submit had no follow-through at all until now. Both
       destinations are spec constants (SUBMIT_DEFAULT_ACTION /
       SUBMIT_ALL_DONE_ACTION), and the busy flag is released above first so
       the next sample loads with a live submit button.
       buildListReturnUrl() is the single writer FR-081's breadcrumb already
       goes through, so the all-done return lands on the same filtered list
       page the annotator came from rather than an unfiltered page 1. */
    var nextUnit = findNextPendingUnit(buildUnits());
    if (nextUnit) {
      selectSample(nextUnit.recordId);
    } else {
      window.location.href = buildListReturnUrl();
    }
  }

  /* ── reviewer mode (Phase 3, FR-024L / FR-024L-1 / FR-014A-C) ────────
     Registry-driven, one row per state.selectedOutputTypes entry -- no
     per-task_id branching. Each row's correction control is the EXACT
     annotator control (renderOutputPreview(container, outKey), the same
     dispatcher/testid-patch chain every annotator panel already goes
     through), seeded from the annotator's own submitted OutputAnswer
     instead of the dataset row, satisfying FR-024L-1's "reuse the
     annotator control, do not build a dedicated correction UI" mandate. */
  var reviewRowDecisions = {};
  var reviewRowOriginals = {};
  /* Every decision pair currently on screen, so the A/R shortcuts below can
     redraw them all after deciding the unit in one go. Rebuilt alongside
     reviewRowDecisions on each renderReviewerWorkspace(). */
  var reviewDecisionRefreshers = [];
  /* Per-outKey guard, sample-scoped (reset in selectSample only, NOT on
     every renderReviewerWorkspace() re-render): seedReviewState() must only
     run once per sample per outKey. buildReviewRow's decision handlers
     trigger a full renderReviewerWorkspace() re-render of every row;
     without this guard, that rebuild would call
     seedReviewState() again on EVERY row (not just the one interacted
     with), silently discarding any live correction the reviewer already
     made on other output types. */
  var reviewRowSeeded = {};

  function describeOutputAnswer(outKey, src) {
    src = src || {};
    var ps = (src.previewState && src.previewState[outKey]) || {};
    switch (outKey) {
      case 'single_label':
        return ps.selected || '';
      case 'multi_label':
        return (Array.isArray(ps.selected) ? ps.selected : [])
          .map(function (path) {
            return Array.isArray(path) ? path[path.length - 1] : String(path);
          })
          .join(', ');
      case 'single_dim':
        return ps.value != null && (ps._touched || ps._seeded) ? String(ps.value) : '';
      case 'multi_dim':
        return Object.keys(ps.dims || {})
          .map(function (name) {
            return name + '=' + ps.dims[name].value;
          })
          .join(', ');
      case 'sequence_tagging':
        return buildSequencePairsFromSpans(ps.spans)
          .map(function (span) { return span.text + '/' + span.label; })
          .join(' ');
      case 'entity_recognition':
        return (src.previewEntities || []).map(function (e) { return e.text; }).join(', ');
      case 'relation_identification':
        return (src.previewTriples || [])
          .map(function (tr) { return tr.subj + ' -> ' + tr.rel + ' -> ' + tr.obj; })
          .join('\n');
      case 'free_text':
        return ps.text || '';
      default:
        return '';
    }
  }

  /* Same stringification as describeOutputAnswer, but reading directly off
     a CompactAnswer value instead of engine state -- used to snapshot the
     reviewed annotator's seed for the review history diff. */
  function describeCompactAnswer(outKey, answer) {
    switch (outKey) {
      case 'single_label':
        return answer || '';
      case 'multi_label':
        return (Array.isArray(answer) ? answer : []).join(', ');
      case 'single_dim':
        return answer != null ? String(answer) : '';
      case 'multi_dim':
        return Object.keys(answer || {}).map(function (name) { return name + '=' + answer[name]; }).join(', ');
      case 'sequence_tagging':
        return (Array.isArray(answer) ? answer : []).map(function (p) { return p.text + '/' + p.label; }).join(' ');
      case 'entity_recognition':
        return (Array.isArray(answer) ? answer : []).map(function (e) { return e.text; }).join(', ');
      case 'relation_identification':
        return (Array.isArray(answer) ? answer : []).map(function (tr) { return tr.subj + ' -> ' + tr.rel + ' -> ' + tr.obj; }).join('\n');
      case 'free_text':
        return answer || '';
      default:
        return '';
    }
  }

  /* Locates the raw (un-sanitized, Data-Fairness-exempt for reviewers)
     dataset output-role field matching outKey's answer shape -- reused
     from the same shape-detection (looksLikeEntityList/looksLikeTripleList)
     buildAnnotatorRecord() already relies on, not a hardcoded field name. */
  function findRawOutputValue(outKey, rawRecord) {
    var roleMap = currentProfile.fieldRoleMap || {};
    var outputCols = Object.keys(roleMap).filter(function (col) {
      return roleMap[col] === 'output';
    });
    if (outKey === 'entity_recognition') {
      var entCol = outputCols.filter(function (col) { return looksLikeEntityList(rawRecord[col]); })[0];
      return entCol ? rawRecord[entCol] : null;
    }
    if (outKey === 'relation_identification') {
      var triCol = outputCols.filter(function (col) { return looksLikeTripleList(rawRecord[col]); })[0];
      return triCol ? rawRecord[triCol] : null;
    }
    var scalarCol = outputCols.filter(function (col) {
      var v = rawRecord[col];
      return !looksLikeEntityList(v) && !looksLikeTripleList(v);
    })[0];
    return scalarCol ? rawRecord[scalarCol] : null;
  }

  /* ── FR-014 aggregate review card (spec 015 v2.5.0) ──────────────────
     Replaces the old per-outKey approve/reject pair with a legacy-parity
     multi-annotator comparison: a stats box, a bulk approve/reject bar,
     and one decision row per annotator. reviewRowDecisions is now keyed
     `${outKey}::${annotatorName}` (annotatorName is the real annotator id
     since v3.8.0 -- it was the literal 'current') instead of just outKey. */
  function decisionKey(outKey, rowName) {
    return outKey + '::' + rowName;
  }

  /* Converts the live annotator's engine-shape submission (previewState /
     previewEntities / previewTriples) into the SAME CompactAnswer shape
     annotation-workspace.data.js's REVIEWER_MOCK_ROWS ships, so the mock
     rows and the prepended "current" row can share one answer renderer.
     FR-052: `(start, end)` is the authoritative pair and `text` is the
     denormalized slice of the source text at those offsets -- carried only
     because the review list and review card read it directly and their rows
     do not always travel with the source text. */
  function buildSequencePairsFromSpans(spans) {
    var text = getDatasetPreviewText() || '';
    return (Array.isArray(spans) ? spans : []).map(function (span) {
      return {
        text: text.substring(span.start, span.end),
        label: span.label,
        start: span.start,
        end: span.end,
      };
    });
  }

  /* Shared with annotation-list.html's official_run single-row rendering
     (annotation-workspace.data.js), which slices each span's text out of
     the source text the answer carries -- so this is a plain delegation. */
  function convertSubmissionAnswer(outKey, submission) {
    return window.LabelSuiteAnnotationWorkspaceData.convertSubmissionAnswer(outKey, submission);
  }

  /* A review reads the annotator's own submission, which only ever exists in
     this browser's localStorage -- so a prototype visitor arriving from the
     dashboard's 快速審核 without having annotated anything first got an empty
     review panel on every output type, while the list beside it promised
     待審 N 筆. Fall back to the REVIEWER_MOCK_ROWS entry for THAT annotator
     (v4.0.0: the review unit is sample × annotator, so the stand-in must name
     the same person the card claims to review), or the group's first row when
     the roster has no entry for them. No dataset gold column is read. A real
     submission always wins over it. */
  function demoAnnotatorRow() {
    var rows = window.LabelSuiteAnnotationWorkspaceData.getReviewerMockRows(
      currentProfile.id,
      currentSampleId
    ) || [];
    var annotatorId = currentAnnotatorId();
    var own = rows.filter(function (row) { return row.annotator === annotatorId; });
    if (own.length) return own[0];
    return rows.length ? rows[0] : null;
  }

  function getAnnotatorSubmission() {
    return window.LabelSuiteAnnotationWorkspaceData.getSubmission(
      currentProfile.id,
      'annotator',
      currentRunType,
      currentSampleId,
      currentIdentity
    );
  }

  /* The one annotator a review row belongs to (FR-049). Both branches below
     name the SAME person on purpose: DEFAULT_ANNOTATOR_ID is the first
     annotator of each REVIEWER_MOCK_ROWS group, so a real submission and the
     FR-044a demo fallback that stands in for it produce one continuous review
     trail rather than splitting across two ids. */
  function currentAnnotatorId() {
    return (
      (currentIdentity && currentIdentity.annotatorId) ||
      window.LabelSuiteAnnotationWorkspaceData.DEFAULT_ANNOTATOR_ID
    );
  }

  /* spec 015 v4.0.0 (FR-051, BREAKING): exactly ONE row -- the reviewed
     annotator's -- for BOTH run types. dry_run no longer merges the whole
     roster into a consensus the reviewer adjudicates; it reviews one person's
     answer at a time, identically to official_run. */
  function getReviewerRows(outKey) {
    var annotatorId = currentAnnotatorId();
    var submission = getAnnotatorSubmission();
    if (submission) {
      return [{
        name: annotatorId,
        displayName: annotatorId,
        answer: convertSubmissionAnswer(outKey, submission),
        bypass: !!(submission.previewBypass && submission.previewBypass[outKey]),
      }];
    }
    var demoRow = demoAnnotatorRow();
    if (!demoRow) return [];
    return [{
      name: annotatorId,
      displayName: annotatorId,
      answer: demoRow.answers ? demoRow.answers[outKey] : undefined,
      bypass: !!(demoRow.bypass && demoRow.bypass[outKey]),
    }];
  }

  /* Applies a CompactAnswer into the live engine state, mirroring
     convertSubmissionAnswer's shape in reverse -- the seed path for a review
     row whose source is the demo annotator row rather than a real submission
     (which carries full engine state and seeds directly). free_text is
     excluded entirely: its correction entry is the draft text itself, so
     there is nothing to pre-apply. */
  /* A CompactAnswer entity carries only {text, type}: the mock annotator rows
     model what an annotator answered, not the character offsets the marking
     flow records alongside it. The engine highlights an entity in the passage
     only when it has a start offset, so resolve one here -- first occurrence
     not yet taken by an earlier entity, `end` inclusive to match the engine's
     own span convention. Offsets come from the passage the panel already
     renders, never from the record's entity column (Constitution: Data
     Fairness); an entity whose text no longer occurs stays position-less and
     simply does not highlight, exactly as before. */
  function placeCompactEntities(entities) {
    var text = getDatasetPreviewText() || '';
    var placed = [];
    entities.forEach(function (entity) {
      var out = { text: entity.text, type: entity.type };
      for (var from = 0; text && entity.text; ) {
        var start = text.indexOf(entity.text, from);
        if (start < 0) break;
        var end = start + entity.text.length - 1;
        var taken = placed.some(function (p) { return p.start != null && start <= p.end && end >= p.start; });
        if (!taken) { out.start = start; out.end = end; break; }
        from = start + 1;
      }
      placed.push(out);
    });
    return placed;
  }

  function applyCompactAnswerToState(outKey, mergedValue) {
    switch (outKey) {
      case 'single_label':
        state.previewState[outKey] = state.previewState[outKey] || {};
        state.previewState[outKey].selected = mergedValue;
        break;
      case 'multi_label':
        state.previewState[outKey] = state.previewState[outKey] || {};
        state.previewState[outKey].selected = (mergedValue || []).map(function (label) { return [label]; });
        break;
      case 'single_dim':
        state.previewState[outKey] = state.previewState[outKey] || {};
        state.previewState[outKey].value = mergedValue;
        state.previewState[outKey]._touched = true;
        break;
      case 'multi_dim': {
        state.previewState[outKey] = state.previewState[outKey] || {};
        var dims = state.previewState[outKey].dims || {};
        Object.keys(mergedValue || {}).forEach(function (name) {
          dims[name] = { value: mergedValue[name], touched: true };
        });
        state.previewState[outKey].dims = dims;
        break;
      }
      case 'entity_recognition':
        state.previewEntities = placeCompactEntities(mergedValue || []);
        state.previewInited = true;
        break;
      case 'relation_identification':
        state.previewTriples = (mergedValue || []).map(function (tr) { return { subj: tr.subj, rel: tr.rel, obj: tr.obj }; });
        state.previewInited = true;
        break;
      /* FR-052: offsets are authoritative, so each span is restored to the
         `(start, end)` it carries. The retired reconstruction walked the
         token list consuming pairs by text left to right, which silently
         moved a span whenever its text repeated in the sentence. */
      case 'sequence_tagging':
        /* Written as a whole slice, with `textKey` left at the engine's own
           null default: seedSpanTaggingPreview() reads any other value as a
           text change and re-seeds from the dataset column, which would drop
           the answer restored here before the panel ever renders it. */
        state.previewState[outKey] = {
          spans: (mergedValue || []).map(function (span) {
            return { start: span.start, end: span.end, label: span.label };
          }),
          pendingSelection: null,
          prefillErrors: [],
          textKey: null,
          _seeded: true,
        };
        break;
      default:
        break;
    }
  }

  /* Builds a small icon-only span via safe DOM methods (no innerHTML) so
     mini-buttons never parse untrusted markup. */
  function buildIconSpan(icon) {
    var span = document.createElement('span');
    span.className = 'rv-btn-icon';
    span.textContent = icon;
    return span;
  }

  /* issue #453 (AC-3.42): issue #399 gave the decision buttons an
     aria-label, which fixed the screen-reader path only -- for a sighted
     reviewer the meaning still rode entirely on a '✕' / '✓' glyph. The
     visible label is the same string as the accessible name, so aria-label
     keeps winning the accessible-name computation and issue #399's
     getByRole('button', { name }) contract is unchanged. */
  function buildLabelSpan(text) {
    var span = document.createElement('span');
    span.className = 'rv-btn-text';
    span.textContent = text;
    return span;
  }

  /* The reviewer's live answer for outKey, read off the same engine state
     the correction control writes to. */
  function currentRowAnswer(outKey) {
    return describeOutputAnswer(outKey, {
      previewState: state.previewState,
      previewEntities: state.previewEntities,
      previewTriples: state.previewTriples,
    });
  }

  /* issue #398: whether outKey's current correction control value differs
     from the reviewed annotator's original answer. FR-014S deliberately
     does NOT persist the correction's own value across a reload -- it
     always reseeds from the original (seedReviewRow()) -- so a decision
     recorded while this is true cannot be trusted to still match what is
     on screen after a reload; see restoreReviewDraft() below. */
  function isRowCorrected(outKey) {
    return currentRowAnswer(outKey) !== (reviewRowOriginals[outKey] || '');
  }

  /* Reviewer draft persistence (issue #196, CONT-03 / role symmetry with the
     annotator's markSampleSaved): every row-decision change writes the
     review unit's current decisions into a dedicated localStorage draft
     bucket (annotation-workspace.data.js's saveReviewRowDecisionDraft), so
     an in-progress (pre-submit) approve/reject choice survives a reload
     instead of only living in the module-level reviewRowDecisions var.
     Each entry also records whether the correction was edited at the time
     of the decision (issue #398) -- not the correction's value itself,
     which stays outside FR-014S's persistence scope. */
  /* issue #596 (design.md D2): REVIEW_DECISIONS = approve | modify | bypass,
     a closed vocabulary this file MUST render from, never hardcode as a
     per-value branch set (Generalization-First). `approve` is the sole
     decision FR-016A does not require a reason for -- deriving the
     reason-required subset by excluding it (rather than listing
     modify/bypass by hand) keeps that single rule as the only literal. */
  var REVIEW_REASON_REQUIRED_DECISIONS = window.LabelSuiteAnnotationWorkspaceData.REVIEW_DECISIONS.filter(
    function (decision) { return decision !== 'approve'; }
  );
  function reviewDecisionRequiresReason(decision) {
    return REVIEW_REASON_REQUIRED_DECISIONS.indexOf(decision) >= 0;
  }

  function persistReviewDraft() {
    var annotatorId = currentAnnotatorId();
    var decisions = {};
    state.selectedOutputTypes.forEach(function (outKey) {
      var key = decisionKey(outKey, annotatorId);
      var decision = reviewRowDecisions[key];
      if (!decision) return;
      decisions[outKey] = { decision: decision, corrected: isRowCorrected(outKey) };
      /* issue #552 (FR-016A, issue #596 D2): the modify/bypass reason is part
         of the decision it explains, so it rides the same draft entry. */
      if (reviewDecisionRequiresReason(decision) && reviewRowReasons[key]) decisions[outKey].reason = reviewRowReasons[key];
    });
    window.LabelSuiteAnnotationWorkspaceData.saveReviewRowDecisionDraft(
      currentProfile.id, currentRunType, currentSampleId, decisions, currentIdentity
    );
  }

  /* issue #596 (FR-014B/FR-092, design.md D2): three-way toggle -- clicking
     the already-active decision cancels it back to undecided. One button per
     REVIEW_DECISIONS entry, in that constant's order; there is no `退回`
     control (FR-014B: MUST NOT render). Returns {el, refresh} so the bulk
     bar can force every row's buttons to redraw after a bulk decision. */
  var REVIEW_DECISION_LABEL_KEYS = {
    approve: 'reviewApproveLabel',
    modify: 'reviewModifyLabel',
    bypass: 'reviewBypassLabel',
  };
  var REVIEW_DECISION_ICONS = {
    approve: '✓',
    modify: '✎',
    bypass: '—',
  };
  function buildRowDecisionButtons(outKey, rowName, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'rv-choice-group';

    var buttons = window.LabelSuiteAnnotationWorkspaceData.REVIEW_DECISIONS.map(function (decision) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-btn mini-btn-' + decision;
      btn.setAttribute('data-testid', 'ws-review-row-' + decision);
      /* issue #399 (WCAG 2.1 SC 4.1.2): the icon-only glyph left the button
         with no accessible name at all -- give it one. */
      var label = t(REVIEW_DECISION_LABEL_KEYS[decision]);
      btn.setAttribute('aria-label', label);
      btn.appendChild(buildIconSpan(REVIEW_DECISION_ICONS[decision]));
      btn.appendChild(buildLabelSpan(label));
      /* issue #453 (AC-3.42): snapshot the answer the decision was made
         against, so syncDecisionsWithCorrections() can tell a later edit of
         that answer apart from an untouched one. */
      /* issue #552/#596: run EVERY refresher, not just this group's -- the
         row's reason field (buildReviewReasonField) follows the same
         decision and lives in the same list. */
      btn.addEventListener('click', function () {
        var key = decisionKey(outKey, rowName);
        reviewRowDecisions[key] = reviewRowDecisions[key] === decision ? null : decision;
        reviewDecisionAnswers[key] = currentRowAnswer(outKey);
        reviewDecisionRefreshers.forEach(function (refreshRow) { refreshRow(); });
        persistReviewDraft();
        if (onChange) onChange();
      });
      return { decision: decision, el: btn };
    });

    function refresh() {
      var decision = reviewRowDecisions[decisionKey(outKey, rowName)];
      buttons.forEach(function (entry) {
        var active = entry.decision === decision;
        entry.el.setAttribute('aria-pressed', active ? 'true' : 'false');
        entry.el.classList.toggle('mini-btn-active-' + entry.decision, active);
      });
    }
    refresh();
    reviewDecisionRefreshers.push(refresh);

    buttons.forEach(function (entry) { wrap.appendChild(entry.el); });
    return { el: wrap, refresh: refresh };
  }

  /* FR-054: the shared sidebar has advertised A / R since spec 008 without
     either ever being wired up. v4.0.0 made a review unit one annotator, so
     the two batch shortcuts it also advertised (Shift+A / Shift+R) have no
     set left to act on and are retired; what survives applies to the whole
     unit. A unit can carry several output types -- handleReviewSubmit()
     requires every one of them decided and nothing marks one as focused --
     so a keystroke decides them all, and repeating it cancels back to
     undecided exactly like clicking an already-active button does. */
  function setReviewUnitDecision(decision) {
    var rowName = currentAnnotatorId();
    var keys = state.selectedOutputTypes.map(function (outKey) {
      return decisionKey(outKey, rowName);
    });
    if (!keys.length) return;
    var cancels = keys.every(function (key) {
      return reviewRowDecisions[key] === decision;
    });
    state.selectedOutputTypes.forEach(function (outKey) {
      var key = decisionKey(outKey, rowName);
      reviewRowDecisions[key] = cancels ? null : decision;
      /* Same AC-3.42 snapshot the click handlers take -- the shortcut is
         the other way to reach the exact same decision. */
      reviewDecisionAnswers[key] = currentRowAnswer(outKey);
    });
    reviewDecisionRefreshers.forEach(function (refresh) {
      refresh();
    });
    persistReviewDraft();
  }

  /* free_text corrections are typed, so `a` and `b` are ordinary input the
     moment a field holds focus; a <select> consumes them as type-ahead. */
  function isTypingTarget(target) {
    var element = target && target.nodeType === 1 ? target : null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    var tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /* FR-054 v5.0.0 (design.md 已確認決策 #1): `R` (退回) is retired outright --
     the rollback channel it drove no longer exists -- so only `A` (通過) and
     `B` (無法判定) remain. 修正 stays unbound: its replacement value differs
     per outKey, so a single key cannot express it. */
  function setupReviewShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      var key = String(e.key).toLowerCase();
      if (key !== 'a' && key !== 'b') return;
      e.preventDefault();
      setReviewUnitDecision(key === 'a' ? 'approve' : 'bypass');
    });
  }

  /* The four action shortcuts the sidebar panel advertises (issue #152).
     Each one dispatches the click of the button it duplicates instead of
     calling the handler directly: the button already carries the role wiring
     (a reviewer's 儲存草稿 is hidden and has no listener) and the
     first/last-unit disabled state, and re-deriving either here would be a
     second source of truth that drifts.

     These stay live while typing, unlike the bare `a`/`r` review keys above:
     a modifier combo produces no text, and 儲存草稿 is wanted most in the
     middle of a free_text answer.

     preventDefault is load-bearing, not tidiness -- Ctrl/Cmd+S opens the
     browser's own save dialog and Alt+← is Back, so an unhandled combo would
     leave the workspace. It fires before the availability check so a hidden
     or disabled target still swallows the browser default. */
  function setupActionShortcuts() {
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      var id = null;
      if (mod && String(e.key).toLowerCase() === 's') id = 'wsSaveBtn';
      else if (mod && e.key === 'Enter') id = currentRole === 'reviewer' ? 'wsReviewSubmitBtn' : 'wsSubmitBtn';
      else if (e.altKey && e.key === 'ArrowLeft') id = 'wsPrevBtn';
      else if (e.altKey && e.key === 'ArrowRight') id = 'wsNextBtn';
      if (!id) return;
      e.preventDefault();
      var btn = document.getElementById(id);
      if (btn && !btn.disabled && !btn.classList.contains('hidden')) btn.click();
    });
  }

  /* Seeds the shared engine state so renderOutputPreview(container, outKey)
     -- the exact same dispatcher every annotator panel already goes through
     -- renders the correction control pre-filled with `value` instead of
     the dataset's default/prefilled value. `value` is either a real
     OutputAnswer submission (FR-044) or the CompactAnswer of the demo
     annotator row standing in for one (FR-044a); both paths go through the
     SAME assignment logic below. */
  /* A task whose outputs[] carries no entity_recognition treats the dataset's
     entity spans as scaffolding (evidence role, T008): the annotator picks
     relations out of them but never marks or submits an entity list, so a
     review panel seeded purely from the submission starts with none -- and the
     engine's relation builder then rejects every passage pick, because
     findEntitySlot() only accepts spans present in state.previewEntities.
     Re-seed from the dataset record, exactly as initPreviewState() does for
     the annotator.
     Conditioned on composition, not on emptiness alone: when
     entity_recognition IS an output type those spans are the answer under
     review, and injecting the dataset's own column would hand the reviewer a
     gold answer nobody submitted (Constitution: Data Fairness). */
  function scaffoldingEntities() {
    if (state.selectedOutputTypes.indexOf('entity_recognition') >= 0) return [];
    var raw = state.datasetRawFirstRow || {};
    return Array.isArray(raw.entities) ? deepClone(raw.entities) : [];
  }

  function seedReviewState(outKey, value, isCompactAnswer) {
    if (isCompactAnswer) {
      delete state.previewState[outKey];
      /* Reset ONLY the slice this output type owns. previewEntities and
         previewTriples are shared engine state, not per-type slots like
         previewState[outKey], and the reviewer workspace seeds them once per
         output type: the merged span card seeds entity_recognition and then
         relation_identification (T010/T013), and T013 seeds a third card
         afterwards. Clearing both arrays on every seed therefore wiped the
         sibling that had just been seeded -- the correction panel lost its
         entity highlights, and in T013 its relations too. */
      if (outKey === 'entity_recognition') state.previewEntities = [];
      if (outKey === 'relation_identification') {
        state.previewTriples = [];
        /* Empty unless the task has no entity_recognition output, in which
           case this is the only seed the panel's entities ever get. */
        var scaffolding = scaffoldingEntities();
        if (scaffolding.length) state.previewEntities = scaffolding;
      }
      state.previewBypass[outKey] = false;
      if (value != null) applyCompactAnswerToState(outKey, value);
      state.previewInited = true;
      return;
    }
    var submission = value;
    var savedPs = (submission.previewState && submission.previewState[outKey]) || null;
    /* Only assign when a real saved value exists -- ensurePreviewState()
       (task-config.engine.js) only merges in its own per-type defaults when
       state.previewState[outKey] is still falsy (undefined/null); pre-setting
       a truthy {} placeholder here (e.g. when the annotator never submitted
       an answer for this type) would silently defeat that default-merge and
       crash renderers that assume a fully-defaulted shape (e.g.
       renderFreeTextPreview's ps.text.length). */
    if (savedPs) {
      state.previewState[outKey] = deepClone(savedPs);
    } else {
      delete state.previewState[outKey];
    }
    if (outKey === 'multi_label' && state.previewState[outKey]) {
      /* selectorOpen is transient annotator UI state (whether the taxonomy
         dialog happened to be open at submit time), not part of the actual
         answer -- carrying it over would silently reopen the floating
         dialog on top of the review row's decision buttons (position:
         absolute, .taxonomy-selector-dialog in task-config.css:217). Each
         review row starts with the dialog closed, same as a fresh render. */
      state.previewState[outKey].selectorOpen = false;
    }
    state.previewBypass[outKey] = !!(submission.previewBypass && submission.previewBypass[outKey]);
    if (outKey === 'entity_recognition' || outKey === 'relation_identification') {
      var submitted = deepClone(submission.previewEntities || []);
      state.previewEntities = submitted.length ? submitted : scaffoldingEntities();
      state.previewTriples = deepClone(submission.previewTriples || []);
      state.previewInited = true;
    }
  }

  /* title is null for every review row (FR-014P): that card carries nothing
     but the correction panel, which already shows what is under review, so a
     header repeating the output-type key is noise -- the whole header row
     goes away with it. */
  function buildReviewRowShell(title) {
    var row = document.createElement('div');
    row.className = 'content-card';
    row.setAttribute('data-testid', 'ws-review-row');
    if (!title) return row;

    var header = document.createElement('div');
    header.className = 'review-row-header';
    var titleEl = document.createElement('div');
    titleEl.className = 'content-card-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    row.appendChild(header);
    return row;
  }

  /* testidSuffix defaults to outKey; the merged span card passes 'span'
     because its single panel stands in for both of its output types. */
  function appendCorrectionControl(row, outKey, testidSuffix, originKeys) {
    /* issue #453 (AC-3.42): the correction control is display AND editor in
       one, so the moment a reviewer edits it the annotator's original
       answer is nowhere on screen and "what am I approving?" has no answer.
       Name the original next to the editor, and name the editor as the
       reviewer's corrected answer. originKeys covers the FR-014N merged
       span card, where one panel stands in for two output types. */
    (originKeys || [outKey]).forEach(function (originKey) {
      var origin = document.createElement('div');
      origin.className = 'rv-answer-origin';
      origin.setAttribute('data-testid', 'ws-review-original-answer');
      origin.setAttribute('data-outkey', originKey);
      var originalAnswer = reviewRowOriginals[originKey] || '';
      origin.setAttribute('data-answer', originalAnswer);
      origin.textContent =
        t('reviewOriginalAnswerLabel') + (originalAnswer || t('reviewNoAnswer'));
      row.appendChild(origin);
    });

    var correctionTitle = document.createElement('div');
    correctionTitle.className = 'rv-correction-title';
    correctionTitle.setAttribute('data-testid', 'ws-review-corrected-answer-title');
    correctionTitle.textContent = t('reviewCorrectionTitle');
    row.appendChild(correctionTitle);

    var correction = document.createElement('div');
    correction.setAttribute('data-testid', 'ws-review-correct-' + (testidSuffix || outKey));
    var panelMount = document.createElement('div');
    correction.appendChild(panelMount);
    renderOutputPreview(panelMount, outKey);
    row.appendChild(correction);
    return correction;
  }

  /* issue #399: this explains what the three-way decision (issue #596,
     design.md D2: approve/modify/bypass) actually does, but was defined in
     I18N and never rendered anywhere -- render it so reviewers can actually
     read it before deciding. issue #451/#515/#520 kept it as ONE
     run-type-invariant sentence deferring the submit consequence to a
     separate pre-submit confirmation area, mounted once per review unit
     above the whole card stack (not inside any ws-review-row) so AC-3.33's
     ban on a run_type branch INSIDE a review card never applied to it.
     issue #550 (FR-070 points 2/3 revoked, FR-077/AC-3.42/AC-3.44 revoked;
     spec 015 v4.55.0) folded that confirmation area's consequence into THIS
     element instead of a second element below the cards. issue #596 retired
     FR-014I's official_run-only rollback and rewrote the copy around the
     three-way decision: the shared `reviewNote` explains what 通過／修正／
     無法判定 do, and a dry run appends one sentence saying its finalization
     produces no final answer (AC-3.40) -- so the bubble is run-type-aware
     again and `data-run-type` labels which copy is on screen. It renders as a MASTER.md Tooltip
     (design/system/MASTER.md:1423-1482) reusing task-config.css's
     .tooltip-wrap / .field-help-tooltip / .tooltip-bubble -- this page
     already links that stylesheet for the shared task-config engine. A real
     <button> triggers it (never the native title attribute, MASTER.md:1482)
     with an aria-describedby-linked role="tooltip" bubble, so hover and
     keyboard focus both work. Once-per-unit count and DOM order (before the
     first card) are unchanged from issue #520; the mount point moved on the
     maintainer's review of #550: it sits in the FR-064 unit-context banner
     right after the 了解審核流程 trigger, so the two "what does this unit
     mean" entry points share one row instead of one floating between the
     banner and the card stack. */
  var REVIEW_NOTE_RUN_SUFFIX_I18N_KEYS = { dry_run: 'reviewNoteDryRunExtra' };

  function appendReviewNoteTooltip(host) {
    var wrap = document.createElement('div');
    wrap.className = 'rv-review-note';
    wrap.setAttribute('data-testid', 'ws-review-note');

    var tooltipWrap = document.createElement('span');
    tooltipWrap.className = 'tooltip-wrap';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'field-help-tooltip';
    trigger.textContent = '?';
    trigger.setAttribute('data-testid', 'ws-review-note-trigger');
    trigger.setAttribute('aria-label', t('reviewNoteTriggerLabel'));
    trigger.setAttribute('aria-describedby', 'wsReviewNoteBubble');

    var bubble = document.createElement('p');
    bubble.className = 'tooltip-bubble';
    bubble.id = 'wsReviewNoteBubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.setAttribute('data-testid', 'ws-review-note-bubble');
    bubble.setAttribute('data-run-type', currentRunType);
    /* AC-3.40: both run types read the SAME explanation of the three-way
       decision; a dry run appends ONE sentence about what its finalization
       does NOT produce. Expressed as a lookup rather than an if, so the
       shared sentence can never drift between the two copies and adding a
       run type is a data change (Generalization-First). */
    var suffixKey = REVIEW_NOTE_RUN_SUFFIX_I18N_KEYS[currentRunType];
    bubble.textContent = t('reviewNote') + (suffixKey ? t(suffixKey) : '');

    tooltipWrap.appendChild(trigger);
    tooltipWrap.appendChild(bubble);
    wrap.appendChild(tooltipWrap);
    host.appendChild(wrap);
  }

  /* FR-014P: a review card must end with exactly ONE decision line,
     the same shape for every output type. The engine's Bypass row already is
     that line ("無法判定 (Bypass)"), so the approve/reject pair is docked into
     it instead of floating in a card header far above the answer it judges.
     Two things make this more than an appendChild: the engine rebuilds the
     whole panel on every Bypass toggle and every entity/relation edit, which
     detaches whatever we put inside it, and a task configured with
     allow_bypass:false renders no such row at all. So docking is idempotent,
     re-runs from a MutationObserver, and always re-attaches the SAME element
     -- a rebuilt copy would drop the reviewer's pending decision. */
  function dockDecisionsOnBypassRow(correction, decisionEls) {
    var fallbackRow = null;
    function place() {
      var bypassRow = correction.querySelector('.' + BYPASS_ROW_CLASS + ':not(.rv-decision-row)');
      if (!bypassRow) {
        if (!fallbackRow) {
          fallbackRow = document.createElement('div');
          fallbackRow.className = BYPASS_ROW_CLASS + ' rv-decision-row';
        }
        if (fallbackRow.parentNode !== correction) correction.appendChild(fallbackRow);
        bypassRow = fallbackRow;
      } else if (fallbackRow && fallbackRow.parentNode) {
        fallbackRow.parentNode.removeChild(fallbackRow);
      }
      decisionEls.forEach(function (decisionEl) {
        /* Guard the append: without it, each re-dock would itself be a
           mutation and the observer would never settle. */
        if (decisionEl.parentNode !== bypassRow) bypassRow.appendChild(decisionEl);
      });
    }
    place();
    new MutationObserver(place).observe(correction, { childList: true, subtree: true });
  }

  /* spec 015 v4.0.0 (US3/US6, FR-044/FR-014P, BREAKING): ONE review card
     shape for both run types -- no title row, no stats box, no consensus
     badge, no apply-majority, no annotator list, no deviation coloring; just
     the reviewed annotator's answer in the correction panel, closing on one
     decision pair. dry_run's consensus/gold adjudication model (FR-030/
     FR-039~FR-042) is gone with the merge it read from. */
  /* A real submission carries the annotator's own engine state (exact spans
     included), so it seeds through the OutputAnswer path. The demo fallback
     only has a CompactAnswer and takes the compact path -- entity offsets get
     resolved against the passage there (placeCompactEntities). */
  function seedReviewRow(outKey, submission) {
    if (submission) {
      reviewRowOriginals[outKey] = describeOutputAnswer(outKey, submission);
      if (!reviewRowSeeded[outKey]) {
        seedReviewState(outKey, submission, false);
        reviewRowSeeded[outKey] = true;
      }
      return;
    }
    var demoRow = demoAnnotatorRow();
    var answer = demoRow && demoRow.answers ? demoRow.answers[outKey] : null;
    reviewRowOriginals[outKey] = answer != null ? describeCompactAnswer(outKey, answer) : '';
    if (!reviewRowSeeded[outKey]) {
      seedReviewState(outKey, answer, true);
      reviewRowSeeded[outKey] = true;
    }
  }

  /* issue #552/#596 (FR-016A, design.md D2): `modify`/`bypass` must say why
     -- `approve` never does. The field is a direct child of the review card,
     AFTER the correction panel rather than inside its Bypass row: the shared
     engine rebuilds that panel wholesale (FR-014P point 3), and anything
     docked inside it has to be re-attached by dockDecisionsOnBypassRow()'s
     observer -- outside it, the field just stays. Visibility follows the
     row's decision through the same refresher list the decision buttons
     use, so shortcuts (FR-054) and draft restores drive it too. */
  var reviewRowReasons = {};

  function reviewRowReason(outKey, rowName) {
    return (reviewRowReasons[decisionKey(outKey, rowName)] || '').trim();
  }

  /* A modify/bypass decision may still lack its reason -- surface that on
     the footer button as a blocked look (data attribute + CSS), never
     `disabled` or `aria-disabled`: FR-083 needs the click to reach
     handleReviewSubmit() so the toast can name the outKeys, and both of
     those would stop it. */
  function refreshReviewSubmitState() {
    var reviewSubmitBtn = document.getElementById('wsReviewSubmitBtn');
    if (!reviewSubmitBtn) return;
    var rowName = currentAnnotatorId();
    var missing = state.selectedOutputTypes.some(function (outKey) {
      return reviewRowBlocker(outKey, rowName) === 'reason';
    });
    if (missing) reviewSubmitBtn.setAttribute('data-submit-blocked', 'reason');
    else reviewSubmitBtn.removeAttribute('data-submit-blocked');
  }

  function buildReviewReasonField(outKey, rowName) {
    var key = decisionKey(outKey, rowName);
    var wrap = document.createElement('div');
    wrap.className = 'rv-review-reason hidden';

    var label = document.createElement('label');
    label.className = 'rv-review-reason-label';
    label.textContent = t('reviewReasonLabel');
    var inputId = 'wsReviewReason-' + outKey;
    label.setAttribute('for', inputId);

    var input = document.createElement('textarea');
    input.id = inputId;
    input.rows = 2;
    input.required = true;
    input.setAttribute('data-testid', 'ws-review-reason');
    input.setAttribute('data-outkey', outKey);
    input.setAttribute('placeholder', t('reviewReasonPlaceholder'));
    input.addEventListener('input', function () {
      reviewRowReasons[key] = input.value;
      refreshReviewSubmitState();
      persistReviewDraft();
    });

    /* Mounted only while the row's decision requires a reason (FR-016A:
       通過時不出現); the typed text lives in reviewRowReasons, so a re-mount
       restores it. */
    function refresh() {
      var needsReason = reviewDecisionRequiresReason(reviewRowDecisions[key]);
      wrap.classList.toggle('hidden', !needsReason);
      if (needsReason && input.parentNode !== wrap) {
        input.value = reviewRowReasons[key] || '';
        wrap.appendChild(label);
        wrap.appendChild(input);
      } else if (!needsReason && input.parentNode === wrap) {
        wrap.removeChild(label);
        wrap.removeChild(input);
      }
      refreshReviewSubmitState();
    }
    refresh();
    reviewDecisionRefreshers.push(refresh);
    return wrap;
  }

  function buildReviewRow(outKey, submission) {
    var row = buildReviewRowShell(null);

    seedReviewRow(outKey, submission);
    var correction = appendCorrectionControl(row, outKey);
    dockDecisionsOnBypassRow(correction, [buildRowDecisionButtons(outKey, currentAnnotatorId(), null).el]);
    row.appendChild(buildReviewReasonField(outKey, currentAnnotatorId()));
    return row;
  }

  /* spec 015 FR-077/AC-3.42 (issue #453) used to pair this with a pre-submit
     summary that restated, per output type, the original answer, the
     corrected answer, the decision and the submit consequence -- issue #550
     revoked that summary (see the v4.55.0 Changelog entry). What survives:
     every decision records the answer it was made against, so a later edit
     of that answer invalidates it instead of silently riding along -- the
     live-edit twin of issue #398's reload path (which stays as-is:
     FR-014S/AC-6.10 still excludes the correction's own value from draft
     persistence). */
  var reviewDecisionAnswers = {};

  /* AC-3.42: a decision must never outlive the value it judged. A restored
     FR-014S draft (AC-6.10) carries no snapshot, and is only ever restored
     when its correction was untouched -- so the freshly seeded answer IS
     the value it was made against; adopt it rather than resetting it. */
  function syncDecisionsWithCorrections() {
    var rowName = currentAnnotatorId();
    var reset = false;
    state.selectedOutputTypes.forEach(function (outKey) {
      var key = decisionKey(outKey, rowName);
      if (!reviewRowDecisions[key]) return;
      var answer = currentRowAnswer(outKey);
      if (!(key in reviewDecisionAnswers)) {
        reviewDecisionAnswers[key] = answer;
        return;
      }
      if (reviewDecisionAnswers[key] === answer) return;
      reviewRowDecisions[key] = null;
      delete reviewDecisionAnswers[key];
      reset = true;
    });
    if (!reset) return;
    reviewDecisionRefreshers.forEach(function (refresh) {
      refresh();
    });
    persistReviewDraft();
    showToast(t('toastReviewDecisionResetOnEdit'), 'warning');
  }

  /* issue #515 (2-a) established these three functions as the single source
     for "is this review unit interactive" (not arbitration, not finalized,
     not empty); renderReviewerWorkspace()'s three early returns are the
     sole consumer since issue #550 removed the summary's own duplicate
     interactivity re-renders (see the v4.55.0 Changelog entry). */
  var REVIEW_UNIT_BLOCK = {
    ARBITRATION: 'arbitration',
    FINALIZED: 'finalized',
    EMPTY: 'empty',
  };

  function currentReviewUnitStatus() {
    return window.LabelSuiteAnnotationWorkspaceData.getReviewUnitStatus(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity, state.selectedOutputTypes,
      { minReviewers: currentProfile.minReviewers || 1 }
    );
  }

  /* Returns null when the unit IS interactive. */
  function reviewUnitBlockReason(unitStatus) {
    var workspaceData = window.LabelSuiteAnnotationWorkspaceData;
    if (
      unitStatus === workspaceData.REVIEW_UNIT_STATUS.DISPUTED &&
      workspaceData.isArbiterCandidate(currentProfile.id, currentRunType, currentSampleId, currentIdentity)
    ) {
      return REVIEW_UNIT_BLOCK.ARBITRATION;
    }
    if (unitStatus === workspaceData.REVIEW_UNIT_STATUS.FINALIZED) return REVIEW_UNIT_BLOCK.FINALIZED;
    if (unitStatus === null && !demoAnnotatorRow()) return REVIEW_UNIT_BLOCK.EMPTY;
    return null;
  }

  /* The shared engine owns every correction control and exposes no change
     hook, so mirror markUnsaved()'s delegated-capture approach on the
     preview root and re-derive on the next tick, after the engine's own
     handler has written the new value into state -- decision clicks land
     here too, which is what keeps a decision from outliving the answer it
     judged (syncDecisionsWithCorrections(), AC-3.42 point 2). */
  (function watchReviewEdits() {
    var previewRoot = document.getElementById('annotationPreview');
    if (!previewRoot) return;
    var queued = false;
    function schedule() {
      if (currentRole !== 'reviewer' || queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        syncDecisionsWithCorrections();
      }, 0);
    }
    ['input', 'change', 'click'].forEach(function (eventName) {
      previewRoot.addEventListener(eventName, schedule, true);
    });
  })();

  /* FR-014N: entity_recognition and relation_identification are two stages
     of ONE annotation action (mark the spans, then link them), and the
     engine already models them that way -- the relation panel it mounts is
     a superset that renders the raw text, the entity type selector, both
     bypass toggles and the relation builder. Giving each output type its
     own correction control therefore painted the same sample text twice on
     one screen (three times with the 原始文本 card on top), all copies
     visually identical, so nothing told the reviewer which one was
     interactive. A task shipping both collapses them into a single card:
     exactly one 直接修正 panel mounted from relation_identification, closing
     on one labeled decision pair per output type. Decisions stay keyed by
     output type, so the submit gate is unaffected. */
  var SPAN_OUTPUT_KEYS = ['entity_recognition', 'relation_identification'];

  function mergedSpanKeys() {
    var keys = SPAN_OUTPUT_KEYS.filter(function (outKey) {
      return state.selectedOutputTypes.indexOf(outKey) >= 0;
    });
    return keys.length === SPAN_OUTPUT_KEYS.length ? keys : null;
  }

  function buildSectionLabel(outKey) {
    var label = document.createElement('div');
    label.className = 'rv-section-label';
    label.setAttribute('data-testid', 'ws-review-section-label');
    label.textContent = outKey;
    return label;
  }

  function buildMergedSpanReviewRow(outKeys, submission) {
    /* One panel stands in for both output types, so each decision pair keeps
       its type label -- unlike a single-type card, where the pair is
       unambiguous on its own (FR-014P). */
    var decisionEls = outKeys.map(function (outKey) {
      var group = document.createElement('div');
      group.className = 'rv-merged-decision';
      group.appendChild(buildSectionLabel(outKey));
      group.appendChild(buildRowDecisionButtons(outKey, currentAnnotatorId(), null).el);
      return group;
    });
    var row = buildReviewRowShell(null);

    outKeys.forEach(function (outKey) {
      seedReviewRow(outKey, submission);
    });

    var correction = appendCorrectionControl(row, 'relation_identification', 'span', outKeys);
    dockDecisionsOnBypassRow(correction, decisionEls);
    outKeys.forEach(function (outKey) {
      row.appendChild(buildReviewReasonField(outKey, currentAnnotatorId()));
    });
    return row;
  }

  /* Reviewer and annotator share the same sample-source contract (spec 015
     v2.0.0 US3 行為規則: "Reviewer 與 Annotator 共用相同樣本來源契約與導覽
     骨架，避免視圖不一致") -- the reviewer must also see the original
     source text, not only the review rows. Data Fairness still applies:
     only fieldRoleMap 'input' fields are ever surfaced here (mirrors
     annotation-list.html's getRecordSnippet()); non-string input-role
     fields (e.g. absa_va's structured `utterances` column) are skipped in
     favor of their scalar sibling ('text'), same generalized rule 裁決6
     applied to the dashboard test helper. */
  function buildReviewerInputText(record, fieldRoleMap) {
    var inputKeys = Object.keys(fieldRoleMap || {}).filter(function (key) {
      return fieldRoleMap[key] === 'input';
    });
    return inputKeys
      .map(function (key) {
        var value = record[key];
        return typeof value === 'string' ? value : null;
      })
      .filter(Boolean)
      .join('\n\n');
  }
  /* ---- Arbitration layout (spec 015 v5.0.0 FR-061, issue #596 task 3.2) --
     A DISPUTED unit opened by an arbiter candidate (FR-060) swaps the whole
     review card for this layout: the annotator's answers stay read-only for
     context, and every still-open dispute item offers the FR-061 three-exit
     choice -- 採 A（標記員）／採 B（審核員）／兩者皆非. Correction controls
     and the ✕/✓ row decisions never render — an arbiter picks a side (or
     rejects both), they do not re-annotate.

     v5.0.0 removal: the former per-item majority-vote convergence
     (resolveDisputeConvergence) is gone -- FR-093 assigns exactly one
     reviewer per unit, so there is no vote to tally and every dispute item
     is decided by the arbiter, not auto-converged. */
  var arbitrationChoices = {};
  /* issue #568: dispute item ids still open on the rendered unit, read by
     the action-bar submit (handleArbitrationSubmit). */
  var arbitrationOpenItemIds = [];
  /* FR-089 / AC-3.50: one reason per OPEN dispute item, keyed the same way
     the choices are. Per item rather than per submit because a card can
     finalize several items at once and one shared sentence would not say
     why any single one went the way it did. */
  var arbitrationReasons = {};

  /* FR-061 point 3: reason is REQUIRED only for the 兩者皆非 exit -- 採 A／
     採 B never re-annotate and have no correction of their own to justify.
     An item with no choice yet, or with adopt_a/adopt_b, never counts as
     missing a reason. */
  function arbitrationItemsMissingReason() {
    return arbitrationOpenItemIds.filter(function (id) {
      var decision = arbitrationChoices[id];
      return !!decision && decision.choice === 'reject' && !(arbitrationReasons[id] || '').trim();
    });
  }

  /* Same blocked-not-disabled convention as the reviewer submit (#552). */
  function refreshArbitrationBlocker() {
    var btn = document.getElementById('wsArbitrationSubmitBtn');
    if (!btn) return;
    if (arbitrationItemsMissingReason().length) btn.setAttribute('data-submit-blocked', 'reason');
    else btn.removeAttribute('data-submit-blocked');
  }

  function formatDisputeValue(value) {
    /* issue #551: a naked reject carries the PURE_REJECT_VALUE sentinel
       instead of a real answer -- render it as what it is (a rejection with
       no proposed replacement), not as the raw marker string. */
    if (value === window.LabelSuiteAnnotationWorkspaceData.PURE_REJECT_VALUE) {
      return t('arbitrationPureRejectLabel');
    }
    if (value == null || value === '') return t('reviewNoAnswer');
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  function disputeItemId(item) {
    return item.outKey + '::' + item.key;
  }

  /* issue #408: compareOutputAnswer()'s default branch (single_label /
     single_dim / free_text -- any output type with no merge-key concept)
     sets diff.key = outKey, so item.key === item.outKey for every dispute
     item on those output types. Rendering both unconditionally duplicated
     the outKey ("single_label · single_label"); only append the key when
     it actually adds information beyond the outKey. */
  function disputeItemLabel(item) {
    return item.key === item.outKey ? item.outKey : item.outKey + ' · ' + item.key;
  }

  function buildArbitrationChoiceButton(testid, text, onSelect) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-btn';
    btn.setAttribute('data-testid', testid);
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = text;
    btn.addEventListener('click', onSelect);
    return btn;
  }

  /* FR-061 point 2: B's wording depends on the assigned reviewer's decision
     source for this outKey. design.md D2's "bypass 不存值" rule makes the
     stored value itself the reliable signal: a `modify` decision always
     carries a real replacement value, a `bypass` decision never stores one
     at all -- so item.reviewerValues reading as "no answer" (the same
     null/'' test formatDisputeValue()'s reviewNoAnswer branch already uses)
     IS the bypass case, not a value to render. */
  function arbitrationBChoiceText(item, reviewerSubmission) {
    var value = reviewerSubmission ? item.reviewerValues[reviewerSubmission.reviewerId] : undefined;
    if (value == null || value === '') return t('arbitrationChoiceBBypass');
    return t('arbitrationChoiceB') + '：' + formatDisputeValue(value);
  }

  /* `reviewerSubmission` is the unit's ONE assigned reviewer (FR-093) --
     there is exactly one B value per item, never a per-reviewer list to
     dedup (design.md D2 point 2: "MUST NOT 出現多個 B"). */
  function buildArbitrationItemRow(item, reviewerSubmission) {
    var itemId = disputeItemId(item);
    var row = document.createElement('div');
    row.setAttribute('data-testid', 'ws-arbitration-item');
    row.style.cssText = 'padding:10px 0;border-top:1px solid var(--color-border);';

    var label = document.createElement('div');
    label.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:6px;';
    label.textContent = disputeItemLabel(item);
    row.appendChild(label);

    /* Before the choice buttons, not after: the reason is what makes the
       choice legible later, and a field below the control you just pressed
       reads as an afterthought. Only required for 兩者皆非 (FR-061 point 3);
       採 A／採 B submit without one. */
    var reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.setAttribute('data-testid', 'ws-arbitration-reason');
    reasonInput.setAttribute('data-item-id', itemId);
    reasonInput.placeholder = t('arbitrationReasonPlaceholder');
    reasonInput.setAttribute('aria-label', t('arbitrationReasonPlaceholder'));
    reasonInput.style.cssText =
      'width:100%;font:inherit;font-size:13px;padding:5px 8px;margin-bottom:6px;'
      + 'border:1px solid var(--color-border);border-radius:var(--radius-sm);'
      + 'background:var(--color-surface);color:var(--color-ink);';
    reasonInput.addEventListener('input', function () {
      arbitrationReasons[itemId] = reasonInput.value;
      refreshArbitrationBlocker();
    });
    row.appendChild(reasonInput);

    var group = document.createElement('div');
    group.className = 'rv-choice-group';
    var buttons = [];
    function select(choice, value, btn) {
      arbitrationChoices[itemId] = { itemId: itemId, choice: choice, value: value };
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        b.classList.toggle('mini-btn-active-approve', b === btn);
      });
      refreshArbitrationBlocker();
    }

    var aBtn = buildArbitrationChoiceButton(
      'ws-arbitration-choose-a', t('arbitrationChoiceA') + '：' + formatDisputeValue(item.annotatorValue),
      function () { select('adopt_a', item.annotatorValue, aBtn); }
    );
    buttons.push(aBtn);
    group.appendChild(aBtn);

    var bValue = reviewerSubmission ? item.reviewerValues[reviewerSubmission.reviewerId] : undefined;
    var bBtn = buildArbitrationChoiceButton(
      'ws-arbitration-choose-b', arbitrationBChoiceText(item, reviewerSubmission),
      function () { select('adopt_b', bValue, bBtn); }
    );
    buttons.push(bBtn);
    group.appendChild(bBtn);

    /* FR-061 point 3: the third exit -- neither side is adoptable. Carries
       no finalized value of its own; a completed submission lands the item
       in the final exception pool (FR-095) instead of the arbitration
       store. */
    var rejectBtn = buildArbitrationChoiceButton(
      'ws-arbitration-choose-reject', t('arbitrationChoiceReject'),
      function () { select('reject', null, rejectBtn); }
    );
    buttons.push(rejectBtn);
    group.appendChild(rejectBtn);

    row.appendChild(group);
    return row;
  }

  function buildArbitrationResolvedRow(item, value, note, testid) {
    var row = document.createElement('div');
    row.setAttribute('data-testid', testid);
    row.style.cssText = 'padding:10px 0;border-top:1px solid var(--color-border);font-size:12px;';
    row.textContent = disputeItemLabel(item) + '：' + formatDisputeValue(value) + '（' + note + '）';
    return row;
  }

  /* FR-094 point 2/3 (issue #596): the micro conflict trace that REPLACES
   * the removed FR-069 per-reviewer vote breakdown. One reviewer owns a
   * unit (FR-093), so "who voted what" no longer exists; what a reader of a
   * finalized unit needs is the responsibility chain that closed it.
   *
   * A and B are FR-061's POSITIONAL letters (A・標記員 / B・審核員), never
   * truncated accounts -- the account behind a letter is exactly what the
   * tooltip expands, so printing it in the line too would make the tooltip
   * pointless. Every segment is derived from the same three stores the
   * status derivation reads (the reviewer submission's decisions, the
   * arbitration items, the exception pool): no second copy of the chain is
   * persisted, and no task id or account is ever branched on. */
  var TRACE_SIDE_LETTERS = { adopt_a: 'A', adopt_b: 'B' };
  var TRACE_ANNOTATOR_LETTER = TRACE_SIDE_LETTERS.adopt_a;
  var TRACE_REVIEWER_LETTER = TRACE_SIDE_LETTERS.adopt_b;
  var TRACE_SEPARATOR = ' ➔ ';
  /* A unit with several dispute items can close on different sides (or with
   * different pool actions). Naming every distinct one keeps the single
   * line honest instead of silently reporting whichever item happened to be
   * read last. */
  var TRACE_MULTI_JOIN = '／';
  var TRACE_DECISION_I18N_KEYS = {
    approve: 'reviewApproveLabel',
    modify: 'reviewModifyLabel',
    bypass: 'reviewBypassLabel',
  };
  var EXCEPTION_ACTION_I18N_KEYS = {
    adopt_annotator: 'exceptionActionAdoptAnnotator',
    adopt_reviewer: 'exceptionActionAdoptReviewer',
    custom_answer: 'exceptionActionCustomAnswer',
    exclude_from_dataset: 'exceptionActionExcludeFromDataset',
  };
  /* Most escalated first: one line describes the WHOLE unit, and the
   * decision that pushed it down the differing lane is the one worth
   * naming. Order is data, not a branch chain. */
  var TRACE_DECISION_PRECEDENCE = ['bypass', 'modify', 'approve'];

  function unitReviewDecision(reviewerSubmission) {
    var decisions = (reviewerSubmission && reviewerSubmission.answers
      && reviewerSubmission.answers.decisions) || {};
    var winner = null;
    TRACE_DECISION_PRECEDENCE.forEach(function (decision) {
      if (winner) return;
      var hit = state.selectedOutputTypes.some(function (outKey) {
        return decisions[outKey] === decision;
      });
      if (hit) winner = decision;
    });
    return winner;
  }

  var traceAccountSeq = 0;

  /* Appends one account-bearing segment: the visible token goes in `line`,
   * its full-account bubble goes in `host` -- deliberately OUTSIDE the
   * trace line, so the line's text content is the trace and nothing else.
   * That separation is also why the reveal is two listeners instead of
   * §Tooltip's adjacent-sibling CSS rule, which cannot reach across it.
   * MUST NOT fall back to the native `title` attribute (FR-094 point 2). */
  function appendTraceActor(line, host, role, token, account) {
    var wrap = document.createElement('span');
    wrap.className = 'tooltip-wrap rv-trace-actor-wrap';
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'rv-trace-actor';
    trigger.setAttribute('data-testid', 'ws-trace-actor');
    trigger.setAttribute('data-actor-role', role);
    trigger.textContent = token;
    traceAccountSeq += 1;
    var bubbleId = 'wsTraceAccount' + traceAccountSeq;
    trigger.setAttribute('aria-describedby', bubbleId);
    wrap.appendChild(trigger);
    line.appendChild(wrap);

    var bubble = document.createElement('span');
    bubble.className = 'tooltip-bubble rv-trace-bubble';
    bubble.id = bubbleId;
    bubble.setAttribute('role', 'tooltip');
    bubble.setAttribute('data-testid', 'ws-trace-account');
    bubble.textContent = account;
    host.appendChild(bubble);

    var toggle = function (open) {
      return function () { bubble.classList.toggle('is-open', open); };
    };
    trigger.addEventListener('mouseenter', toggle(true));
    trigger.addEventListener('mouseleave', toggle(false));
    trigger.addEventListener('focus', toggle(true));
    trigger.addEventListener('blur', toggle(false));
  }

  function buildFinalizedTrace(reviewerSubmission, arbState, exceptionPool) {
    var host = document.createElement('div');
    host.className = 'rv-trace-host';
    var line = document.createElement('div');
    line.className = 'rv-finalized-trace';
    line.setAttribute('data-testid', 'ws-finalized-trace');
    host.appendChild(line);
    var text = function (value) { line.appendChild(document.createTextNode(value)); };
    /* FR-094's example reads 「（修正）➔ 仲裁 B」: a full-width closer already
       carries its own trailing whitespace, so the separator drops its
       leading space right after one. Latin locales, whose decision template
       closes with an ASCII ')', keep it. */
    var separate = function () {
      var rendered = line.textContent;
      var keepSpace = rendered.charAt(rendered.length - 1) !== '）';
      text(keepSpace ? TRACE_SEPARATOR : TRACE_SEPARATOR.slice(1));
    };

    text(t('traceLabel') + t('traceAnnotator') + ' ');
    appendTraceActor(line, host, 'annotator', TRACE_ANNOTATOR_LETTER,
      (currentIdentity && currentIdentity.annotatorId) || '');

    var decision = unitReviewDecision(reviewerSubmission);
    if (decision) {
      separate();
      text(t('traceReviewer') + ' ');
      appendTraceActor(line, host, 'reviewer', TRACE_REVIEWER_LETTER,
        (reviewerSubmission && reviewerSubmission.reviewerId) || '');
      text(t('traceDecisionTpl').replace('{decision}', t(TRACE_DECISION_I18N_KEYS[decision])));
    }

    /* An arbitration item finalizes on the side its arbiter voted for, so
       the adopted letter is read off that arbiter's own vote rather than
       re-derived from the stored value. */
    var sides = [];
    var arbiterId = null;
    Object.keys(arbState).forEach(function (itemId) {
      var stored = arbState[itemId];
      if (!stored || !stored.finalized_by) return;
      var vote = null;
      (stored.votes || []).forEach(function (candidate) {
        if (candidate.arbiter_id === stored.finalized_by) vote = candidate;
      });
      var letter = vote && TRACE_SIDE_LETTERS[vote.choice];
      if (!letter) return;
      if (sides.indexOf(letter) === -1) sides.push(letter);
      if (!arbiterId) arbiterId = stored.finalized_by;
    });
    if (sides.length) {
      separate();
      text(t('traceArbitration') + ' ');
      appendTraceActor(line, host, 'arbiter', sides.sort().join(TRACE_MULTI_JOIN), arbiterId);
    }

    /* The pool is always the tail: it only ever runs on what arbitration
       could not close (FR-095). */
    var actions = [];
    var resolverId = null;
    Object.keys(exceptionPool).forEach(function (outKey) {
      var record = exceptionPool[outKey];
      var key = record && EXCEPTION_ACTION_I18N_KEYS[record.action];
      if (!key) return;
      var label = t(key);
      if (actions.indexOf(label) === -1) actions.push(label);
      if (!resolverId) resolverId = record.resolver_id;
    });
    if (actions.length) {
      separate();
      text(t('traceExceptionPool') + ' ');
      appendTraceActor(line, host, 'exception_pool', actions.join(TRACE_MULTI_JOIN), resolverId);
    }

    return host;
  }

  function renderArbitrationCard(preview, submission) {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    arbitrationChoices = {};
    arbitrationReasons = {};

    var card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-testid', 'ws-arbitration-card');

    var title = document.createElement('h3');
    title.style.cssText = 'font-size:14px;margin:0 0 4px;';
    title.textContent = t('arbitrationTitle');
    card.appendChild(title);

    var note = document.createElement('p');
    note.style.cssText = 'font-size:12px;color:var(--color-text-soft);margin:0 0 10px;';
    note.textContent = t('arbitrationNote');
    card.appendChild(note);

    /* Read-only context: the annotator's full answers, so the arbiter sees
       the agreed parts around each disputed value. */
    var agreedTitle = document.createElement('div');
    agreedTitle.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:4px;';
    agreedTitle.textContent = t('arbitrationAgreedTitle');
    card.appendChild(agreedTitle);
    state.selectedOutputTypes.forEach(function (outKey) {
      var line = document.createElement('div');
      line.style.cssText = 'font-size:12px;white-space:pre-line;margin-bottom:2px;';
      line.textContent = outKey + '：'
        + (describeCompactAnswer(outKey, data.convertSubmissionAnswer(outKey, submission)) || t('reviewNoAnswer'));
      card.appendChild(line);
    });

    /* FR-093: exactly one reviewer is ever assigned to a unit -- the same
       submission both produced the dispute items (getDisputeItems) and
       decides how each item's B side renders (arbitrationBChoiceText). */
    var reviewerSubmission = data.readReviewerSubmissions(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity
    )[0] || null;

    var items = data.getDisputeItems(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity, state.selectedOutputTypes
    );
    var arbState = data.getArbitrationState(currentProfile.id, currentRunType, currentSampleId, currentIdentity);
    var openItemIds = [];
    items.forEach(function (item) {
      var stored = arbState[disputeItemId(item)];
      if (stored && stored.finalized_by) {
        card.appendChild(buildArbitrationResolvedRow(
          item, stored.finalized_value, stored.finalized_by, 'ws-arbitration-finalized'
        ));
        return;
      }
      openItemIds.push(disputeItemId(item));
      card.appendChild(buildArbitrationItemRow(item, reviewerSubmission));
    });

    /* issue #568: the submit lives in the fixed action bar
       (#wsArbitrationSubmitBtn, bound once in init to handleArbitrationSubmit)
       so it sits where 送出審核 sits instead of scrolling with the card.
       renderReviewer() hides it before branching; only an open item shows it. */
    arbitrationOpenItemIds = openItemIds;
    var arbitrationSubmitBtn = document.getElementById('wsArbitrationSubmitBtn');
    if (arbitrationSubmitBtn && openItemIds.length) arbitrationSubmitBtn.classList.remove('hidden');
    refreshArbitrationBlocker();

    preview.appendChild(card);
  }

  function handleArbitrationSubmit() {
    var decisions = arbitrationOpenItemIds.map(function (id) { return arbitrationChoices[id]; });
    if (!decisions.length) return;
    if (decisions.some(function (decision) { return !decision; })) {
      showToast(t('toastArbitrationIncomplete'), 'warning');
      return;
    }
    /* FR-061 point 3 / FR-089 style: the toast NAMES the items still missing
       a reason -- on a card finalizing several at once, "fill in the
       reason" alone would not say which one. Only 兩者皆非 items can be
       missing (arbitrationItemsMissingReason ignores adopt_a/adopt_b). */
    var missing = arbitrationItemsMissingReason();
    if (missing.length) {
      showToast(t('arbitrationNeedsReason') + '：' + missing.join('、'), 'warning');
      return;
    }
    /* FR-061 point 4 / design.md D2: every decision -- including 兩者皆非 --
       is an ARBITRATION record (a vote plus its reason). submitArbitration()
       itself withholds finalized_value/finalized_by for `reject` (D2:
       absent field is the sentinel), so a reject vote reads as unresolved
       via getReviewUnitStatus() without landing in the D2 exceptionPool --
       that record is the project leader's later resolution (task 6.2),
       never written here. */
    window.LabelSuiteAnnotationWorkspaceData.submitArbitration(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity,
      decisions.map(function (decision) {
        return {
          itemId: decision.itemId,
          choice: decision.choice,
          value: decision.value,
          reason: (arbitrationReasons[decision.itemId] || '').trim(),
        };
      })
    );
    clearUnsaved();
    showToast(t('wsArbitrationSubmitSuccess'));
    renderSampleList();
    renderReviewerWorkspace();
  }

  /* FR-095 final exception pool disposition screen (issue #596, task 6.3).
     Queue = dispute items an arbiter voted 兩者皆非 (`reject`) on -- present
     in getArbitrationState() with no finalized_by (design.md D2's sentinel
     for a reject vote) -- that have no exceptionPool record yet. Mirrors
     renderArbitrationCard()'s open-item filter, one step later in the
     pipeline: arbitration hands off exactly what it could not close. */
  function exceptionPoolQueue() {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    var pool = data.getExceptionPool(currentProfile.id, currentRunType, currentSampleId, currentIdentity);
    var arbState = data.getArbitrationState(currentProfile.id, currentRunType, currentSampleId, currentIdentity);
    var items = data.getDisputeItems(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity, state.selectedOutputTypes
    );
    return items.filter(function (item) {
      var stored = arbState[disputeItemId(item)];
      return !!(stored && !stored.finalized_by) && !pool[item.outKey];
    });
  }

  /* `custom_answer` MUST reuse the exact config-driven answer control every
     other role already goes through (renderOutputPreview -> e.g.
     renderSingleLabelPreview) -- design.md D4 / Generalization-First forbids
     a second, bespoke answer UI for this screen. clearOutputPreviewState()
     resets the shared previewState slot to a blank, already-`_seeded` shape
     first so the panel never opens pre-selected on whatever the dataset's
     output column happens to hold (renderSingleLabelPreview's own
     ground-truth auto-seed only fires when `_seeded` is still falsy) -- the
     project leader picks an answer explicitly, the same as every other
     action on this screen requiring one. */
  function expandExceptionPoolAction(item, host, action, resolveFn) {
    while (host.firstChild) host.removeChild(host.firstChild);

    if (action === 'custom_answer') {
      var panel = document.createElement('div');
      panel.setAttribute('data-testid', 'ws-exception-pool-custom-answer');
      var panelMount = document.createElement('div');
      panel.appendChild(panelMount);
      clearOutputPreviewState(item.outKey);
      renderOutputPreview(panelMount, item.outKey);
      host.appendChild(panel);
    }

    /* FR-063 / FR-095 point 4: both custom_answer and exclude_from_dataset
       require an audit reason before they resolve -- the same shared
       testid/blocked-not-disabled convention arbitration's reject reason
       uses (refreshArbitrationBlocker), simplified to a single always-open
       panel since only one exception-pool item ever expands at a time. */
    var reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.setAttribute('data-testid', 'ws-exception-pool-reason');
    reasonInput.placeholder = t('exceptionPoolReasonPlaceholder');
    reasonInput.setAttribute('aria-label', t('exceptionPoolReasonPlaceholder'));
    reasonInput.style.cssText =
      'width:100%;font:inherit;font-size:13px;padding:5px 8px;margin:8px 0;'
      + 'border:1px solid var(--color-border);border-radius:var(--radius-sm);'
      + 'background:var(--color-surface);color:var(--color-ink);';
    host.appendChild(reasonInput);

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'mini-btn';
    confirmBtn.setAttribute(
      'data-testid',
      action === 'custom_answer' ? 'ws-exception-pool-custom-answer-confirm' : 'ws-exception-pool-exclude-confirm'
    );
    confirmBtn.textContent = t('exceptionPoolConfirmLabel');
    confirmBtn.addEventListener('click', function () {
      var reason = reasonInput.value.trim();
      if (!reason) {
        showToast(t('exceptionPoolReasonRequired'), 'warning');
        return;
      }
      var value = action === 'custom_answer'
        ? window.LabelSuiteAnnotationWorkspaceData.convertSubmissionAnswer(item.outKey, { previewState: state.previewState })
        : undefined;
      resolveFn(item, action, value, reason);
    });
    host.appendChild(confirmBtn);
  }

  /* adopt_annotator/adopt_reviewer resolve in one click with the diffed
     CompactAnswer value already on the dispute item (no reason field, same
     as arbitration's 採 A／採 B); custom_answer/exclude_from_dataset expand
     their reason + confirm panel via expandExceptionPoolAction. dry_run
     never offers custom_answer (AC-4.57 -- no free re-annotation channel
     outside official_run). */
  function buildExceptionPoolItemRow(item, runType, resolveFn) {
    var data = window.LabelSuiteAnnotationWorkspaceData;
    var row = document.createElement('div');
    row.setAttribute('data-testid', 'ws-exception-pool-item');
    row.style.cssText = 'padding:10px 0;border-top:1px solid var(--color-border);';

    var label = document.createElement('div');
    label.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:6px;';
    label.textContent = disputeItemLabel(item);
    row.appendChild(label);

    /* FR-093: exactly one reviewer per unit -- same single-B assumption
       buildArbitrationItemRow's arbitrationBChoiceText relies on. */
    var reviewerSubmission = data.readReviewerSubmissions(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity
    )[0] || null;
    var reviewerValue = reviewerSubmission ? item.reviewerValues[reviewerSubmission.reviewerId] : undefined;

    var context = document.createElement('div');
    context.style.cssText = 'font-size:12px;color:var(--color-text-soft);margin-bottom:8px;';
    context.textContent = t('exceptionPoolContextTpl')
      .replace('{a}', formatDisputeValue(item.annotatorValue))
      .replace('{b}', formatDisputeValue(reviewerValue));
    row.appendChild(context);

    var expandHost = document.createElement('div');

    var actionsWrap = document.createElement('div');
    actionsWrap.className = 'rv-choice-group';
    data.EXCEPTION_POOL_ACTIONS
      .filter(function (action) { return action !== 'custom_answer' || runType === 'official_run'; })
      .forEach(function (action) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mini-btn';
        btn.setAttribute('data-testid', 'ws-exception-pool-action-' + action);
        btn.textContent = t(EXCEPTION_ACTION_I18N_KEYS[action]);
        btn.addEventListener('click', function () {
          if (action === 'adopt_annotator') {
            resolveFn(item, action, item.annotatorValue, '');
          } else if (action === 'adopt_reviewer') {
            resolveFn(item, action, reviewerValue, '');
          } else {
            expandExceptionPoolAction(item, expandHost, action, resolveFn);
          }
        });
        actionsWrap.appendChild(btn);
      });
    row.appendChild(actionsWrap);
    row.appendChild(expandHost);
    return row;
  }

  /* Renders only when the queue is non-empty (design.md: no navigation entry
     point, no redirect/error for a project leader with nothing to do here --
     the screen is simply absent, same as any other role-gated render being a
     no-op). renderWorkspace() re-invokes this on every resolve, so the
     screen naturally clears once the last item resolves. */
  function renderExceptionPoolScreen() {
    var preview = document.getElementById('annotationPreview');
    if (!preview) return;
    while (preview.firstChild) preview.removeChild(preview.firstChild);

    var queue = exceptionPoolQueue();
    if (!queue.length) return;

    var card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-testid', 'ws-exception-pool');

    var title = document.createElement('h3');
    title.style.cssText = 'font-size:14px;margin:0 0 4px;';
    title.textContent = t('wsExceptionPoolTitle');
    card.appendChild(title);

    var note = document.createElement('p');
    note.style.cssText = 'font-size:12px;color:var(--color-text-soft);margin:0 0 10px;';
    note.textContent = t('wsExceptionPoolNote');
    card.appendChild(note);

    function resolve(item, action, value, reason) {
      window.LabelSuiteAnnotationWorkspaceData.resolveExceptionPoolItem(
        currentProfile.id, currentRunType, currentSampleId, currentIdentity,
        item.outKey, action, value, reason
      );
      clearUnsaved();
      showToast(t('wsExceptionPoolResolveSuccess'));
      renderSampleList();
      renderWorkspace();
    }

    queue.forEach(function (item) {
      card.appendChild(buildExceptionPoolItemRow(item, currentRunType, resolve));
    });

    preview.appendChild(card);
  }

  /* Finalized unit lock (issue #308): a FINALIZED unit renders this
     read-only results card instead of the interactive review card -- no
     ✕/✓ rows, no correction controls, no submit path. Mirrors the
     arbitration card's read-only layout: the annotator's answers per
     outKey, one resolved row per arbitrated dispute item, and FR-094's
     single-line responsibility trace. The FR-016A
     reopen-with-audit-reason flow is deferred to the backend phase, so the
     notice deliberately offers no way out of the lock. `submission` is
     never null here: getReviewUnitStatus() cannot return FINALIZED without
     a stored annotator submission. */
  function renderFinalizedCard(preview, submission) {
    var data = window.LabelSuiteAnnotationWorkspaceData;

    var card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-testid', 'ws-review-finalized-card');

    var title = document.createElement('h3');
    title.style.cssText = 'font-size:14px;margin:0 0 4px;';
    title.textContent = t('reviewFinalizedTitle');
    card.appendChild(title);

    var note = document.createElement('p');
    note.style.cssText = 'font-size:12px;color:var(--color-text-soft);margin:0 0 10px;';
    note.textContent = t('reviewFinalizedNote');
    card.appendChild(note);

    state.selectedOutputTypes.forEach(function (outKey) {
      var line = document.createElement('div');
      line.style.cssText = 'font-size:12px;white-space:pre-line;margin-bottom:2px;';
      line.textContent = outKey + '：'
        + (describeCompactAnswer(outKey, data.convertSubmissionAnswer(outKey, submission)) || t('reviewNoAnswer'));
      card.appendChild(line);
    });

    var arbState = data.getArbitrationState(currentProfile.id, currentRunType, currentSampleId, currentIdentity);
    /* Majority convergence went with FR-069: one reviewer per unit (FR-093)
       means an item is either untouched or settled by a named arbiter, so
       the only resolved row left is the arbitrated one. */
    data.getDisputeItems(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity, state.selectedOutputTypes
    ).forEach(function (item) {
      var stored = arbState[disputeItemId(item)];
      if (!stored || !stored.finalized_by) return;
      card.appendChild(buildArbitrationResolvedRow(
        item, stored.finalized_value, stored.finalized_by, 'ws-finalized-resolved'
      ));
    });

    /* FR-093: exactly one reviewer ever owns the unit. */
    card.appendChild(buildFinalizedTrace(
      data.readReviewerSubmissions(
        currentProfile.id, currentRunType, currentSampleId, currentIdentity
      )[0] || null,
      arbState,
      data.getExceptionPool(currentProfile.id, currentRunType, currentSampleId, currentIdentity)
    ));

    preview.appendChild(card);
  }

  /* Review-unit context banner (issue #302): FR-051 renders the SAME
     review card for every review model, so run type and the unit's state
     pill are the only way a reviewer can tell one review model from another
     inside the workspace. Rendered above the card in every reviewer path,
     including the arbitration branch. issue #596 removed the quorum chip
     and the reviewed-progress reading with the threshold they counted
     against (AC-4.37). */
  /* FR-051's three states as a route, per lane. FINALIZED is reachable from
     BOTH lanes, which is exactly why the track needs getReviewUnitLane() and
     not just the status.

     issue #596: there is no longer a per-lane quorum column. Every unit has
     exactly ONE reviewer (FR-093), so the two interim states that meant "a
     reviewer answered, but the quorum is not reached yet" cannot occur under
     ANY task configuration -- including a task whose stored profile still
     carries the retired reviewer-count field. Keying the route off that
     field would let retired data resurrect retired states, so the field is
     no longer read here at all. */
  var REVIEW_TRACK_ROUTES = {
    same: ['pending', 'finalized'],
    differing: ['pending', 'disputed', 'finalized'],
  };

  /* `unconverged` went with the quorum column: the rail it labelled sat
     between 已修改 and 爭議中, and neither end exists any more. */
  var TRACK_BRANCH_I18N_KEYS = {
    same: 'trackBranchSame',
    differing: 'trackBranchDiffering',
    arbitrated: 'trackBranchArbitrated',
  };

  var TRACK_BORDER = 'var(--color-border)';
  var TRACK_TAKEN = 'var(--color-cta)';

  /* `taken` widens the stroke as well as recolouring it: the route a unit
     actually walked must not be a colour-only signal (AC-7's reasoning,
     applied to the connectors rather than only to the current node). */
  function trackFork(paths) {
    var span = document.createElement('span');
    span.className = 'review-track-fork';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML =
      '<svg width="28" height="68" viewBox="0 0 28 68" fill="none">' +
      paths.map(function (p) {
        return '<path d="' + p.d + '" stroke="' + (p.taken ? TRACK_TAKEN : TRACK_BORDER) +
          '" stroke-width="' + (p.taken ? 3 : 2) + '"/>';
      }).join('') +
      '</svg>';
    return span;
  }

  /* Builds the §Review Status Track for one unit. `lane` is null until the
     reviewer submits, in which case only 待審 is on the route.

     `done` means "this node is on the unit's route, before its current
     position". It is a ROUTE, not an event log: the prototype derives
     REVIEW_UNIT_STATUS on every render and stores no history, so a unit can
     reach 已定稿 without ever having been rendered as 爭議中. Marking the
     lane keeps the branch legible; claiming a timestamped visit would be a
     claim the data cannot support. */
  function buildReviewStatusTrack(unitStatus, lane) {
    var route = REVIEW_TRACK_ROUTES[lane] || ['pending'];
    var position = route.indexOf(unitStatus);

    function nodeClass(status) {
      if (status === unitStatus) return 'review-track-node current';
      var at = route.indexOf(status);
      return 'review-track-node' + (at !== -1 && position !== -1 && at < position ? ' done' : '');
    }

    var track = document.createElement('div');
    track.className = 'review-track';
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', t('trackAria'));

    function addNode(status, gridStyle) {
      var node = document.createElement('span');
      node.className = nodeClass(status);
      node.setAttribute('role', 'listitem');
      node.setAttribute('style', gridStyle);
      if (status === unitStatus) {
        node.setAttribute('aria-current', 'step');
        var marker = document.createElement('span');
        marker.className = 'review-track-marker';
        marker.textContent = t('trackMarker');
        node.appendChild(marker);
      }
      node.appendChild(document.createTextNode(t(REVIEW_STATE_I18N_KEYS[status])));
      track.appendChild(node);
    }

    /* The branch condition used to live only in the fork's geometry, and the
       fork is aria-hidden -- so it reached assistive tech through nothing at
       all. These captions are therefore NOT hidden. They carry no `listitem`
       role, so the node list the track exposes is unchanged. */
    function branchLabel(branchKey, taken) {
      var label = document.createElement('span');
      label.className = 'review-track-branch' + (taken ? ' done' : '');
      label.setAttribute('data-branch', branchKey);
      label.textContent = t(TRACK_BRANCH_I18N_KEYS[branchKey]);
      return label;
    }

    function addBranch(branchKey, taken, gridStyle) {
      var label = branchLabel(branchKey, taken);
      label.setAttribute('style', gridStyle);
      track.appendChild(label);
    }

    function addRail(gridStyle, taken, branchKey) {
      var rail = document.createElement('span');
      rail.className = 'review-track-rail' + (taken ? ' done' : '');
      rail.setAttribute('style', gridStyle);
      if (branchKey) rail.appendChild(branchLabel(branchKey, taken));
      track.appendChild(rail);
    }

    function addFork(fork, gridStyle) {
      fork.setAttribute('style', gridStyle);
      track.appendChild(fork);
    }

    var finalized = unitStatus === 'finalized';
    addNode('pending', 'grid-column:1;grid-row:1/3');
    addFork(trackFork([
      { d: 'M0 34 H12 V17 H28', taken: lane === 'same' },
      { d: 'M0 34 H12 V51 H28', taken: lane === 'differing' },
    ]), 'grid-column:2;grid-row:1/3');
    addBranch('same', lane === 'same', 'grid-column:3;grid-row:1');
    addBranch('differing', lane === 'differing', 'grid-column:3;grid-row:2');
    /* No interim node to pass through: the approved lane runs straight from
       the fork to 已定稿, and the differing lane straight to 爭議中. */
    addRail('grid-column:4/6;grid-row:1', lane === 'same' && finalized);
    addNode('disputed', 'grid-column:4;grid-row:2');
    addRail('grid-column:5;grid-row:2', lane === 'differing' && finalized, 'arbitrated');
    var joinColumn = 6;
    addFork(trackFork([
      { d: 'M0 17 H16 V34 H28', taken: lane === 'same' && finalized },
      { d: 'M0 51 H16 V34 H28', taken: lane === 'differing' && finalized },
    ]), 'grid-column:' + joinColumn + ';grid-row:1/3');
    addNode('finalized', 'grid-column:' + (joinColumn + 1) + ';grid-row:1/3');
    return track;
  }

  function buildReviewUnitContext(unitStatus) {
    var workspaceData = window.LabelSuiteAnnotationWorkspaceData;

    var banner = document.createElement('div');
    banner.className = 'rv-unit-context';
    banner.setAttribute('data-testid', 'ws-review-unit-context');

    function chip(text, extraClass) {
      var node = document.createElement('span');
      node.className = 'rv-unit-chip' + (extraClass ? ' ' + extraClass : '');
      node.textContent = text;
      banner.appendChild(node);
    }

    /* issue #525 PR-B: an official run is the only one of its kind, but a
       dry run is one of SEVERAL rounds -- an unnumbered 試標 chip leaves a
       reviewer comparing R1 and R2 results with no way to tell from the
       workspace which round is on screen. The round and its fallback come
       from the same expression annotation-list.html:1866 already uses, so
       the list and the workspace can never name different rounds. The
       breadcrumb keeps the unnumbered `unitCtxRunDry`: crumbTaskTpl
       substitutes that string into `{run}` and would carry a `{round}`
       token past every replace() into the DOM. */
    var runLabel;
    if (currentRunType === 'official_run') {
      runLabel = t('unitCtxRunOfficial');
    } else {
      var dryRunCtx = currentProfile.materializedRuns && currentProfile.materializedRuns.dry_run;
      var dryRunRound = dryRunCtx && dryRunCtx.round != null ? dryRunCtx.round : 1;
      runLabel = t('unitCtxRunDryRound').replace('{round}', String(dryRunRound));
    }
    chip(runLabel, 'rv-unit-run');
    /* issue #515: no identity chip here. "Who am I reviewing" is already
       answered twice -- breadcrumb level 3 (審核單位 {sample} · {annotator},
       FR-080) and the left column's group header ({n} 位標記員, FR-071) --
       and this banner's subject is the review MODEL: run type, finalize
       threshold, state, state track. A third copy only raised the density. */

    var statePill = document.createElement('span');
    statePill.className =
      'rv-unit-state' + (unitStatus ? ' rv-unit-state-' + unitStatus : '');
    var stateText = t(REVIEW_STATE_I18N_KEYS[unitStatus] || 'unitStateNone');
    /* FINALIZED is the ONLY terminal state (issue #452): disputed is decided
       but unresolved, so the non-terminal pill carries a note saying so in
       words. Colour alone must not be the difference -- `data-terminal`
       exposes the same split to assistive tech and tests. issue #596: the
       third branch went with the interim states -- 待審 means "the reviewer
       has not answered", which needs no progress note, and there is no
       state left between it and a decided unit. */
    var terminal = unitStatus === workspaceData.REVIEW_UNIT_STATUS.FINALIZED;
    var note = '';
    if (terminal) {
      note = t('unitStateFinalizedNote');
    } else if (unitStatus === workspaceData.REVIEW_UNIT_STATUS.DISPUTED) {
      note = t('unitStateDisputedNote');
    }
    /* issue #572: the 目前： prefix from issue #525 PR-B is gone -- the
       pill sits between the run-type badge and the quorum chip, so it
       already reads as the unit's state, not as an action. */
    statePill.textContent = note ? stateText + ' · ' + note : stateText;
    if (unitStatus !== null) {
      statePill.setAttribute('data-terminal', terminal ? 'true' : 'false');
      statePill.setAttribute(
        'aria-label',
        t(terminal ? 'unitStateAriaFinalized' : 'unitStateAria')
          .replace('{state}', stateText)
      );
    }
    banner.appendChild(statePill);

    /* issue #596 (AC-4.37): the finalize-threshold chip is gone. It read
       「定稿門檻 {x} / {n} 位審核員」 against a threshold that no longer
       exists -- one reviewer owns the unit and their decision closes it or
       sends it to arbitration, so there is no count to make progress
       against and nothing the chip could truthfully say. */

    /* The pill answers "what state"; the track answers "by which route, and
       what is left". Both stay: the pill carries the terminal/interim note
       and the aria-label the track has no place for.
       issue #525 PR-A: the track no longer sits in the banner. Only the
       question "what state" is worth permanent space -- "by which route" is
       asked once, so it moved into an on-demand drawer and the banner keeps
       only the way in. A null status has no unit yet, so there is no route
       to draw and no reason to offer the trigger either. */
    syncReviewFlowDrawer(unitStatus);
    if (unitStatus !== null) banner.appendChild(buildReviewFlowTrigger());
    return banner;
  }

  /* ── Review-flow drawer (issue #525 PR-A) ──────────────────────────
     The panel itself is static markup in annotation-workspace.html; this
     block owns its content and its open/close state. Focus trap, Esc and
     focus return come from LabelSuiteModalFocus, the same shared helper the
     guideline modals use -- a second focus implementation would be a second
     thing to keep correct. */
  var FLOW_DRAWER_ID = 'wsReviewFlowDrawer';

  function buildReviewFlowTrigger() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rv-flow-trigger';
    btn.setAttribute('data-testid', 'ws-review-flow-trigger');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', FLOW_DRAWER_ID);
    btn.textContent = t('flowDrawerOpen');
    btn.addEventListener('click', function () { openReviewFlowDrawer(btn); });
    return btn;
  }

  function openReviewFlowDrawer(trigger) {
    var drawer = document.getElementById(FLOW_DRAWER_ID);
    if (!drawer) return;
    drawer.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    if (window.LabelSuiteModalFocus) {
      window.LabelSuiteModalFocus.open(drawer, {
        trigger: trigger,
        onClose: closeReviewFlowDrawer,
      });
    }
  }

  function closeReviewFlowDrawer() {
    var drawer = document.getElementById(FLOW_DRAWER_ID);
    if (!drawer || drawer.classList.contains('hidden')) return;
    drawer.classList.add('hidden');
    var trigger = document.querySelector('[data-testid="ws-review-flow-trigger"]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(drawer);
  }

  /* Refills the drawer from the unit the banner is describing. Closing first
     is not cosmetic: every render replaces the banner, so the trigger that an
     open drawer would return focus to is a detached node by the time the
     reviewer presses Esc. */
  function syncReviewFlowDrawer(unitStatus) {
    closeReviewFlowDrawer();
    var body = document.getElementById('wsReviewFlowDrawerBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);
    if (unitStatus === null) return;
    body.appendChild(buildReviewStatusTrack(
      unitStatus,
      window.LabelSuiteAnnotationWorkspaceData.getReviewUnitLane(
        currentProfile.id, currentRunType, currentSampleId, currentIdentity,
        state.selectedOutputTypes
      )
    ));
  }

  function setupReviewFlowDrawer() {
    var drawer = document.getElementById(FLOW_DRAWER_ID);
    var closeBtn = document.getElementById('wsReviewFlowDrawerClose');
    if (closeBtn) closeBtn.addEventListener('click', closeReviewFlowDrawer);
    if (drawer) {
      drawer.addEventListener('click', function (e) {
        if (e.target === drawer) closeReviewFlowDrawer();
      });
    }
    /* Escape-to-close comes from the LabelSuiteModalFocus trap registered in
       openReviewFlowDrawer(), same as the guideline modals. */
  }

  function renderReviewerWorkspace() {
    var preview = document.getElementById('annotationPreview');
    if (!preview) return;
    while (preview.firstChild) preview.removeChild(preview.firstChild);
    reviewRowDecisions = {};
    reviewRowOriginals = {};
    reviewDecisionRefreshers = [];
    reviewDecisionAnswers = {};
    reviewRowReasons = {};
    /* issue #196 (CONT-03): restore any in-progress decisions persisted by
       persistReviewDraft() before this render -- a reload must not silently
       undecide rows the reviewer already chose.
       issue #398: EXCEPT a decision recorded while its correction was
       edited -- the correction control itself reseeds from the annotator's
       original answer on this same render (seedReviewRow(), outside
       FR-014S's persistence scope), so restoring that decision would keep
       it "approved"/"rejected" against a value the reviewer never actually
       confirmed. Reset those instead and tell the reviewer why. */
    (function restoreReviewDraft() {
      var draft = window.LabelSuiteAnnotationWorkspaceData.getReviewRowDecisionDraft(
        currentProfile.id, currentRunType, currentSampleId, currentIdentity
      );
      if (!draft) return;
      var annotatorId = currentAnnotatorId();
      var correctionLost = false;
      Object.keys(draft).forEach(function (outKey) {
        var entry = draft[outKey];
        if (entry.corrected) {
          correctionLost = true;
          return;
        }
        reviewRowDecisions[decisionKey(outKey, annotatorId)] = entry.decision;
        if (entry.reason) reviewRowReasons[decisionKey(outKey, annotatorId)] = entry.reason;
      });
      if (correctionLost) showToast(t('toastReviewCorrectionReset'), 'warning');
    })();

    /* null, not {}: seedReviewRow() branches on whether a real submission
       exists at all. */
    var submission = getAnnotatorSubmission();
    var rawRecord = findRecordById(currentSampleId) || {};

    var reviewSubmitBtn = document.getElementById('wsReviewSubmitBtn');
    /* issue #568: hidden by default; renderArbitrationCard() reveals it only
       while this unit still has an open dispute item. */
    var arbitrationSubmitBtn = document.getElementById('wsArbitrationSubmitBtn');
    if (arbitrationSubmitBtn) arbitrationSubmitBtn.classList.add('hidden');
    arbitrationOpenItemIds = [];
    var unitStatus = currentReviewUnitStatus();
    preview.appendChild(buildReviewUnitContext(unitStatus));
    /* issue #515: the three early returns below and the summary's own guard
       read one and the same answer, so they cannot disagree about whether
       this unit is interactive. */
    var blockReason = reviewUnitBlockReason(unitStatus);
    if (blockReason === REVIEW_UNIT_BLOCK.ARBITRATION) {
      /* The fixed footer submit drives handleReviewSubmit(); arbitration has
         its own in-card submit instead. */
      if (reviewSubmitBtn) reviewSubmitBtn.classList.add('hidden');
      var inputCard = document.createElement('div');
      inputCard.className = 'content-card';
      inputCard.setAttribute('data-testid', 'ws-input-content');
      inputCard.textContent = buildReviewerInputText(rawRecord, currentProfile.fieldRoleMap);
      preview.appendChild(inputCard);
      renderArbitrationCard(preview, submission);
      return;
    }
    /* Finalized unit lock (issue #308): both finalize paths -- quorum
       convergence and arbitration resolution -- land here, replacing the
       interactive review card with the read-only results card. Without
       this branch a reviewer could reject + submit on a finalized
       official_run unit, and markSampleRejected() would roll the
       annotator's sample back to pending, erasing the finalized unit.
       Hiding the footer submit also blocks the FR-058 Ctrl/Cmd+Enter
       shortcut (setupActionShortcuts skips hidden buttons). Mutually
       exclusive with the arbitration branch above (disputed ≠ finalized)
       and the empty gate below (finalized requires a submission). */
    if (blockReason === REVIEW_UNIT_BLOCK.FINALIZED) {
      if (reviewSubmitBtn) reviewSubmitBtn.classList.add('hidden');
      var lockedInputCard = document.createElement('div');
      lockedInputCard.className = 'content-card';
      lockedInputCard.setAttribute('data-testid', 'ws-input-content');
      lockedInputCard.textContent = buildReviewerInputText(rawRecord, currentProfile.fieldRoleMap);
      preview.appendChild(lockedInputCard);
      renderFinalizedCard(preview, submission);
      return;
    }
    /* Empty review unit gate (issue #307): "truly empty" reuses the exact
       two sources the FR-064 banner and the FR-044a fallback already read —
       no stored annotator submission (unitStatus === null) AND no
       REVIEWER_MOCK_ROWS stand-in for this group (demoAnnotatorRow() null;
       T015's ofs-05-not-submitted is the seeded demo point). Without the
       gate getReviewerRows() returns [] here, so the review card rendered
       submit-able chrome whose all-decided validation passed vacuously and
       an empty review could be filed against nothing. Keeping the footer
       submit hidden also blocks the FR-058 Ctrl/Cmd+Enter path
       (setupActionShortcuts skips hidden buttons). */
    if (blockReason === REVIEW_UNIT_BLOCK.EMPTY) {
      if (reviewSubmitBtn) reviewSubmitBtn.classList.add('hidden');
      var emptyCard = document.createElement('div');
      emptyCard.className = 'content-card';
      emptyCard.setAttribute('data-testid', 'ws-review-empty-unit');
      emptyCard.textContent = t('reviewEmptyUnitNote');
      preview.appendChild(emptyCard);
      return;
    }
    if (reviewSubmitBtn) reviewSubmitBtn.classList.remove('hidden');

    /* Output types whose registry entry declares rendersInputPreview:true
       (free_text/entity_recognition/relation_identification/sequence_tagging)
       already embed their own ws-input-content-taggable element inside the
       reused annotator control buildReviewRow() below renders -- same
       registry check updateAnnotationPreview() itself uses
       (task-config.engine.js), reused here rather than a hardcoded type
       list. Only add this standalone source-text card when nothing else on
       the page already owns that testid. */
    var hasOutputOwnedInputPreview = state.selectedOutputTypes.some(function (outKey) {
      var outReg = window.OUTPUT_TYPE_REGISTRY && window.OUTPUT_TYPE_REGISTRY[outKey];
      return outReg && outReg.rendersInputPreview === true;
    });
    if (!hasOutputOwnedInputPreview) {
      var inputCard = document.createElement('div');
      inputCard.className = 'content-card';
      inputCard.setAttribute('data-testid', 'ws-input-content');
      inputCard.textContent = buildReviewerInputText(rawRecord, currentProfile.fieldRoleMap);
      preview.appendChild(inputCard);
    }

    /* The legacy 原始文本 card (FR-014L/FR-014O) is gone with the consensus
       model that justified it: it earned its place by showing the UNION of
       entity spans ACROSS annotators, which the merge-seeded correction panel
       below could not. A card reviewing ONE annotator has no union to show --
       that panel already renders exactly this annotator's spans, so the card
       would be a pixel-identical second copy of the sample text. */
    /* issue #520: one decision note for the whole unit, above the card
       stack whose 通過/修正/無法判定 decisions it explains (issue #596); issue
       #550 docked it as a tooltip in the unit-context banner beside the
       review-flow trigger (still once, still before the first
       card). The banner is built above, before the non-interactive early
       returns, so the note only lands on units that actually show
       decisions. */
    appendReviewNoteTooltip(
      preview.querySelector('[data-testid="ws-review-unit-context"]') || preview
    );

    var spanKeys = mergedSpanKeys();
    var spanRowRendered = false;
    state.selectedOutputTypes.forEach(function (outKey) {
      if (spanKeys && spanKeys.indexOf(outKey) >= 0) {
        if (spanRowRendered) return;
        spanRowRendered = true;
        preview.appendChild(buildMergedSpanReviewRow(spanKeys, submission));
        return;
      }
      preview.appendChild(buildReviewRow(outKey, submission));
    });
  }

  function appendReviewHistoryEntry(history, text) {
    var entry = document.createElement('div');
    entry.style.cssText = 'font-size:12px;white-space:pre-line;padding:6px 0;border-top:1px solid var(--color-border);';
    entry.textContent = text;
    history.appendChild(entry);
    history.classList.remove('hidden');
  }

  /* FR-044/AC-6.3: one decision per outKey, for both run types --
     getReviewerRows() narrows to exactly one row, the reviewed annotator's
     (v4.0.0: the review unit is sample × annotator). */
  /* issue #550 (FR-070 new point, spec 015 v4.55.0): with the pre-submit
     confirmation area's summaryPending list gone (FR-077 revoked), nothing
     on screen named WHICH output type was still blocking submit on a
     multi-output task -- only the generic toastSelectDecision. This is the
     sole surviving "still undecided" derivation in the file; the submit
     guard below is its only caller. */
  /* issue #552/#596 (FR-016A / FR-083): the ONE per-outKey answer to "does
     this row block submit, and why" -- null, 'undecided', or 'reason'
     (modify/bypass without a reason). pendingReviewOutputKeys(), the footer
     button's aria-disabled state and the blocking toast all read it;
     nothing else recomputes it. */
  function reviewRowBlocker(outKey, rowName) {
    var decision = reviewRowDecisions[decisionKey(outKey, rowName)];
    if (!decision) return 'undecided';
    if (reviewDecisionRequiresReason(decision) && !reviewRowReason(outKey, rowName)) return 'reason';
    return null;
  }

  function pendingReviewOutputKeys(rowName) {
    var pendingKeys = [];
    state.selectedOutputTypes.forEach(function (outKey) {
      if (reviewRowBlocker(outKey, rowName)) pendingKeys.push(outKey);
    });
    return pendingKeys;
  }

  function handleReviewSubmit() {
    var history = document.getElementById('wsReviewHistory');
    if (!history) return;
    /* issue #307: a truly empty unit (no stored submission, no mock-row
       stand-in) yields zero review rows, so the all-decided check below
       would pass vacuously and submit an empty review. The render path
       already hides the submit button; this guard keeps any residual
       invocation path inert. */
    if (!getAnnotatorSubmission() && !demoAnnotatorRow()) return;
    /* issue #308: finalized units are fully read-only. The render path
       already replaces the card and hides the submit button; this guard
       keeps any residual invocation path inert. Evaluated at entry, so the
       submit that CAUSES the finalize still goes through. */
    var lockedStatus = window.LabelSuiteAnnotationWorkspaceData.getReviewUnitStatus(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity, state.selectedOutputTypes,
      { minReviewers: currentProfile.minReviewers || 1 }
    );
    if (lockedStatus === window.LabelSuiteAnnotationWorkspaceData.REVIEW_UNIT_STATUS.FINALIZED) return;
    var rowsByOutKey = {};
    var annotatorId = currentAnnotatorId();
    state.selectedOutputTypes.forEach(function (outKey) {
      rowsByOutKey[outKey] = getReviewerRows(outKey);
    });
    var pendingOutputKeys = pendingReviewOutputKeys(annotatorId);
    if (pendingOutputKeys.length) {
      /* issue #552/#596: same list either way; the wording only switches to
         the reason-specific copy once every blocker is a reason-less
         modify/bypass. */
      var onlyReasons = pendingOutputKeys.every(function (outKey) {
        return reviewRowBlocker(outKey, annotatorId) === 'reason';
      });
      var toastKey = onlyReasons ? 'toastReasonRequired' : 'toastSelectDecision';
      showToast(t(toastKey).replace('{list}', pendingOutputKeys.join('、')), 'warning');
      return;
    }

    var decisionLines = [];
    var reasons = {};
    var values = {};
    state.selectedOutputTypes.forEach(function (outKey) {
      rowsByOutKey[outKey].forEach(function (row) {
        var decision = reviewRowDecisions[decisionKey(outKey, row.name)];
        var line = outKey + ' · ' + row.name + ': ' + decision;
        if (row.name === annotatorId) {
          /* issue #596 (design.md D2): `values[outKey]` only exists for a
             `modify` decision -- `bypass` deliberately stores no value
             ("bypass 不存值"). */
          if (decision === 'modify') values[outKey] = currentRowAnswer(outKey);
          /* issue #552 (FR-016A): the reason rides the history line so the
             decision's summary carries it as well. */
          if (reviewDecisionRequiresReason(decision)) {
            reasons[outKey] = reviewRowReason(outKey, annotatorId);
            line += ' — ' + reasons[outKey];
          }
        }
        decisionLines.push(line);
      });
    });
    var correctionLines = state.selectedOutputTypes.map(function (outKey) {
      var corrected = describeOutputAnswer(outKey, {
        previewState: state.previewState,
        previewEntities: state.previewEntities,
        previewTriples: state.previewTriples,
      });
      var original = reviewRowOriginals[outKey] || '';
      return outKey + ': ' + original + ' -> ' + corrected;
    });
    appendReviewHistoryEntry(history, decisionLines.concat(correctionLines).join('\n'));

    var summary = buildHistorySummary() + '\n' + decisionLines.join('\n');
    /* issue #551/#596: the decision itself must survive into storage, not
       just its free-text history line -- getReviewUnitStatus()/
       getDisputeItems() need it, and a same-value answer alone cannot say
       which decision produced it. */
    var submitPayload = collectAnswerPayload();
    submitPayload.decisions = {};
    state.selectedOutputTypes.forEach(function (outKey) {
      submitPayload.decisions[outKey] = reviewRowDecisions[decisionKey(outKey, annotatorId)];
    });
    /* issue #552/#596 (FR-016A / design.md D2): modify/bypass reasons and
       modify's corrected value persist next to the decisions they explain. */
    submitPayload.reasons = reasons;
    submitPayload.values = values;
    window.LabelSuiteAnnotationWorkspaceData.markSampleSubmitted(
      currentProfile.id,
      currentRole,
      currentRunType,
      currentSampleId,
      submitPayload,
      summary,
      currentIdentity
    );
    clearUnsaved();
    /* issue #196: the draft's job ends at submit -- the decision is now
       recorded in the real submission bucket, so leaving the draft behind
       would only resurface stale per-row state if this unit ever becomes
       interactively reviewable again. */
    window.LabelSuiteAnnotationWorkspaceData.clearReviewRowDecisionDraft(
      currentProfile.id, currentRunType, currentSampleId, currentIdentity
    );
    /* issue #596: FR-014I's reject -> pending rollback is retired -- the
       single-owner relay model has no "退回個人重標" channel in either
       run_type any more (design.md D1/D2); a disputed unit now routes to
       arbitration/the exception pool instead of back to the annotator. */

    renderSampleList();
    renderSampleNav();
    renderHistoryPanel();
    /* issue #401: submitting can finalize the unit (e.g. the first review on
       a min_reviewers=1 unit) -- without re-rendering, the context banner and
       card stay on their pre-submit state until a manual reload, and a
       second click on the now-stale submit button silently no-ops against
       the FINALIZED guard above with no feedback at all. */
    renderReviewerWorkspace();
    showToast(t('wsReviewSubmitSuccess'));
  }


  /* ── guideline panel (spec 015 v2.0.0 AC-5.1-5.3, 區塊 C) ────────────
     Rendered exactly once per task load (called from boot(), never from
     selectSample()/renderWorkspace()) because guidelineFiles is task-level
     data, not sample-level -- this is what makes AC-5.1 ("切換下一筆，右
     欄說明不收起且內容不重置") and AC-5.2 ("切換下一筆，抽屜維持目前開合
     狀態") hold for free: nothing here ever re-runs on sample switch. */
  function openGuidelineImageModal(src, altText, triggerEl) {
    var modal = document.getElementById('wsGuidelineImageModal');
    var image = document.getElementById('wsGuidelineImageModalPreview');
    if (!modal || !image) return;
    image.src = src;
    image.alt = altText || '';
    modal.classList.remove('hidden');
    if (window.LabelSuiteModalFocus) {
      window.LabelSuiteModalFocus.open(modal, {
        trigger: triggerEl || document.activeElement,
        onClose: closeGuidelineImageModal
      });
    }
  }
  function closeGuidelineImageModal() {
    var modal = document.getElementById('wsGuidelineImageModal');
    if (modal) modal.classList.add('hidden');
    if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(modal);
  }
  /* issue #353 (spec 015 AC-5.3 / SC-005C): PDF guideline files preview in
     an in-page modal (mirroring the image modal's interaction contract)
     instead of window.open(..., '_blank'). The modal title carries the file
     name -- single-language source data, not UI chrome, so it is set here
     rather than in applyI18n(). */
  function openGuidelinePdfModal(src, name, triggerEl) {
    var modal = document.getElementById('wsGuidelinePdfModal');
    var frame = document.getElementById('wsGuidelinePdfModalPreview');
    if (!modal || !frame) return;
    frame.src = src;
    setText('wsGuidelinePdfModalTitleText', name || '');
    modal.classList.remove('hidden');
    if (window.LabelSuiteModalFocus) {
      window.LabelSuiteModalFocus.open(modal, {
        trigger: triggerEl || document.activeElement,
        onClose: closeGuidelinePdfModal
      });
    }
  }
  function closeGuidelinePdfModal() {
    var modal = document.getElementById('wsGuidelinePdfModal');
    if (modal) modal.classList.add('hidden');
    if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(modal);
  }
  /* issue #527 (spec 015 AC-5.3 / FR-020D / SC-005D): Markdown guideline
     files preview in an in-page modal (same contract as the PDF modal) with
     the source rendered to HTML. Minimal renderer -- headings, paragraphs,
     unordered/ordered lists, bold/italic, inline code, links -- with every
     fenced code blocks, tables, images -- with every text run
     HTML-escaped first and link href / image src restricted to http(s)/
     mailto/relative paths, so raw HTML or javascript: URLs in the source
     can never reach innerHTML unescaped (issue #527 decision record). */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function isSafeMarkdownUrl(url) {
    return /^(https?:\/\/|mailto:|\.{0,2}\/|#)/i.test(url);
  }
  function renderMarkdownInline(text) {
    var out = escapeHtml(text);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_m, alt, src) {
      return isSafeMarkdownUrl(src) ? '<img src="' + src + '" alt="' + alt + '">' : alt;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, href) {
      return isSafeMarkdownUrl(href) ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
    });
    return out;
  }
  function renderMarkdown(source) {
    var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    var html = '';
    var list = null;
    var para = [];
    function flushPara() {
      if (para.length) html += '<p>' + renderMarkdownInline(para.join(' ')) + '</p>';
      para = [];
    }
    function flushList() {
      if (list) html += '</' + list + '>';
      list = null;
    }
    var fence = null;
    var table = null;
    function flushTable() {
      if (table) html += '</tbody></table>';
      table = null;
    }
    function splitTableRow(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (cell) {
        return cell.trim();
      });
    }
    lines.forEach(function (line, index) {
      if (fence) {
        if (/^\s*```/.test(line)) {
          html += '<pre><code>' + escapeHtml(fence.join('\n')) + '</code></pre>';
          fence = null;
        } else {
          fence.push(line);
        }
        return;
      }
      if (/^\s*```/.test(line)) {
        flushPara(); flushList(); flushTable();
        fence = [];
        return;
      }
      var isTableRow = /^\s*\|.*\|\s*$/.test(line);
      if (isTableRow) {
        flushPara(); flushList();
        if (!table) {
          /* A table starts only with a header row followed by a |---| rule. */
          if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[index + 1] || '')) {
            para.push(line.trim());
            return;
          }
          table = { headerDone: false };
          html += '<table><thead><tr>' + splitTableRow(line).map(function (cell) {
            return '<th>' + renderMarkdownInline(cell) + '</th>';
          }).join('') + '</tr></thead><tbody>';
          return;
        }
        if (!table.headerDone) { table.headerDone = true; return; }
        html += '<tr>' + splitTableRow(line).map(function (cell) {
          return '<td>' + renderMarkdownInline(cell) + '</td>';
        }).join('') + '</tr>';
        return;
      }
      flushTable();
      var heading = /^(#{1,3})\s+(.+)$/.exec(line);
      var bullet = /^\s*[-*]\s+(.+)$/.exec(line);
      var ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
      if (heading) {
        flushPara(); flushList();
        html += '<h' + heading[1].length + '>' + renderMarkdownInline(heading[2]) + '</h' + heading[1].length + '>';
      } else if (bullet || ordered) {
        flushPara();
        var tag = bullet ? 'ul' : 'ol';
        if (list !== tag) { flushList(); list = tag; html += '<' + tag + '>'; }
        html += '<li>' + renderMarkdownInline((bullet || ordered)[1]) + '</li>';
      } else if (!line.trim()) {
        flushPara(); flushList();
      } else {
        flushList();
        para.push(line.trim());
      }
    });
    if (fence) html += '<pre><code>' + escapeHtml(fence.join('\n')) + '</code></pre>';
    flushPara(); flushList(); flushTable();
    return html;
  }
  function openGuidelineMdModal(content, name, triggerEl) {
    var modal = document.getElementById('wsGuidelineMdModal');
    var body = document.getElementById('wsGuidelineMdModalBody');
    if (!modal || !body) return;
    /* innerHTML only ever receives renderMarkdown() output, whose text
       runs are escaped and whose only tags are the fixed allowlist above. */
    body.innerHTML = renderMarkdown(content);
    setText('wsGuidelineMdModalTitleText', name || '');
    modal.classList.remove('hidden');
    if (window.LabelSuiteModalFocus) {
      window.LabelSuiteModalFocus.open(modal, {
        trigger: triggerEl || document.activeElement,
        onClose: closeGuidelineMdModal
      });
    }
  }
  function closeGuidelineMdModal() {
    var modal = document.getElementById('wsGuidelineMdModal');
    if (modal) modal.classList.add('hidden');
    if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(modal);
  }
  var GUIDELINE_FILE_ICON_SVG = {
    pdf: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    markdown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  };
  var GUIDELINE_FILE_ICON_CLASS = { pdf: 'pdf', image: 'img', markdown: 'md' };
  function renderGuidelineFileList(container, files, taggedForTest) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    files.forEach(function (file) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'guideline-file-item';
      if (taggedForTest) item.setAttribute('data-testid', 'ws-guideline-file-item');
      var icon = document.createElement('div');
      icon.className = 'guideline-file-icon ' + (GUIDELINE_FILE_ICON_CLASS[file.type] || 'md');
      icon.setAttribute('aria-hidden', 'true');
      /* innerHTML must only ever receive the static GUIDELINE_FILE_ICON_SVG
         constants above -- file-derived strings (name, url) stay on
         textContent paths */
      icon.innerHTML = GUIDELINE_FILE_ICON_SVG[file.type] || GUIDELINE_FILE_ICON_SVG.markdown;
      item.appendChild(icon);
      var name = document.createElement('span');
      name.className = 'guideline-file-name';
      name.textContent = file.name;
      item.appendChild(name);
      var action = document.createElement('span');
      action.className = 'guideline-file-action';
      /* All three types preview in-page since issue #353 (PDF used to say
         新分頁 and open a new tab). */
      action.textContent = t('guidelineFileActionPreview');
      item.appendChild(action);
      item.addEventListener('click', function () {
        if (file.type === 'pdf') {
          openGuidelinePdfModal(file.url, file.name, item);
        } else if (file.type === 'image') {
          openGuidelineImageModal(file.url, file.name, item);
        } else if (file.type === 'markdown') {
          openGuidelineMdModal(file.content, file.name, item);
        }
      });
      container.appendChild(item);
    });
  }
  function renderGuidelinePanel() {
    var files = (currentProfile && currentProfile.guidelineFiles) || [];
    renderGuidelineFileList(document.getElementById('wsGuidelineFileList'), files, true);
    renderGuidelineFileList(document.getElementById('wsGuidelineFileListMobile'), files, false);
  }
  function setupGuidelineImageModal() {
    var modal = document.getElementById('wsGuidelineImageModal');
    var closeBtn = document.getElementById('wsGuidelineImageModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeGuidelineImageModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeGuidelineImageModal();
      });
    }
    /* Escape-to-close is now handled by the LabelSuiteModalFocus trap
       registered in openGuidelineImageModal() (issue #195). */
  }
  function setupGuidelinePdfModal() {
    var modal = document.getElementById('wsGuidelinePdfModal');
    var closeBtn = document.getElementById('wsGuidelinePdfModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeGuidelinePdfModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeGuidelinePdfModal();
      });
    }
    /* Escape-to-close comes from the LabelSuiteModalFocus trap registered
       in openGuidelinePdfModal(), same as the image modal. */
  }
  function setupGuidelineMdModal() {
    var modal = document.getElementById('wsGuidelineMdModal');
    var closeBtn = document.getElementById('wsGuidelineMdModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeGuidelineMdModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeGuidelineMdModal();
      });
    }
    /* Escape-to-close comes from the LabelSuiteModalFocus trap registered
       in openGuidelineMdModal(), same as the PDF modal. */
  }
  function setupGuidelineCollapse() {
    var btn = document.getElementById('wsGuidelineCollapseBtn');
    var body = document.getElementById('workspaceBody');
    if (!btn || !body) return;
    btn.addEventListener('click', function () {
      var collapsed = body.classList.toggle('guideline-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  }
  /* 說明與檔案 / 歷程 tab switching (區塊 C): tab state is page-level and
     never re-rendered on sample switch, so the active tab survives
     navigation (AC-5.1); only the history CONTENT re-renders per sample. */
  function setupGuidelineTabs() {
    var tabGuideline = document.getElementById('wsTabGuideline');
    var tabHistory = document.getElementById('wsTabHistory');
    var guidelinePanel = document.getElementById('wsGuidelinePanel');
    var historyPanel = document.getElementById('wsHistoryPanel');
    if (!tabGuideline || !tabHistory || !guidelinePanel || !historyPanel) return;
    tabGuideline.addEventListener('click', function () {
      tabGuideline.classList.add('active');
      tabHistory.classList.remove('active');
      guidelinePanel.classList.remove('hidden');
      historyPanel.classList.add('hidden');
    });
    tabHistory.addEventListener('click', function () {
      tabHistory.classList.add('active');
      tabGuideline.classList.remove('active');
      historyPanel.classList.remove('hidden');
      guidelinePanel.classList.add('hidden');
      renderHistoryPanel();
    });
  }

  function setupSampleNav() {
    var prevBtn = document.getElementById('wsPrevBtn');
    var nextBtn = document.getElementById('wsNextBtn');
    /* Steps one REVIEW UNIT at a time (FR-056), so a reviewer reaches every
       annotator of a sample before the sample changes. */
    function step(delta) {
      var units = buildUnits();
      var next = units[currentUnitIndex(units) + delta];
      if (!next) return;
      selectSample(next.recordId, next.annotatorId);
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        step(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        step(1);
      });
    }
  }

  function setupMobileDrawer() {
    var drawer = document.getElementById('wsMobileDrawer');
    var handle = document.getElementById('wsMobileDrawerHandle');
    if (!drawer || !handle) return;
    function toggle() {
      var open = drawer.classList.toggle('open');
      handle.setAttribute('aria-expanded', String(open));
    }
    /* Native <button>: Enter/Space activation comes for free, no keydown shim. */
    handle.addEventListener('click', toggle);
  }

  /* ── guideline modal ──────────────────────────────────────────────── */
  /* Gate depends on the task's own "開始標記前強制顯示" setting
     (currentProfile.forceShowGuideline, task-detail.panels/overview.html
     #editForceGuidelineToggle) -- tasks that don't enable it never show
     the modal (issue #184). The seen-flag is keyed per taskId so
     confirming it for one task never suppresses it for another, and
     switching tasks (a fresh page load with a different task_id)
     re-evaluates against that task's own setting from scratch. */
  function guidelineModalStorageKey(taskId) {
    return 'labelsuite.guidelineModalSeen.' + taskId;
  }
  function setupGuidelineModal() {
    var modal = document.getElementById('wsGuidelineModal');
    var confirmBtn = document.getElementById('wsGuidelineModalConfirm');
    var body = document.getElementById('wsGuidelineModalBody');
    if (!modal || !confirmBtn) return;
    if (!currentProfile || !currentProfile.forceShowGuideline) {
      modal.classList.add('hidden');
      return;
    }
    if (body) {
      /* Same data source as the right-side 說明 tab (renderGuidelinePanel):
         guidelineFiles[]. The markdown entry's `content` is the only
         actual prose text in that data -- pdf/image entries are links,
         not text -- so it's what "guideline text" means here. */
      var files = currentProfile.guidelineFiles || [];
      var mdFile = files.filter(function (file) {
        return file.type === 'markdown';
      })[0];
      if (mdFile) {
        /* innerHTML only receives renderMarkdown() output (issue #527). */
        body.innerHTML = renderMarkdown(mdFile.content);
      } else {
        body.textContent = files
          .map(function (file) {
            return file.name;
          })
          .join('\n');
      }
    }
    var storageKey = guidelineModalStorageKey(currentProfile.id);
    var seen = null;
    try {
      seen = window.localStorage.getItem(storageKey);
    } catch (e) {
      /* treat blocked storage as not-seen: showing the modal again is safe */
    }
    function hideGuidelineModal() {
      modal.classList.add('hidden');
      if (window.LabelSuiteModalFocus) window.LabelSuiteModalFocus.close(modal);
    }
    if (!seen) {
      modal.classList.remove('hidden');
      if (window.LabelSuiteModalFocus) {
        /* No user click triggers this modal (shown automatically on first
           visit), so focus returns to the workspace root landmark on close
           rather than to a trigger element. */
        window.LabelSuiteModalFocus.open(modal, {
          trigger: document.getElementById('wsRoot'),
          onClose: hideGuidelineModal
        });
      }
    } else {
      modal.classList.add('hidden');
    }
    confirmBtn.addEventListener('click', function () {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch (e) {
        /* ignore quota/serialization errors in the prototype */
      }
      hideGuidelineModal();
    });
  }

  /* ── Language toggle (spec 015 v2.2.0): the workspace no longer renders
     its own task-title card / in-card toggle -- language switching binds to
     the shared sidebar's lang-toggle buttons, same as every other page.
     Reuses the SAME localStorage key the shared sidebar already writes
     (pages/shared/sidebar.js LANG_STORAGE_KEY) so a language choice made
     anywhere in the app is honored on the next workspace load. */
  var LANG_STORAGE_KEY = 'labelsuite.lang';
  function readStoredLang() {
    try {
      var value = window.localStorage.getItem(LANG_STORAGE_KEY);
      return value === 'en' ? 'en' : 'zh';
    } catch (e) {
      return 'zh';
    }
  }
  function persistLang(lang) {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (e) {
      /* ignore quota/serialization errors in the prototype */
    }
  }
  function applyDocumentLang() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-TW' : 'en';
  }
  function applyStaticI18nText() {
    setText('sampleListTitle', t('sampleListTitle'));
    var submitBtn = document.getElementById('wsSubmitBtn');
    var reviewSubmitBtn = document.getElementById('wsReviewSubmitBtn');
    if (currentRole === 'reviewer') {
      if (reviewSubmitBtn) setText('wsReviewSubmitLabel', t('reviewSubmitLabel'));
      setText('wsArbitrationSubmitLabel', t('arbitrationSubmitLabel'));
    } else if (submitBtn) {
      setText('wsSubmitLabel', t('submitLabel'));
      setText('wsSaveLabel', t('saveLabel'));
      setText('wsSkipLabel', t('skipLabel'));
      var skipReasonInput = document.getElementById('wsSkipReason');
      if (skipReasonInput) {
        skipReasonInput.placeholder = t('skipReasonPlaceholder');
        /* The placeholder is the only visible wording, so it has to double
           as the accessible name -- a placeholder alone is not one. */
        skipReasonInput.setAttribute('aria-label', t('skipReasonPlaceholder'));
      }
    }
    setText('wsPrevBtnLabel', t('wsPrevBtnLabel'));
    setText('wsNextBtnLabel', t('wsNextBtnLabel'));
    setText('wsTabGuidelineLabel', t('wsTabGuideline'));
    setText('wsTabHistoryLabel', t('wsTabHistory'));
    setText('wsGuidelineModalTitleText', t('guidelineModalTitle'));
    setText('wsGuidelineModalConfirm', t('guidelineModalConfirm'));
    setText('guidelineSummaryTitle', t('guidelineSummaryTitle'));
    setText('wsGuidelineImageModalTitleText', t('guidelineSummaryTitle'));
    setText('wsMobileDrawerTitle', t('mobileDrawerTitle'));
    var closeBtn = document.getElementById('wsGuidelineImageModalClose');
    if (closeBtn) closeBtn.setAttribute('aria-label', t('guidelineImageModalCloseAria'));
    var pdfCloseBtn = document.getElementById('wsGuidelinePdfModalClose');
    if (pdfCloseBtn) pdfCloseBtn.setAttribute('aria-label', t('guidelinePdfModalCloseAria'));
    var mdCloseBtn = document.getElementById('wsGuidelineMdModalClose');
    if (mdCloseBtn) mdCloseBtn.setAttribute('aria-label', t('guidelineMdModalCloseAria'));
    setText('wsReviewFlowDrawerTitle', t('flowDrawerTitle'));
    var flowCloseBtn = document.getElementById('wsReviewFlowDrawerClose');
    if (flowCloseBtn) flowCloseBtn.setAttribute('aria-label', t('flowDrawerCloseAria'));
    /* issue #309: the shared sidebar mounts with its 一般使用者 default;
       reviewers must read as 審核員 (same role noun the history trail uses).
       Annotator view keeps the shared default untouched. Runs at boot and on
       every language toggle, so it survives both. */
    var roleIndicatorEl = document.getElementById('roleIndicator');
    if (currentRole === 'reviewer' && roleIndicatorEl) {
      roleIndicatorEl.textContent = t('wsHistoryRoleReviewer');
    } else if (currentRole === 'project_leader' && roleIndicatorEl) {
      roleIndicatorEl.textContent = t('wsHistoryRoleProjectLeader');
    }
    var taskName = currentProfile ? (state.lang === 'zh' ? currentProfile.nameZh : currentProfile.nameEn) : '';
    setText('guidelineSummaryText', taskName);
    setText('wsMobileGuidelineSummaryText', taskName);
    ['langLabel', 'mobileLangLabel'].forEach(function (id) {
      var langLabel = document.getElementById(id);
      if (langLabel) langLabel.textContent = state.lang === 'zh' ? 'ZH' : 'EN';
    });
  }
  function setupLangToggle() {
    ['langToggle', 'mobileLangToggle'].forEach(function (id) {
      var toggle = document.getElementById(id);
      if (!toggle) return;
      toggle.addEventListener('click', function () {
        state.lang = state.lang === 'zh' ? 'en' : 'zh';
        persistLang(state.lang);
        applyDocumentLang();
        applyStaticI18nText();
        /* file-action labels (新分頁/預覽) are i18n text rendered into the
           list items, so the list must re-render on language switch; this
           is not a sample switch, so AC-5.1/5.2 persistence is unaffected */
        renderGuidelinePanel();
        renderWorkspace();
      });
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────── */
  function boot() {
    var params = new URLSearchParams(window.location.search);
    var taskId = params.get('task_id');
    var sampleId = params.get('sample_id');
    /* FR-006: missing/unsupported role or run_type fall back to the
       defaults (annotator / dry_run) -- same normalization annotation-list's
       parseContext() applies, so both pages resolve an identical context. */
    currentRole =
      params.get('role') === 'reviewer'
        ? 'reviewer'
        : params.get('role') === 'project_leader'
          ? 'project_leader'
          : 'annotator';
    currentRunType = params.get('run_type') === 'official_run' ? 'official_run' : 'dry_run';
    currentIdentity = window.LabelSuiteAnnotationWorkspaceData.resolveIdentity(params);

    currentProfile = window.LabelSuiteAnnotationWorkspaceData.resolveTaskProfile(taskId);
    if (!currentProfile) {
      window.location.href = 'annotation-list.html' + window.location.search;
      return;
    }

    state.lang = readStoredLang();
    applyDocumentLang();
    applyStaticI18nText();
    /* Bound once for the page's lifetime; selectSample() below only resets
       the accumulator, it does not rebind. */
    bindLeadTimerSignals();

    var submitBtn = document.getElementById('wsSubmitBtn');
    var saveBtn = document.getElementById('wsSaveBtn');
    var reviewSubmitBtn = document.getElementById('wsReviewSubmitBtn');
    if (currentRole === 'reviewer') {
      if (submitBtn) submitBtn.classList.add('hidden');
      if (saveBtn) saveBtn.classList.add('hidden');
      if (reviewSubmitBtn) {
        reviewSubmitBtn.classList.remove('hidden');
        reviewSubmitBtn.addEventListener('click', handleReviewSubmit);
      }
      var arbitrationSubmitBtn = document.getElementById('wsArbitrationSubmitBtn');
      if (arbitrationSubmitBtn) arbitrationSubmitBtn.addEventListener('click', handleArbitrationSubmit);
      setupReviewShortcuts();
    } else if (currentRole === 'project_leader') {
      /* The exception pool screen resolves items via its own in-card
         confirm controls (see renderExceptionPoolScreen); the shared
         submit/save buttons have no role here. */
      if (submitBtn) submitBtn.classList.add('hidden');
      if (saveBtn) saveBtn.classList.add('hidden');
    } else {
      if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
      if (saveBtn) saveBtn.addEventListener('click', handleSave);
    }
    skipGroupNode = document.getElementById('wsSkipGroup');
    if (skipGroupNode) {
      skipGroupParent = skipGroupNode.parentNode;
      skipGroupAnchor = skipGroupNode.nextSibling;
      if (currentRole === 'annotator') {
        document.getElementById('wsSkipBtn').addEventListener('click', handleSkip);
        document.getElementById('wsSkipReason').addEventListener('input', refreshSkipBlocker);
      } else {
        skipGroupNode.remove();
      }
    }
    setupActionShortcuts();

    seedEngineState(currentProfile);
    selectSample(
      sampleId ||
        (currentProfile.datasetRecords[0] &&
          window.LabelSuiteAnnotationWorkspaceData.getRecordId(currentProfile.datasetRecords[0], 0))
    );
    renderGuidelinePanel();
    setupGuidelineImageModal();
    setupGuidelinePdfModal();
    setupGuidelineMdModal();
    setupReviewFlowDrawer();
    setupGuidelineCollapse();
    setupGuidelineTabs();
    setupSampleNav();
    setupMobileDrawer();
    setupGuidelineModal();
    setupLangToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
