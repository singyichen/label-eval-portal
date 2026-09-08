/* task-config.data.js
 * Pure data for the shared task-config engine: task-type registry, output-type
 * registry (ADR-029 outputs[] composition), taxonomy, field roles, sampling
 * defaults, default guideline files, entity colors, the demo user directory,
 * and the I18N keys used by task-config.{yaml,dataset,engine}.js.
 *
 * No DOM access, no globals besides the ones declared here. Loaded first,
 * before task-config.yaml.js / task-config.dataset.js / task-config.engine.js.
 */

/* ── Registry ────────────────────────────────────────────────── */
var REGISTRY = {
  single_sentence_classification: {
    zh: '單句分類（含多標籤）', en: 'Single Sentence Classification (Multi-label)',
    fields: [
      { key: 'labels', type: 'tag-list', zh: '標籤清單', en: 'Labels', required: true, hint_zh: '輸入標籤後按 Enter', hint_en: 'Type label and press Enter' },
      { key: 'allow_multiple', type: 'boolean', zh: '允許多選', en: 'Allow multiple labels', required: false, defaultValue: false },
    ],
    defaultTemplate: { labels: ['正向', '負向', '中立'], allow_multiple: false },
    defaultTemplateI18n: {
      zh: { labels: ['正向', '負向', '中立'], allow_multiple: false },
      en: { labels: ['Positive', 'Negative', 'Neutral'], allow_multiple: false },
    },
  },
  single_sentence_va_scoring: {
    zh: '單句 VA 雙維度評分（Valence / Arousal）', en: 'Single Sentence VA Scoring (Valence / Arousal)',
    fields: [
      { key: 'va_dimensions', type: 'va-dimensions', zh: 'VA 雙維度設定', en: 'VA dimensions', required: true },
    ],
    defaultTemplate: {
      valence: { min: 1, max: 9, step: 1 },
      arousal: { min: 1, max: 9, step: 1 },
    },
  },
  sequence_labeling: {
    zh: '序列標記（含 Aspect / NER / 實體辨識）', en: 'Sequence Labeling (Aspect / NER / Entity Recognition)',
    fields: [
      { key: 'subtype', type: 'subtype-select', zh: '子類型', en: 'Subtype', required: true,
        options: ['ner', 'aspect_list', 'entity_recognition'],
        optionLabels: { zh: { ner: 'NER 命名實體辨識', aspect_list: 'Aspect List 抽取／校正', entity_recognition: '實體辨識' }, en: { ner: 'NER (Named Entity Recognition)', aspect_list: 'Aspect List extraction / correction', entity_recognition: 'Entity Recognition' } },
        defaultValue: 'ner' },
      /* NER-only fields */
      { key: 'entities', type: 'entity-list', zh: '實體類型', en: 'Entity types', required: true, showWhen: 'ner', addLabel_zh: '新增實體類型', addLabel_en: 'Add entity type' },
      { key: 'scheme', type: 'select', zh: '標記格式', en: 'Labeling scheme', required: true, options: ['IOB2', 'BIOES'], defaultValue: 'IOB2', showWhen: 'ner' },
      { key: 'allow_overlapping', type: 'boolean', zh: '允許重疊標記', en: 'Allow overlapping spans', required: false, defaultValue: false, showWhen: 'ner' },
      { key: 'input_field', type: 'text', zh: '輸入欄位名稱', en: 'Input field name', required: true, defaultValue: 'text', placeholder_zh: '預設：text', placeholder_en: 'Default: text', showWhen: 'ner', advanced: true },
      { key: 'entity_field', type: 'text', zh: '實體欄位名稱', en: 'Entity field name', required: true, defaultValue: 'entities', placeholder_zh: '預設：entities', placeholder_en: 'Default: entities', showWhen: 'ner', advanced: true },
      { key: 'allow_custom_entity_type', type: 'boolean', zh: '允許自訂實體類型', en: 'Allow custom entity type', required: false, defaultValue: false, showWhen: 'ner', advanced: true },
      { key: 'require_entity_type', type: 'boolean', zh: '要求實體類型', en: 'Require entity type', required: false, defaultValue: true, showWhen: 'ner', advanced: true },
      { key: 'allow_nested_entities', type: 'boolean', zh: '允許巢狀實體', en: 'Allow nested entities', required: false, defaultValue: false, showWhen: 'ner', advanced: true },
      { key: 'min_entity_length', type: 'number', zh: '最少實體長度', en: 'Min entity length', required: false, defaultValue: 1, showWhen: 'ner', advanced: true },
      { key: 'max_entity_length', type: 'number', zh: '最多實體長度', en: 'Max entity length', required: false, defaultValue: 50, showWhen: 'ner', advanced: true },
      /* aspect_list-only fields */
      { key: 'input_field', type: 'text', zh: '輸入欄位名稱', en: 'Input field name', required: true, placeholder_zh: '預設：sentence', placeholder_en: 'Default: sentence', showWhen: 'aspect_list' },
      { key: 'aspect_list_field', type: 'text', zh: '輸出欄位名稱', en: 'Aspect list field name', required: true, placeholder_zh: '預設：aspects', placeholder_en: 'Default: aspects', showWhen: 'aspect_list' },
      { key: 'allow_sentence_edit', type: 'boolean', zh: '允許修改原句', en: 'Allow sentence edit', required: false, defaultValue: false, showWhen: 'aspect_list' },
      { key: 'allow_aspect_add', type: 'boolean', zh: '允許新增 Aspect', en: 'Allow adding aspects', required: false, defaultValue: true, showWhen: 'aspect_list' },
      { key: 'allow_aspect_delete', type: 'boolean', zh: '允許刪除 Aspect', en: 'Allow deleting aspects', required: false, defaultValue: true, showWhen: 'aspect_list' },
      { key: 'require_exact_match_in_sentence', type: 'boolean', zh: '要求 Aspect 完全出現在句子中', en: 'Require exact match in sentence', required: false, defaultValue: true, showWhen: 'aspect_list' },
      { key: 'min_aspects', type: 'number', zh: '最少 Aspect 數量', en: 'Min aspects', required: false, defaultValue: 1, showWhen: 'aspect_list' },
      { key: 'max_aspects', type: 'number', zh: '最多 Aspect 數量', en: 'Max aspects', required: false, defaultValue: 10, showWhen: 'aspect_list' },
      { key: 'require_sentiment_context_check', type: 'boolean', zh: '提示前後文情緒描述核查（軟性指引）', en: 'Prompt sentiment context check (soft guidance)', required: false, defaultValue: false, showWhen: 'aspect_list' },
      /* Entity Recognition-only fields */
      { key: 'span_mode', type: 'select', zh: '標記模式', en: 'Annotation mode', required: true,
        options: ['entity_based', 'polarity_based'],
        optionLabels: { zh: { entity_based: '實體類型', polarity_based: '極性標籤（ABSA）' }, en: { entity_based: 'Entity types', polarity_based: 'Polarity labels (ABSA)' } },
        defaultValue: 'entity_based', showWhen: 'entity_recognition' },
      { key: 'entities', type: 'entity-list', zh: '實體類型', en: 'Entity types', required: true, showWhen: 'entity_recognition', addLabel_zh: '新增實體類型', addLabel_en: 'Add entity type' },
      { key: 'polarity_options', type: 'tag-list', zh: '極性標籤', en: 'Polarity labels', required: true, hint_zh: '輸入極性標籤後按 Enter（如：正面、負面、中立）', hint_en: 'Type polarity label and press Enter (e.g. Positive, Negative, Neutral)', showWhen: 'entity_recognition' },
      { key: 'allow_overlapping', type: 'boolean', zh: '允許重疊標記', en: 'Allow overlapping spans', required: false, defaultValue: false, showWhen: 'entity_recognition' },
      { key: 'scheme', type: 'select', zh: '匯出格式', en: 'Export scheme', required: true, options: ['IOB2', 'BIOES'], defaultValue: 'IOB2', showWhen: 'entity_recognition' },
    ],
    nerTemplate: { subtype: 'ner', entities: [{ name: 'PER', color: '#6366F1' }, { name: 'ORG', color: '#10B981' }, { name: 'LOC', color: '#F59E0B' }], scheme: 'IOB2', allow_overlapping: false, input_field: 'text', entity_field: 'entities', allow_custom_entity_type: false, require_entity_type: true, allow_nested_entities: false, min_entity_length: 1, max_entity_length: 50 },
    aspectListTemplate: { subtype: 'aspect_list', input_field: 'sentence', aspect_list_field: 'aspects', allow_sentence_edit: false, allow_aspect_add: true, allow_aspect_delete: true, require_exact_match_in_sentence: true, min_aspects: 1, max_aspects: 10, require_sentiment_context_check: false },
    spanEntityTemplate: { subtype: 'entity_recognition', span_mode: 'entity_based', entities: [{ name: 'ASPECT', color: '#6366F1' }], allow_overlapping: false, scheme: 'IOB2' },
    spanPolarityTemplate: { subtype: 'entity_recognition', span_mode: 'polarity_based', polarity_options: ['正面', '負面', '中立'] },
    spanPolarityTemplateI18n: { zh: { polarity_options: ['正面', '負面', '中立'] }, en: { polarity_options: ['Positive', 'Negative', 'Neutral'] } },
    defaultTemplate: { subtype: 'ner', entities: [{ name: 'PER', color: '#6366F1' }, { name: 'ORG', color: '#10B981' }, { name: 'LOC', color: '#F59E0B' }], scheme: 'IOB2', allow_overlapping: false, input_field: 'text', entity_field: 'entities', allow_custom_entity_type: false, require_entity_type: true, allow_nested_entities: false, min_entity_length: 1, max_entity_length: 50 },
  },
  relation_extraction: {
    zh: '關係抽取（Entity + Relation + Triple）', en: 'Relation Extraction (Entity + Relation + Triple)',
    fields: [
      { key: 'entity_types', type: 'entity-list', zh: '實體類型', en: 'Entity types', required: true, addLabel_zh: '新增實體類型', addLabel_en: 'Add entity type' },
      { key: 'relation_types', type: 'tag-list', zh: '關係類型', en: 'Relation types', required: true, hint_zh: '輸入關係類型後按 Enter', hint_en: 'Type relation and press Enter' },
      { key: 'tuple_mode', type: 'select', zh: '結構模式', en: 'Tuple mode', required: true, options: ['triple', 'five_tuple'], defaultValue: 'triple' },
    ],
    defaultTemplate: {
      entity_types: [{ name: 'BODY', color: '#6366F1' }, { name: 'SYMPTOM', color: '#10B981' }],
      relation_types: ['causes', 'associated_with'],
      tuple_mode: 'triple',
    },
  },
  sentence_pairs: {
    zh: '句對任務（相似度 / 蘊含）', en: 'Sentence Pairs (Similarity / Entailment)',
    fields: [
      { key: 'pair_mode', type: 'select', zh: '任務模式', en: 'Task mode', required: true,
        options: ['entailment', 'similarity'],
        optionLabels: { zh: { entailment: '蘊含（Entailment）', similarity: '相似度（Similarity）' }, en: { entailment: 'Entailment', similarity: 'Similarity' } },
        defaultValue: 'entailment' },
      { key: 'response_format', type: 'select', zh: '回應格式', en: 'Response format', required: true,
        options: ['classification', 'scoring'],
        optionLabels: { zh: { classification: '分類（Classification）', scoring: '評分（Scoring）' }, en: { classification: 'Classification', scoring: 'Scoring' } },
        defaultValue: 'classification' },
      { key: 'sentence_1_field', type: 'text', zh: '句子 1 欄位', en: 'Sentence 1 field', required: true, placeholder_zh: '如 Premise', placeholder_en: 'e.g. Premise' },
      { key: 'sentence_2_field', type: 'text', zh: '句子 2 欄位', en: 'Sentence 2 field', required: true, placeholder_zh: '如 Hypothesis', placeholder_en: 'e.g. Hypothesis' },
      { key: 'sentence_1_label', type: 'text', zh: '句子 1 顯示名', en: 'Sentence 1 display label', required: false, placeholder_zh: '預設使用欄位名', placeholder_en: 'Defaults to field name' },
      { key: 'sentence_2_label', type: 'text', zh: '句子 2 顯示名', en: 'Sentence 2 display label', required: false, placeholder_zh: '預設使用欄位名', placeholder_en: 'Defaults to field name' },
      { key: 'label_options', type: 'tag-list', zh: '標籤選項', en: 'Label options', required: true, hint_zh: '輸入標籤後按 Enter', hint_en: 'Type label and press Enter', spShowWhen: 'classification' },
      { key: 'score_min', type: 'number', zh: '最小分數', en: 'Min score', required: true, defaultValue: 1, spShowWhen: 'scoring' },
      { key: 'score_max', type: 'number', zh: '最大分數', en: 'Max score', required: true, defaultValue: 5, spShowWhen: 'scoring' },
      { key: 'score_step', type: 'number', zh: '分數步進', en: 'Score step', required: true, defaultValue: 1, spShowWhen: 'scoring' },
      { key: 'allow_unsure', type: 'boolean', zh: '允許「不確定」選項', en: 'Allow "Unsure" option', required: false, defaultValue: false },
      { key: 'note_enabled', type: 'boolean', zh: '啟用備註欄', en: 'Enable note field', required: false, defaultValue: false },
    ],
    defaultTemplate: {
      pair_mode: 'entailment', response_format: 'classification',
      sentence_1_field: '', sentence_2_field: '',
      sentence_1_label: '', sentence_2_label: '',
      label_options: ['蘊含', '矛盾', '中立'],
      allow_unsure: false, note_enabled: false,
    },
    defaultTemplateI18n: {
      zh: { label_options: ['蘊含', '矛盾', '中立'] },
      en: { label_options: ['Entailment', 'Contradiction', 'Neutral'] },
    },
  },
  generation_single_item_free_text: {
    zh: '自由文字生成', en: 'Free Text Generation',
    fields: [
      { key: 'max_length', type: 'number', zh: '最大長度', en: 'Max length', required: true, defaultValue: 512 },
      { key: 'evaluation_reference_required', type: 'boolean', zh: '系統評估需要參考輸出', en: 'Evaluation reference required', required: false, defaultValue: true },
    ],
    defaultTemplate: {
      max_length: 512,
      evaluation_reference_required: true,
    },
  },
};
/* ── Output-type registry (ADR-029 composition model) ─────────── */
/* Each entry maps an output_type key to its config schema fields  */
/* FR-003d-1: selection snapping replaces the retired tokenization contract.
   It moves where a drag selection lands, never what is stored, so the two
   values produce identical `spans[]` and switching between them can never
   invalidate, shift or clear an existing span. */
var SPAN_SNAP_UNITS = ['character', 'word'];

/* FR-003d-1: sequence_tagging and entity_recognition share one drag-select
   component and one span storage shape. The only thing that separates them is
   whether spans may intersect, and that is a property of the output type, not
   a user setting: a flat BIO sequence cannot express overlap or nesting, so
   forbidding it is what guarantees any sequence_tagging annotation compresses
   to BIO without loss. */
var SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE = {
  sequence_tagging: 'forbidden',
  entity_recognition: 'configurable',
};

var OUTPUT_TYPE_REGISTRY = {
  /* ── Sequence ── */
  sequence_tagging: {
    zh: '序列標註', en: 'Sequence Tagging',
    source_output: null,
    rendersInputPreview: true,
    hidePreviewTitle: true,
    fields: [
      { key: 'entities', type: 'entity-list', zh: '標籤類型', en: 'Label types', required: true, addLabel_zh: '新增標籤類型', addLabel_en: 'Add label type' },
      {
        key: 'snap_unit',
        type: 'select',
        zh: '選取吸附',
        en: 'Selection snapping',
        testId: 'sequence-snap-unit-select',
        required: true,
        options: ['character', 'word'],
        optionLabels: {
          zh: { character: '字元（Character）', word: '詞（Word）' },
          en: { character: 'Character', word: 'Word' },
        },
        defaultValue: 'character',
        hint_zh: '只影響拖曳圈選的落點，不影響儲存的字元 offset；切換不會使既有標記失效。',
        hint_en: 'Affects only where a drag selection lands, never the stored character offsets; switching never invalidates existing spans.',
      },
    ],
    defaultConfig: {
      entities: [
        { name: 'PER', color: '#EC4899' },
        { name: 'ORG', color: '#14B8A6' },
        { name: 'LOC', color: '#0EA5E9' },
      ],
      snap_unit: 'character',
    },
    /* FR-003d-1: `allow_overlapping` is a type-level invariant for
       sequence_tagging, not a setting. It never reaches the panel and never
       survives serialization, so a config that carries it is rejected rather
       than silently rewritten to false (see validateOutputConfig). */
    normalizeConfig: function(config) {
      config.snap_unit = SPAN_SNAP_UNITS.indexOf(config.snap_unit) === -1
        ? 'character'
        : config.snap_unit;
      return config;
    },
    validateConfig: function(config, lang) {
      if (!Object.prototype.hasOwnProperty.call(config, 'allow_overlapping')) return '';
      return lang === 'en'
        ? 'sequence_tagging does not accept allow_overlapping: overlapping spans cannot be expressed as a BIO sequence. Remove the key.'
        : 'sequence_tagging 不接受 allow_overlapping：重疊標記無法表示為 BIO 序列，請移除該鍵。';
    },
  },
  entity_recognition: {
    zh: '實體辨識', en: 'Entity Recognition',
    source_output: null,
    rendersInputPreview: true,
    fields: [
      { key: 'entities', type: 'entity-list', zh: '實體類型', en: 'Entity types', required: true, addLabel_zh: '新增實體類型', addLabel_en: 'Add entity type' },
      {
        key: 'snap_unit',
        type: 'select',
        zh: '選取吸附',
        en: 'Selection snapping',
        testId: 'entity-snap-unit-select',
        required: true,
        options: ['character', 'word'],
        optionLabels: {
          zh: { character: '字元（Character）', word: '詞（Word）' },
          en: { character: 'Character', word: 'Word' },
        },
        defaultValue: 'character',
        hint_zh: '只影響拖曳圈選的落點，不影響儲存的字元 offset；切換不會使既有標記失效。',
        hint_en: 'Affects only where a drag selection lands, never the stored character offsets; switching never invalidates existing spans.',
      },
      { key: 'allow_overlapping', type: 'boolean', zh: '允許重疊標記', en: 'Allow overlapping spans', required: false, defaultValue: false },
    ],
    defaultConfig: {
      entities: [
        { name: 'target', color: '#EC4899' },
        { name: 'aspect', color: '#14B8A6' },
        { name: 'opinion', color: '#0EA5E9' },
      ],
      snap_unit: 'character',
      allow_overlapping: true,
    },
    normalizeConfig: function(config) {
      config.snap_unit = SPAN_SNAP_UNITS.indexOf(config.snap_unit) === -1
        ? 'character'
        : config.snap_unit;
      return config;
    },
  },
  relation_identification: {
    zh: '關係識別', en: 'Relation Identification',
    source_output: 'entity_recognition',
    rendersInputPreview: true,
    fields: [
      { key: 'relation_types', type: 'tag-list', zh: '語意類型標籤', en: 'Semantic relation types', required: false, hint_zh: '輸入語意類型（如 causes、bodyLocation）後按 Enter', hint_en: 'Type semantic relation type (e.g. causes, bodyLocation) and press Enter', placeholder_zh: '', placeholder_en: '' },
    ],
    defaultConfig: {
      relation_types: [],
    },
  },
  /* ── Classification ── */
  single_label: {
    zh: '單一標籤', en: 'Single label',
    source_output: null,
    fields: [
      { key: 'label_options', type: 'entity-list', zh: '標籤選項', en: 'Label options', required: true, addLabel_zh: '新增標籤', addLabel_en: 'Add label' },
    ],
    defaultConfig: {
      label_options: [
        { name: 'positive', color: '#10B981' },
        { name: 'neutral', color: '#F59E0B' },
        { name: 'negative', color: '#EC4899' },
      ],
    },
  },
  multi_label: {
    zh: '多標籤', en: 'Multi-label',
    source_output: null,
    fields: [
      { key: 'label_options', type: 'taxonomy-tree', zh: '標籤選項', en: 'Label options', required: true, addLabel_zh: '新增根標籤', addLabel_en: 'Add root label', hintAsTooltip: true, hint_zh: '所有層級皆可選 — 父、子標籤可分別勾選，系統會保留其分類位置。', hint_en: 'Every level is selectable — parent and child labels are checked independently, and their category position is retained.' },
      { key: 'max_selections', type: 'number', zh: '最多可選數量（0 = 不限）', en: 'Max selections (0 = unlimited)', required: false, defaultValue: 0, min: 0 },
    ],
    defaultConfig: {
      label_options: [
        {
          id: 'emotion', name: 'emotion', children: [
            {
              id: 'positive', name: 'positive', children: [
                { id: 'happy', name: 'happy', color: '#10B981' },
              ],
            },
            {
              id: 'negative', name: 'negative', children: [
                { id: 'sad', name: 'sad', color: '#6366F1' },
                { id: 'angry', name: 'angry', color: '#EC4899' },
              ],
            },
          ],
        },
        { id: 'surprise', name: 'surprise', color: '#F59E0B' },
      ],
      max_selections: 0,
    },
  },
  /* ── Regression ── */
  single_dim: {
    zh: '單維度回歸', en: 'Single-dimensional regression',
    source_output: null,
    dimensionSettings: {
      mode: 'single',
      nameKey: 'dimension_name',
      minKey: 'min',
      maxKey: 'max',
      stepKey: 'step',
    },
    fields: [
      { key: 'dimension_name', type: 'text', zh: '維度名稱', en: 'Dimension name', required: true, defaultValue: 'score' },
      { key: 'min', type: 'number', zh: '最小值', en: 'Min value', required: true, defaultValue: 1, min: -100 },
      { key: 'max', type: 'number', zh: '最大值', en: 'Max value', required: true, defaultValue: 5, min: -100 },
      { key: 'step', type: 'number', zh: '間距', en: 'Step', required: true, defaultValue: 1, min: 0.01 },
    ],
    defaultConfig: {
      dimension_name: 'score',
      min: 1, max: 5, step: 1,
    },
  },
  multi_dim: {
    zh: '多維度回歸', en: 'Multi-dimensional regression',
    source_output: null,
    dimensionSettings: {
      mode: 'multiple',
      collectionKey: 'dimensions',
    },
    fields: [
      { key: 'dimensions', type: 'va-dimensions', zh: '維度設定', en: 'Dimension settings', required: true },
    ],
    defaultConfig: {
      dimensions: [
        { name: 'valence', min: 1, max: 9, step: 1 },
        { name: 'arousal', min: 1, max: 9, step: 1 },
      ],
    },
  },
  /* ── Generation ── */
  free_text: {
    zh: '自由文字', en: 'Free text',
    source_output: null,
    rendersEvidencePreview: true,
    rendersInputPreview: true,
    hidePreviewTitle: true,
    fields: [
      {
        key: 'input_instruction',
        type: 'text',
        zh: '輸入區說明',
        en: 'Input section instruction',
        required: true,
        defaultValue: '請閱讀以下內容',
        defaultValue_zh: '請閱讀以下內容',
        defaultValue_en: 'Read the following content',
        maxLength: 100,
        hintAsTooltip: true,
        hint_zh: '顯示在輸入內容上方，告訴標記員要閱讀或處理什麼。例：請閱讀以下文章',
        hint_en: 'Shown above the input content to explain what annotators should read or process. Example: Read the following article',
      },
      {
        key: 'output_instruction',
        type: 'text',
        zh: '作答區說明',
        en: 'Response section instruction',
        required: true,
        defaultValue: '請輸入回答',
        defaultValue_zh: '請輸入回答',
        defaultValue_en: 'Enter your response',
        maxLength: 100,
        hintAsTooltip: true,
        hint_zh: '顯示在自由文字欄位上方，告訴標記員要輸入什麼。例：請用一句話摘要文章重點',
        hint_en: 'Shown above the free-text field to explain what annotators should enter. Example: Summarize the article in one sentence',
      },
      { key: 'max_length', type: 'number', zh: '最大字數', en: 'Max length', required: false, defaultValue: 512, min: 1 },
    ],
    retiredConfigKeys: ['show_reference', 'show_reference_to_annotator'],
    defaultConfig: {
      input_instruction: '請閱讀以下內容',
      output_instruction: '請輸入回答',
      max_length: 512,
    },
  },
};

/* Shared bypass field — every output type lets annotators mark an item as
   「無法判定 (Bypass)」; task creators can turn it off per output type */
var BYPASS_FIELD = { key: 'allow_bypass', type: 'boolean', zh: '允許無法判定 (Bypass)', en: 'Allow bypass (unable to determine)', required: false, defaultValue: true };
Object.keys(OUTPUT_TYPE_REGISTRY).forEach(function(outKey) {
  OUTPUT_TYPE_REGISTRY[outKey].fields.push(Object.assign({}, BYPASS_FIELD));
  OUTPUT_TYPE_REGISTRY[outKey].defaultConfig.allow_bypass = true;
});

/* ── IAA metric registry (task-management-014 IAA strategy v2) ──────────
 * Read-only per-output-type primary IAA metric + default gate threshold.
 * Source of truth: dataset-017-dataset-analysis-detail spec's
 * `OUTPUT_TYPE_IAA_REGISTRY` constant table. task-detail.html only reads
 * this to render a read-only metric list and to resolve
 * `target_agreement_overrides` fallback values — it must not define a
 * second copy of these metric names or thresholds (constitution:
 * Generalization-First). `free_text` has no automatic IAA metric
 * (`notApplicable: true`) and is excluded from the IAA gate denominator. */
var OUTPUT_TYPE_IAA_REGISTRY = {
  single_label: { zh: "Krippendorff's Alpha（nominal）", en: "Krippendorff's Alpha (nominal)", defaultThreshold: 0.80 },
  multi_label: { zh: '逐標籤 Alpha macro 平均', en: 'Per-label alpha (macro average)', defaultThreshold: 0.80 },
  single_dim: { zh: 'ICC(2,1)', en: 'ICC(2,1)', defaultThreshold: 0.75 },
  multi_dim: { zh: 'ICC(2,1)', en: 'ICC(2,1)', defaultThreshold: 0.80 },
  entity_recognition: { zh: 'Span F1（嚴格）', en: 'Span F1 (strict)', defaultThreshold: 0.80 },
  relation_identification: { zh: 'Triple F1', en: 'Triple F1', defaultThreshold: 0.75 },
  /* FR-012L (dataset-017 v... seq-tagging-span-export-metrics): span-unit
     Krippendorff u-α replaces the retired token-level nominal alpha metric.
     sequence_tagging is IAA_UNCALIBRATED_TYPES so defaultThreshold stays
     null — no threshold, default, or fallback number may be smuggled in
     here (FR-043 §2). computeNote records the u-α computation prerequisite
     (continuum-length weighting of unlabeled regions) for traceability. */
  sequence_tagging: { zh: 'Krippendorff 單位化 α（u-α，以 span 為計算單位）', en: "Krippendorff's unitizing alpha (u-α, span-level unit)", defaultThreshold: null, computeUnit: 'span', computeNote: 'u-α 以連續體長度加權處理未標記區段' },
  free_text: { zh: null, en: null, defaultThreshold: null, notApplicable: true },
};

function getOutputFieldDefault(field, lang) {
  var localizedKey = 'defaultValue_' + (lang || state.lang || 'zh');
  if (Object.prototype.hasOwnProperty.call(field, localizedKey)) return field[localizedKey];
  return field.defaultValue;
}

function getOutputConfigFieldValue(config, field) {
  var value = config[field.key];
  if (!field.valueKey) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value[field.valueKey];
}

function setOutputConfigFieldValue(config, field, value) {
  if (!field.valueKey) {
    config[field.key] = value;
    return;
  }
  if (!config[field.key] || typeof config[field.key] !== 'object' || Array.isArray(config[field.key])) {
    config[field.key] = {};
  }
  config[field.key][field.valueKey] = value;
}

function getOutputTypeDefaultConfig(outKey, lang) {
  var outReg = OUTPUT_TYPE_REGISTRY[outKey];
  if (!outReg) return {};
  var defaults = JSON.parse(JSON.stringify(outReg.defaultConfig || {}));
  outReg.fields.forEach(function(field) {
    var value = getOutputFieldDefault(field, lang);
    if (value !== undefined) {
      setOutputConfigFieldValue(defaults, field, JSON.parse(JSON.stringify(value)));
    }
  });
  return defaults;
}

function normalizeOutputConfig(outKey, config, lang) {
  var outReg = OUTPUT_TYPE_REGISTRY[outKey];
  var normalized = config && typeof config === 'object' && !Array.isArray(config)
    ? JSON.parse(JSON.stringify(config))
    : {};
  var defaults = getOutputTypeDefaultConfig(outKey, lang);
  Object.keys(defaults).forEach(function(key) {
    if (normalized[key] === undefined) normalized[key] = defaults[key];
  });
  if (outReg && Array.isArray(outReg.retiredConfigKeys)) {
    outReg.retiredConfigKeys.forEach(function(key) { delete normalized[key]; });
  }
  if (outReg && typeof outReg.normalizeConfig === 'function') {
    normalized = outReg.normalizeConfig(normalized, lang);
  }
  return normalized;
}

/* Known output-type dependencies: which output type depends on which source */
var OUTPUT_TYPE_DEPS = {
  relation_identification: 'entity_recognition',
};

/* Canonical ABSA multi-output template (ADR-029 §Example: ABSA) */
var ABSA_MULTI_OUTPUT_TEMPLATE = {
  input_type: 'single_item',
  outputs: [
    {
      type: 'entity_recognition',
      config: {
        entities: [
          { name: 'target', color: '#EC4899' },
          { name: 'aspect', color: '#14B8A6' },
          { name: 'opinion', color: '#0EA5E9' },
        ],
        allow_overlapping: true,
      },
    },
    {
      type: 'relation_identification',
      config: {
        relation_types: ['has_aspect', 'has_opinion', 'sentiment_of'],
        source_output: 'entity_recognition',
      },
    },
    {
      type: 'multi_dim',
      config: {
        dimensions: [
          { name: 'valence', min: 1, max: 9, step: 1 },
          { name: 'arousal', min: 1, max: 9, step: 1 },
        ],
      },
    },
  ],
};

/* ── Task taxonomy cascade ───────────────────────────────────── */
var TASK_TAXONOMY = {
  classification: {
    zh: '分類（Classification）', en: 'Classification',
    outputSelection: 'single',
    granularities: {
      single_item: {
        zh: '單一項目', en: 'Single item',
        subtypes: {
          single_label:    { registryKey: 'single_sentence_classification', zh: '單一標籤', en: 'Single label' },
          multi_label:     { registryKey: 'single_sentence_classification', zh: '多標籤', en: 'Multi-label' },
        },
      },
      item_pair: {
        zh: '項目對', en: 'Item pair',
        subtypes: {
          single_label:    { registryKey: 'sentence_pairs', zh: '單一標籤', en: 'Single label' },
          multi_label:     { registryKey: 'sentence_pairs', zh: '多標籤', en: 'Multi-label' },
        },
      },
    },
  },
  regression: {
    zh: '回歸（Regression）', en: 'Regression',
    outputSelection: 'single',
    granularities: {
      single_item: {
        zh: '單一項目', en: 'Single item',
        subtypes: {
          single_dim: { registryKey: 'single_sentence_va_scoring', zh: '單維度', en: 'Single dimension' },
          multi_dim:  { registryKey: 'single_sentence_va_scoring', zh: '多維度', en: 'Multi-dimension' },
        },
      },
      item_pair: {
        zh: '項目對', en: 'Item pair',
        subtypes: {
          single_dim: { registryKey: 'single_sentence_va_scoring', zh: '單維度', en: 'Single dimension' },
          multi_dim:  { registryKey: 'single_sentence_va_scoring', zh: '多維度', en: 'Multi-dimension' },
        },
      },
    },
  },
  sequence: {
    zh: '序列（Sequence）', en: 'Sequence',
    outputSelection: 'multiple',
    granularities: {
      single_item: {
        zh: '單一項目', en: 'Single item',
        subtypes: {
          sequence_tagging:     { registryKey: 'sequence_labeling', zh: '序列標註', en: 'Sequence Tagging' },
          entity_recognition:            { registryKey: 'sequence_labeling', zh: '實體辨識', en: 'Entity Recognition' },
          relation_identification: { registryKey: 'relation_extraction', zh: '關係識別', en: 'Relation Identification' },
        },
      },
    },
  },
  generation: {
    zh: '生成（Generation）', en: 'Generation',
    outputSelection: 'multiple',
    granularities: {
      single_item: {
        zh: '單一項目', en: 'Single item',
        subtypes: {
          free_text: { registryKey: 'generation_single_item_free_text', zh: '自由文字', en: 'Free text' },
        },
      },
    },
  },
};
var FIELD_ROLE_LABELS = {
  zh: { '': '— 不使用 —', evidence: 'Evidence（背景）', input: 'Input（輸入）', output: 'Output（輸出）' },
  en: { '': '— not used —', evidence: 'Evidence', input: 'Input', output: 'Output' },
};
var SAMPLING_DEFAULTS_BY_TYPE = {
  single_sentence_classification: { targetIAA: 0.75, targetStd: null, minAnnotators: 3, trialPercent: 12 },
  single_sentence_va_scoring:     { targetIAA: 0.75, targetStd: 0.10, minAnnotators: 5, trialPercent: 15 },
  sequence_labeling:               { targetIAA: 0.82, targetStd: null, minAnnotators: 3, trialPercent: 15 },
  relation_extraction:             { targetIAA: 0.78, targetStd: null, minAnnotators: 3, trialPercent: 18 },
  sentence_pairs:                  { targetIAA: 0.76, targetStd: 0.15, minAnnotators: 3, trialPercent: 12 },
};
var DEFAULT_GUIDELINE_FILES_BY_TASK_TYPE = {
  single_sentence_va_scoring: [
    { name: 'VA_emj.png', type: 'Image', size: 584508, assetPath: '../../assets/images/task-management/VA_emj.png' },
  ],
};
var ENTITY_COLORS = ['#6366F1','#10B981','#F59E0B','#EC4899','#8B5CF6','#0EA5E9','#F97316','#14B8A6'];
var USER_DIRECTORY = [
  { name: 'Alex Wang', email: 'alex.wang@labelsuite.io', systemRole: 'user' },
  { name: 'Olivia Lin', email: 'olivia.lin@labelsuite.io', systemRole: 'user' },
  { name: 'Jason Huang', email: 'jason.h@labelsuite.io', systemRole: 'user' },
  { name: 'Rachel Su', email: 'rachel.su@labelsuite.io', systemRole: 'user' },
];

/* I18N keys moved out of the host page's I18N object (see task-new.html):
 * every key here is referenced (directly or via a dynamically-computed key
 * name) from code in task-config.yaml.js / task-config.dataset.js /
 * task-config.engine.js. The host page must run:
 *   Object.assign(I18N.zh, TASK_CONFIG_I18N.zh);
 *   Object.assign(I18N.en, TASK_CONFIG_I18N.en);
 * immediately after its own I18N object is defined, so that t() resolves
 * these keys for both engine code and any chrome code sharing the same key. */
var TASK_CONFIG_I18N = {
  zh: {
    previewEvidenceHeading: '背景參考 (Evidence)',
    previewTaskChooseLabel: '請選擇標記',
    previewTaskEntity: '請選擇實體類型',
    previewTaskRelation: '請選擇關係類型',
    previewTaskEntityType: 'Entity Type',
    previewEntityList: 'Entity List',
    previewRelationType: 'Relation Type',
    previewTripleList: 'Triple List',
    previewTaskValence: 'Valence 評分',
    previewTaskArousal: 'Arousal 評分',
    previewEmpty: '請先新增至少一個標記選項',
    previewSampleSentence: '這是一段範例文本，請依目前設定完成標記。',
    previewSampleSentenceVA: '這次住宿整體舒適，但隔音稍差。',
    previewSampleSentenceSequence: '台積電董事長魏哲家今天在台北出席產業論壇。',
    previewSampleSentenceAspectList: '這家餐廳服務態度親切，環境整潔，餐點品質也很穩定。',
    aspectListPreviewTitle: 'Aspect List',
    aspectListSentenceLabel: 'Sentence',
    addAspectBtnLabel: '+ 新增 Aspect',
    aspectRowPlaceholder: '輸入 aspect 文字',
    requireSentimentContextHint: '提示：請確認每個 Aspect 在句子前後文中是否有對應的情緒描述，沒有的話請刪除。（軟性指引，不強制攔截）',
    nerCoreSectionTitle: '核心設定',
    nerCoreSectionDesc: '建立任務時優先設定實體類型、標記格式與是否允許重疊標記。',
    nerAdvancedSectionTitle: '進階設定',
    nerAdvancedSectionDesc: '只在資料欄位映射、巢狀實體或長度限制有特殊需求時再展開調整。',
    aspectFieldSectionTitle: '欄位對應',
    aspectFieldSectionDesc: '指定資料集中的句子來源與標記輸出欄位。',
    aspectRuleSectionTitle: 'Aspect 編輯規則',
    aspectRuleSectionDesc: '控制標記員能否修正句子、增刪 aspect，以及系統驗證方式。',
    aspectLimitSectionTitle: '數量限制',
    aspectLimitSectionDesc: '設定每筆資料需要提交的 Aspect List 長度範圍。',
    templateBtnNer: '套用預設範本：NER 命名實體辨識',
    templateBtnAspectList: '套用預設範本：Aspect List 抽取／校正',
    previewSampleSentenceRelation: '阿司匹靈可緩解頭痛症狀，但可能造成胃部不適。',
    previewSampleSentenceA: '這間餐廳的服務態度很好。',
    previewSampleSentenceB: '但上菜速度偏慢。',
    datasetPreviewTitle: '資料集預覽',
    datasetPreviewAriaLabel: '預覽資料集',
    datasetRemoveAriaLabel: '移除檔案',
    errDatasetFormat: '不支援此格式，請上傳 JSON 檔案（.json）',
    errDatasetSize: '檔案超過 200 MB 上限',
    errCodeInvalid: 'Code 內容格式錯誤，請修正後再儲存',
    errConfigFormat: '設定檔格式錯誤，請上傳 YAML / YML / JSON',
    errConfigRead: '讀取設定檔失敗，請重試',
    inlinePreviewHint: '前 2 筆資料・為每個欄位指定 Evidence / Input / Output 角色',
    inlinePreviewTitle: '欄位預覽・指定欄位角色',
    uploadZoneLabel: '點擊或拖曳上傳資料集',
    uploadZoneHint: '僅支援 JSON · 最大 200 MB · UTF-8',
    taskCategoryGroupLabel: '大分類（可多選）',
    taskInputTypeGroupLabel: '輸入類型（單選）',
    taskOutputTypeGroupLabel: '輸出類型（可多選）',
    errNoRecords: '找不到資料列：JSON 中沒有可辨識的物件陣列',
    errRecordPathIncompat: '欄位不一致：「{name}」在資料列來源「{path}」下的欄位與已上傳檔案不同',
    inlineSourceLabel: '資料列來源',
    inlineSourceCandidates: '偵測到 {n} 個候選陣列',
    inlineSourceRowUnit: '{n} 筆',
    inlineTotalRecords: '共 {n} 筆資料',
    fieldNoteMissing: '{m}/{t} 筆缺值',
    fieldNoteMissingRefs: '如：{refs}',
    fieldNoteAllPresent: '全部 {t} 筆有值',
    fieldNotePreAnnotated: '{p}/{t} 筆有預標記',
    typeString: '字串',
    typeNumber: '數字',
    typeBoolean: '布林',
    typeArray: '陣列',
    typeObject: '物件',
    typeMixed: '混合',
    typeEmpty: '—',
    outputTypePlaceholder: '請先選擇大分類',
    toastCodeSaved: 'Code 設定已同步',
    toastConfigLoaded: '設定檔已載入，請按「儲存」套用',
    applyTemplate: '套用預設範本：',
    addEntity: '新增實體類型',
    enabled: '已啟用',
    disabled: '已停用',
    accordionDependsOn: '依賴：',
    previewUnifiedTitle: '整合預覽',
    previewSourceTextTitle: '原始文本',
    itemPairLabelsTitle: '項目對名稱',
    itemPairLabel1: '項目一名稱',
    itemPairLabel2: '項目二名稱',
    absa_template_btn: '套用範本：ABSA（實體辨識 + 關係識別）',
    templateBtnSpanEntity: '套用範本：實體辨識',
    templateBtnSpanPolarity: '套用範本：實體辨識極性標記（ABSA）',
    spanModeSectionTitle: '標記模式',
    spanModeSectionDesc: '選擇實體辨識模式：實體類型標記或極性標籤標記（兩者互斥）。',
    spanEntitySectionTitle: '實體類型設定',
    spanEntitySectionDesc: '定義可辨識的實體類型，並設定重疊與匯出格式。',
    spanPolaritySectionTitle: '極性標籤設定',
    spanPolaritySectionDesc: '定義每個標記區間需選擇的極性標籤（如正面／負面／中立）。',
    previewSampleSentenceSpan: '這家餐廳服務很差，但環境不錯。',
    previewSpanPolarityTitle: '標記區間並選擇極性',
    spTaskModeSectionTitle: '任務模式',
    spTaskModeSectionDesc: '選擇句對比較模式與回應格式。',
    spFieldMappingSectionTitle: '欄位對應',
    spFieldMappingSectionDesc: '確認資料集欄位與標記角色的對應關係。欄位來自第一步驟選擇，顯示名稱可自訂。',
    spEvidenceFieldsLabel: '背景資料欄位',
    spOutputSectionTitle: '輸出設定',
    spOutputSectionDesc: '標籤選項已從資料集自動抽取，可自行新增或刪除。',
    spAnnotationSectionTitle: '作答設定',
    spAnnotationSectionDesc: '控制標記介面的額外選項。',
    templateBtnSentencePairs: '套用預設範本：句對標記（NLI）',
  },
  en: {
    previewEvidenceHeading: 'Background reference (Evidence)',
    previewTaskChooseLabel: 'Choose labels',
    previewTaskEntity: 'Choose entity types',
    previewTaskRelation: 'Choose relation types',
    previewTaskEntityType: 'Entity Type',
    previewEntityList: 'Entity List',
    previewRelationType: 'Relation Type',
    previewTripleList: 'Triple List',
    previewTaskValence: 'Valence score',
    previewTaskArousal: 'Arousal score',
    previewEmpty: 'Add at least one option to preview',
    previewSampleSentence: 'This is a sample text. Apply annotations with the current settings.',
    previewSampleSentenceVA: 'The hotel stay was comfortable overall, but the soundproofing was weak.',
    previewSampleSentenceSequence: 'TSMC chairman C.C. Wei attended an industry forum in Taipei today.',
    previewSampleSentenceAspectList: 'The service was friendly, the space was clean, and the food quality was consistent.',
    aspectListPreviewTitle: 'Aspect List',
    aspectListSentenceLabel: 'Sentence',
    addAspectBtnLabel: '+ Add aspect',
    aspectRowPlaceholder: 'Enter aspect text',
    requireSentimentContextHint: 'Hint: check that each aspect has a matching sentiment description in context. Remove any that do not. (Soft guidance — not system-enforced)',
    nerCoreSectionTitle: 'Core settings',
    nerCoreSectionDesc: 'Configure entity types, labeling scheme, and overlapping spans first when creating the task.',
    nerAdvancedSectionTitle: 'Advanced settings',
    nerAdvancedSectionDesc: 'Expand only when you need custom field mapping, nested entities, or length constraints.',
    aspectFieldSectionTitle: 'Field mapping',
    aspectFieldSectionDesc: 'Choose the source sentence field and the output field for annotations.',
    aspectRuleSectionTitle: 'Aspect editing rules',
    aspectRuleSectionDesc: 'Control sentence edits, aspect row actions, and validation behavior.',
    aspectLimitSectionTitle: 'Quantity limits',
    aspectLimitSectionDesc: 'Set the accepted Aspect List length for each dataset row.',
    templateBtnNer: 'Apply template: NER (Named Entity Recognition)',
    templateBtnAspectList: 'Apply template: Aspect List extraction / correction',
    previewSampleSentenceRelation: 'Aspirin can relieve headaches, but it may cause stomach discomfort.',
    previewSampleSentenceA: 'The service at this restaurant is great.',
    previewSampleSentenceB: 'But the dishes are served slowly.',
    datasetPreviewTitle: 'Dataset Preview',
    datasetPreviewAriaLabel: 'Preview dataset',
    datasetRemoveAriaLabel: 'Remove file',
    errDatasetFormat: 'Unsupported format — only .json files are accepted',
    errDatasetSize: 'File exceeds the 200 MB limit',
    errCodeInvalid: 'Invalid code format. Please fix and save again',
    errConfigFormat: 'Invalid config file type. Upload YAML / YML / JSON',
    errConfigRead: 'Failed to read config file. Please try again',
    inlinePreviewHint: 'First 2 rows · assign Evidence / Input / Output role to each field',
    inlinePreviewTitle: 'Column preview · assign field roles',
    uploadZoneLabel: 'Click or drag to upload dataset',
    uploadZoneHint: 'JSON only · max 200 MB · UTF-8',
    taskCategoryGroupLabel: 'Category (multi-select)',
    taskInputTypeGroupLabel: 'Input type (single-select)',
    taskOutputTypeGroupLabel: 'Output type (multi-select)',
    errNoRecords: 'No records found: the JSON contains no recognizable array of objects',
    errRecordPathIncompat: 'Column mismatch: "{name}" has different columns under record source "{path}"',
    inlineSourceLabel: 'Record source',
    inlineSourceCandidates: '{n} candidate arrays detected',
    inlineSourceRowUnit: '{n} rows',
    inlineTotalRecords: '{n} rows total',
    fieldNoteMissing: '{m}/{t} rows empty',
    fieldNoteMissingRefs: 'e.g. {refs}',
    fieldNoteAllPresent: 'All {t} rows present',
    fieldNotePreAnnotated: '{p}/{t} rows pre-annotated',
    typeString: 'string',
    typeNumber: 'number',
    typeBoolean: 'boolean',
    typeArray: 'array',
    typeObject: 'object',
    typeMixed: 'mixed',
    typeEmpty: '—',
    outputTypePlaceholder: 'Please select a category first',
    toastCodeSaved: 'Code configuration synced',
    toastConfigLoaded: 'Config loaded. Click Save to apply',
    applyTemplate: 'Apply default template: ',
    addEntity: 'Add entity type',
    enabled: 'Enabled',
    disabled: 'Disabled',
    accordionDependsOn: 'Depends on: ',
    previewUnifiedTitle: 'Unified preview',
    previewSourceTextTitle: 'Text',
    itemPairLabelsTitle: 'Item pair labels',
    itemPairLabel1: 'Item 1 label',
    itemPairLabel2: 'Item 2 label',
    absa_template_btn: 'Apply template: ABSA (Entity Recognition + Relation Identification)',
    templateBtnSpanEntity: 'Apply template: Entity Recognition',
    templateBtnSpanPolarity: 'Apply template: Entity Recognition polarity annotation (ABSA)',
    spanModeSectionTitle: 'Annotation mode',
    spanModeSectionDesc: 'Choose an Entity Recognition mode: entity type labeling or polarity labeling (mutually exclusive).',
    spanEntitySectionTitle: 'Entity type settings',
    spanEntitySectionDesc: 'Define entity types, overlapping behavior, and export scheme.',
    spanPolaritySectionTitle: 'Polarity label settings',
    spanPolaritySectionDesc: 'Define the polarity labels each span must be assigned (e.g. Positive / Negative / Neutral).',
    previewSampleSentenceSpan: 'The service at this restaurant was poor, but the ambiance was nice.',
    previewSpanPolarityTitle: 'Mark spans and choose polarity',
    spTaskModeSectionTitle: 'Task mode',
    spTaskModeSectionDesc: 'Choose sentence pair comparison mode and response format.',
    spFieldMappingSectionTitle: 'Field mapping',
    spFieldMappingSectionDesc: 'Confirm dataset field to annotation role mapping. Fields come from Step 1; display labels are editable.',
    spEvidenceFieldsLabel: 'Evidence fields',
    spOutputSectionTitle: 'Output settings',
    spOutputSectionDesc: 'Label options were auto-extracted from the dataset. You can add or remove them.',
    spAnnotationSectionTitle: 'Annotation settings',
    spAnnotationSectionDesc: 'Configure additional annotation interface options.',
    templateBtnSentencePairs: 'Apply template: Sentence pairs (NLI)',
  },
};

