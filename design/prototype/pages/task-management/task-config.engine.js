/* task-config.engine.js
 * DOM-render layer of the shared task-config engine: chip/SVG-icon helpers,
 * field-role + taxonomy utilities, Step 2 output-accordion builders, the
 * taxonomy tree editor, the interactive annotation preview (all output
 * types), legacy single-schema field rendering, i18n template re-sync, the
 * YAML/JSON code editor load/save, and the dataset file list + inline
 * field-role preview UI.
 *
 * Host page must define (called by this file as globals):
 *   - state                    — shared wizard/config state object
 *   - t(key)                   — I18N lookup
 *   - el(id)                   — document.getElementById shorthand
 *   - setText(id, txt)         — set element textContent if it exists
 *   - markDirty()              — flag unsaved changes + persist wizard state
 *   - revalidateCurrentStep()  — re-run the active step's validation
 *   - showFieldError(errId, show, msg) — inline field error banner
 *   - showToast(msg, type)     — toast notification
 *   - track(event, extra)      — analytics event (no-op if analytics absent)
 *   - onChipSelectionChange()  — re-derive task type + reset config after a
 *                                 category/input/output chip toggle
 *   - showTaxonomyDeleteModal(descendantCount, onConfirm) / hideTaxonomyDeleteModal()
 *                              — UXC-10 branch-delete confirmation modal
 *   - getDatasetTotalEstimate() — total row-count estimate for sampling UI
 *
 * Depends on data/helpers from task-config.data.js, task-config.yaml.js and
 * task-config.dataset.js (all three load before this file).
 */

/* Entity/label colors originate from user-editable config (code editor,
   config-file upload) and are concatenated into style.cssText strings; a
   value containing ';' could escape the declaration and inject arbitrary
   CSS. Only pass through hex colors (the app's palette format). */
function safeCssColor(value, fallback) {
  return (typeof value === 'string' && /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) ? value : fallback;
}

/* The trailing Bypass line of an output preview. Consumers outside this file
   (the reviewer workspace) look it up to dock their own controls onto the same
   row, so the name is part of the engine's contract, not a private detail. */
var BYPASS_ROW_CLASS = 'preview-bypass-row';

function syncChipsFromState() {
  ['taskCategoryChips', 'taskInputTypeChips'].forEach(function(containerId) {
    var container = el(containerId);
    if (!container) return;
    var stateKey = containerId === 'taskCategoryChips' ? 'taskCategories' : 'taskInputTypes';
    var arr = state[stateKey] || [];
    container.querySelectorAll('.task-type-chip').forEach(function(btn) {
      var key = btn.getAttribute('data-key');
      var selected = arr.indexOf(key) >= 0;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
  });
  _lastOutputCatsKey = undefined;
  rebuildOutputChips();
}

/* ── SVG icon helpers (DOM, no innerHTML) ────────────────────── */
var SVG_NS = 'http://www.w3.org/2000/svg';
function makeSvgIcon(paths, size) {
  size = size || 12;
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  paths.forEach(function(d) {
    var line = document.createElementNS(SVG_NS, 'line');
    d.forEach(function(attr) { line.setAttribute(attr[0], attr[1]); });
    svg.appendChild(line);
  });
  return svg;
}
function makeXIcon(size) {
  return makeSvgIcon([
    [['x1','18'],['y1','6'],['x2','6'],['y2','18']],
    [['x1','6'],['y1','6'],['x2','18'],['y2','18']],
  ], size);
}
function makePlusIcon(size) {
  return makeSvgIcon([
    [['x1','12'],['y1','5'],['x2','12'],['y2','19']],
    [['x1','5'],['y1','12'],['x2','19'],['y2','12']],
  ], size);
}
/* ── Schema fields (Step 2 Visual mode) ─────────────────────── */
function currentSubtype() {
  return state.configData.subtype || 'ner';
}

function fieldVisible(field) {
  if (!field.showWhen) return true;
  if (currentSubtype() !== field.showWhen) return false;
  if (field.showWhen === 'entity_recognition') {
    var spanMode = state.configData.span_mode || 'entity_based';
    if (field.key === 'entities' || field.key === 'allow_overlapping' || field.key === 'scheme') return spanMode === 'entity_based';
    if (field.key === 'polarity_options') return spanMode === 'polarity_based';
  }
  return true;
}

function buildSchemaSection(title, desc) {
  var section = document.createElement('div');
  section.className = 'schema-section';
  var header = document.createElement('div');
  header.className = 'schema-section-header';
  var titleEl = document.createElement('div');
  titleEl.className = 'schema-section-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  if (desc) {
    var descEl = document.createElement('div');
    descEl.className = 'schema-section-desc';
    descEl.textContent = desc;
    header.appendChild(descEl);
  }
  section.appendChild(header);
  return section;
}

function buildSchemaDisclosureSection(title, desc, isOpen, onToggle) {
  var section = document.createElement('details');
  section.className = 'schema-disclosure';
  section.open = !!isOpen;
  section.addEventListener('toggle', function() {
    onToggle(section.open);
  });

  var summary = document.createElement('summary');
  var copy = document.createElement('div');
  copy.className = 'schema-disclosure-summary-copy';
  var titleEl = document.createElement('div');
  titleEl.className = 'schema-disclosure-summary-title';
  titleEl.textContent = title;
  copy.appendChild(titleEl);
  if (desc) {
    var descEl = document.createElement('div');
    descEl.className = 'schema-disclosure-summary-desc';
    descEl.textContent = desc;
    copy.appendChild(descEl);
  }
  summary.appendChild(copy);
  var chevron = document.createElement('span');
  chevron.className = 'schema-disclosure-chevron';
  chevron.textContent = '›';
  summary.appendChild(chevron);
  section.appendChild(summary);

  var body = document.createElement('div');
  body.className = 'schema-disclosure-body';
  section.appendChild(body);
  return { section: section, body: body };
}

function appendSchemaField(container, field) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    if (field.type === 'number') wrap.className += ' schema-number-field';

    if (field.type !== 'boolean') {
      var lbl = document.createElement('label');
      lbl.className = 'field-label';
      lbl.textContent = field[state.lang] || field.zh;
      if (field.required) {
        var req = document.createElement('span');
        req.className = 'required'; req.textContent = '*';
        lbl.appendChild(req);
      }
      wrap.appendChild(lbl);
    }

    if (field.type === 'subtype-select') {
      var subtypeSel = document.createElement('select');
      subtypeSel.className = 'input-select';
      var curSubtype = state.configData[field.key] !== undefined ? state.configData[field.key] : field.defaultValue;
      var labels = (field.optionLabels && field.optionLabels[state.lang]) || {};
      field.options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt; o.textContent = labels[opt] || opt;
        if (opt === curSubtype) o.selected = true;
        subtypeSel.appendChild(o);
      });
      subtypeSel.addEventListener('change', function() {
        state.configData[field.key] = subtypeSel.value;
        markDirty(); renderSchemaFields(); revalidateCurrentStep();
      });
      wrap.appendChild(subtypeSel);
    } else if (field.type === 'tag-list') {
      wrap.appendChild(buildTagInput(field));
      if (field['hint_' + state.lang]) {
        var hint = document.createElement('div');
        hint.className = 'field-hint';
        hint.textContent = field['hint_' + state.lang];
        wrap.appendChild(hint);
      }
    } else if (field.type === 'entity-list') {
      wrap.appendChild(buildEntityList(field));
    } else if (field.type === 'va-dimensions') {
      wrap.appendChild(buildVADimensionsInput());
    } else if (field.type === 'boolean') {
      var card = document.createElement('label');
      card.className = 'schema-toggle-card';
      var checkedValue = !!(state.configData[field.key] !== undefined ? state.configData[field.key] : field.defaultValue);
      if (checkedValue) card.classList.add('is-on');

      var copy = document.createElement('span');
      copy.className = 'schema-toggle-copy';
      var title = document.createElement('span');
      title.className = 'schema-toggle-label';
      title.textContent = field[state.lang] || field.zh;
      copy.appendChild(title);
      var status = document.createElement('span');
      status.className = 'schema-toggle-status';
      status.textContent = checkedValue ? t('enabled') : t('disabled');
      copy.appendChild(status);

      var switchWrap = document.createElement('span');
      switchWrap.className = 'toggle-switch';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = checkedValue;
      var slider = document.createElement('span');
      slider.className = 'toggle-slider';
      chk.addEventListener('change', function() {
        state.configData[field.key] = chk.checked;
        status.textContent = chk.checked ? t('enabled') : t('disabled');
        card.classList.toggle('is-on', chk.checked);
        markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
      });
      switchWrap.appendChild(chk);
      switchWrap.appendChild(slider);
      card.appendChild(copy);
      card.appendChild(switchWrap);
      wrap.appendChild(card);
    } else if (field.type === 'select') {
      var sel = document.createElement('select');
      sel.className = 'input-select';
      var curVal = state.configData[field.key] !== undefined ? state.configData[field.key] : field.defaultValue;
      var selLabels = (field.optionLabels && field.optionLabels[state.lang]) || {};
      field.options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt; o.textContent = selLabels[opt] || opt;
        if (opt === curVal) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function() {
        state.configData[field.key] = sel.value;
        if (field.key === 'span_mode' || field.key === 'response_format') {
          markDirty(); renderSchemaFields(); revalidateCurrentStep();
        } else {
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        }
      });
      wrap.appendChild(sel);
    } else if (field.type === 'number') {
      var numInp = document.createElement('input');
      numInp.type = 'number'; numInp.className = 'input-text';
      numInp.style.width = '100px';
      numInp.value = state.configData[field.key] !== undefined ? state.configData[field.key] : (field.defaultValue !== undefined ? field.defaultValue : '');
      numInp.addEventListener('input', function() {
        state.configData[field.key] = numInp.value === '' ? '' : Number(numInp.value);
        markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
      });
      wrap.appendChild(numInp);
    } else if (field.type === 'textarea') {
      var ta = document.createElement('textarea');
      ta.className = 'input-textarea';
      ta.placeholder = field['placeholder_' + state.lang] || field.placeholder_zh || '';
      ta.value = state.configData[field.key] || '';
      ta.addEventListener('input', function() {
        state.configData[field.key] = ta.value;
        markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
      });
      wrap.appendChild(ta);
    } else {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'input-text';
      inp.placeholder = field['placeholder_' + state.lang] || field.placeholder_zh || '';
      inp.value = state.configData[field.key] || '';
      if (field.readOnly) {
        inp.readOnly = true;
      } else {
        inp.addEventListener('input', function() {
          state.configData[field.key] = inp.value;
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }
      wrap.appendChild(inp);
      // Step 2 field-mapping hint: show selected columns from dataset (FR-002c-1)
      var fieldMappingKeys = ['input_field', 'entity_field', 'aspect_list_field', 'sentence_1_field', 'sentence_2_field'];
      if (!field.readOnly && fieldMappingKeys.indexOf(field.key) >= 0 && state.datasetFiles.length > 0) {
        var selectedCols = getSelectedColumns();
        if (selectedCols.length > 0) {
          var colHint = document.createElement('div');
          colHint.className = 'field-hint';
          colHint.textContent = (state.lang === 'en' ? 'Available columns: ' : '可用欄位：') + selectedCols.join(', ');
          wrap.appendChild(colHint);
        }
      }
    }
    container.appendChild(wrap);
}

function getFieldsByRole(role) {
  var result = [];
  state.datasetParsedColumns.forEach(function(col) {
    if (state.fieldRoleMap[col] === role) result.push(col);
  });
  return result;
}

/* Return an output column's value from the first dataset row, or undefined.
   When outKey is given and multiple output columns exist, try to match the
   column whose name best corresponds to the output type; fall back to first. */
function getOutputFieldValue(outKey) {
  var outCols = getFieldsByRole('output');
  if (outCols.length === 0 || !state.datasetRawFirstRow) return undefined;
  var col = outCols[0];
  if (outKey && outCols.length > 1) {
    for (var ci = 0; ci < outCols.length; ci++) {
      var colOutputTypes = state.columnOutputTypeMap && state.columnOutputTypeMap[outCols[ci]];
      if (colOutputTypes && colOutputTypes.indexOf(outKey) >= 0) { col = outCols[ci]; break; }
    }
  }
  var val = state.datasetRawFirstRow[col];
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

var TAXONOMY_MAX_DEPTH = 8;
var TAXONOMY_MAX_NODES = 500;
var TAXONOMY_MAX_TEXT = 100;

function taxonomyPathKey(path) { return JSON.stringify(path || []); }

/* Parse the first dataset row's output column into taxonomy paths.
   Auto-fill is blocked entirely (issue set, paths emptied) when the column
   mixes flat and hierarchical formats or contains a path that matches no
   existing root-to-node route — never guess or truncate. Non-JSON values
   fall through as `raw` for the legacy comma-separated fallback. */
function readTaxonomyDataPaths(outKey, entries) {
  var result = { paths: [], issue: null, raw: null };
  var outputVal = getOutputFieldValue(outKey);
  if (!outputVal) return result;
  var parsed;
  try { parsed = JSON.parse(outputVal); } catch(e) { result.raw = outputVal; return result; }
  if (!Array.isArray(parsed)) return result;
  var hasNested = parsed.some(function(value) { return Array.isArray(value); });
  var hasFlat = parsed.some(function(value) { return !Array.isArray(value); });
  if (hasNested && hasFlat) { result.issue = 'mixed'; return result; }
  parsed.forEach(function(value) {
    var path = Array.isArray(value) ? value.map(String) : [String(value)];
    if (entries.some(function(entry) { return taxonomyPathKey(entry.idPath) === taxonomyPathKey(path); })) result.paths.push(path);
    else result.issue = 'unmatched';
  });
  if (result.issue) result.paths = [];
  return result;
}

function getOutputFieldName(outKey) {
  var outCols = getFieldsByRole('output');
  if (outCols.length === 0) return null;
  for (var i = 0; i < outCols.length; i++) {
    var types = state.columnOutputTypeMap && state.columnOutputTypeMap[outCols[i]];
    if (types && types.indexOf(outKey) >= 0) return outCols[i];
  }
  return outCols[0];
}

function getAllDatasetRecords() {
  var rows = [];
  state._datasetRoots.forEach(function(root) {
    var records = extractRecordsAtPath(root, state.datasetRecordPath);
    if (records) rows = rows.concat(records);
  });
  return rows;
}

function collectTaxonomyEntries(nodes, idPrefix, namePrefix, depth, output, parentId) {
  output = output || [];
  idPrefix = idPrefix || [];
  namePrefix = namePrefix || [];
  depth = depth || 1;
  (Array.isArray(nodes) ? nodes : []).forEach(function(node) {
    if (!node || typeof node !== 'object') return;
    var idPath = idPrefix.concat(String(node.id != null ? node.id : node.name || ''));
    var namePath = namePrefix.concat(String(node.name != null ? node.name : node.id || ''));
    var children = Array.isArray(node.children) ? node.children : [];
    output.push({
      node: node,
      idPath: idPath,
      namePath: namePath,
      depth: depth,
      parentId: parentId || null,
      isLeaf: children.length === 0,
    });
    collectTaxonomyEntries(children, idPath, namePath, depth + 1, output, String(node.id || ''));
  });
  return output;
}

function normalizeTaxonomyNodes(nodes) {
  var colorIndex = 0;
  function walk(list) {
    return (Array.isArray(list) ? list : []).map(function(raw) {
      var fallback = raw && raw.name != null ? String(raw.name) : '';
      var node = {
        id: raw && raw.id != null ? String(raw.id) : fallback,
        name: fallback || (raw && raw.id != null ? String(raw.id) : ''),
      };
      var children = raw && Array.isArray(raw.children) ? walk(raw.children) : [];
      if (children.length > 0) {
        node.children = children;
      } else {
        node.color = raw && raw.color ? raw.color : ENTITY_COLORS[colorIndex % ENTITY_COLORS.length];
        colorIndex += 1;
      }
      return node;
    });
  }
  return walk(nodes);
}

function validateTaxonomyNodes(nodes) {
  var entries = collectTaxonomyEntries(nodes);
  var seen = {};
  var error = '';
  if (entries.length === 0) error = state.lang === 'en' ? 'Add at least one label.' : '請至少新增一個標籤。';
  if (entries.length > TAXONOMY_MAX_NODES) error = state.lang === 'en' ? 'Taxonomy exceeds 500 nodes.' : '標籤樹不可超過 500 個節點。';
  entries.some(function(entry) {
    if (error) return true;
    var node = entry.node;
    var id = String(node.id || '').trim();
    var name = String(node.name || '').trim();
    if (!id || !name) { error = state.lang === 'en' ? 'Every node needs an ID and name.' : '每個節點都需要 ID 與顯示名稱。'; return true; }
    if (id.length > TAXONOMY_MAX_TEXT || name.length > TAXONOMY_MAX_TEXT) { error = state.lang === 'en' ? 'Node ID and name must be 100 characters or fewer.' : '節點 ID 與名稱不得超過 100 字。'; return true; }
    if (seen[id]) { error = state.lang === 'en' ? 'Node IDs must be unique across the tree.' : '節點 ID 必須在整棵樹中唯一。'; return true; }
    if (entry.depth > TAXONOMY_MAX_DEPTH) { error = state.lang === 'en' ? 'Taxonomy depth cannot exceed 8 levels.' : '標籤樹深度不可超過 8 層。'; return true; }
    if (!entry.isLeaf && node.color) { error = state.lang === 'en' ? 'Only leaf nodes may define a color.' : '只有葉節點可以設定顏色。'; return true; }
    seen[id] = true;
    return false;
  });
  return { valid: !error, error: error, entries: entries };
}

function buildTaxonomyFromPaths(paths) {
  var roots = [];
  var byId = {};
  var parentById = {};
  var error = '';
  (paths || []).forEach(function(path) {
    if (error || !Array.isArray(path) || path.length === 0 || path.length > TAXONOMY_MAX_DEPTH) {
      if (path && path.length > TAXONOMY_MAX_DEPTH) error = state.lang === 'en' ? 'Dataset paths cannot exceed 8 levels.' : '資料中的標籤路徑不可超過 8 層。';
      return;
    }
    var siblings = roots;
    var parentId = '$';
    path.forEach(function(rawId) {
      if (error) return;
      var id = String(rawId).trim();
      if (!id || id.length > TAXONOMY_MAX_TEXT) {
        error = state.lang === 'en' ? 'Dataset label IDs must contain 1–100 characters.' : '資料中的標籤 ID 長度需為 1–100 字。';
        return;
      }
      if (parentById[id] !== undefined && parentById[id] !== parentId) {
        error = state.lang === 'en' ? 'Dataset label IDs must be globally unique.' : '資料中的標籤 ID 必須在整棵樹中唯一。';
        return;
      }
      var node = byId[id];
      if (!node) {
        node = { id: id, name: id };
        byId[id] = node;
        parentById[id] = parentId;
        siblings.push(node);
      }
      if (!Array.isArray(node.children)) node.children = [];
      delete node.color;
      siblings = node.children;
      parentId = id;
    });
  });
  var leafIndex = 0;
  function finish(list) {
    list.forEach(function(node) {
      if (node.children && node.children.length > 0) finish(node.children);
      else {
        delete node.children;
        node.color = ENTITY_COLORS[leafIndex % ENTITY_COLORS.length];
        leafIndex += 1;
      }
    });
  }
  finish(roots);
  if (!error && collectTaxonomyEntries(roots).length > TAXONOMY_MAX_NODES) {
    error = state.lang === 'en' ? 'Dataset taxonomy exceeds 500 nodes.' : '資料中的標籤樹超過 500 個節點。';
  }
  return { nodes: roots, error: error };
}

function getMultiLabelDatasetPaths() {
  var column = getOutputFieldName('multi_label');
  if (!column) return { paths: [], error: '' };
  var paths = [];
  var shape = null;
  var error = '';
  getAllDatasetRecords().some(function(row) {
    var value = row[column];
    if (value == null || (Array.isArray(value) && value.length === 0)) return false;
    if (!Array.isArray(value)) { error = state.lang === 'en' ? 'Multi-label data must be an array.' : '多標籤資料必須是陣列。'; return true; }
    var currentShape = Array.isArray(value[0]) ? 'paths' : 'flat';
    if (shape && shape !== currentShape) { error = state.lang === 'en' ? 'Flat labels and hierarchical paths cannot be mixed.' : '同一欄位不可混用扁平標籤與階層路徑。'; return true; }
    shape = currentShape;
    value.forEach(function(item) {
      if (currentShape === 'paths') {
        if (!Array.isArray(item) || item.some(function(segment) { return typeof segment !== 'string' && typeof segment !== 'number'; })) {
          error = state.lang === 'en' ? 'Every hierarchical label must be an ID path.' : '每個階層標籤都必須是 ID 路徑。';
          return;
        }
        paths.push(item.map(String));
      } else {
        var scalar = scalarLabelValue(item);
        if (scalar === null) error = state.lang === 'en' ? 'Flat labels must be scalar values.' : '扁平標籤必須是純量值。';
        else paths.push([scalar]);
      }
    });
    return !!error;
  });
  return { paths: paths, error: error };
}

function findTaxonomyPosition(nodes, targetId, parent) {
  for (var i = 0; i < nodes.length; i++) {
    if (String(nodes[i].id) === String(targetId)) return { siblings: nodes, index: i, parent: parent || null };
    var children = Array.isArray(nodes[i].children) ? nodes[i].children : [];
    var found = findTaxonomyPosition(children, targetId, nodes[i]);
    if (found) return found;
  }
  return null;
}

function replaceSelectedTaxonomyId(oldId, newId) {
  var ps = state.previewState.multi_label;
  if (!ps || !Array.isArray(ps.selected)) return;
  ps.selected = ps.selected.map(function(path) {
    return Array.isArray(path) ? path.map(function(segment) { return segment === oldId ? newId : segment; }) : path;
  });
}

function clearSelectedTaxonomyBranch(nodeId) {
  var ps = state.previewState.multi_label;
  if (!ps || !Array.isArray(ps.selected)) return;
  ps.selected = ps.selected.filter(function(path) { return !Array.isArray(path) || path.indexOf(nodeId) === -1; });
}

function nextTaxonomyNodeId(nodes) {
  var used = {};
  collectTaxonomyEntries(nodes).forEach(function(entry) { used[String(entry.node.id)] = true; });
  var index = 1;
  while (used['label_' + index]) index += 1;
  return 'label_' + index;
}

/* Infer which output types each output column's first-row value shape can
   seed, so getOutputFieldValue(outKey) picks the right column when several
   columns are marked output (ADR-029 multi-output tasks) */
function rebuildColumnOutputTypeMap() {
  var rawRow = state.datasetRawFirstRow || {};
  var map = {};
  getFieldsByRole('output').forEach(function(col) {
    var v = rawRow[col];
    var types = [];
    if (Array.isArray(v) && v.length > 0) {
      var first = v[0];
      if (Array.isArray(first)) {
        types = ['multi_label'];
      } else if (typeof first === 'string') {
        /* FR-003d-2: a per-token tag array no longer seeds sequence_tagging --
           its pre-annotations are offset spans, detected in the object branch */
        types = ['multi_label'];
      } else if (first && typeof first === 'object') {
        if (first.entity1 || first.subj || first.target_text || first.aspect_text || first.opinion_text) types = ['relation_identification'];
        else if (first.label != null && first.start != null) types = ['sequence_tagging'];
        else if (first.text != null) types = ['entity_recognition'];
      }
    } else if (v && typeof v === 'object') {
      types = ['multi_dim'];
    } else if (typeof v === 'number') {
      types = ['single_dim', 'single_label'];
    } else if (typeof v === 'boolean') {
      types = ['single_label'];
    } else if (typeof v === 'string') {
      types = ['single_label', 'free_text'];
    }
    map[col] = types;
  });
  state.columnOutputTypeMap = map;
}

function autoPopulateSentencePairsConfig() {
  var inputFields = getFieldsByRole('input');
  var outputFields = getFieldsByRole('output');
  var evidenceFields = getFieldsByRole('evidence');
  var cfg = state.configData;
  if (!cfg.pair_mode) cfg.pair_mode = 'entailment';
  if (!cfg.response_format) cfg.response_format = 'classification';
  cfg.sentence_1_field = inputFields[0] || '';
  cfg.sentence_2_field = inputFields[1] || '';
  if (!cfg.sentence_1_label) cfg.sentence_1_label = cfg.sentence_1_field;
  if (!cfg.sentence_2_label) cfg.sentence_2_label = cfg.sentence_2_field;
  cfg.evidence_fields = evidenceFields;
  if (outputFields.length > 0 && (!Array.isArray(cfg.label_options) || cfg.label_options.length === 0)) {
    var uniqueVals = state.datasetColumnUniqueValues[outputFields[0]] || [];
    cfg.label_options = uniqueVals.length > 0 ? uniqueVals.slice() : [];
  }
  if (cfg.allow_unsure === undefined) cfg.allow_unsure = false;
  if (cfg.note_enabled === undefined) cfg.note_enabled = false;
}

/* ── Multi-output accordion builder (ADR-029) ─────────────────── */
function buildOutputAccordion(outKey, outReg, isCollapsed) {
  var accordion = document.createElement('div');
  accordion.className = 'output-accordion' + (isCollapsed ? ' collapsed' : '');
  accordion.setAttribute('data-output-key', outKey);

  var header = document.createElement('button');
  header.type = 'button';
  header.className = 'output-accordion-header';
  header.setAttribute('data-testid', 'output-accordion-toggle');
  header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

  var titleWrap = document.createElement('div');

  var titleRow = document.createElement('div');
  titleRow.className = 'output-accordion-title';

  var badge = document.createElement('span');
  badge.className = 'output-type-index-badge';
  badge.textContent = String(state.selectedOutputTypes.indexOf(outKey) + 1);
  titleRow.appendChild(badge);

  var titleText = document.createTextNode(outReg[state.lang] || outReg.zh || outKey);
  titleRow.appendChild(titleText);
  titleWrap.appendChild(titleRow);

  /* Dependency badge if this output type has a source */
  var sourceKey = OUTPUT_TYPE_DEPS[outKey] || (outReg && outReg.source_output);
  if (sourceKey && state.selectedOutputTypes.indexOf(sourceKey) >= 0) {
    var depSourceReg = OUTPUT_TYPE_REGISTRY[sourceKey];
    var depName = depSourceReg ? (depSourceReg[state.lang] || depSourceReg.zh) : sourceKey;
    var depBadge = document.createElement('div');
    depBadge.className = 'output-accordion-dep';
    depBadge.textContent = t('accordionDependsOn') + depName;
    titleWrap.appendChild(depBadge);
  }

  var chevron = document.createElement('span');
  chevron.className = 'output-accordion-chevron';
  chevron.textContent = '▾';

  header.appendChild(titleWrap);
  header.appendChild(chevron);
  accordion.appendChild(header);

  var body = document.createElement('div');
  body.className = 'output-accordion-body';
  body.id = 'output-accordion-body-' + outKey;
  header.setAttribute('aria-controls', body.id);
  accordion.appendChild(body);

  header.addEventListener('click', function() {
    accordion.classList.toggle('collapsed');
    header.setAttribute('aria-expanded', accordion.classList.contains('collapsed') ? 'false' : 'true');
  });

  return { accordion: accordion, body: body };
}

/* ── Item-pair display-name settings (input-level, not per output type) ── */
function buildItemPairLabelSection() {
  var card = document.createElement('div');
  card.className = 'output-accordion item-pair-labels-card';
  card.setAttribute('data-testid', 'item-pair-labels-card');

  var header = document.createElement('div');
  header.className = 'output-accordion-header item-pair-labels-header';
  var title = document.createElement('div');
  title.className = 'output-accordion-title';
  title.textContent = t('itemPairLabelsTitle');
  header.appendChild(title);
  card.appendChild(header);

  var body = document.createElement('div');
  body.className = 'output-accordion-body';

  if (!state.itemPairLabels) state.itemPairLabels = getItemPairLabels().slice();
  [t('itemPairLabel1'), t('itemPairLabel2')].forEach(function(labelText, i) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    var lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = labelText;
    var inputId = 'item-pair-label-input-' + (i + 1);
    lbl.htmlFor = inputId;
    wrap.appendChild(lbl);
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'entity-name-input';
    inp.style.cssText = 'width:100%;padding:8px 12px;';
    inp.id = inputId;
    inp.setAttribute('data-testid', inputId);
    inp.value = state.itemPairLabels[i] || '';
    inp.addEventListener('input', function() {
      state.itemPairLabels[i] = inp.value;
      markDirty(); updateAnnotationPreview();
    });
    wrap.appendChild(inp);
    body.appendChild(wrap);
  });
  card.appendChild(body);
  return card;
}

var regressionDimensionInputId = 0;

function buildRegressionDimensionSettings(config, settings) {
  var isMultiple = settings.mode === 'multiple';
  var dimensions = isMultiple
    ? (Array.isArray(config[settings.collectionKey]) ? config[settings.collectionKey] : [])
    : [{
        name: config[settings.nameKey],
        min: config[settings.minKey],
        max: config[settings.maxKey],
        step: config[settings.stepKey],
      }];
  if (isMultiple) config[settings.collectionKey] = dimensions;

  var labels = {
    name: { zh: '維度名稱', en: 'Dimension name' },
    min: { zh: '最小值', en: 'Min value' },
    max: { zh: '最大值', en: 'Max value' },
    step: { zh: '間距', en: 'Step' },
  };
  var defaults = { name: '', min: 1, max: 9, step: 1 };
  var testIds = {
    name: 'regression-dimension-name-input',
    min: 'regression-dimension-min-input',
    max: 'regression-dimension-max-input',
    step: 'regression-dimension-step-input',
  };
  var REMOVE_SVG = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var ADD_SVG = '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var list = document.createElement('div');
  list.className = 'regression-dimension-settings-list';
  list.setAttribute('data-testid', 'regression-dimension-settings-list');

  function syncDimension(index, property, value) {
    var normalized = property === 'name' ? value : (value === '' ? '' : Number(value));
    if (isMultiple) {
      dimensions[index][property] = normalized;
    } else {
      var configKey = settings[property + 'Key'];
      config[configKey] = normalized;
    }
    markDirty();
    updateAnnotationPreview();
    revalidateCurrentStep();
  }

  function makeField(index, property, value) {
    var field = document.createElement('div');
    field.className = 'form-field';

    regressionDimensionInputId += 1;
    var inputId = 'regression-dimension-setting-' + regressionDimensionInputId;
    var label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = inputId;
    label.textContent = labels[property][state.lang] || labels[property].zh;
    var required = document.createElement('span');
    required.className = 'required';
    required.textContent = '*';
    label.appendChild(required);
    field.appendChild(label);

    var input = document.createElement('input');
    input.id = inputId;
    input.type = property === 'name' ? 'text' : 'number';
    if (property !== 'name') input.step = 'any';
    input.className = 'entity-name-input';
    input.value = value != null ? value : defaults[property];
    input.setAttribute('data-testid', testIds[property]);
    input.addEventListener('input', function() {
      syncDimension(index, property, input.value);
    });
    field.appendChild(input);
    return field;
  }

  function renderCards() {
    while (list.firstChild) list.removeChild(list.firstChild);

    dimensions.forEach(function(dimension, index) {
      var card = document.createElement('div');
      card.className = 'regression-dimension-settings-card';
      card.setAttribute('data-testid', 'regression-dimension-settings-card');
      card.setAttribute(
        'aria-label',
        dimension.name || (state.lang === 'en' ? 'Unnamed dimension' : '未命名維度'),
      );

      if (isMultiple) {
        var removeButton = document.createElement('button');
        removeButton.className = 'entity-remove-btn regression-dimension-settings-remove';
        removeButton.type = 'button';
        removeButton.setAttribute('data-testid', 'regression-dimension-remove-btn');
        removeButton.setAttribute(
          'aria-label',
          state.lang === 'en' ? 'Remove dimension' : '移除維度',
        );
        removeButton.innerHTML = REMOVE_SVG;
        removeButton.addEventListener('click', function() {
          dimensions.splice(index, 1);
          renderCards();
          markDirty();
          updateAnnotationPreview();
          revalidateCurrentStep();
        });
        card.appendChild(removeButton);
      }

      card.appendChild(makeField(index, 'name', dimension.name));
      var numberGrid = document.createElement('div');
      numberGrid.className = 'regression-dimension-settings-number-grid';
      numberGrid.appendChild(makeField(index, 'min', dimension.min));
      numberGrid.appendChild(makeField(index, 'max', dimension.max));
      numberGrid.appendChild(makeField(index, 'step', dimension.step));
      card.appendChild(numberGrid);
      list.appendChild(card);
    });

    if (isMultiple) {
      var addButton = document.createElement('button');
      addButton.className = 'add-row-btn';
      addButton.type = 'button';
      addButton.setAttribute('data-testid', 'regression-dimension-add-btn');
      addButton.innerHTML = ADD_SVG;
      addButton.appendChild(
        document.createTextNode(' ' + (state.lang === 'en' ? 'Add dimension' : '新增維度')),
      );
      addButton.addEventListener('click', function() {
        dimensions.push({ name: '', min: 1, max: 9, step: 1 });
        renderCards();
        markDirty();
        updateAnnotationPreview();
        revalidateCurrentStep();
      });
      list.appendChild(addButton);
    }
  }

  renderCards();
  return list;
}

/* Lucide icon path data (design system: no text-glyph icons) */
function taxonomyIcon(paths, size) {
  return '<svg style="width:' + (size || 14) + 'px;height:' + (size || 14) + 'px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}
var ICON_CHEVRON_DOWN = taxonomyIcon('<path d="m6 9 6 6 6-6"/>');
var ICON_X = taxonomyIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

function buildTaxonomyTreeEditor(config, field, outKey) {
  var nodes = normalizeTaxonomyNodes(config[field.key]);
  config[field.key] = nodes;
  if (!config._taxonomyExpanded) config._taxonomyExpanded = {};
  var expanded = config._taxonomyExpanded;
  var ICON_PLUS = taxonomyIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');
  var ICON_CORNER_DOWN_RIGHT = taxonomyIcon('<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>');
  var ICON_ARROW_UP = taxonomyIcon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>');
  var ICON_ARROW_DOWN = taxonomyIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>');
  var ICON_TRASH = taxonomyIcon('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>');
  var editor = document.createElement('div');
  editor.className = 'taxonomy-editor';
  editor.setAttribute('data-testid', 'taxonomy-tree-editor');

  var tree = document.createElement('div');
  tree.className = 'taxonomy-tree';
  tree.setAttribute('role', 'tree');
  tree.setAttribute('aria-label', state.lang === 'en' ? 'Label taxonomy' : '標籤分類樹');
  editor.appendChild(tree);

  var live = document.createElement('div');
  live.className = 'taxonomy-live';
  live.setAttribute('aria-live', 'polite');
  editor.appendChild(live);

  function announce(zh, en) { live.textContent = state.lang === 'en' ? en : zh; }
  function sync() {
    config[field.key] = nodes;
    config._taxonomyError = '';
    markDirty();
    updateAnnotationPreview();
    revalidateCurrentStep();
  }
  function focusNode(nodeId) {
    setTimeout(function() {
      var target = tree.querySelector('[data-node-id="' + CSS.escape(String(nodeId)) + '"]');
      if (target) target.focus();
    }, 0);
  }
  function renderTree(focusId) {
    while (tree.firstChild) tree.removeChild(tree.firstChild);
    var validation = validateTaxonomyNodes(nodes);
    if (config._taxonomyError) validation = { valid: false, error: config._taxonomyError };

    function renderLevel(list, depth, parentNode, parentGroup) {
      list.forEach(function(node, index) {
        var children = Array.isArray(node.children) ? node.children : [];
        var isBranch = children.length > 0;
        if (expanded[node.id] === undefined) expanded[node.id] = true;

        var item = document.createElement('div');
        item.className = 'taxonomy-treeitem';
        item.setAttribute('role', 'treeitem');
        item.setAttribute('tabindex', tree.querySelector('[role="treeitem"]') ? '-1' : '0');
        item.setAttribute('aria-level', String(depth));
        item.setAttribute('aria-label', String(node.name || node.id || ''));
        item.setAttribute('data-testid', 'taxonomy-treeitem');
        item.setAttribute('data-node-id', String(node.id || ''));
        if (isBranch) item.setAttribute('aria-expanded', expanded[node.id] ? 'true' : 'false');

        var row = document.createElement('div');
        row.className = 'taxonomy-node-row';
        var descendantCount = collectTaxonomyEntries(children).length;

        if (isBranch) {
          var disclosure = document.createElement('button');
          disclosure.type = 'button';
          disclosure.className = 'taxonomy-disclosure';
          disclosure.innerHTML = ICON_CHEVRON_DOWN;
          disclosure.setAttribute('aria-label', expanded[node.id]
            ? (state.lang === 'en' ? 'Collapse ' : '收合 ') + (node.name || node.id)
            : (state.lang === 'en' ? 'Expand ' : '展開 ') + (node.name || node.id)
              + (state.lang === 'en' ? ', ' + descendantCount + ' labels inside' : '，含 ' + descendantCount + ' 個子標籤'));
          disclosure.setAttribute('aria-expanded', expanded[node.id] ? 'true' : 'false');
          disclosure.addEventListener('click', function() {
            expanded[node.id] = !expanded[node.id];
            renderTree(node.id);
          });
          row.appendChild(disclosure);
        } else {
          var disclosurePlaceholder = document.createElement('span');
          disclosurePlaceholder.className = 'taxonomy-disclosure-placeholder';
          row.appendChild(disclosurePlaceholder);
        }

        if (isBranch) {
          var branchDot = document.createElement('span');
          branchDot.className = 'taxonomy-branch-dot';
          branchDot.setAttribute('aria-hidden', 'true');
          /* Lucide "folder" — ADR-030: no hand-drawn glyphs */
          branchDot.innerHTML = taxonomyIcon('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>', 13);
          row.appendChild(branchDot);
        } else {
          var color = document.createElement('input');
          color.type = 'color';
          color.className = 'taxonomy-leaf-dot';
          color.value = node.color || ENTITY_COLORS[index % ENTITY_COLORS.length];
          color.setAttribute('aria-label', (state.lang === 'en' ? 'Color for ' : '顏色：') + (node.name || node.id));
          color.addEventListener('input', function() { node.color = color.value; sync(); });
          row.appendChild(color);
        }

        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'taxonomy-node-input';
        nameInput.value = node.name || '';
        nameInput.maxLength = TAXONOMY_MAX_TEXT;
        nameInput.placeholder = state.lang === 'en' ? 'Display name' : '顯示名稱';
        nameInput.setAttribute('data-testid', 'taxonomy-node-name-input');
        nameInput.setAttribute('aria-label', (state.lang === 'en' ? 'Display name ' : '顯示名稱 ') + (node.id || ''));
        nameInput.addEventListener('input', function() {
          node.name = nameInput.value;
          item.setAttribute('aria-label', node.name || node.id || '');
          sync();
        });
        var nameCell = document.createElement('div');
        nameCell.className = 'taxonomy-name-cell';
        nameCell.appendChild(nameInput);
        if (isBranch && !expanded[node.id]) {
          /* Count is voiced through the disclosure button's aria-label */
          var childCount = document.createElement('span');
          childCount.className = 'taxonomy-child-count';
          childCount.setAttribute('data-testid', 'taxonomy-child-count');
          childCount.setAttribute('aria-hidden', 'true');
          childCount.textContent = String(descendantCount);
          nameCell.appendChild(childCount);
        }
        row.appendChild(nameCell);

        var idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.className = 'taxonomy-node-input taxonomy-node-id';
        idInput.value = node.id || '';
        idInput.maxLength = TAXONOMY_MAX_TEXT;
        idInput.placeholder = 'node_id';
        idInput.setAttribute('data-testid', 'taxonomy-node-id-input');
        idInput.setAttribute('aria-label', (state.lang === 'en' ? 'Node ID ' : '節點 ID ') + (node.name || ''));
        idInput.addEventListener('input', function() {
          var oldId = String(node.id || '');
          node.id = idInput.value;
          replaceSelectedTaxonomyId(oldId, node.id);
          sync();
        });
        row.appendChild(idInput);

        var actions = document.createElement('div');
        actions.className = 'taxonomy-node-actions';

        function actionButton(iconSvg, label, className, handler) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'taxonomy-action-btn' + (className ? ' ' + className : '');
          button.innerHTML = iconSvg;
          button.title = label;
          button.setAttribute('aria-label', label + ' ' + (node.name || node.id || ''));
          button.addEventListener('click', handler);
          actions.appendChild(button);
          return button;
        }

        var addChild = actionButton(ICON_PLUS, state.lang === 'en' ? 'Add child to' : '新增子標籤至', '', function() {
          if (depth >= TAXONOMY_MAX_DEPTH || collectTaxonomyEntries(nodes).length >= TAXONOMY_MAX_NODES) {
            announce('已達標籤樹限制。', 'The taxonomy limit has been reached.');
            return;
          }
          var newId = nextTaxonomyNodeId(nodes);
          if (!Array.isArray(node.children)) node.children = [];
          if (node.children.length === 0) {
            delete node.color;
          }
          node.children.push({ id: newId, name: state.lang === 'en' ? 'New label' : '新標籤', color: ENTITY_COLORS[collectTaxonomyEntries(nodes).length % ENTITY_COLORS.length] });
          expanded[node.id] = true;
          sync();
          renderTree(newId);
          announce('已新增子標籤。', 'Child label added.');
        });
        addChild.setAttribute('data-testid', 'taxonomy-add-child-btn');
        addChild.disabled = depth >= TAXONOMY_MAX_DEPTH;

        actionButton(ICON_CORNER_DOWN_RIGHT, state.lang === 'en' ? 'Add sibling after' : '在後方新增同層標籤', '', function() {
          if (collectTaxonomyEntries(nodes).length >= TAXONOMY_MAX_NODES) return;
          var newId = nextTaxonomyNodeId(nodes);
          list.splice(index + 1, 0, { id: newId, name: state.lang === 'en' ? 'New label' : '新標籤', color: ENTITY_COLORS[collectTaxonomyEntries(nodes).length % ENTITY_COLORS.length] });
          sync();
          renderTree(newId);
          announce('已新增同層標籤。', 'Sibling label added.');
        });
        var up = actionButton(ICON_ARROW_UP, state.lang === 'en' ? 'Move up' : '上移', '', function() {
          if (index === 0) return;
          var moved = list.splice(index, 1)[0];
          list.splice(index - 1, 0, moved);
          sync(); renderTree(node.id);
        });
        up.disabled = index === 0;
        var down = actionButton(ICON_ARROW_DOWN, state.lang === 'en' ? 'Move down' : '下移', '', function() {
          if (index >= list.length - 1) return;
          var moved = list.splice(index, 1)[0];
          list.splice(index + 1, 0, moved);
          sync(); renderTree(node.id);
        });
        down.disabled = index >= list.length - 1;
        actionButton(ICON_TRASH, state.lang === 'en' ? 'Delete' : '刪除', 'danger', function() {
          var count = collectTaxonomyEntries([node]).length;
          var doDelete = function() {
            clearSelectedTaxonomyBranch(node.id);
            list.splice(index, 1);
            sync();
            renderTree(parentNode ? parentNode.id : (list[Math.max(0, index - 1)] || {}).id);
            announce('已刪除標籤。', 'Label deleted.');
          };
          if (count > 1) showTaxonomyDeleteModal(count - 1, doDelete);
          else doDelete();
        });
        row.appendChild(actions);
        item.appendChild(row);
        parentGroup.appendChild(item);

        if (isBranch && expanded[node.id]) {
          var group = document.createElement('div');
          group.className = 'taxonomy-children';
          group.setAttribute('role', 'group');
          renderLevel(children, depth + 1, node, group);
          item.appendChild(group);
        }

        item.addEventListener('keydown', function(event) {
          if (event.target !== item) return;
          var visible = Array.prototype.slice.call(tree.querySelectorAll('[role="treeitem"]'));
          var at = visible.indexOf(item);
          if (event.key === 'ArrowDown' && visible[at + 1]) { event.preventDefault(); visible[at + 1].focus(); }
          else if (event.key === 'ArrowUp' && visible[at - 1]) { event.preventDefault(); visible[at - 1].focus(); }
          else if (event.key === 'Home' && visible[0]) { event.preventDefault(); visible[0].focus(); }
          else if (event.key === 'End' && visible.length) { event.preventDefault(); visible[visible.length - 1].focus(); }
          else if (event.key === 'ArrowRight' && isBranch) {
            event.preventDefault();
            if (!expanded[node.id]) { expanded[node.id] = true; renderTree(node.id); }
            else {
              var firstChild = item.querySelector('[role="group"] > [role="treeitem"]');
              if (firstChild) firstChild.focus();
            }
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (isBranch && expanded[node.id]) { expanded[node.id] = false; renderTree(node.id); }
            else if (parentNode) focusNode(parentNode.id);
          }
        });
      });
    }

    renderLevel(nodes, 1, null, tree);
    if (!validation.valid) {
      var warning = document.createElement('div');
      warning.className = 'field-error show';
      warning.textContent = validation.error;
      tree.appendChild(warning);
    }
    if (focusId) focusNode(focusId);
  }

  var addRoot = document.createElement('button');
  addRoot.type = 'button';
  addRoot.className = 'add-row-btn taxonomy-add-root';
  addRoot.innerHTML = taxonomyIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 12) + ' ' + (field['addLabel_' + state.lang] || (state.lang === 'en' ? 'Add root label' : '新增根標籤'));
  addRoot.addEventListener('click', function() {
    if (collectTaxonomyEntries(nodes).length >= TAXONOMY_MAX_NODES) return;
    var newId = nextTaxonomyNodeId(nodes);
    nodes.push({ id: newId, name: state.lang === 'en' ? 'New label' : '新標籤', color: ENTITY_COLORS[collectTaxonomyEntries(nodes).length % ENTITY_COLORS.length] });
    sync(); renderTree(newId);
    announce('已新增根標籤。', 'Root label added.');
  });
  editor.appendChild(addRoot);
  renderTree();
  return editor;
}

/* ── Render schema fields for a single output type into a container ── */
/* Field hint as tooltip (registry hintAsTooltip): moves the label into a
 * .field-label-row with a "?" trigger; the bubble shows on hover/focus.
 * The bubble anchors to .tooltip-wrap so the arrow centers on the trigger. */
function outputFieldControlId(outKey, fieldKey) {
  return 'output-config-' + outKey.replace(/_/g, '-') + '-' + fieldKey.replace(/_/g, '-');
}

function attachFieldHintTooltip(wrap, lbl, field, outKey, hintId, describedEl) {
  var labelRow = document.createElement('div');
  labelRow.className = 'field-label-row';
  var helpBtn = document.createElement('button');
  helpBtn.className = 'field-help-tooltip';
  helpBtn.setAttribute('type', 'button');
  helpBtn.textContent = '?';
  helpBtn.setAttribute('data-testid', outKey.replace(/_/g, '-') + '-' + field.key.replace(/_/g, '-') + '-help');
  var hintBubble = document.createElement('p');
  hintBubble.className = 'tooltip-bubble';
  hintBubble.id = hintId;
  hintBubble.setAttribute('role', 'tooltip');
  hintBubble.textContent = field['hint_' + state.lang];
  helpBtn.setAttribute('aria-label', (state.lang === 'en' ? 'Help: ' : '說明：') + (field[state.lang] || field.zh));
  helpBtn.setAttribute('aria-describedby', hintBubble.id);
  if (describedEl) describedEl.setAttribute('aria-describedby', hintBubble.id);
  var tipWrap = document.createElement('span');
  tipWrap.className = 'tooltip-wrap';
  tipWrap.appendChild(helpBtn);
  tipWrap.appendChild(hintBubble);
  if (lbl) labelRow.appendChild(lbl);
  labelRow.appendChild(tipWrap);
  wrap.insertBefore(labelRow, wrap.firstChild);
}

function renderOutputTypeFields(container, outKey) {
  var outReg = OUTPUT_TYPE_REGISTRY[outKey];
  if (!outReg) return;

  /* Ensure outputConfigs[outKey] exists */
  state.outputConfigs[outKey] = normalizeOutputConfig(outKey, state.outputConfigs[outKey], state.lang);
  var cfg = state.outputConfigs[outKey];
  var dimensionFieldKeys = [];
  if (outReg.dimensionSettings) {
    container.appendChild(buildRegressionDimensionSettings(cfg, outReg.dimensionSettings));
    if (outReg.dimensionSettings.mode === 'multiple') {
      dimensionFieldKeys.push(outReg.dimensionSettings.collectionKey);
    } else {
      dimensionFieldKeys.push(
        outReg.dimensionSettings.nameKey,
        outReg.dimensionSettings.minKey,
        outReg.dimensionSettings.maxKey,
        outReg.dimensionSettings.stepKey,
      );
    }
  }

  outReg.fields.forEach(function(field, fieldIndex) {
    if (dimensionFieldKeys.indexOf(field.key) >= 0) return;
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    if (field.key === BYPASS_FIELD.key) wrap.classList.add('schema-bypass-field');
    /* Previous *rendered* field — dimension-settings fields are skipped above
       and must not count as the boolean's visual predecessor */
    var previousField = null;
    for (var prevIdx = fieldIndex - 1; prevIdx >= 0; prevIdx--) {
      if (dimensionFieldKeys.indexOf(outReg.fields[prevIdx].key) < 0) { previousField = outReg.fields[prevIdx]; break; }
    }
    /* The 12px separator marks where the boolean toggle group begins, so it
       belongs to the first boolean after any non-boolean field -- not only
       after an entity-list, which stopped being the predecessor once
       sequence_tagging and entity_recognition gained snap_unit (FR-003d-3). */
    if (field.type === 'boolean' && previousField && previousField.type !== 'boolean') {
      wrap.classList.add('schema-group-start-field');
    }
    if (field.type !== 'boolean') {
      var lbl = document.createElement('label');
      lbl.className = 'field-label';
      lbl.textContent = field[state.lang] || field.zh;
      if (field.required) {
        var req = document.createElement('span');
        req.className = 'required'; req.textContent = '*';
        lbl.appendChild(req);
      }
      wrap.appendChild(lbl);
    }

    if (field.type === 'taxonomy-tree') {
      var taxonomyEditor = buildTaxonomyTreeEditor(cfg, field, outKey);
      wrap.appendChild(taxonomyEditor);
      if (field.hintAsTooltip && field['hint_' + state.lang]) {
        var taxonomyHintId = outputFieldControlId(outKey, field.key) + '-hint';
        attachFieldHintTooltip(wrap, lbl, field, outKey, taxonomyHintId, taxonomyEditor);
      }
    } else if (field.type === 'entity-list') {
      /* Build entity list scoped to this output type's config */
      var entities = Array.isArray(cfg[field.key]) ? cfg[field.key] : [];
      cfg[field.key] = entities;
      var entityWrap = document.createElement('div');
      var REMOVE_SVG = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      var ADD_SVG = '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      (function(ents, capturedKey, capturedWrap) {
        function renderEntityRows() {
          while (capturedWrap.firstChild) capturedWrap.removeChild(capturedWrap.firstChild);
          ents.forEach(function(ent, i) {
            var row = document.createElement('div');
            row.className = 'entity-row';
            var dot = document.createElement('div');
            dot.className = 'entity-color-dot';
            dot.style.background = ent.color || ENTITY_COLORS[i % ENTITY_COLORS.length];
            var nameInp = document.createElement('input');
            nameInp.type = 'text'; nameInp.className = 'entity-name-input';
            nameInp.value = ent.name;
            nameInp.placeholder = state.lang === 'en' ? 'Entity name' : '實體名稱';
            (function(idx) {
              nameInp.addEventListener('input', function() {
                ents[idx].name = nameInp.value;
                markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
              });
            }(i));
            var rmBtn = document.createElement('button');
            rmBtn.className = 'entity-remove-btn';
            rmBtn.setAttribute('aria-label', '移除');
            rmBtn.setAttribute('type', 'button');
            rmBtn.innerHTML = REMOVE_SVG;
            (function(idx) {
              rmBtn.addEventListener('click', function() {
                ents.splice(idx, 1);
                renderEntityRows(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
              });
            }(i));
            row.appendChild(dot); row.appendChild(nameInp); row.appendChild(rmBtn);
            capturedWrap.appendChild(row);
          });
          var addBtn = document.createElement('button');
          addBtn.className = 'add-row-btn';
          addBtn.setAttribute('type', 'button');
          addBtn.innerHTML = ADD_SVG;
          addBtn.appendChild(document.createTextNode(' ' + (field['addLabel_' + state.lang] || t('addEntity'))));
          addBtn.addEventListener('click', function() {
            ents.push({ name: '', color: ENTITY_COLORS[ents.length % ENTITY_COLORS.length] });
            renderEntityRows(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
          });
          capturedWrap.appendChild(addBtn);
        }
        renderEntityRows();
      }(entities, field.key, entityWrap));
      wrap.appendChild(entityWrap);
    } else if (field.type === 'tag-list') {
      /* Build tag list scoped to this output type's config */
      var tags = Array.isArray(cfg[field.key]) ? cfg[field.key].slice() : [];
      cfg[field.key] = tags;
      var isComposing = false;
      var tagWrap = document.createElement('div');
      tagWrap.className = 'tag-input-wrap';
      (function(tagsArr, tw) {
        function renderTags() {
          while (tw.firstChild) tw.removeChild(tw.firstChild);
          tagsArr.forEach(function(tag, i) {
            var pill = document.createElement('span');
            pill.className = 'tag-pill';
            pill.appendChild(document.createTextNode(tag));
            var rm = document.createElement('button');
            rm.className = 'tag-pill-remove';
            rm.setAttribute('aria-label', '移除');
            rm.setAttribute('type', 'button');
            rm.innerHTML = '<svg style="width:10px;height:10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            (function(idx) {
              rm.addEventListener('click', function() {
                tagsArr.splice(idx, 1);
                renderTags(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
              });
            }(i));
            pill.appendChild(rm);
            tw.appendChild(pill);
          });
          var inp = document.createElement('input');
          inp.type = 'text'; inp.className = 'tag-new-input';
          inp.placeholder = ('placeholder_' + state.lang) in field ? field['placeholder_' + state.lang] : (field['hint_' + state.lang] || '');
          inp.addEventListener('compositionstart', function() { isComposing = true; });
          inp.addEventListener('compositionend', function() { isComposing = false; });
          inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ',') {
              if (e.isComposing || isComposing || e.keyCode === 229) return;
              e.preventDefault();
              var val = inp.value.trim();
              if (val && tagsArr.indexOf(val) === -1) {
                tagsArr.push(val);
                inp.value = '';
                renderTags();
                setTimeout(function() { var ni = tw.querySelector('.tag-new-input'); if (ni) ni.focus(); }, 0);
                markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
              }
            }
          });
          tw.appendChild(inp);
        }
        renderTags();
      }(tags, tagWrap));
      if (field['hint_' + state.lang]) {
        var hint = document.createElement('div');
        hint.className = 'field-hint';
        hint.textContent = field['hint_' + state.lang];
        wrap.appendChild(tagWrap);
        wrap.appendChild(hint);
        container.appendChild(wrap);
        return;
      }
      wrap.appendChild(tagWrap);
    } else if (field.type === 'va-dimensions') {
      var dims = Array.isArray(cfg[field.key]) ? cfg[field.key] : [];
      cfg[field.key] = dims;
      var dimWrap = document.createElement('div');
      dimWrap.className = 'va-dim-list';
      var REMOVE_SVG_D = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      var ADD_SVG_D = '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      var dimLabels = {
        name: { zh: '維度名稱', en: 'Dimension name' },
        min:  { zh: '最小值', en: 'Min value' },
        max:  { zh: '最大值', en: 'Max value' },
        step: { zh: '間距', en: 'Step' },
      };
      (function(dimArr, dw) {
        function makeLabeledInput(labelObj, inputType, value, placeholder, required) {
          var ff = document.createElement('div');
          ff.className = 'form-field';
          var lbl = document.createElement('label');
          lbl.className = 'field-label';
          lbl.textContent = labelObj[state.lang] || labelObj.zh;
          if (required) { var req = document.createElement('span'); req.className = 'required'; req.textContent = '*'; lbl.appendChild(req); }
          ff.appendChild(lbl);
          var inp = document.createElement('input');
          inp.type = inputType; inp.className = 'entity-name-input';
          inp.style.cssText = 'width:100%;padding:8px 12px;';
          inp.value = value != null ? value : '';
          if (placeholder) inp.placeholder = placeholder;
          ff.appendChild(inp);
          return { wrapper: ff, input: inp };
        }
        function renderDimRows() {
          while (dw.firstChild) dw.removeChild(dw.firstChild);
          dimArr.forEach(function(dim, i) {
            var card = document.createElement('div');
            card.style.cssText = 'border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:12px;position:relative;background:var(--color-slate-50);';
            var rmBtn = document.createElement('button');
            rmBtn.className = 'entity-remove-btn';
            rmBtn.setAttribute('aria-label', '移除');
            rmBtn.setAttribute('type', 'button');
            rmBtn.style.cssText = 'position:absolute;top:8px;right:8px;';
            rmBtn.innerHTML = REMOVE_SVG_D;
            (function(idx) { rmBtn.addEventListener('click', function() { dimArr.splice(idx, 1); renderDimRows(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep(); }); }(i));
            card.appendChild(rmBtn);
            var nameF = makeLabeledInput(dimLabels.name, 'text', dim.name, '', true);
            var minF  = makeLabeledInput(dimLabels.min, 'number', dim.min != null ? dim.min : 1, '', true);
            var maxF  = makeLabeledInput(dimLabels.max, 'number', dim.max != null ? dim.max : 9, '', true);
            var stepF = makeLabeledInput(dimLabels.step, 'number', dim.step != null ? dim.step : 1, '', true);
            (function(idx) {
              function sync() { dimArr[idx] = { name: nameF.input.value, min: +minF.input.value, max: +maxF.input.value, step: +stepF.input.value }; markDirty(); updateAnnotationPreview(); revalidateCurrentStep(); }
              nameF.input.addEventListener('input', sync);
              minF.input.addEventListener('input', sync);
              maxF.input.addEventListener('input', sync);
              stepF.input.addEventListener('input', sync);
            }(i));
            card.appendChild(nameF.wrapper);
            var numRow = document.createElement('div');
            numRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;';
            numRow.appendChild(minF.wrapper); numRow.appendChild(maxF.wrapper); numRow.appendChild(stepF.wrapper);
            card.appendChild(numRow);
            dw.appendChild(card);
          });
          var addBtn = document.createElement('button');
          addBtn.className = 'add-row-btn';
          addBtn.setAttribute('type', 'button');
          addBtn.innerHTML = ADD_SVG_D;
          addBtn.appendChild(document.createTextNode(' ' + (state.lang === 'en' ? 'Add dimension' : '新增維度')));
          addBtn.addEventListener('click', function() {
            dimArr.push({ name: '', min: 1, max: 9, step: 1 });
            renderDimRows(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
          });
          dw.appendChild(addBtn);
        }
        renderDimRows();
      }(dims, dimWrap));
      wrap.appendChild(dimWrap);
    } else if (field.type === 'select') {
      var sel = document.createElement('select');
      sel.className = 'select-field';
      sel.style.cssText = 'width:100%;padding:8px 12px;border:1.5px solid var(--color-border);border-radius:var(--radius-md);font-size:0.9rem;';
      sel.setAttribute('data-testid', field.testId || (outKey.replace(/_/g, '-') + '-' + field.key.replace(/_/g, '-') + '-select'));
      var selectLabels = (field.optionLabels && field.optionLabels[state.lang]) || {};
      var selectedValue = getOutputConfigFieldValue(cfg, field);
      (field.options || []).forEach(function(opt) {
        var option = document.createElement('option');
        option.value = opt; option.textContent = selectLabels[opt] || opt;
        if ((selectedValue || field.defaultValue) === opt) option.selected = true;
        sel.appendChild(option);
      });
      (function(capturedCfg, capturedField) {
        sel.addEventListener('change', function() {
          setOutputConfigFieldValue(capturedCfg, capturedField, sel.value);
          var capturedRegistry = OUTPUT_TYPE_REGISTRY[outKey];
          if (capturedRegistry && typeof capturedRegistry.normalizeConfig === 'function') {
            state.outputConfigs[outKey] = capturedRegistry.normalizeConfig(capturedCfg, state.lang);
          }
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(cfg, field));
      wrap.appendChild(sel);
    } else if (field.type === 'number') {
      var numInp = document.createElement('input');
      numInp.type = 'number';
      numInp.className = 'entity-name-input';
      numInp.style.cssText = 'width:100%;padding:8px 12px;';
      numInp.value = cfg[field.key] != null ? cfg[field.key] : (field.defaultValue != null ? field.defaultValue : '');
      if (field.min != null) numInp.min = field.min;
      (function(capturedCfg, capturedKey) {
        numInp.addEventListener('input', function() {
          capturedCfg[capturedKey] = +numInp.value;
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(cfg, field.key));
      wrap.appendChild(numInp);
    } else if (field.type === 'text') {
      var textInp = document.createElement('input');
      textInp.type = 'text';
      textInp.className = 'entity-name-input';
      textInp.style.cssText = 'width:100%;padding:8px 12px;';
      textInp.value = cfg[field.key] || field.defaultValue || '';
      textInp.placeholder = field[state.lang] || field.zh || '';
      var textControlId = outputFieldControlId(outKey, field.key);
      textInp.id = textControlId;
      textInp.setAttribute('data-testid', outKey.replace(/_/g, '-') + '-' + field.key.replace(/_/g, '-') + '-input');
      if (field.maxLength != null) textInp.maxLength = field.maxLength;
      if (lbl) lbl.htmlFor = textControlId;
      (function(capturedCfg, capturedKey) {
        textInp.addEventListener('input', function() {
          capturedCfg[capturedKey] = textInp.value;
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(cfg, field.key));
      wrap.appendChild(textInp);
      if (field['hint_' + state.lang]) {
        if (field.hintAsTooltip) {
          attachFieldHintTooltip(wrap, lbl, field, outKey, textControlId + '-hint', textInp);
        } else {
          var textHint = document.createElement('div');
          textHint.className = 'field-hint';
          textHint.id = textControlId + '-hint';
          textHint.textContent = field['hint_' + state.lang];
          textInp.setAttribute('aria-describedby', textHint.id);
          wrap.appendChild(textHint);
        }
      }
    } else if (field.type === 'boolean') {
      var card = document.createElement('label');
      card.className = 'schema-toggle-card';
      var checkedVal = !!(cfg[field.key] !== undefined ? cfg[field.key] : field.defaultValue);
      if (checkedVal) card.classList.add('is-on');
      var copy = document.createElement('span');
      copy.className = 'schema-toggle-copy';
      var titleEl = document.createElement('span');
      titleEl.className = 'schema-toggle-label';
      titleEl.textContent = field[state.lang] || field.zh;
      copy.appendChild(titleEl);
      var statusEl = document.createElement('span');
      statusEl.className = 'schema-toggle-status';
      statusEl.textContent = checkedVal ? t('enabled') : t('disabled');
      copy.appendChild(statusEl);
      var sw = document.createElement('span');
      sw.className = 'toggle-switch';
      var chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = checkedVal;
      var slider = document.createElement('span');
      slider.className = 'toggle-slider';
      (function(capturedCfg, capturedKey) {
        chk.addEventListener('change', function() {
          capturedCfg[capturedKey] = chk.checked;
          statusEl.textContent = chk.checked ? t('enabled') : t('disabled');
          card.classList.toggle('is-on', chk.checked);
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(cfg, field.key));
      sw.appendChild(chk); sw.appendChild(slider);
      card.appendChild(copy); card.appendChild(sw);
      wrap.appendChild(card);
    }
    container.appendChild(wrap);
  });
}

/* ── Dataset-aware preview text helper ── */
function getDatasetPreviewText() {
  var raw = state.datasetRawFirstRow;
  if (!raw || !Object.keys(raw).length) return null;
  var inputCols = state.datasetParsedColumns.filter(function(col) {
    return state.fieldRoleMap[col] === 'input';
  });
  if (inputCols.length > 0) {
    /* Once Input roles are assigned, never fall back to other columns —
       the longest-string fallback could surface Evidence or Output data */
    var vals = inputCols.map(function(col) {
      var v = raw[col];
      if (v === undefined || v === null) return null;
      return (typeof v === 'string') ? v : String(v);
    }).filter(function(v) { return v !== null && v !== ''; });
    if (vals.length > 0) return vals.join('\n');
    return null;
  }
  var bestCol = null;
  var bestLen = 0;
  for (var i = 0; i < state.datasetParsedColumns.length; i++) {
    var col = state.datasetParsedColumns[i];
    var v = raw[col];
    if (typeof v === 'string' && v.length > bestLen) {
      bestCol = col;
      bestLen = v.length;
    }
  }
  if (bestCol && bestLen > 5) return raw[bestCol];
  return null;
}

function getDatasetPairTexts() {
  var raw = state.datasetRawFirstRow;
  if (!raw || !Object.keys(raw).length) return null;
  var inputCols = state.datasetParsedColumns.filter(function(col) {
    return state.fieldRoleMap[col] === 'input';
  });
  if (inputCols.length >= 2) {
    var v1 = raw[inputCols[0]]; var v2 = raw[inputCols[1]];
    return { text1: String(v1 !== undefined && v1 !== null ? v1 : ''), text2: String(v2 !== undefined && v2 !== null ? v2 : ''), col1: inputCols[0], col2: inputCols[1] };
  }
  return null;
}

/* Effective item_pair display names: the user-edited Step 2 values, falling
   back per slot to the dataset input column name when unset or blank. */
function getItemPairLabels() {
  var pairTexts = getDatasetPairTexts();
  var defaults = [
    pairTexts ? pairTexts.col1 : (state.lang === 'en' ? 'Sentence A' : '句子 A'),
    pairTexts ? pairTexts.col2 : (state.lang === 'en' ? 'Sentence B' : '句子 B'),
  ];
  var edited = state.itemPairLabels || [];
  return [
    (typeof edited[0] === 'string' && edited[0].trim()) ? edited[0].trim() : defaults[0],
    (typeof edited[1] === 'string' && edited[1].trim()) ? edited[1].trim() : defaults[1],
  ];
}

function normalizeRegressionValue(rawValue, min, max) {
  if (String(rawValue).trim() === '') return null;
  var numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, numeric));
}

function countRegressionDecimals(value) {
  var text = String(value);
  var decimalIndex = text.indexOf('.');
  return decimalIndex === -1 ? 0 : text.length - decimalIndex - 1;
}

function syncRegressionSliderValue(slider, valueLabel, valueInput, updateValueInput) {
  var min = parseFloat(slider.min);
  var max = parseFloat(slider.max);
  var value = parseFloat(slider.value);
  var ratio = max > min ? (value - min) / (max - min) : 0;
  var thumbSize = 18;
  valueLabel.textContent = slider.value;
  valueLabel.style.left = 'calc(' + (ratio * 100) + '% + ' + ((thumbSize / 2) - (ratio * thumbSize)) + 'px)';
  if (valueInput && updateValueInput !== false) valueInput.value = slider.value;
}

function createRegressionSliderControl(options) {
  var control = document.createElement('div');
  control.className = 'regression-slider-control regression-dimension-color-' + (options.colorIndex % 8);

  var shell = document.createElement('div');
  shell.className = 'regression-slider-shell';

  var minLabel = document.createElement('span');
  minLabel.className = 'regression-slider-bound';
  minLabel.textContent = options.min;

  var field = document.createElement('div');
  field.className = 'regression-slider-field';

  var valueLabel = document.createElement('output');
  valueLabel.className = 'regression-slider-value';
  valueLabel.setAttribute('aria-live', 'polite');
  if (options.valueTestId) valueLabel.setAttribute('data-testid', options.valueTestId);

  var slider = document.createElement('input');
  slider.className = 'regression-slider-input';
  slider.type = 'range';
  slider.min = options.min;
  slider.max = options.max;
  slider.step = 'any';
  slider.dataset.configStep = String(options.step);
  slider.value = options.value;
  slider.setAttribute('aria-label', options.ariaLabel);
  if (options.inputTestId) slider.setAttribute('data-testid', options.inputTestId);

  var valueInput = document.createElement('input');
  valueInput.className = 'regression-value-input';
  valueInput.type = 'number';
  valueInput.inputMode = 'decimal';
  valueInput.min = options.min;
  valueInput.max = options.max;
  valueInput.step = 'any';
  valueInput.value = slider.value;
  valueInput.setAttribute(
    'aria-label',
    options.ariaLabel + (state.lang === 'zh' ? ' 數值輸入' : ' value input')
  );
  if (options.numericInputTestId) {
    valueInput.setAttribute('data-testid', options.numericInputTestId);
  }

  function publishSliderValue() {
    syncRegressionSliderValue(slider, valueLabel, valueInput);
    if (options.onInput) options.onInput(slider.value);
  }

  slider.addEventListener('input', publishSliderValue);
  slider.addEventListener('pointerdown', function() {
    slider.step = slider.dataset.configStep;
  });
  slider.addEventListener('pointerup', function() {
    slider.step = 'any';
  });
  slider.addEventListener('pointercancel', function() {
    slider.step = 'any';
  });
  slider.addEventListener('keydown', function(event) {
    var direction = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = -1;
    var nextValue = null;
    if (direction !== 0) {
      var configuredStep = parseFloat(slider.dataset.configStep);
      var precision = Math.max(
        countRegressionDecimals(slider.value),
        countRegressionDecimals(configuredStep)
      );
      nextValue = Number(
        (parseFloat(slider.value) + direction * configuredStep).toFixed(precision)
      );
    } else if (event.key === 'Home') {
      nextValue = parseFloat(slider.min);
    } else if (event.key === 'End') {
      nextValue = parseFloat(slider.max);
    }
    if (nextValue !== null) {
      event.preventDefault();
      slider.step = 'any';
      slider.value = String(normalizeRegressionValue(
        nextValue,
        parseFloat(slider.min),
        parseFloat(slider.max)
      ));
      publishSliderValue();
    }
  });

  function commitNumericValue() {
    var normalized = normalizeRegressionValue(
      valueInput.value,
      parseFloat(slider.min),
      parseFloat(slider.max)
    );
    if (normalized === null) {
      valueInput.value = slider.value;
      return;
    }
    slider.value = String(normalized);
    syncRegressionSliderValue(slider, valueLabel, valueInput);
    if (options.onInput) options.onInput(slider.value);
  }

  valueInput.addEventListener('input', function() {
    var numeric = Number(valueInput.value);
    var normalized = normalizeRegressionValue(
      valueInput.value,
      parseFloat(slider.min),
      parseFloat(slider.max)
    );
    if (normalized !== null && Math.abs(normalized - numeric) < 0.0000001) {
      slider.value = String(normalized);
      syncRegressionSliderValue(slider, valueLabel, valueInput, false);
      if (options.onInput) options.onInput(slider.value);
    }
  });
  valueInput.addEventListener('change', commitNumericValue);
  valueInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitNumericValue();
    }
  });

  field.appendChild(valueLabel);
  field.appendChild(slider);
  shell.appendChild(minLabel);
  shell.appendChild(field);
  shell.appendChild(valueInput);
  control.appendChild(shell);
  syncRegressionSliderValue(slider, valueLabel, valueInput);

  return control;
}

/* ── Multi-dim (VA regression) preview ── */
function renderMultiDimPreview(container, config, outKey) {
  var dims = Array.isArray(config.dimensions) ? config.dimensions : (Array.isArray(config.va_dimensions) ? config.va_dimensions : []);
  if (dims.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'annotation-preview-empty';
    empty.textContent = state.lang === 'zh' ? '請先新增維度' : 'Add dimensions first';
    container.appendChild(empty);
    return;
  }
  var outputVal = getOutputFieldValue(outKey);
  var outputObj = null;
  if (outputVal) { try { outputObj = JSON.parse(outputVal); } catch(e) { /* not JSON */ } }
  /* sliders are DOM-only; while bypassed, seed from midpoints instead of the output column */
  if (state.previewBypass[outKey]) outputObj = null;
  dims.forEach(function(dim, dimensionIndex) {
    var dimWrap = document.createElement('div');
    dimWrap.className = 'regression-slider-control regression-dimension-color-' + (dimensionIndex % 8);
    dimWrap.style.cssText = 'margin-bottom:16px;';
    var label = document.createElement('div');
    label.className = 'regression-dimension-title';
    var colorDot = document.createElement('span');
    colorDot.className = 'regression-dimension-dot';
    colorDot.setAttribute('aria-hidden', 'true');
    label.appendChild(colorDot);
    label.appendChild(document.createTextNode(dim.name || '(unnamed)'));
    dimWrap.appendChild(label);
    var dMin = dim.min != null ? dim.min : 1;
    var dMax = dim.max != null ? dim.max : 9;
    var dStep = dim.step != null ? dim.step : 1;
    var initVal = dMin + Math.round(((dMax - dMin) / 2) / dStep) * dStep;
    if (outputObj && dim.name && outputObj[dim.name] != null) {
      var n = parseFloat(outputObj[dim.name]);
      if (!isNaN(n) && n >= dMin && n <= dMax) initVal = dMin + Math.round((n - dMin) / dStep) * dStep;
    }
    var sliderControl = createRegressionSliderControl({
      min: dMin,
      max: dMax,
      step: dStep,
      value: initVal,
      colorIndex: dimensionIndex,
      inputTestId: 'multi-dim-slider',
      valueTestId: 'multi-dim-value-tooltip',
      numericInputTestId: 'multi-dim-value-input',
      ariaLabel: dim.name || (state.lang === 'zh' ? '未命名維度' : 'Unnamed dimension')
    });
    dimWrap.appendChild(sliderControl.firstChild);
    dimWrap.setAttribute('data-testid', 'multi-dim-control');
    container.appendChild(dimWrap);
  });
}

/* ── Interactive unified preview (Entity Recognition + Relation Identification) ── */
function initPreviewState() {
  var rawRow = state.datasetRawFirstRow || {};
  var spanCfg = state.outputConfigs['entity_recognition'] || {};
  var relCfg = state.outputConfigs['relation_identification'] || {};
  var cfgEntities = Array.isArray(spanCfg.entities) ? spanCfg.entities.filter(function(e) { return e && e.name; }) : [];
  var relationTypes = Array.isArray(relCfg.relation_types) ? relCfg.relation_types.filter(Boolean) : [];

  var outputVal = getOutputFieldValue();
  var outputParsed = null;
  if (outputVal) { try { outputParsed = JSON.parse(outputVal); } catch(e) { /* not JSON */ } }

  var dataEnts = Array.isArray(rawRow.entities) ? rawRow.entities : [];
  if (dataEnts.length === 0 && Array.isArray(outputParsed) && outputParsed.length > 0 && outputParsed[0].text) {
    dataEnts = outputParsed;
  }
  if (dataEnts.length > 0) {
    state.previewEntities = dataEnts.map(function(e) { return { text: e.text, type: e.type, start: e.start, end: e.end }; });
  } else {
    state.previewEntities = [];
  }

  /* Pick the first candidate triple array whose elements match a supported
     shape, independent of the field name it was stored under */
  function tripleShapeOf(arr) {
    if (!Array.isArray(arr) || arr.length === 0 || !arr[0] || typeof arr[0] !== 'object') return null;
    if (arr[0].entity1) return 'ner';
    if (arr[0].subj) return 'gold';
    if (arr[0].target_text || arr[0].aspect_text || arr[0].opinion_text) return 'absa';
    return null;
  }
  var trips = [], tripShape = null;
  [rawRow.triples, rawRow.gold_triplets, rawRow.gold_triples, outputParsed].some(function(cand) {
    var shape = tripleShapeOf(cand);
    if (shape) { trips = cand; tripShape = shape; return true; }
    return false;
  });
  var nameTarget = (cfgEntities[0] && cfgEntities[0].name) || 'target';
  var nameAspect = (cfgEntities[1] && cfgEntities[1].name) || 'aspect';
  var nameOpinion = (cfgEntities[2] && cfgEntities[2].name) || 'opinion';
  var sampleRel1 = relationTypes[0] || 'has_aspect';
  var sampleRel2 = relationTypes[1] || 'has_opinion';

  if (tripShape === 'ner') {
    state.previewTriples = trips.map(function(trip) {
      var e1 = trip.entity1 || {}, rel = trip.relation || {}, e2 = trip.entity2 || {};
      function fmt(o) { var s = o.text || '?'; if (o.start != null && o.end != null) s += ' (' + o.start + ',' + o.end + ')'; return s; }
      return {
        subj: fmt(e1), rel: fmt(rel), obj: fmt(e2), relType: trip.relation_type || null,
        subjStart: e1.start != null ? e1.start : null, subjEnd: e1.end != null ? e1.end : null,
        objStart: e2.start != null ? e2.start : null, objEnd: e2.end != null ? e2.end : null
      };
    });
  } else if (tripShape === 'gold') {
    state.previewTriples = trips.map(function(trip) {
      return {
        subj: trip.subj || '?', rel: trip.rel || '?', obj: trip.obj || '?', relType: trip.relation_type || null,
        subjStart: null, subjEnd: null, objStart: null, objEnd: null
      };
    });
  } else if (tripShape === 'absa') {
    state.previewTriples = [];
    trips.forEach(function(trip) {
      var tgt = trip.target_text || '?', asp = trip.aspect_text || '', opn = trip.opinion_text || '';
      if (asp) state.previewTriples.push({ subj: tgt + '/' + nameTarget, rel: sampleRel1, obj: asp + '/' + nameAspect, subjStart: null, subjEnd: null, objStart: null, objEnd: null });
      if (opn) state.previewTriples.push({ subj: tgt + '/' + nameTarget, rel: sampleRel2, obj: opn + '/' + nameOpinion, subjStart: null, subjEnd: null, objStart: null, objEnd: null });
    });
  } else {
    state.previewTriples = [];
  }

  state.relDraft = { e1: null, rel: null, e2: null };
  state.relSel = null;
  state.relMsg = '';
  if (state.previewState.entity_recognition) state.previewState.entity_recognition.pendingSelection = null;
  state.previewInited = true;
}

function getPreviewTypeColorMap() {
  var map = {}, order = [];
  var spanCfg = state.outputConfigs['entity_recognition'] || {};
  var cfgEntities = Array.isArray(spanCfg.entities) ? spanCfg.entities.filter(function(e) { return e && e.name; }) : [];
  cfgEntities.forEach(function(e) { if (e.name && !map[e.name]) { map[e.name] = safeCssColor(e.color, ENTITY_COLORS[order.length % ENTITY_COLORS.length]); order.push(e.name); } });
  state.previewEntities.forEach(function(e) { if (e.type && !map[e.type]) { map[e.type] = ENTITY_COLORS[order.length % ENTITY_COLORS.length]; order.push(e.type); } });
  return { map: map, order: order };
}

/* Format a span slot ({text,start,end}) as "詞 (start,end)" for display and triple storage. */
function fmtRelSpan(slot) {
  if (!slot) return '';
  var s = slot.text || '?';
  if (slot.start != null && slot.end != null) s += ' (' + slot.start + ',' + slot.end + ')';
  return s;
}

/* Sequential relation builder: E1/Arg1 → Relation → E2/Arg2 → Undo → Add.
   Each step consumes the current passage selection (state.relSel). E1/E2 must
   match an already-marked entity; Relation accepts any trigger-word span. */
function buildRelationStateMachine(container, relationTypes, refresh, allowEntityEditing) {
  var d = state.relDraft;

  var rbTitle = document.createElement('div');
  rbTitle.className = 'annotation-preview-task-title';
  rbTitle.style.marginBottom = '6px';
  rbTitle.textContent = state.lang === 'zh' ? '關係類型' : 'Relation Type';
  container.appendChild(rbTitle);

  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:0.75rem;color:var(--color-text-soft);margin-bottom:8px;line-height:1.7;';
  hint.textContent = state.lang === 'zh'
    ? '在上方文字中反白選取後，依序按下按鈕：實體 → E1/Arg1、關係觸發詞 → Relation、實體 → E2/Arg2，最後按「新增」。'
    : 'Select text above, then click in order: entity → E1/Arg1, trigger word → Relation, entity → E2/Arg2, then Add.';
  container.appendChild(hint);

  /* Current-selection + draft status */
  var status = document.createElement('div');
  status.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px;font-size:0.75rem;';
  function chip(label, slot, active) {
    var c = document.createElement('span');
    var filled = !!slot;
    c.style.cssText = 'display:inline-flex;gap:4px;padding:2px 8px;border-radius:999px;border:1.5px solid ' + (active ? 'var(--color-primary)' : 'var(--color-border)') + ';background:' + (filled ? 'var(--color-primary-soft-bg)' : 'transparent') + ';color:' + (filled ? 'var(--color-primary)' : 'var(--color-text-soft)') + ';font-weight:600;';
    c.textContent = label + '：' + (filled ? fmtRelSpan(slot) : '—');
    return c;
  }
  status.appendChild(chip('E1', d.e1, !d.e1));
  status.appendChild(chip('Rel', d.rel, !!d.e1 && !d.rel));
  status.appendChild(chip('E2', d.e2, !!d.rel && !d.e2));
  var selBadge = document.createElement('span');
  selBadge.style.cssText = 'margin-left:auto;color:var(--color-text-soft);';
  selBadge.textContent = (state.lang === 'zh' ? '目前選取：' : 'Selection: ') + (state.relSel ? fmtRelSpan(state.relSel) : (state.lang === 'zh' ? '（無）' : '(none)'));
  status.appendChild(selBadge);
  container.appendChild(status);

  /* Button row */
  var rbRow = document.createElement('div');
  rbRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;';
  function findEntitySlot() {
    /* The current selection must correspond to a marked entity (by text, and by
       position when available) — mirrors the reference system's entity check. */
    if (!state.relSel) return null;
    var sel = state.relSel;
    var byPos = state.previewEntities.filter(function(e) { return e.text === sel.text && e.start === sel.start; });
    var m = byPos.length ? byPos[0] : state.previewEntities.filter(function(e) { return e.text === sel.text; })[0];
    return m ? { text: m.text, start: m.start, end: m.end } : null;
  }
  function stepBtn(label, enabled, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.disabled = !enabled;
    var base = 'padding:4px 12px;border-radius:6px;font-size:0.8rem;font-weight:600;transition:all 0.15s;';
    if (enabled) b.style.cssText = base + 'border:1.5px solid var(--color-primary);background:var(--color-primary);color:#fff;cursor:pointer;';
    else b.style.cssText = base + 'border:1.5px solid var(--color-border);background:transparent;color:var(--color-text-soft);cursor:not-allowed;opacity:0.6;';
    b.textContent = label;
    if (enabled) b.addEventListener('click', onClick);
    return b;
  }
  var msgWord = state.lang === 'zh' ? '請先在文字中選取' : 'Select text first';
  var notEntity = allowEntityEditing
    ? (state.lang === 'zh' ? '該選取不是已標記的實體，請先在上方標記實體' : 'Selection is not a marked entity — mark it first')
    : (state.lang === 'zh' ? '該選取不是資料中的既有實體，請選取已高亮的實體' : 'Selection is not an existing entity — select a highlighted entity');

  rbRow.appendChild(stepBtn('E1/Arg1', !d.e1, function() {
    var slot = findEntitySlot();
    if (!state.relSel) { state.relMsg = msgWord; refresh(); return; }
    if (!slot) { state.relMsg = notEntity; refresh(); return; }
    d.e1 = slot; state.relSel = null; state.relMsg = ''; refresh();
  }));
  rbRow.appendChild(stepBtn('Relation', !!d.e1 && !d.rel, function() {
    if (!state.relSel) { state.relMsg = msgWord; refresh(); return; }
    d.rel = { text: state.relSel.text, start: state.relSel.start, end: state.relSel.end };
    state.relSel = null; state.relMsg = ''; refresh();
  }));
  rbRow.appendChild(stepBtn('E2/Arg2', !!d.rel && !d.e2, function() {
    var slot = findEntitySlot();
    if (!state.relSel) { state.relMsg = msgWord; refresh(); return; }
    if (!slot) { state.relMsg = notEntity; refresh(); return; }
    d.e2 = slot; state.relSel = null; state.relMsg = ''; refresh();
  }));
  rbRow.appendChild(stepBtn(state.lang === 'zh' ? '退回' : 'Undo', !!(d.e2 || d.rel || d.e1), function() {
    if (d.e2) d.e2 = null; else if (d.rel) d.rel = null; else if (d.e1) d.e1 = null;
    state.relMsg = ''; refresh();
  }));
  rbRow.appendChild(stepBtn(state.lang === 'zh' ? '新增' : 'Add', !!(d.e1 && d.rel && d.e2), function() {
    state.previewTriples.push({
      subj: fmtRelSpan(d.e1), rel: fmtRelSpan(d.rel), obj: fmtRelSpan(d.e2), relType: null,
      subjStart: d.e1.start != null ? d.e1.start : null, subjEnd: d.e1.end != null ? d.e1.end : null,
      objStart: d.e2.start != null ? d.e2.start : null, objEnd: d.e2.end != null ? d.e2.end : null
    });
    state.relDraft = { e1: null, rel: null, e2: null };
    state.relSel = null; state.relMsg = ''; refresh();
  }));
  container.appendChild(rbRow);

  if (state.relMsg) {
    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:0.75rem;color:var(--color-error);margin-bottom:8px;';
    msg.textContent = state.relMsg;
    container.appendChild(msg);
  }
}

/* Relation-type options for the post-hoc `type` menu: only config relation_types
   (semantic labels like bodyLocation, causes, possibleTreatment).
   Trigger words come from text selection and are NOT mixed into this list. */
function getRelationTypeOptions(relationTypes) {
  var opts = [], seen = {};
  (relationTypes || []).forEach(function(rt) {
    if (rt && !seen[rt]) { seen[rt] = 1; opts.push(rt); }
  });
  return opts;
}

/* Shared entity list-row builder -- the annotator's 實體列表 and the reviewer
   aggregate card's per-annotator entity rows both render through this single
   implementation so the two views can never drift. `ent` is the display shape
   {text, type, start?, end?} (positions render only when both are present);
   mutation stays with the caller via onDelete(). */
function buildEntityListRow(ent, color, opts) {
  var lang = (opts && opts.lang) || 'zh';
  var row = document.createElement('div');
  row.setAttribute('data-testid', (opts && opts.testid) || 'entity-list-row');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 10px;margin-bottom:4px;background:var(--color-slate-50);border-radius:6px;font-size:0.85rem;';
  var badge = document.createElement('span');
  badge.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.7rem;font-weight:700;color:#fff;background:' + (color || '#6366F1') + ';flex-shrink:0;';
  badge.textContent = ent.type;
  row.appendChild(badge);
  var txt = document.createElement('span');
  txt.style.flex = '1';
  txt.textContent = ent.text;
  row.appendChild(txt);
  if (ent.start != null && ent.end != null) {
    var posEl = document.createElement('span');
    posEl.style.cssText = 'font-size:0.75rem;color:var(--color-text-soft);font-family:monospace;flex-shrink:0;';
    posEl.textContent = '(' + ent.start + ', ' + ent.end + ')';
    row.appendChild(posEl);
  }
  if (opts && opts.onDelete) {
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.style.cssText = 'border:1.5px solid var(--color-error);background:transparent;color:var(--color-error);border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.7rem;font-weight:700;flex-shrink:0;';
    delBtn.textContent = lang === 'zh' ? '刪除' : 'Del';
    if (opts.deleteTestid) delBtn.setAttribute('data-testid', opts.deleteTestid);
    delBtn.addEventListener('click', function() { opts.onDelete(); });
    row.appendChild(delBtn);
  }
  return row;
}

/* Shared relation triple-row builder -- the annotator's 關係識別 list and the
   reviewer aggregate card's per-annotator relation rows both render through
   this single implementation so the two views can never drift. `triple` is
   the display shape {subj, rel, obj, relType}; mutation stays with the
   caller via onSetType(newTypeOrNull)/onDelete(). */
function buildRelationTripleRow(triple, allRelTypes, opts) {
  var lang = (opts && opts.lang) || 'zh';
  var row = document.createElement('div');
  row.className = 'absa-relation-row';
  row.setAttribute('data-testid', 'relation-triple-row');
  row.style.display = 'flex'; row.style.alignItems = 'center';
  var content = document.createElement('span');
  content.style.flex = '1';
  var subjSpan = document.createElement('span');
  subjSpan.style.cssText = 'font-weight:600;font-size:11px;'; subjSpan.textContent = triple.subj;
  content.appendChild(subjSpan);
  var arrow = document.createElement('span'); arrow.className = 'absa-arrow'; arrow.textContent = ' → ';
  content.appendChild(arrow);
  var relBadge = document.createElement('span'); relBadge.className = 'absa-relation-badge'; relBadge.textContent = triple.rel;
  content.appendChild(relBadge);
  var arrow2 = document.createElement('span'); arrow2.className = 'absa-arrow'; arrow2.textContent = ' → ';
  content.appendChild(arrow2);
  var objSpan = document.createElement('span');
  objSpan.style.cssText = 'font-weight:600;font-size:11px;'; objSpan.textContent = triple.obj;
  content.appendChild(objSpan);
  if (triple.relType && allRelTypes.indexOf(triple.relType) >= 0) {
    var typeBadge = document.createElement('span');
    typeBadge.style.cssText = 'margin-left:8px;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;background:var(--color-success-bg);color:var(--color-success);border:1px solid var(--color-success-border);';
    typeBadge.textContent = (lang === 'zh' ? '類型：' : 'type: ') + triple.relType;
    content.appendChild(typeBadge);
  }
  row.appendChild(content);
  /* type dropdown button: assigns the post-hoc semantic relation type from config relation_types */
  if (allRelTypes.length > 0 && opts && opts.onSetType) {
    var typeWrap = document.createElement('span');
    typeWrap.style.cssText = 'position:relative;flex-shrink:0;margin-left:8px;';
    var typeBtn = document.createElement('button');
    typeBtn.type = 'button';
    typeBtn.style.cssText = 'border:1.5px solid var(--color-primary);background:transparent;color:var(--color-primary);border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.7rem;font-weight:700;';
    typeBtn.textContent = lang === 'zh' ? '類型' : 'type';
    var typeMenu = document.createElement('div');
    typeMenu.style.cssText = 'display:none;position:absolute;right:0;bottom:calc(100% + 4px);background:var(--color-white);border:1px solid var(--color-border);border-radius:8px;padding:4px 0;min-width:180px;max-height:220px;overflow-y:auto;z-index:100;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    allRelTypes.forEach(function(rt) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:6px 14px;font-size:0.8rem;color:var(--color-ink);cursor:pointer;display:flex;align-items:center;gap:6px;';
      item.addEventListener('mouseenter', function() { item.style.background = 'var(--color-slate-50)'; });
      item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
      var check = document.createElement('span');
      check.style.cssText = 'width:14px;font-size:0.75rem;';
      check.textContent = (triple.relType === rt) ? '✓' : '';
      item.appendChild(check);
      item.appendChild(document.createTextNode(rt));
      item.addEventListener('click', function(ev) {
        ev.stopPropagation();
        opts.onSetType((triple.relType === rt) ? null : rt);
      });
      typeMenu.appendChild(item);
    });
    typeBtn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var isOpen = typeMenu.style.display !== 'none';
      typeMenu.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        var closeHandler = function() { typeMenu.style.display = 'none'; document.removeEventListener('click', closeHandler); };
        setTimeout(function() { document.addEventListener('click', closeHandler); }, 0);
      }
    });
    typeWrap.appendChild(typeBtn);
    typeWrap.appendChild(typeMenu);
    row.appendChild(typeWrap);
  }
  if (opts && opts.onDelete) {
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.style.cssText = 'border:1.5px solid var(--color-error);background:transparent;color:var(--color-error);border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.7rem;font-weight:700;flex-shrink:0;margin-left:4px;';
    delBtn.textContent = lang === 'zh' ? '刪除' : 'Del';
    delBtn.addEventListener('click', function() { opts.onDelete(); });
    row.appendChild(delBtn);
  }
  return row;
}

/* Resolve the selection to its actual character offset in realText by
   walking containerEl's text nodes — indexOf alone would always bind repeated
   words (e.g. the same entity text occurring twice) to the first occurrence */
function resolveSelectionOffset(sel, selText, containerEl, realText) {
  if (sel.rangeCount === 0) return -1;
  var range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== 3 || !containerEl.contains(range.startContainer)) return -1;
  var total = 0;
  var walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null);
  var textNode;
  while ((textNode = walker.nextNode())) {
    if (textNode === range.startContainer) {
      var raw = sel.toString();
      var leadingWhitespace = raw.length - raw.replace(/^\s+/, '').length;
      var start = total + range.startOffset + leadingWhitespace;
      return realText.slice(start, start + selText.length) === selText ? start : -1;
    }
    total += textNode.textContent.length;
  }
  return -1;
}

function renderAbsaUnifiedPreview(previewContainer) {
  /* allow_bypass turned off while bypassed: clear the flag AND re-init the
     preview BEFORE rendering, so this pass already shows the restored state */
  ['entity_recognition', 'relation_identification'].forEach(function(outKey) {
    if (state.selectedOutputTypes.indexOf(outKey) >= 0 && !isBypassAllowed(outKey) && state.previewBypass[outKey]) {
      delete state.previewBypass[outKey];
      resetOutputPreviewState(outKey);
    }
  });
  if (!state.previewInited) initPreviewState();
  var realText = getDatasetPreviewText();
  var tc = getPreviewTypeColorMap();
  var typeColorMap = tc.map, typeOrder = tc.order;
  var relCfg = state.outputConfigs['relation_identification'] || {};
  var relationTypes = Array.isArray(relCfg.relation_types) ? relCfg.relation_types.filter(Boolean) : [];
  var hasSpanOut = state.selectedOutputTypes.indexOf('entity_recognition') >= 0;
  var hasRelOut = state.selectedOutputTypes.indexOf('relation_identification') >= 0;
  var allowEntityEditing = hasSpanOut;
  var DEL_SVG = '<svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  /* ── Working Area title ── */
  if (allowEntityEditing) {
    var titleEl = document.createElement('div');
    titleEl.className = 'annotation-preview-task-title';
    titleEl.style.marginBottom = '10px';
    titleEl.textContent = t('previewUnifiedTitle');
    previewContainer.appendChild(titleEl);
  }

  /* ── Annotated text with entity highlights ── */
  var textEl = document.createElement('div');
  textEl.className = 'absa-preview-text';
  textEl.style.cursor = 'text';
  textEl.style.userSelect = 'text';
  function appendTextMaybeHighlighted(parent, text, textStart) {
    var rs = state.relSel;
    if (!rs || rs.start == null) { parent.appendChild(document.createTextNode(text)); return; }
    var ss = rs.start - textStart;
    var se = rs.start + (rs.text ? rs.text.length : 0) - textStart;
    if (se <= 0 || ss >= text.length) { parent.appendChild(document.createTextNode(text)); return; }
    ss = Math.max(0, ss); se = Math.min(text.length, se);
    if (ss > 0) parent.appendChild(document.createTextNode(text.substring(0, ss)));
    var hl = document.createElement('span'); hl.className = 'rel-sel-highlight';
    hl.textContent = text.substring(ss, se); parent.appendChild(hl);
    if (se < text.length) parent.appendChild(document.createTextNode(text.substring(se)));
  }
  if (realText && state.previewEntities.length > 0) {
    var sorted = state.previewEntities.slice().filter(function(e) { return e.start != null; }).sort(function(a, b) { return a.start - b.start; });
    var charPos = 0;
    sorted.forEach(function(ent) {
      if (ent.start > charPos) { appendTextMaybeHighlighted(textEl, realText.substring(charPos, ent.start), charPos); }
      var span = document.createElement('span');
      span.className = 'absa-span-highlight';
      if (state.relSel && state.relSel.start != null) {
        var _entEnd = ent.start + ((ent.text || realText.substring(ent.start, (ent.end || ent.start) + 1)).length);
        var _rsEnd = state.relSel.start + (state.relSel.text ? state.relSel.text.length : 0);
        if (state.relSel.start <= ent.start && _rsEnd >= _entEnd) span.classList.add('rel-sel-highlight');
      }
      var c = typeColorMap[ent.type] || '#6366F1';
      span.style.background = c + '33'; span.style.borderBottom = '2px solid ' + c; span.style.color = c;
      span.title = ent.type + ' (' + ent.start + ',' + ent.end + ')';
      span.appendChild(document.createTextNode(ent.text || realText.substring(ent.start, ent.end + 1)));
      textEl.appendChild(span);
      charPos = (ent.end || ent.start) + 1;
    });
    if (charPos < realText.length) appendTextMaybeHighlighted(textEl, realText.substring(charPos), charPos);
  } else if (realText) {
    appendTextMaybeHighlighted(textEl, realText.length > 500 ? realText.substring(0, 500) + '…' : realText, 0);
  }
  /* Text selection handler: with an entity type armed → add entity;
     otherwise → capture the selection for the sequential relation flow */
  textEl.addEventListener('mouseup', function() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var selText = sel.toString().trim();
    if (!realText) return;
    var idx = resolveSelectionOffset(sel, selText, textEl, realText);
    if (idx < 0) idx = realText.indexOf(selText);
    if (idx < 0) return;
    if (allowEntityEditing && state.activeEntityType) {
      state.previewEntities.push({ text: selText, type: state.activeEntityType, start: idx, end: idx + selText.length - 1 });
      sel.removeAllRanges();
      renderAbsaUnifiedPreview_refresh(previewContainer);
      return;
    }
    state.relSel = { text: selText, start: idx, end: idx + selText.length - 1 };
    state.relMsg = '';
    sel.removeAllRanges();
    renderAbsaUnifiedPreview_refresh(previewContainer);
  });
  previewContainer.appendChild(textEl);

  if (allowEntityEditing) {
    /* ── Entity Type selector (interactive) ── */
    var etTitle = document.createElement('div');
    etTitle.className = 'annotation-preview-task-title';
    etTitle.style.cssText = 'margin:12px 0 6px;';
    etTitle.textContent = state.lang === 'zh' ? '實體類型' : 'Entity Type';
    previewContainer.appendChild(etTitle);
    var legendRow = document.createElement('div');
    legendRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
    typeOrder.forEach(function(typeName) {
      var c = typeColorMap[typeName] || '#6366F1';
      var chip = document.createElement('button');
      chip.type = 'button';
      var isActive = state.activeEntityType === typeName;
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ' + c + ';color:' + (isActive ? '#fff' : c) + ';background:' + (isActive ? c : 'transparent') + ';transition:all 0.15s;';
      chip.textContent = typeName;
      chip.addEventListener('click', function() {
        if (state.relSel) {
          state.previewEntities.push({
            text: state.relSel.text,
            type: typeName,
            start: state.relSel.start,
            end: state.relSel.end
          });
          state.relSel = null;
          state.relMsg = '';
          state.activeEntityType = typeName;
        } else {
          state.activeEntityType = state.activeEntityType === typeName ? null : typeName;
        }
        renderAbsaUnifiedPreview_refresh(previewContainer);
      });
      legendRow.appendChild(chip);
    });
    previewContainer.appendChild(legendRow);

    /* ── Entity List (interactive, deletable) ── */
    if (state.previewEntities.length > 0) {
      var elTitle = document.createElement('div');
      elTitle.className = 'annotation-preview-task-title';
      elTitle.style.marginBottom = '6px';
      elTitle.textContent = state.lang === 'zh' ? '實體列表' : 'Entity List';
      previewContainer.appendChild(elTitle);
      var elWrap = document.createElement('div');
      elWrap.style.cssText = 'margin-bottom:12px;max-height:200px;overflow-y:auto;';
      state.previewEntities.forEach(function(ent, i) {
        elWrap.appendChild(buildEntityListRow(ent, typeColorMap[ent.type] || '#6366F1', {
          lang: state.lang,
          onDelete: function() { state.previewEntities.splice(i, 1); renderAbsaUnifiedPreview_refresh(previewContainer); }
        }));
      });
      previewContainer.appendChild(elWrap);
    }
  }

  var divider = document.createElement('div');
  divider.className = 'annotation-preview-divider';
  divider.style.margin = '0 0 12px';
  previewContainer.appendChild(divider);

  /* ── Relation Builder (sequential state machine, mirrors the NER labeling system) ──
     Flow: 反白選取實體 → E1/Arg1 · 反白選取關係觸發詞 → Relation · 反白選取實體 → E2/Arg2 · Add
     E1/E2 must be already-marked entities; Relation is any trigger-word span from the text.
     Grouped in relSection so relation_identification's bypass can disable it independently. */
  var relSection = document.createElement('div');
  buildRelationStateMachine(relSection, relationTypes, function() { renderAbsaUnifiedPreview_refresh(previewContainer); }, allowEntityEditing);

  /* ── Triple List (interactive, deletable) ── */
  var tlTitle = document.createElement('div');
  tlTitle.className = 'annotation-preview-task-title';
  tlTitle.style.marginBottom = '8px';
  tlTitle.textContent = state.lang === 'zh' ? '關係識別' : 'Relation Identification';
  relSection.appendChild(tlTitle);

  var relList = document.createElement('div');
  relList.className = 'absa-relation-list';
  var allRelTypes = getRelationTypeOptions(relationTypes);
  state.previewTriples.forEach(function(triple, i) {
    relList.appendChild(buildRelationTripleRow(triple, allRelTypes, {
      lang: state.lang,
      onSetType: function(v) { state.previewTriples[i].relType = v; renderAbsaUnifiedPreview_refresh(previewContainer); },
      onDelete: function() { state.previewTriples.splice(i, 1); renderAbsaUnifiedPreview_refresh(previewContainer); }
    }));
  });
  if (state.previewTriples.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'font-size:0.8rem;color:var(--color-text-soft);padding:8px;';
    emptyMsg.textContent = state.lang === 'zh' ? '（尚無三元組，請從上方新增）' : '(No triples yet — add above)';
    relList.appendChild(emptyMsg);
  }
  relSection.appendChild(relList);
  previewContainer.appendChild(relSection);

  /* ── Bypass chips — one per selected output type; span bypass cascades
     (no entities → relation builder unusable), relation bypass only disables relSection ── */
  if (hasSpanOut && state.previewBypass['entity_recognition']) {
    disableBypassedArea(previewContainer.children);
  } else if (hasRelOut && state.previewBypass['relation_identification']) {
    disableBypassedArea([relSection]);
  }
  var refreshUnified = function() { renderAbsaUnifiedPreview_refresh(previewContainer); };
  var bypassChips = [];
  if (hasSpanOut && isBypassAllowed('entity_recognition')) bypassChips.push(makeBypassChip('entity_recognition', refreshUnified, bypassChipLabel('entity_recognition', hasSpanOut && hasRelOut)));
  if (hasRelOut && isBypassAllowed('relation_identification')) bypassChips.push(makeBypassChip('relation_identification', refreshUnified, bypassChipLabel('relation_identification', hasSpanOut && hasRelOut)));
  if (bypassChips.length > 0) {
    var bypassWrap = document.createElement('div');
    bypassWrap.className = BYPASS_ROW_CLASS;
    bypassWrap.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px dashed var(--color-border);display:flex;flex-wrap:wrap;align-items:center;gap:8px;';
    bypassChips.forEach(function(chip) { bypassWrap.appendChild(chip); });
    previewContainer.appendChild(bypassWrap);
  }
}

/* Prefix the chip with the output-type name only when both types share the unified preview */
function bypassChipLabel(outKey, needPrefix) {
  var base = state.lang === 'zh' ? '無法判定 (Bypass)' : 'Unable to determine (Bypass)';
  if (!needPrefix) return base;
  var outReg = OUTPUT_TYPE_REGISTRY[outKey];
  var name = outReg ? (outReg[state.lang] || outReg.zh) : outKey;
  return name + (state.lang === 'zh' ? '：' : ': ') + base;
}

function renderAbsaUnifiedPreview_refresh(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
  renderAbsaUnifiedPreview(container);
}

/* ── Per-output-type interactive preview renderers ── */
function ensurePreviewState(outKey, defaults) {
  if (!state.previewState[outKey]) state.previewState[outKey] = JSON.parse(JSON.stringify(defaults));
  return state.previewState[outKey];
}

/* ── Bypass（無法判定）— per-output-type annotator escape hatch ── */
function isBypassAllowed(outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  return cfg.allow_bypass !== false;
}

/* Bypass ON: reset the output type's preview marks to an explicitly-cleared,
   seed-proof shape (_seeded blocks re-seeding from the output column) */
function clearOutputPreviewState(outKey) {
  switch (outKey) {
    case 'single_label':
      state.previewState[outKey] = { selected: null, _seeded: true }; break;
    case 'multi_label':
      state.previewState[outKey] = { selected: [], _seeded: true }; break;
    case 'free_text':
      state.previewState[outKey] = { text: '', _seeded: true }; break;
    case 'single_dim': {
      var cfg = state.outputConfigs[outKey] || {};
      var min = cfg.min != null ? cfg.min : 1;
      var max = cfg.max != null ? cfg.max : 5;
      var step = (cfg.step != null && cfg.step > 0) ? cfg.step : 1;
      state.previewState[outKey] = { value: min + Math.round(((max - min) / 2) / step) * step, _seeded: true };
      break;
    }
    case 'sequence_tagging':
      state.previewState[outKey] = { spans: [], pendingSelection: null, prefillErrors: [], textKey: null, _seeded: true }; break;
    case 'entity_recognition':
      /* clearing entities invalidates triples that reference them */
      state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
      state.relDraft = { e1: null, rel: null, e2: null }; state.relSel = null; state.relMsg = '';
      delete state.previewState[outKey];
      break;
    case 'relation_identification':
      state.previewTriples = [];
      state.relDraft = { e1: null, rel: null, e2: null }; state.relSel = null; state.relMsg = '';
      delete state.previewState[outKey];
      break;
    default:
      delete state.previewState[outKey];
  }
}

/* Bypass OFF: drop the cleared state so the next render re-initializes
   (dataset output-column seeding re-applies, same as first load) */
function resetOutputPreviewState(outKey) {
  delete state.previewState[outKey];
  if (outKey === 'entity_recognition' || outKey === 'relation_identification') {
    state.previewInited = false;
    state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
    state.relDraft = { e1: null, rel: null, e2: null }; state.relSel = null; state.relMsg = '';
  }
}

/* Reconcile per-output config state with the current chip selection:
   seed registry defaults for newly selected output types, drop config /
   bypass state for deselected ones, and clear any uncommitted preview
   selection that a renderer swap would orphan (standalone renderers keep
   it in previewState pendingSelection · composite in relSel). */
function reconcileOutputConfigs() {
  /* ADR-029: initialize outputConfigs for each selected output type */
  state.selectedOutputTypes.forEach(function(outKey) {
    if (!state.outputConfigs[outKey]) {
      state.outputConfigs[outKey] = getOutputTypeDefaultConfig(outKey, state.lang);
    }
  });
  /* Remove outputConfigs entries for deselected output types */
  Object.keys(state.outputConfigs).forEach(function(k) {
    if (state.selectedOutputTypes.indexOf(k) < 0) delete state.outputConfigs[k];
  });
  /* Drop bypass flags of deselected output types so a later reselect
     does not come back pre-bypassed with a cleared preview */
  Object.keys(state.previewBypass).forEach(function(k) {
    if (state.selectedOutputTypes.indexOf(k) < 0) {
      delete state.previewBypass[k];
      resetOutputPreviewState(k);
    }
  });
  state.relSel = null;
  state.relMsg = '';
  Object.keys(state.previewState).forEach(function(k) {
    if (state.previewState[k] && state.previewState[k].pendingSelection) state.previewState[k].pendingSelection = null;
  });
}

function makeBypassChip(outKey, refresh, labelText) {
  var active = !!state.previewBypass[outKey];
  var c = '#64748B';
  var chip = document.createElement('button');
  chip.type = 'button';
  chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.15s;border:2px dashed ' + c + ';color:' + (active ? '#fff' : c) + ';background:' + (active ? c : 'transparent') + ';';
  var box = document.createElement('span');
  box.style.cssText = 'width:14px;height:14px;border-radius:3px;border:2px solid ' + (active ? '#fff' : c) + ';display:inline-flex;align-items:center;justify-content:center;font-size:10px;';
  if (active) box.textContent = '✓';
  chip.appendChild(box);
  chip.appendChild(document.createTextNode(labelText));
  chip.addEventListener('click', function() {
    if (state.previewBypass[outKey]) {
      delete state.previewBypass[outKey];
      resetOutputPreviewState(outKey);
    } else {
      state.previewBypass[outKey] = true;
      clearOutputPreviewState(outKey);
    }
    refresh();
  });
  return chip;
}

/* Consumers (the reviewer workspace) dock their own trailing controls onto
   this row, so it carries a stable class and lays out as a flex line. */
function appendBypassControl(container, outKey, refresh) {
  var wrap = document.createElement('div');
  wrap.className = BYPASS_ROW_CLASS;
  wrap.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px dashed var(--color-border);display:flex;flex-wrap:wrap;align-items:center;gap:8px;';
  wrap.appendChild(makeBypassChip(outKey, refresh, state.lang === 'zh' ? '無法判定 (Bypass)' : 'Unable to determine (Bypass)'));
  container.appendChild(wrap);
}

function disableBypassedArea(nodes) {
  Array.prototype.forEach.call(nodes, function(n) {
    if (n && n.style) { n.style.opacity = '0.45'; n.style.pointerEvents = 'none'; }
  });
}

function previewTextBlock(container) {
  if (state.selectedOutputTypes && state.selectedOutputTypes.length >= 1) return '';
  var realText = getDatasetPreviewText();
  var textEl = document.createElement('div');
  textEl.className = 'absa-preview-text';
  textEl.style.marginBottom = '12px';
  var displayText = realText || (state.lang === 'zh' ? '這是一段範例文字，用於預覽標記效果。' : 'This is sample text for annotation preview.');
  textEl.textContent = displayText.length > 500 ? displayText.substring(0, 500) + '…' : displayText;
  container.appendChild(textEl);
  return displayText;
}

function renderSingleLabelPreview(container, outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  var labels = Array.isArray(cfg.label_options) ? cfg.label_options.filter(function(l) { return l && l.name; }) : [];
  if (labels.length === 0) return;
  var outputVal = getOutputFieldValue(outKey);
  var matchedLabel = outputVal ? labels.find(function(l) { return l.name === outputVal; }) : null;
  var ps = ensurePreviewState(outKey, { selected: matchedLabel ? matchedLabel.name : null, _seeded: !!matchedLabel });
  if (matchedLabel && !ps._seeded) { ps.selected = matchedLabel.name; ps._seeded = true; }

  previewTextBlock(container);

  var chipWrap = document.createElement('div');
  chipWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
  labels.forEach(function(label) {
    var chip = document.createElement('button');
    chip.type = 'button';
    var isActive = ps.selected === label.name;
    var c = safeCssColor(label.color, '#6366F1');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;border:2px solid ' + c + ';color:' + (isActive ? '#fff' : c) + ';background:' + (isActive ? c : 'transparent') + ';transition:all 0.15s;';
    var radio = document.createElement('span');
    radio.style.cssText = 'width:14px;height:14px;border-radius:50%;border:2px solid ' + (isActive ? '#fff' : c) + ';display:inline-flex;align-items:center;justify-content:center;';
    if (isActive) { var dot = document.createElement('span'); dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#fff;'; radio.appendChild(dot); }
    chip.appendChild(radio);
    chip.appendChild(document.createTextNode(label.name));
    chip.addEventListener('click', function() { ps.selected = ps.selected === label.name ? null : label.name; refreshOutputPreview(container, outKey); });
    chipWrap.appendChild(chip);
  });
  container.appendChild(chipWrap);
}

function renderMultiLabelPreview(container, outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  var nodes = normalizeTaxonomyNodes(cfg.label_options);
  cfg.label_options = nodes;
  var entries = collectTaxonomyEntries(nodes);
  if (entries.length === 0) return;
  var dataPaths = readTaxonomyDataPaths(outKey, entries);
  var initSelected = dataPaths.paths;
  if (dataPaths.raw != null) {
    dataPaths.raw.split(/[,;，；]\s*/).forEach(function(value) {
      var match = entries.find(function(entry) { return entry.node.id === value.trim() || entry.node.name === value.trim(); });
      if (match) initSelected.push(match.idPath);
    });
  }
  var ps = ensurePreviewState(outKey, { selected: initSelected });
  if (!Array.isArray(ps.selected)) ps.selected = [];
  ps.selected = ps.selected.map(function(value) { return Array.isArray(value) ? value.map(String) : [String(value)]; });

  previewTextBlock(container);

  if (dataPaths.issue) {
    var issueMsg = document.createElement('div');
    issueMsg.className = 'field-error-msg show';
    issueMsg.setAttribute('data-testid', 'taxonomy-data-issue');
    var issueField = getOutputFieldName(outKey) || 'output';
    issueMsg.textContent = dataPaths.issue === 'mixed'
      ? (state.lang === 'en'
        ? 'Row 1 field "' + issueField + '" mixes flat and hierarchical label formats; auto-fill was blocked.'
        : '資料列 1 的欄位「' + issueField + '」混用扁平與階層標籤格式，已停止自動帶入。')
      : (state.lang === 'en'
        ? 'Row 1 field "' + issueField + '" contains label paths that do not match the taxonomy; auto-fill was blocked.'
        : '資料列 1 的欄位「' + issueField + '」含未對應標籤樹的標籤路徑，已停止自動帶入。');
    container.appendChild(issueMsg);
  }

  var selector = document.createElement('div');
  selector.className = 'taxonomy-selector';

  var selectedList = document.createElement('div');
  selectedList.className = 'taxonomy-selected-list';
  ps.selected.forEach(function(path) {
    var entry = entries.find(function(candidate) { return taxonomyPathKey(candidate.idPath) === taxonomyPathKey(path); });
    if (!entry) return;
    var chip = document.createElement('span');
    chip.className = 'taxonomy-selected-path';
    chip.setAttribute('data-testid', 'taxonomy-selected-path');
    var leafLabel = String(entry.node.name || entry.node.id || '');
    var accessiblePathLabel = entry.namePath.join(' / ');
    chip.appendChild(document.createTextNode(leafLabel));
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.innerHTML = taxonomyIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 12);
    remove.setAttribute('aria-label', (state.lang === 'en' ? 'Remove ' : '移除 ') + accessiblePathLabel);
    remove.addEventListener('click', function() {
      ps.selected = ps.selected.filter(function(selected) { return taxonomyPathKey(selected) !== taxonomyPathKey(path); });
      refreshOutputPreview(container, outKey);
    });
    chip.appendChild(remove);
    selectedList.appendChild(chip);
  });
  selector.appendChild(selectedList);

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'taxonomy-selector-trigger';
  trigger.setAttribute('data-testid', 'taxonomy-selector-trigger');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', ps.selectorOpen ? 'true' : 'false');
  trigger.appendChild(document.createTextNode(state.lang === 'en'
    ? (ps.selected.length ? ps.selected.length + ' selected — choose labels' : 'Choose labels')
    : (ps.selected.length ? '已選 ' + ps.selected.length + ' 個 — 選擇標籤' : '選擇標籤')));
  var triggerIcon = document.createElement('span');
  triggerIcon.innerHTML = ICON_CHEVRON_DOWN;
  triggerIcon.setAttribute('aria-hidden', 'true');
  trigger.appendChild(triggerIcon);
  selector.appendChild(trigger);

  var maxSetting = Number(cfg.max_selections) || 0;
  if (maxSetting > 0 && dataPaths.paths.length > maxSetting) {
    var maxExceeded = document.createElement('div');
    maxExceeded.className = 'field-error-msg show';
    maxExceeded.setAttribute('data-testid', 'taxonomy-max-exceeded');
    var exceededField = getOutputFieldName(outKey) || 'output';
    maxExceeded.textContent = state.lang === 'en'
      ? 'Row 1 field "' + exceededField + '" preselects ' + dataPaths.paths.length + ' labels, exceeding max selections (' + maxSetting + '). Adjust the data or the limit.'
      : '資料列 1 的欄位「' + exceededField + '」預選 ' + dataPaths.paths.length + ' 個標籤，超過最多可選數量（' + maxSetting + '），請調整資料或上限。';
    selector.appendChild(maxExceeded);
  }
  if (maxSetting > 0 && maxSetting > entries.length) {
    var maxHint = document.createElement('div');
    maxHint.className = 'field-hint';
    maxHint.setAttribute('data-testid', 'taxonomy-max-hint');
    maxHint.textContent = state.lang === 'en'
      ? 'Max selections (' + maxSetting + ') exceeds the ' + entries.length + ' selectable nodes; treated as unlimited.'
      : '最多可選數量（' + maxSetting + '）大於可選節點數（' + entries.length + '），視為不限。';
    selector.appendChild(maxHint);
  }

  var dialog = document.createElement('div');
  dialog.className = 'taxonomy-selector-dialog';
  dialog.setAttribute('data-testid', 'taxonomy-selector-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', state.lang === 'en' ? 'Choose hierarchical labels' : '選擇階層標籤');
  dialog.setAttribute('tabindex', '-1');
  dialog.hidden = !ps.selectorOpen;

  var stickyWrap = document.createElement('div');
  stickyWrap.className = 'taxonomy-selector-sticky';

  var dialogHeader = document.createElement('div');
  dialogHeader.className = 'taxonomy-selector-dialog-header';
  var dialogTitle = document.createElement('div');
  dialogTitle.className = 'taxonomy-selector-dialog-title';
  dialogTitle.textContent = state.lang === 'en' ? 'Choose hierarchical labels' : '選擇階層標籤';
  dialogHeader.appendChild(dialogTitle);
  var dialogClose = document.createElement('button');
  dialogClose.type = 'button';
  dialogClose.className = 'taxonomy-selector-close';
  dialogClose.innerHTML = ICON_X;
  dialogClose.setAttribute('aria-label', state.lang === 'en' ? 'Close label selector' : '關閉標籤選擇器');
  dialogClose.addEventListener('click', closeDialog);
  dialogHeader.appendChild(dialogClose);
  stickyWrap.appendChild(dialogHeader);

  var search = document.createElement('input');
  search.type = 'search';
  search.className = 'taxonomy-search-input';
  search.placeholder = state.lang === 'en' ? 'Search label names (matches parent categories too)' : '搜尋標籤名稱（含上層分類）';
  search.setAttribute('data-testid', 'taxonomy-search-input');
  search.setAttribute('aria-label', search.placeholder);
  search.value = ps.searchQuery || '';
  stickyWrap.appendChild(search);
  dialog.appendChild(stickyWrap);

  var previewTree = document.createElement('div');
  previewTree.className = 'taxonomy-preview-tree';
  previewTree.setAttribute('role', 'group');
  previewTree.setAttribute('aria-label', state.lang === 'en' ? 'Available labels' : '可選標籤');
  dialog.appendChild(previewTree);

  function isSelected(path) {
    return ps.selected.some(function(selected) { return taxonomyPathKey(selected) === taxonomyPathKey(path); });
  }
  function nodeMatches(node, idPrefix, namePrefix, query) {
    var nextIds = idPrefix.concat(String(node.id));
    var nextNames = namePrefix.concat(String(node.name));
    if (!query) return true;
    if ((nextIds.join(' / ') + ' ' + nextNames.join(' / ')).toLowerCase().indexOf(query) >= 0) return true;
    return (Array.isArray(node.children) ? node.children : []).some(function(child) {
      return nodeMatches(child, nextIds, nextNames, query);
    });
  }
  function renderChoices() {
    while (previewTree.firstChild) previewTree.removeChild(previewTree.firstChild);
    var query = search.value.trim().toLowerCase();
    var rendered = 0;
    function renderLevel(list, idPrefix, namePrefix, depth, parent) {
      list.forEach(function(node) {
        if (!nodeMatches(node, idPrefix, namePrefix, query)) return;
        var idPath = idPrefix.concat(String(node.id));
        var namePath = namePrefix.concat(String(node.name));
        var children = Array.isArray(node.children) ? node.children : [];
        var isBranch = children.length > 0;
        var row = document.createElement('div');
        row.className = 'taxonomy-preview-row';
        row.style.paddingLeft = Math.min((depth - 1) * 16, 80) + 'px';
        var selected = isSelected(idPath);
        var max = Number(cfg.max_selections) || 0;
        var limitReached = max > 0 && ps.selected.length >= max && !selected;
        var option = document.createElement('button');
        option.type = 'button';
        option.className = 'taxonomy-preview-option';
        option.setAttribute('data-testid', 'taxonomy-preview-option');
        option.setAttribute('data-node-id', String(node.id));
        option.setAttribute('role', 'checkbox');
        option.setAttribute('aria-label', namePath.join(' / '));
        option.setAttribute('aria-checked', selected ? 'true' : 'false');
        option.setAttribute('aria-disabled', limitReached ? 'true' : 'false');
        var checkbox = document.createElement('span');
        checkbox.className = 'taxonomy-option-checkbox';
        checkbox.setAttribute('aria-hidden', 'true');
        checkbox.innerHTML = taxonomyIcon('<path d="M20 6 9 17l-5-5"/>', 10);
        option.appendChild(checkbox);
        option.appendChild(document.createTextNode(node.name));
        option.addEventListener('click', function() {
          if (limitReached) return;
          if (selected) ps.selected = ps.selected.filter(function(path) { return taxonomyPathKey(path) !== taxonomyPathKey(idPath); });
          else ps.selected.push(idPath);
          /* Keep the dialog open across picks: restore scroll + focus after re-render */
          ps._restoreScrollTop = dialog.scrollTop;
          ps._refocusNodeId = String(node.id);
          ps._announce = state.lang === 'en'
            ? (selected ? 'Removed ' : 'Added ') + node.name + ', ' + ps.selected.length + ' selected'
            : (selected ? '已移除 ' : '已新增 ') + node.name + '，共已選 ' + ps.selected.length + ' 個';
          refreshOutputPreview(container, outKey);
        });
        row.appendChild(option);
        parent.appendChild(row);
        rendered += 1;
        if (isBranch) renderLevel(children, idPath, namePath, depth + 1, parent);
      });
    }
    renderLevel(nodes, [], [], 1, previewTree);
    if (!rendered) {
      var empty = document.createElement('div');
      empty.className = 'taxonomy-selector-empty';
      empty.textContent = state.lang === 'en' ? 'No matching labels.' : '找不到符合的標籤。';
      previewTree.appendChild(empty);
    }
  }
  search.addEventListener('input', function() {
    ps.searchQuery = search.value;
    renderChoices();
  });
  renderChoices();
  selector.appendChild(dialog);
  var live = document.createElement('div');
  live.className = 'taxonomy-live';
  live.setAttribute('aria-live', 'polite');
  selector.appendChild(live);
  container.appendChild(selector);

  function handleOutsideClick(event) {
    if (!document.body.contains(selector)) { unwatchOutsideClick(); return; }
    if (selector.contains(event.target)) return;
    ps.selectorOpen = false;
    dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    unwatchOutsideClick();
  }
  function unwatchOutsideClick() {
    document.removeEventListener('click', handleOutsideClick);
    if (ps._outsideClickHandler === handleOutsideClick) ps._outsideClickHandler = null;
  }
  function watchOutsideClick() {
    /* Each re-render creates a fresh closure — drop the previous render's
       listener before registering this one so exactly one is ever active. */
    if (ps._outsideClickHandler) document.removeEventListener('click', ps._outsideClickHandler);
    ps._outsideClickHandler = handleOutsideClick;
    setTimeout(function() { document.addEventListener('click', handleOutsideClick); }, 0);
  }

  if (ps.selectorOpen) {
    watchOutsideClick();
    setTimeout(function() {
      if (ps._restoreScrollTop != null) { dialog.scrollTop = ps._restoreScrollTop; ps._restoreScrollTop = null; }
      if (ps._refocusNodeId != null) {
        var refocus = previewTree.querySelector('[data-testid="taxonomy-preview-option"][data-node-id="' + CSS.escape(ps._refocusNodeId) + '"]');
        if (refocus) refocus.focus({ preventScroll: true });
        ps._refocusNodeId = null;
      }
      if (ps._announce) { live.textContent = ps._announce; ps._announce = null; }
    }, 0);
  }

  function closeDialog() {
    ps.selectorOpen = false;
    dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    unwatchOutsideClick();
    trigger.focus();
  }
  trigger.addEventListener('click', function() {
    var willOpen = dialog.hidden;
    ps.selectorOpen = willOpen;
    dialog.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) {
      renderChoices();
      watchOutsideClick();
      setTimeout(function() { dialog.focus(); }, 0);
    } else {
      unwatchOutsideClick();
    }
  });
  dialog.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
  });
}

function renderSingleDimPreview(container, outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  var dimName = cfg.dimension_name || 'score';
  var min = cfg.min != null ? cfg.min : 1;
  var max = cfg.max != null ? cfg.max : 5;
  var step = cfg.step != null ? cfg.step : 1;
  var mid = min + Math.round(((max - min) / 2) / step) * step;
  var outputVal = getOutputFieldValue(outKey);
  var initVal = mid;
  var seeded = false;
  if (outputVal) { var n = parseFloat(outputVal); if (!isNaN(n) && n >= min && n <= max) { initVal = min + Math.round((n - min) / step) * step; seeded = true; } }
  var ps = ensurePreviewState(outKey, { value: initVal, _seeded: seeded });
  if (seeded && !ps._seeded) { ps.value = initVal; ps._seeded = true; }

  previewTextBlock(container);

  var dimTitle = document.createElement('div');
  dimTitle.className = 'regression-dimension-title regression-dimension-color-0';
  var colorDot = document.createElement('span');
  colorDot.className = 'regression-dimension-dot';
  colorDot.setAttribute('aria-hidden', 'true');
  dimTitle.appendChild(colorDot);
  dimTitle.appendChild(document.createTextNode(dimName));
  container.appendChild(dimTitle);

  container.appendChild(createRegressionSliderControl({
    min: min,
    max: max,
    step: step,
    value: ps.value,
    colorIndex: 0,
    inputTestId: 'single-dim-slider',
    valueTestId: 'single-dim-value-tooltip',
    numericInputTestId: 'single-dim-value-input',
    ariaLabel: dimName,
    onInput: function(value) { ps.value = +value; }
  }));
}
/* FR-003d-1: word snapping widens a drag selection to the Intl.Segmenter word
   boundaries that contain it. A runtime without Segmenter lands the selection
   unsnapped -- snapping is a task property, so the configured value is never
   rewritten locally. */
function snapSelectionToWordBoundaries(text, start, end) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return { start: start, end: end };
  var segments;
  try {
    segments = Array.from(new Intl.Segmenter(state.lang === 'en' ? 'en' : 'zh', { granularity: 'word' }).segment(text));
  } catch (e) {
    return { start: start, end: end };
  }
  var snappedStart = start, snappedEnd = end;
  segments.forEach(function(segment) {
    var segmentEnd = segment.index + segment.segment.length;
    if (segment.index < start && segmentEnd > start) snappedStart = segment.index;
    if (segment.index < end && segmentEnd > end) snappedEnd = segmentEnd;
  });
  return { start: snappedStart, end: snappedEnd };
}

/* FR-003d-3: intersection is refused for output types whose policy is
   `forbidden`; `configurable` defers to the type's allow_overlapping setting. */
function spansMayIntersect(outKey) {
  var policy = SPAN_OVERLAP_POLICY_BY_OUTPUT_TYPE[outKey];
  if (policy === 'forbidden') return false;
  return (state.outputConfigs[outKey] || {}).allow_overlapping !== false;
}

/* FR-003d-2: pre-annotations are character offsets, so they land directly with
   no count check. A span outside the text or with start >= end is listed as an
   error and skipped -- the remaining spans still load and Step 2 stays passable. */
function seedSpanTaggingPreview(ps, outKey, text) {
  var textChanged = ps.textKey !== null && ps.textKey !== text;
  ps.textKey = text;
  if (state.previewBypass[outKey] || (ps._seeded && !textChanged)) return;
  ps.spans = [];
  ps.prefillErrors = [];
  ps.pendingSelection = null;
  ps._seeded = true;

  var outputVal = getOutputFieldValue(outKey);
  if (!outputVal) return;
  var parsed;
  try { parsed = JSON.parse(outputVal); } catch (e) { return; }
  if (!Array.isArray(parsed)) return;
  parsed.forEach(function(raw) {
    if (!raw || typeof raw !== 'object') return;
    var span = { start: Number(raw.start), end: Number(raw.end), label: String(raw.label == null ? '' : raw.label) };
    var inRange = isFinite(span.start) && isFinite(span.end)
      && span.start >= 0 && span.end <= text.length && span.start < span.end;
    if (inRange) ps.spans.push(span);
    else ps.prefillErrors.push(span);
  });
  ps.spans.sort(function(a, b) { return a.start - b.start; });
}

function buildSequenceSpanAlertRow(testid, message) {
  var el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.setAttribute('data-testid', testid);
  el.style.cssText = 'margin-bottom:8px;padding:8px 10px;border:1px solid var(--color-danger);border-radius:var(--radius-md);background:var(--color-danger-bg);color:var(--color-danger);font-size:0.78rem;line-height:1.5;';
  el.textContent = message;
  return el;
}

/* FR-003d-1: sequence_tagging annotates by dragging over the untokenized text
   and storing half-open character offsets. It keeps its own preview state
   rather than reusing entity_recognition's previewEntities, whose `end` is
   inclusive and whose spans may overlap. */
function renderSpanTaggingPreview(container, outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  var labels = Array.isArray(cfg.entities) ? cfg.entities.filter(function(e) { return e && e.name; }) : [];
  var snapUnit = cfg.snap_unit === 'word' ? 'word' : 'character';
  var ps = ensurePreviewState(outKey, { spans: [], pendingSelection: null, prefillErrors: [], textKey: null, _seeded: false });
  var realText = getDatasetPreviewText();
  var text = realText || (state.lang === 'zh' ? '台積電董事長魏哲家今天出席台北產業論壇' : 'The chairman of TSMC attended the forum in Taipei today.');
  seedSpanTaggingPreview(ps, outKey, text);

  var labelColor = {};
  labels.forEach(function(label, i) { labelColor[label.name] = safeCssColor(label.color, ENTITY_COLORS[i % ENTITY_COLORS.length]); });

  var sourceTextLabel = document.createElement('div');
  sourceTextLabel.className = 'annotation-preview-task-title';
  sourceTextLabel.style.marginBottom = '6px';
  sourceTextLabel.setAttribute('data-testid', 'sequence-source-text-label');
  sourceTextLabel.textContent = t('previewSourceTextTitle');
  container.appendChild(sourceTextLabel);

  /* One element per run of characters sharing the same span (and the same
     pending-selection membership), so a refused selection can be shown in
     error colour without splitting the span it collides with. */
  var textEl = document.createElement('div');
  textEl.className = 'absa-preview-text';
  textEl.setAttribute('data-testid', 'sequence-source-text');
  textEl.style.cssText = 'margin-bottom:12px;cursor:text;user-select:text;';
  var pending = ps.pendingSelection;
  var spanAt = new Array(text.length);
  ps.spans.forEach(function(span, spanIndex) {
    for (var i = span.start; i < span.end && i < text.length; i++) spanAt[i] = spanIndex;
  });
  /* A rejected selection that lands fully inside an existing span has no
     character of its own to paint in error colour (every position already
     belongs to that span), so the existing span is marked instead — this is
     the only feedback for a fully-covered rejection (issue #659). */
  var blockingSpanIndexes = {};
  if (pending && pending.invalid) {
    ps.spans.forEach(function(s, i) {
      if (s.start < pending.end && pending.start < s.end) blockingSpanIndexes[i] = true;
    });
  }
  var runStart = 0;
  function keyAt(i) {
    var inPending = !!pending && i >= pending.start && i < pending.end && spanAt[i] === undefined;
    return (spanAt[i] === undefined ? '-' : spanAt[i]) + (inPending ? 'P' : '');
  }
  function flushRun(from, to) {
    if (to <= from) return;
    var chunk = text.substring(from, to);
    var spanIndex = spanAt[from];
    var inPending = !!pending && from >= pending.start && from < pending.end && spanIndex === undefined;
    if (spanIndex === undefined && !inPending) { textEl.appendChild(document.createTextNode(chunk)); return; }
    var el = document.createElement('span');
    if (spanIndex !== undefined) {
      var span = ps.spans[spanIndex];
      var color = labelColor[span.label] || '#6366F1';
      el.className = 'absa-span-highlight';
      el.setAttribute('data-testid', 'sequence-span');
      el.setAttribute('data-start', String(span.start));
      el.setAttribute('data-end', String(span.end));
      el.setAttribute('data-label', span.label);
      el.style.cssText = 'background:' + color + '33;border-bottom:2px solid ' + color + ';color:' + color + ';';
      el.title = span.label;
      if (blockingSpanIndexes[spanIndex]) {
        el.setAttribute('data-overlap-blocked', 'true');
        el.style.outline = '2px dashed var(--color-danger)';
        el.style.outlineOffset = '2px';
      }
    } else if (pending.invalid) {
      el.className = 'rel-sel-highlight';
      el.setAttribute('data-testid', 'sequence-span-selection-error');
      el.style.cssText = 'background:var(--color-danger-bg);border-bottom:2px solid var(--color-danger);color:var(--color-danger);';
    } else {
      el.className = 'rel-sel-highlight';
      el.setAttribute('data-testid', 'sequence-span-pending');
    }
    el.textContent = chunk;
    textEl.appendChild(el);
  }
  for (var ci = 1; ci <= text.length; ci++) {
    if (ci === text.length || keyAt(ci) !== keyAt(runStart)) { flushRun(runStart, ci); runStart = ci; }
  }
  textEl.addEventListener('mouseup', function() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var selText = sel.toString().trim();
    var idx = resolveSelectionOffset(sel, selText, textEl, text);
    if (idx < 0) idx = text.indexOf(selText);
    if (idx < 0) return;
    var bounds = { start: idx, end: idx + selText.length };
    if (snapUnit === 'word') bounds = snapSelectionToWordBoundaries(text, bounds.start, bounds.end);
    ps.pendingSelection = {
      start: bounds.start,
      end: bounds.end,
      invalid: !spansMayIntersect(outKey) && ps.spans.some(function(s) {
        return s.start < bounds.end && bounds.start < s.end;
      }),
    };
    sel.removeAllRanges();
    refreshOutputPreview(container, outKey);
  });
  container.appendChild(textEl);

  if (pending && pending.invalid) {
    var blockingLabels = ps.spans
      .filter(function(s, i) { return blockingSpanIndexes[i]; })
      .map(function(s) { return s.label + '「' + text.substring(s.start, s.end) + '」'; });
    container.appendChild(buildSequenceSpanAlertRow('sequence-span-overlap-error', state.lang === 'zh'
      ? '新圈選範圍與既有標記重疊：' + blockingLabels.join('、') + '，請重新選取。'
      : 'The new selection overlaps existing mark(s): ' + blockingLabels.join(', ') + '. Please reselect.'));
  }

  ps.prefillErrors.forEach(function(span) {
    container.appendChild(buildSequenceSpanAlertRow('sequence-span-prefill-error', state.lang === 'zh'
      ? '預標記 offset (' + span.start + ', ' + span.end + ') 超出文本範圍，已略過該筆。'
      : 'Pre-annotation offset (' + span.start + ', ' + span.end + ') falls outside the text and was skipped.'));
  });

  var typeTitle = document.createElement('div');
  typeTitle.className = 'annotation-preview-task-title';
  typeTitle.style.marginBottom = '6px';
  typeTitle.textContent = state.lang === 'zh' ? '標籤類型' : 'Label types';
  container.appendChild(typeTitle);

  var chipWrap = document.createElement('div');
  chipWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
  labels.forEach(function(label) {
    var color = labelColor[label.name] || '#6366F1';
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.setAttribute('data-testid', 'sequence-label-option');
    chip.style.cssText = 'padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ' + color + ';color:' + color + ';background:transparent;';
    chip.textContent = label.name;
    chip.addEventListener('click', function() {
      var selected = ps.pendingSelection;
      /* A refused selection is kept pending, not discarded here: the error
         highlight and message must survive a label click until the next
         selection replaces it (issue #659), so labeling is a no-op while
         invalid rather than a way to dismiss the rejection. */
      if (selected && selected.invalid) return;
      ps.pendingSelection = null;
      if (selected) {
        ps.spans.push({ start: selected.start, end: selected.end, label: label.name });
        ps.spans.sort(function(a, b) { return a.start - b.start; });
      }
      refreshOutputPreview(container, outKey);
    });
    chipWrap.appendChild(chip);
  });
  container.appendChild(chipWrap);

  /* Marked-span list: the only way to undo a mis-drag, and the surface
     FR-003d-1's row-count acceptance clauses refer to. Rows go through the
     same builder entity_recognition uses so the two span-based output types
     can never drift apart visually; `end` is half-open here and inclusive
     there, which the row only ever prints, never interprets. */
  if (ps.spans.length > 0) {
    var listTitle = document.createElement('div');
    listTitle.className = 'annotation-preview-task-title';
    listTitle.style.marginBottom = '6px';
    listTitle.textContent = state.lang === 'zh' ? '已標記清單' : 'Marked spans';
    container.appendChild(listTitle);
    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'max-height:160px;overflow-y:auto;';
    ps.spans.forEach(function(span, i) {
      var row = buildEntityListRow(
        { type: span.label, text: text.substring(span.start, span.end), start: span.start, end: span.end },
        labelColor[span.label] || '#6366F1',
        {
          lang: state.lang,
          testid: 'sequence-span-item',
          deleteTestid: 'sequence-span-item-delete',
          onDelete: function() { ps.spans.splice(i, 1); refreshOutputPreview(container, outKey); },
        }
      );
      listWrap.appendChild(row);
    });
    container.appendChild(listWrap);
  }
}

function renderSpanOnlyPreview(container, outKey) {
  if (!state.previewInited) initPreviewState();
  var realText = getDatasetPreviewText();
  var tc = getPreviewTypeColorMap();
  var typeColorMap = tc.map, typeOrder = tc.order;
  var ps = ensurePreviewState(outKey, { pendingSelection: null });

  /* Text with entity highlights */
  var textEl = document.createElement('div');
  textEl.className = 'absa-preview-text';
  textEl.style.cursor = 'text'; textEl.style.userSelect = 'text';
  function appendTextMaybePending(parent, text, textStart) {
    var pending = ps.pendingSelection;
    if (!pending || pending.start == null) { parent.appendChild(document.createTextNode(text)); return; }
    var selectionStart = pending.start - textStart;
    var selectionEnd = pending.end + 1 - textStart;
    if (selectionEnd <= 0 || selectionStart >= text.length) { parent.appendChild(document.createTextNode(text)); return; }
    selectionStart = Math.max(0, selectionStart);
    selectionEnd = Math.min(text.length, selectionEnd);
    if (selectionStart > 0) parent.appendChild(document.createTextNode(text.substring(0, selectionStart)));
    var highlight = document.createElement('span');
    highlight.className = 'rel-sel-highlight';
    highlight.textContent = text.substring(selectionStart, selectionEnd);
    parent.appendChild(highlight);
    if (selectionEnd < text.length) parent.appendChild(document.createTextNode(text.substring(selectionEnd)));
  }
  if (realText && state.previewEntities.length > 0) {
    var sorted = state.previewEntities.slice().filter(function(e) { return e.start != null; }).sort(function(a, b) { return a.start - b.start; });
    var charPos = 0;
    sorted.forEach(function(ent) {
      if (ent.start > charPos) appendTextMaybePending(textEl, realText.substring(charPos, ent.start), charPos);
      var span = document.createElement('span'); span.className = 'absa-span-highlight';
      if (ps.pendingSelection && ps.pendingSelection.start != null) {
        var entEnd = ent.start + (ent.text || realText.substring(ent.start, (ent.end || ent.start) + 1)).length - 1;
        if (ps.pendingSelection.start <= ent.start && ps.pendingSelection.end >= entEnd) span.classList.add('rel-sel-highlight');
      }
      var c = typeColorMap[ent.type] || '#6366F1';
      span.style.background = c + '33'; span.style.borderBottom = '2px solid ' + c; span.style.color = c; span.title = ent.type;
      span.appendChild(document.createTextNode(ent.text || realText.substring(ent.start, ent.end + 1)));
      textEl.appendChild(span);
      charPos = (ent.end || ent.start) + 1;
    });
    if (charPos < realText.length) appendTextMaybePending(textEl, realText.substring(charPos), charPos);
  } else if (realText) {
    appendTextMaybePending(textEl, realText.length > 500 ? realText.substring(0, 500) + '…' : realText, 0);
  }
  textEl.addEventListener('mouseup', function() {
    if (!realText) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    var selText = sel.toString().trim();
    var idx = resolveSelectionOffset(sel, selText, textEl, realText);
    if (idx < 0) idx = realText.indexOf(selText);
    if (idx < 0) return;
    if (state.activeEntityType) {
      state.previewEntities.push({ text: selText, type: state.activeEntityType, start: idx, end: idx + selText.length - 1 });
    } else {
      ps.pendingSelection = { text: selText, start: idx, end: idx + selText.length - 1 };
    }
    sel.removeAllRanges();
    refreshOutputPreview(container, outKey);
  });
  container.appendChild(textEl);

  /* Entity type selector */
  var etTitle = document.createElement('div');
  etTitle.className = 'annotation-preview-task-title';
  etTitle.style.cssText = 'margin:12px 0 6px;';
  etTitle.textContent = state.lang === 'zh' ? '實體類型' : 'Entity Type';
  container.appendChild(etTitle);
  var legendRow = document.createElement('div');
  legendRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
  typeOrder.forEach(function(typeName) {
    var c = typeColorMap[typeName] || '#6366F1';
    var chip = document.createElement('button'); chip.type = 'button';
    var isActive = state.activeEntityType === typeName;
    chip.style.cssText = 'padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ' + c + ';color:' + (isActive ? '#fff' : c) + ';background:' + (isActive ? c : 'transparent') + ';';
    chip.textContent = typeName;
    chip.addEventListener('click', function() {
      if (ps.pendingSelection) {
        state.previewEntities.push({
          text: ps.pendingSelection.text,
          type: typeName,
          start: ps.pendingSelection.start,
          end: ps.pendingSelection.end
        });
        ps.pendingSelection = null;
        state.activeEntityType = typeName;
      } else {
        state.activeEntityType = state.activeEntityType === typeName ? null : typeName;
      }
      refreshOutputPreview(container, outKey);
    });
    legendRow.appendChild(chip);
  });
  container.appendChild(legendRow);

  /* Entity list */
  if (state.previewEntities.length > 0) {
    var elTitle = document.createElement('div');
    elTitle.className = 'annotation-preview-task-title';
    elTitle.style.marginBottom = '6px';
    elTitle.textContent = state.lang === 'zh' ? '實體列表' : 'Entity List';
    container.appendChild(elTitle);
    var elWrap = document.createElement('div');
    elWrap.style.cssText = 'max-height:160px;overflow-y:auto;';
    state.previewEntities.forEach(function(ent, i) {
      elWrap.appendChild(buildEntityListRow(ent, typeColorMap[ent.type] || '#6366F1', {
        lang: state.lang,
        onDelete: function() { state.previewEntities.splice(i, 1); refreshOutputPreview(container, outKey); }
      }));
    });
    container.appendChild(elWrap);
  }
}

function renderFreeTextPreview(container, outKey) {
  var cfg = state.outputConfigs[outKey] || {};
  var maxLen = cfg.max_length || 512;
  var outputVal = getOutputFieldValue(outKey);
  var ps = ensurePreviewState(outKey, { text: outputVal || '', _seeded: !!outputVal });
  if (outputVal && !ps._seeded) { ps.text = outputVal; ps._seeded = true; }

  /* A blank stored instruction must stay blank in the preview — substituting
     the default here would hide why Step 2 validation is failing */
  var inputInstruction = typeof cfg.input_instruction === 'string'
    ? cfg.input_instruction.trim()
    : (state.lang === 'zh' ? '請閱讀以下內容' : 'Read the following content');
  var outputInstruction = typeof cfg.output_instruction === 'string'
    ? cfg.output_instruction.trim()
    : (state.lang === 'zh' ? '請輸入回答' : 'Enter your response');

  /* Another selected output (e.g. entity_recognition) already renders the
     input text; keep the editable instruction but skip the duplicate content */
  var otherOwnsInputPreview = state.selectedOutputTypes.some(function(k) {
    var reg = OUTPUT_TYPE_REGISTRY[k];
    return k !== outKey && reg && reg.rendersInputPreview === true;
  });

  var inputWrap = document.createElement('div');
  if (!otherOwnsInputPreview) {
    inputWrap.setAttribute('data-testid', 'generation-input-preview');
  }

  var inputTitle = document.createElement('div');
  inputTitle.className = 'annotation-preview-task-title';
  inputTitle.style.marginBottom = '6px';
  inputTitle.setAttribute('data-testid', 'free-text-input-instruction');
  inputTitle.textContent = inputInstruction;
  inputWrap.appendChild(inputTitle);

  if (!otherOwnsInputPreview) {
    var realText = getDatasetPreviewText();
    var inputSample = document.createElement('div');
    inputSample.className = 'annotation-preview-sample';
    inputSample.setAttribute('data-testid', 'free-text-input-content');
    var inputText = realText || (state.lang === 'zh'
      ? '這是一段範例文字，用於預覽自由文字作答介面。'
      : 'This is sample text for the free-text response preview.');
    inputSample.textContent = inputText.length > 500 ? inputText.substring(0, 500) + '…' : inputText;
    inputWrap.appendChild(inputSample);
  }
  container.appendChild(inputWrap);

  var responseArea = document.createElement('div');
  responseArea.setAttribute('data-testid', 'free-text-response-area');
  responseArea.setAttribute('data-bypass-sensitive', 'true');
  responseArea.style.marginTop = '12px';
  container.appendChild(responseArea);

  var ansTitle = document.createElement('div');
  ansTitle.className = 'annotation-preview-task-title';
  ansTitle.style.marginBottom = '6px';
  ansTitle.setAttribute('data-testid', 'free-text-output-instruction');
  ansTitle.textContent = outputInstruction;
  responseArea.appendChild(ansTitle);

  var textarea = document.createElement('textarea');
  textarea.style.cssText = 'width:100%;min-height:100px;padding:10px 12px;border:1.5px solid var(--color-border);border-radius:var(--radius-md);font-size:0.9rem;resize:vertical;font-family:inherit;';
  textarea.placeholder = state.lang === 'zh' ? '在此輸入回答…' : 'Type your answer here…';
  textarea.setAttribute('aria-label', outputInstruction);
  textarea.setAttribute('data-testid', 'generation-answer-input');
  textarea.value = ps.text;
  textarea.maxLength = maxLen;
  textarea.addEventListener('input', function() { ps.text = textarea.value; charCount.textContent = textarea.value.length + ' / ' + maxLen; });
  responseArea.appendChild(textarea);

  var charCount = document.createElement('div');
  charCount.style.cssText = 'font-size:0.75rem;color:var(--color-text-soft);text-align:right;margin-top:4px;';
  charCount.textContent = ps.text.length + ' / ' + maxLen;
  responseArea.appendChild(charCount);
}

function renderRelationTripleOnlyPreview(container, outKey) {
  /* Reuse the relation state machine while selected outputs determine whether
     entity editing is available. Standalone Relation Identification keeps dataset entities
     as read-only highlights; explicit Entity Recognition + Relation Identification enables editing. */
  renderAbsaUnifiedPreview(container);
}

/* ── Preview dispatcher ── */
function renderOutputPreview(container, outKey) {
  /* allow_bypass turned off while bypassed: clear the flag AND re-init the
     preview, otherwise the cleared `_seeded` state blocks dataset re-seeding */
  if (!isBypassAllowed(outKey) && state.previewBypass[outKey]) {
    delete state.previewBypass[outKey];
    resetOutputPreviewState(outKey);
  }
  switch (outKey) {
    case 'single_label': renderSingleLabelPreview(container, outKey); break;
    case 'multi_label': renderMultiLabelPreview(container, outKey); break;
    case 'single_dim': renderSingleDimPreview(container, outKey); break;
    case 'multi_dim': renderMultiDimPreview(container, state.outputConfigs['multi_dim'] || {}, outKey); break;
    case 'sequence_tagging': renderSpanTaggingPreview(container, outKey); break;
    case 'entity_recognition': renderSpanOnlyPreview(container, outKey); break;
    case 'relation_identification': renderRelationTripleOnlyPreview(container, outKey); break;
    case 'free_text': renderFreeTextPreview(container, outKey); break;
    default:
      var placeholder = document.createElement('div');
      placeholder.className = 'annotation-preview-empty';
      placeholder.textContent = state.lang === 'zh' ? '（設定後顯示預覽）' : '(Preview updates after config)';
      container.appendChild(placeholder);
  }
  /* relation_identification routes to the unified preview, which owns its bypass chip */
  if (outKey !== 'relation_identification' && isBypassAllowed(outKey)) {
    if (state.previewBypass[outKey]) {
      var scopedTargets = container.querySelectorAll('[data-bypass-sensitive="true"]');
      var bypassTargets = scopedTargets.length ? scopedTargets : container.children;
      disableBypassedArea(bypassTargets);
    }
    appendBypassControl(container, outKey, function() { refreshOutputPreview(container, outKey); });
  }
}

function refreshOutputPreview(container, outKey) {
  while (container.firstChild) container.removeChild(container.firstChild);
  renderOutputPreview(container, outKey);
}

function syncStep2Layout() {
  var workspace = el('s2PrimaryWorkspace');
  var settingsPanel = el('s2SettingsPanel');
  var primarySlot = el('s2PrimarySettingsSlot');
  var defaultSlot = el('s2DefaultSettingsSlot');
  var supportingTools = el('s2SupportingTools');
  var usesSettingsFirstPreview = state.selectedOutputTypes.length > 0;
  var targetSlot = usesSettingsFirstPreview ? primarySlot : defaultSlot;

  if (settingsPanel.parentNode !== targetSlot) targetSlot.appendChild(settingsPanel);
  workspace.classList.toggle('is-settings-first-preview', usesSettingsFirstPreview);
  workspace.setAttribute('data-layout', usesSettingsFirstPreview ? 'settings-first-preview' : 'default');
  supportingTools.classList.toggle('is-integrated-config-tools', usesSettingsFirstPreview);
  supportingTools.setAttribute('data-presentation', usesSettingsFirstPreview ? 'integrated' : 'default');
}

function renderSchemaFields() {
  syncStep2Layout();
  var container = el('schemaFields');
  while (container.firstChild) container.removeChild(container.firstChild);

  rebuildColumnOutputTypeMap();

  /* Reset auto-population flags only when the dataset or any column role
     assignment changes; the full role map covers input/evidence/output so
     e.g. re-pointing the input column also re-seeds offset-based previews,
     and _datasetVersion distinguishes replaced files sharing the same columns */
  var _datasetKey = (state._datasetVersion || 0) + ':' + state.datasetParsedColumns.map(function(c) { return c + '=' + (state.fieldRoleMap[c] || ''); }).join(',');
  if (state._lastAutoPopKey !== _datasetKey) {
    state._lastAutoPopKey = _datasetKey;
    state.previewState = {};
    state.previewBypass = {};
    state.previewInited = false; state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
    /* Task-detail seeding provides a one-shot pending value so saved labels
       survive the seed-triggered reset; genuine dataset/role changes have no
       pending value and re-derive defaults from the new columns. */
    state.itemPairLabels = state._pendingItemPairLabels || null;
    state._pendingItemPairLabels = null;
    Object.keys(state.outputConfigs).forEach(function(k) {
      if (state.outputConfigs[k]) {
        state.outputConfigs[k]._autoPopulated = false;
      }
    });
  }

  /* Auto-populate flat single-label options and hierarchical multi-label
     taxonomy from all records. Flat multi-label arrays become one-level paths. */
  var _outCols = getFieldsByRole('output');
  if (_outCols.length > 0) {
    var _singleLabelColumn = getOutputFieldName('single_label') || _outCols[0];
    var _uniqueVals = state.datasetColumnUniqueValues[_singleLabelColumn] || [];
    if (_uniqueVals.length > 0) {
      var _singleLabelCfg = state.outputConfigs.single_label;
      if (_singleLabelCfg && !_singleLabelCfg._autoPopulated) {
        _singleLabelCfg.label_options = _uniqueVals.map(function(v, i) {
          return { name: String(v), color: ENTITY_COLORS[i % ENTITY_COLORS.length] };
        });
        _singleLabelCfg._autoPopulated = true;
      }
    }
    var _multiLabelCfg = state.outputConfigs.multi_label;
    if (_multiLabelCfg && !_multiLabelCfg._autoPopulated) {
      var _datasetPaths = getMultiLabelDatasetPaths();
      var _treeResult = buildTaxonomyFromPaths(_datasetPaths.paths);
      _multiLabelCfg._taxonomyError = _datasetPaths.error || _treeResult.error || '';
      if (!_multiLabelCfg._taxonomyError && _treeResult.nodes.length > 0) {
        _multiLabelCfg.label_options = _treeResult.nodes;
      }
      _multiLabelCfg._autoPopulated = true;
    }
    /* Auto-populate multi_dim dimensions from output JSON object */
    var _multiDimCfg = state.outputConfigs['multi_dim'];
    if (_multiDimCfg && !_multiDimCfg._autoPopulated) {
      var _rawVal = state.datasetRawFirstRow ? state.datasetRawFirstRow[_outCols[0]] : null;
      if (_rawVal && typeof _rawVal === 'object' && !Array.isArray(_rawVal)) {
        var _dimKeys = Object.keys(_rawVal);
        if (_dimKeys.length > 0) {
          _multiDimCfg.dimensions = _dimKeys.map(function(key) {
            var v = parseFloat(_rawVal[key]);
            var minVal = 1, maxVal = 5, stepVal = 1;
            if (!isNaN(v)) {
              if (v >= 0 && v <= 1) { minVal = 0; maxVal = 1; stepVal = 0.01; }
              else if (v < 0) { minVal = Math.floor(v * 1.5); maxVal = Math.max(Math.ceil(Math.abs(v) * 1.5), 5); stepVal = 1; }
              else if (v > 5) { maxVal = Math.ceil(v * 1.5); }
            }
            return { name: key, min: minVal, max: maxVal, step: stepVal };
          });
          _multiDimCfg._autoPopulated = true;
        }
      }
    }

  }

  /* Auto-populate relation_types from semantic type labels in the pre-labeled
     data. Collection priority: (1) per-triple `relation_type` field,
     (2) record-level `relation_types` array, (3) `{subj, rel, obj}` format
     where `rel` is already a semantic label. Trigger words (relation.text)
     are NOT used — they are text spans, not semantic categories. */
  var _relCfg = state.outputConfigs['relation_identification'];
  if (_relCfg && !_relCfg._autoPopulated) {
    var _rawRow = state.datasetRawFirstRow || {};
    var _tripCands = [_rawRow.triples, _rawRow.gold_triplets, _rawRow.gold_triples];
    if (_outCols.length > 0) _tripCands.unshift(_rawRow[_outCols[0]]);
    var _trips = null;
    _tripCands.some(function(cand) {
      if (!Array.isArray(cand) || cand.length === 0) return false;
      var _f = cand[0];
      if (!_f || typeof _f !== 'object' || !(_f.relation || typeof _f.rel === 'string')) return false;
      _trips = cand; return true;
    });
    var _rels = [], _relSeen = {};
    /* (1) Collect per-triple relation_type fields */
    if (_trips) {
      _trips.forEach(function(tp) {
        var rt = tp && tp.relation_type;
        if (rt && typeof rt === 'string' && !_relSeen[rt]) { _relSeen[rt] = 1; _rels.push(rt); }
      });
    }
    /* (2) Collect from record-level relation_types array */
    if (Array.isArray(_rawRow.relation_types)) {
      _rawRow.relation_types.forEach(function(rt) {
        if (rt && typeof rt === 'string' && !_relSeen[rt]) { _relSeen[rt] = 1; _rels.push(rt); }
      });
    }
    /* (3) Fallback: {subj, rel, obj} format where rel is the semantic label */
    if (_rels.length === 0 && _trips) {
      _trips.forEach(function(tp) {
        var w = (tp && typeof tp.rel === 'string') ? tp.rel.trim() : '';
        if (w && !_relSeen[w]) { _relSeen[w] = 1; _rels.push(w); }
      });
    }
    if (_rels.length > 0) {
      _relCfg.relation_types = _rels;
      _relCfg._autoPopulated = true;
    }
  }

  /* ADR-029: render accordion layout for all output types (single or multi) */
  if (state.selectedOutputTypes.length >= 1) {
    if (((state.taskInputTypes && state.taskInputTypes[0]) || 'single_item') === 'item_pair') {
      container.appendChild(buildItemPairLabelSection());
    }
    var autoCollapse = state.selectedOutputTypes.length > 2;
    state.selectedOutputTypes.forEach(function(outKey, idx) {
      var outReg = OUTPUT_TYPE_REGISTRY[outKey];
      if (!outReg) return;
      var isCollapsed = autoCollapse && idx > 0;
      var accResult = buildOutputAccordion(outKey, outReg, isCollapsed);
      renderOutputTypeFields(accResult.body, outKey);
      container.appendChild(accResult.accordion);
    });
    /* Sync code panel with unified config */
    if (!state.codeDraftDirty) {
      el('codeEditor').value = configToCode();
    }
    updateAnnotationPreview();
    return;
  }

  var schema = state.taskType ? REGISTRY[state.taskType] : null;
  if (!schema) return;

  if (state.taskType === 'sequence_labeling' && currentSubtype() === 'aspect_list') {
    var fieldByKey = {};
    schema.fields.forEach(function(field) { fieldByKey[field.key] = field; });
    appendSchemaField(container, fieldByKey.subtype);

    var fieldSection = buildSchemaSection(t('aspectFieldSectionTitle'), t('aspectFieldSectionDesc'));
    var fieldGrid = document.createElement('div');
    fieldGrid.className = 'schema-field-grid';
    appendSchemaField(fieldGrid, fieldByKey.input_field);
    appendSchemaField(fieldGrid, fieldByKey.aspect_list_field);
    fieldSection.appendChild(fieldGrid);
    container.appendChild(fieldSection);

    var ruleSection = buildSchemaSection(t('aspectRuleSectionTitle'), t('aspectRuleSectionDesc'));
    var toggleList = document.createElement('div');
    toggleList.className = 'schema-toggle-list';
    ['allow_sentence_edit', 'allow_aspect_add', 'allow_aspect_delete', 'require_exact_match_in_sentence', 'require_sentiment_context_check'].forEach(function(key) {
      appendSchemaField(toggleList, fieldByKey[key]);
    });
    ruleSection.appendChild(toggleList);
    container.appendChild(ruleSection);

    var limitSection = buildSchemaSection(t('aspectLimitSectionTitle'), t('aspectLimitSectionDesc'));
    var limitGrid = document.createElement('div');
    limitGrid.className = 'schema-field-grid';
    appendSchemaField(limitGrid, fieldByKey.min_aspects);
    appendSchemaField(limitGrid, fieldByKey.max_aspects);
    limitSection.appendChild(limitGrid);
    container.appendChild(limitSection);

    updateAnnotationPreview();
    return;
  }

  if (state.taskType === 'sequence_labeling' && currentSubtype() === 'ner') {
    var nerFieldByKey = {};
    schema.fields.forEach(function(field) { nerFieldByKey[field.key] = field; });
    appendSchemaField(container, nerFieldByKey.subtype);

    var coreSection = buildSchemaSection(t('nerCoreSectionTitle'), t('nerCoreSectionDesc'));
    appendSchemaField(coreSection, nerFieldByKey.entities);
    appendSchemaField(coreSection, nerFieldByKey.scheme);
    appendSchemaField(coreSection, nerFieldByKey.allow_overlapping);
    container.appendChild(coreSection);

    var advancedSection = buildSchemaDisclosureSection(
      t('nerAdvancedSectionTitle'),
      t('nerAdvancedSectionDesc'),
      state.nerAdvancedOpen,
      function(open) { state.nerAdvancedOpen = open; }
    );
    ['input_field', 'entity_field', 'allow_custom_entity_type', 'require_entity_type', 'allow_nested_entities', 'min_entity_length', 'max_entity_length'].forEach(function(key) {
      appendSchemaField(advancedSection.body, nerFieldByKey[key]);
    });
    container.appendChild(advancedSection.section);

    updateAnnotationPreview();
    return;
  }

  if (state.taskType === 'sequence_labeling' && currentSubtype() === 'entity_recognition') {
    var spanFieldByKey = {};
    schema.fields.forEach(function(field) { spanFieldByKey[field.key] = field; });
    appendSchemaField(container, spanFieldByKey.subtype);

    var modeSection = buildSchemaSection(t('spanModeSectionTitle'), t('spanModeSectionDesc'));
    appendSchemaField(modeSection, spanFieldByKey.span_mode);
    container.appendChild(modeSection);

    var spanMode = state.configData.span_mode || 'entity_based';
    if (spanMode === 'entity_based') {
      var entitySection = buildSchemaSection(t('spanEntitySectionTitle'), t('spanEntitySectionDesc'));
      appendSchemaField(entitySection, spanFieldByKey.entities);
      appendSchemaField(entitySection, spanFieldByKey.allow_overlapping);
      appendSchemaField(entitySection, spanFieldByKey.scheme);
      container.appendChild(entitySection);
    } else {
      var polaritySection = buildSchemaSection(t('spanPolaritySectionTitle'), t('spanPolaritySectionDesc'));
      appendSchemaField(polaritySection, spanFieldByKey.polarity_options);
      container.appendChild(polaritySection);
    }

    updateAnnotationPreview();
    return;
  }

  if (state.taskType === 'sentence_pairs') {
    autoPopulateSentencePairsConfig();
    var spFieldByKey = {};
    schema.fields.forEach(function(field) { spFieldByKey[field.key] = field; });

    var modeSection = buildSchemaSection(t('spTaskModeSectionTitle'), t('spTaskModeSectionDesc'));
    var modeGrid = document.createElement('div');
    modeGrid.className = 'schema-field-grid';
    appendSchemaField(modeGrid, spFieldByKey.pair_mode);
    appendSchemaField(modeGrid, spFieldByKey.response_format);
    modeSection.appendChild(modeGrid);
    container.appendChild(modeSection);

    var fieldSection = buildSchemaSection(t('spFieldMappingSectionTitle'), t('spFieldMappingSectionDesc'));
    var fieldGrid = document.createElement('div');
    fieldGrid.className = 'schema-field-grid';
    var s1 = Object.assign({}, spFieldByKey.sentence_1_field, { readOnly: true });
    var s2 = Object.assign({}, spFieldByKey.sentence_2_field, { readOnly: true });
    appendSchemaField(fieldGrid, s1);
    appendSchemaField(fieldGrid, s2);
    fieldSection.appendChild(fieldGrid);
    var labelGrid = document.createElement('div');
    labelGrid.className = 'schema-field-grid';
    appendSchemaField(labelGrid, spFieldByKey.sentence_1_label);
    appendSchemaField(labelGrid, spFieldByKey.sentence_2_label);
    fieldSection.appendChild(labelGrid);
    var evidenceFields = getFieldsByRole('evidence');
    if (evidenceFields.length > 0) {
      var evWrap = document.createElement('div');
      evWrap.className = 'schema-field-wrap';
      var evLabel = document.createElement('label');
      evLabel.className = 'field-label';
      evLabel.textContent = t('spEvidenceFieldsLabel');
      evWrap.appendChild(evLabel);
      var evValue = document.createElement('div');
      evValue.className = 'field-readonly-value';
      evValue.textContent = evidenceFields.join(', ');
      evValue.style.cssText = 'padding:6px 10px;background:var(--color-border-muted);border-radius:6px;color:var(--color-text-soft);font-size:0.85rem;';
      evWrap.appendChild(evValue);
      fieldSection.appendChild(evWrap);
    }
    container.appendChild(fieldSection);

    var responseFormat = state.configData.response_format || 'classification';
    var outputSection = buildSchemaSection(t('spOutputSectionTitle'), t('spOutputSectionDesc'));
    if (responseFormat === 'classification') {
      appendSchemaField(outputSection, spFieldByKey.label_options);
    } else {
      var scoreGrid = document.createElement('div');
      scoreGrid.className = 'schema-field-grid schema-field-grid-3';
      appendSchemaField(scoreGrid, spFieldByKey.score_min);
      appendSchemaField(scoreGrid, spFieldByKey.score_max);
      appendSchemaField(scoreGrid, spFieldByKey.score_step);
      outputSection.appendChild(scoreGrid);
    }
    container.appendChild(outputSection);

    var annotationSection = buildSchemaSection(t('spAnnotationSectionTitle'), t('spAnnotationSectionDesc'));
    var toggleList = document.createElement('div');
    toggleList.className = 'schema-toggle-list';
    appendSchemaField(toggleList, spFieldByKey.allow_unsure);
    appendSchemaField(toggleList, spFieldByKey.note_enabled);
    annotationSection.appendChild(toggleList);
    container.appendChild(annotationSection);

    updateAnnotationPreview();
    return;
  }

  schema.fields.forEach(function(field) {
    if (!fieldVisible(field)) return;
    appendSchemaField(container, field);
  });
  updateAnnotationPreview();
}

function buildTagInput(field) {
  var tags = Array.isArray(state.configData[field.key]) ? state.configData[field.key].slice() : [];
  var isComposing = false;
  state.configData[field.key] = tags;
  var wrap = document.createElement('div');
  wrap.className = 'tag-input-wrap';

  function render() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    tags.forEach(function(tag, i) {
      var pill = document.createElement('span');
      pill.className = 'tag-pill';
      var pillText = document.createTextNode(tag);
      pill.appendChild(pillText);
      var rm = document.createElement('button');
      rm.className = 'tag-pill-remove';
      rm.setAttribute('aria-label', '移除');
      rm.setAttribute('type', 'button');
      /* static SVG, no user content */
      rm.innerHTML = '<svg style="width:10px;height:10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      (function(idx) {
        rm.addEventListener('click', function() {
          tags.splice(idx, 1);
          render(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(i));
      pill.appendChild(rm);
      wrap.appendChild(pill);
    });
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'tag-new-input';
    inp.placeholder = ('placeholder_' + state.lang) in field ? field['placeholder_' + state.lang] : (field['hint_' + state.lang] || '');
    inp.addEventListener('compositionstart', function() { isComposing = true; });
    inp.addEventListener('compositionend', function() { isComposing = false; });
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ',') {
        if (e.isComposing || isComposing || e.keyCode === 229) return;
        e.preventDefault();
        var val = inp.value.trim();
        if (val) {
          inp.value = '';
          if (tags.indexOf(val) === -1) {
            tags.push(val);
            render();
            setTimeout(function() {
              var nextInp = wrap.querySelector('.tag-new-input');
              if (nextInp) nextInp.focus();
            }, 0);
            markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
          }
        }
      }
    });
    wrap.appendChild(inp);
  }
  render();
  return wrap;
}

function buildEntityList(field) {
  var entities = Array.isArray(state.configData[field.key]) ? state.configData[field.key] : [];
  state.configData[field.key] = entities;
  var wrap = document.createElement('div');

  /* static remove-icon path (never user data) */
  var REMOVE_SVG = '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var ADD_SVG = '<svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  function render() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    entities.forEach(function(ent, i) {
      var row = document.createElement('div');
      row.className = 'entity-row';

      var dot = document.createElement('div');
      dot.className = 'entity-color-dot';
      dot.style.background = ent.color || ENTITY_COLORS[i % ENTITY_COLORS.length];

      var nameInp = document.createElement('input');
      nameInp.type = 'text'; nameInp.className = 'entity-name-input';
      nameInp.value = ent.name;
      nameInp.placeholder = state.lang === 'en' ? 'Entity name, e.g. PER' : '實體名稱，如 PER';
      (function(idx) {
        nameInp.addEventListener('input', function() {
          entities[idx].name = nameInp.value;
          markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(i));

      var rmBtn = document.createElement('button');
      rmBtn.className = 'entity-remove-btn';
      rmBtn.setAttribute('aria-label', '移除');
      rmBtn.setAttribute('type', 'button');
      rmBtn.innerHTML = REMOVE_SVG; /* static SVG, safe */
      (function(idx) {
        rmBtn.addEventListener('click', function() {
          entities.splice(idx, 1);
          render(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
        });
      }(i));

      row.appendChild(dot);
      row.appendChild(nameInp);
      row.appendChild(rmBtn);
      wrap.appendChild(row);
    });

    var addBtn = document.createElement('button');
    addBtn.className = 'add-row-btn';
    addBtn.setAttribute('type', 'button');
    addBtn.innerHTML = ADD_SVG; /* static SVG, safe */
    addBtn.appendChild(document.createTextNode(' ' + t('addEntity')));
    addBtn.addEventListener('click', function() {
      entities.push({ name: '', color: ENTITY_COLORS[entities.length % ENTITY_COLORS.length] });
      render(); markDirty(); updateAnnotationPreview(); revalidateCurrentStep();
    });
    wrap.appendChild(addBtn);
  }
  render();
  return wrap;
}

function normalizeVADimensionConfig(key, fallback) {
  var dim = state.configData[key];
  if (!dim || typeof dim !== 'object') dim = {};
  var min = Number(dim.min);
  var max = Number(dim.max);
  var step = Number(dim.step);
  if (!Number.isFinite(min)) min = fallback.min;
  if (!Number.isFinite(max)) max = fallback.max;
  if (!Number.isFinite(step) || step <= 0) step = fallback.step;
  if (max < min) max = min;
  state.configData[key] = { min: min, max: max, step: step };
}

function buildVADimensionsInput() {
  normalizeVADimensionConfig('valence', { min: 1, max: 9, step: 1 });
  normalizeVADimensionConfig('arousal', { min: 1, max: 9, step: 1 });
  var wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '12px';

  function makeDimensionRow(key, title) {
    var row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    row.style.gap = '10px';
    row.style.padding = '10px 12px';
    row.style.border = '1px solid var(--color-border)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.background = 'var(--color-slate-50)';

    var titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.gridColumn = '1 / -1';
    titleEl.style.fontWeight = '600';
    titleEl.style.fontSize = '13px';
    row.appendChild(titleEl);

    [
      { prop: 'min', zh: '最小值', en: 'Min' },
      { prop: 'max', zh: '最大值', en: 'Max' },
      { prop: 'step', zh: '間距', en: 'Step' },
    ].forEach(function(item) {
      var fieldWrap = document.createElement('label');
      fieldWrap.style.display = 'flex';
      fieldWrap.style.flexDirection = 'column';
      fieldWrap.style.gap = '6px';
      fieldWrap.style.fontSize = '12px';
      fieldWrap.style.color = 'var(--color-text-soft)';

      var label = document.createElement('span');
      label.textContent = state.lang === 'en' ? item.en : item.zh;
      fieldWrap.appendChild(label);

      var input = document.createElement('input');
      input.type = 'number';
      input.className = 'input-text';
      input.step = 'any';
      input.value = String(state.configData[key][item.prop]);
      input.addEventListener('input', function() {
        var numeric = Number(input.value);
        state.configData[key][item.prop] = Number.isFinite(numeric) ? numeric : input.value;
        markDirty();
        updateAnnotationPreview();
        revalidateCurrentStep();
      });
      input.addEventListener('blur', function() {
        var defaults = key === 'valence' ? { min: 1, max: 9, step: 1 } : { min: 1, max: 9, step: 1 };
        normalizeVADimensionConfig(key, defaults);
        input.value = String(state.configData[key][item.prop]);
        markDirty();
        updateAnnotationPreview();
        revalidateCurrentStep();
      });
      fieldWrap.appendChild(input);
      row.appendChild(fieldWrap);
    });

    return row;
  }

  wrap.appendChild(makeDimensionRow('valence', 'Valence'));
  wrap.appendChild(makeDimensionRow('arousal', 'Arousal'));
  return wrap;
}

function buildScoreOptionsFromDimension(dimConfig) {
  if (!dimConfig || typeof dimConfig !== 'object') return [];
  var min = Number(dimConfig.min);
  var max = Number(dimConfig.max);
  var step = Number(dimConfig.step);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) return [];
  if (step <= 0 || max < min) return [];
  var values = [];
  var precision = step % 1 === 0 ? 0 : String(step).split('.')[1].length;
  for (var value = min; value <= max + step / 1000; value += step) {
    values.push({ text: value.toFixed(precision), color: null });
  }
  return values;
}

function appendPreviewOptionRows(optionsWrap, options, singleSelectPreview) {
  options.forEach(function(option) {
    var row = document.createElement('label');
    row.className = 'annotation-preview-option';

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    if (singleSelectPreview) {
      checkbox.addEventListener('change', function() {
        if (!checkbox.checked) return;
        optionsWrap.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
          if (cb !== checkbox) cb.checked = false;
        });
      });
    }
    row.appendChild(checkbox);

    if (option.color) {
      var color = document.createElement('span');
      color.className = 'annotation-preview-color';
      color.style.background = option.color;
      row.appendChild(color);
    }

    var text = document.createElement('span');
    text.textContent = option.text;
    row.appendChild(text);

    optionsWrap.appendChild(row);
  });
}

function renderSentencePairsPreview(preview, config) {
  var rawRow = state.datasetRawFirstRow || {};
  var s1Field = config.sentence_1_field || '';
  var s2Field = config.sentence_2_field || '';
  var pairTexts = getDatasetPairTexts();
  if (!s1Field && pairTexts) s1Field = pairTexts.col1;
  if (!s2Field && pairTexts) s2Field = pairTexts.col2;
  var s1Label = config.sentence_1_label || s1Field || 'Sentence 1';
  var s2Label = config.sentence_2_label || s2Field || 'Sentence 2';
  var _s1Raw = rawRow[s1Field]; var s1Text = (_s1Raw !== undefined && _s1Raw !== null) ? String(_s1Raw) : (pairTexts ? pairTexts.text1 : (state.lang === 'en' ? '(no data)' : '（無資料）'));
  var _s2Raw = rawRow[s2Field]; var s2Text = (_s2Raw !== undefined && _s2Raw !== null) ? String(_s2Raw) : (pairTexts ? pairTexts.text2 : (state.lang === 'en' ? '(no data)' : '（無資料）'));

  var pairWrap = document.createElement('div');
  pairWrap.className = 'annotation-preview-pair';

  var p1LabelEl = document.createElement('div');
  p1LabelEl.className = 'annotation-preview-pair-label';
  p1LabelEl.textContent = s1Label;
  pairWrap.appendChild(p1LabelEl);
  var p1 = document.createElement('div');
  p1.className = 'annotation-preview-sample';
  p1.textContent = String(s1Text).length > 300 ? String(s1Text).substring(0, 300) + '…' : String(s1Text);
  pairWrap.appendChild(p1);

  var p2LabelEl = document.createElement('div');
  p2LabelEl.className = 'annotation-preview-pair-label';
  p2LabelEl.textContent = s2Label;
  pairWrap.appendChild(p2LabelEl);
  var p2 = document.createElement('div');
  p2.className = 'annotation-preview-sample';
  p2.textContent = String(s2Text).length > 300 ? String(s2Text).substring(0, 300) + '…' : String(s2Text);
  pairWrap.appendChild(p2);

  preview.appendChild(pairWrap);

  var divider = document.createElement('div');
  divider.className = 'annotation-preview-divider';
  preview.appendChild(divider);

  var responseFormat = config.response_format || 'classification';
  if (responseFormat === 'classification') {
    var labels = Array.isArray(config.label_options) ? config.label_options.filter(function(l) { return l && l.trim(); }) : [];
    if (labels.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'annotation-preview-empty';
      empty.textContent = t('previewEmpty');
      preview.appendChild(empty);
    } else {
      var title = document.createElement('div');
      title.className = 'annotation-preview-task-title';
      title.textContent = t('previewTaskChooseLabel');
      preview.appendChild(title);
      var optionsWrap = document.createElement('div');
      optionsWrap.className = 'annotation-preview-options';
      labels.forEach(function(label) {
        var row = document.createElement('label');
        row.className = 'annotation-preview-option';
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'sp_preview_label';
        radio.disabled = true;
        row.appendChild(radio);
        var span = document.createElement('span');
        span.textContent = label;
        row.appendChild(span);
        optionsWrap.appendChild(row);
      });
      preview.appendChild(optionsWrap);
    }
  } else {
    var scoreTitle = document.createElement('div');
    scoreTitle.className = 'annotation-preview-task-title';
    scoreTitle.textContent = state.lang === 'en' ? 'Score' : '評分';
    preview.appendChild(scoreTitle);
    var scoreWrap = document.createElement('div');
    scoreWrap.className = 'annotation-preview-options';
    var sMin = typeof config.score_min === 'number' ? config.score_min : 1;
    var sMax = typeof config.score_max === 'number' ? config.score_max : 5;
    var sStep = typeof config.score_step === 'number' ? config.score_step : 1;
    for (var s = sMin; s <= sMax; s += sStep) {
      var sRow = document.createElement('label');
      sRow.className = 'annotation-preview-option';
      var sRadio = document.createElement('input');
      sRadio.type = 'radio';
      sRadio.name = 'sp_preview_score';
      sRadio.disabled = true;
      sRow.appendChild(sRadio);
      var sSpan = document.createElement('span');
      sSpan.textContent = String(s);
      sRow.appendChild(sSpan);
      scoreWrap.appendChild(sRow);
    }
    preview.appendChild(scoreWrap);
  }

  if (config.allow_unsure) {
    var unsureDiv = document.createElement('div');
    unsureDiv.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid var(--color-border);';
    var unsureRow = document.createElement('label');
    unsureRow.className = 'annotation-preview-option';
    var unsureRadio = document.createElement('input');
    unsureRadio.type = 'radio';
    unsureRadio.name = 'sp_preview_label';
    unsureRadio.disabled = true;
    unsureRow.appendChild(unsureRadio);
    var unsureSpan = document.createElement('span');
    unsureSpan.style.color = 'var(--color-ink-muted)';
    unsureSpan.textContent = state.lang === 'en' ? 'Unsure' : '不確定';
    unsureRow.appendChild(unsureSpan);
    unsureDiv.appendChild(unsureRow);
    preview.appendChild(unsureDiv);
  }

  if (config.note_enabled) {
    var noteWrap = document.createElement('div');
    noteWrap.style.cssText = 'margin-top:8px;';
    var noteTextarea = document.createElement('textarea');
    noteTextarea.disabled = true;
    noteTextarea.placeholder = state.lang === 'en' ? 'Add a note (optional)' : '新增備註（選填）';
    noteTextarea.style.cssText = 'width:100%;border:1px solid var(--color-border);border-radius:6px;padding:6px 10px;font-size:0.8rem;resize:vertical;min-height:48px;background:var(--color-slate-50);color:var(--color-ink-muted);';
    noteWrap.appendChild(noteTextarea);
    preview.appendChild(noteWrap);
  }
}

function renderAspectListPreview(preview, config) {
  var allowEdit = !!config.allow_sentence_edit;
  var allowAdd  = config.allow_aspect_add !== false;
  var allowDel  = config.allow_aspect_delete !== false;
  var showSentimentHint = !!config.require_sentiment_context_check;

  var realText = getDatasetPreviewText();
  var SAMPLE_SENTENCE = realText ? (realText.length > 300 ? realText.substring(0, 300) + '…' : realText) : t('previewSampleSentenceAspectList');
  var SAMPLE_ASPECTS  = state.lang === 'zh'
    ? ['服務態度', '環境整潔', '餐點品質']
    : ['service attitude', 'cleanliness', 'food quality'];

  /* Sentence section */
  var sentenceSection = document.createElement('div');
  sentenceSection.className = 'aspect-list-preview-sentence';

  var sentLabel = document.createElement('div');
  sentLabel.className = 'annotation-preview-task-title';
  sentLabel.textContent = t('aspectListSentenceLabel');
  sentenceSection.appendChild(sentLabel);

  if (allowEdit) {
    var sentInput = document.createElement('textarea');
    sentInput.className = 'aspect-list-preview-sentence-input';
    sentInput.value = SAMPLE_SENTENCE;
    sentInput.rows = 2;
    sentenceSection.appendChild(sentInput);
  } else {
    var sentReadonly = document.createElement('div');
    sentReadonly.className = 'aspect-list-preview-sentence-readonly';
    sentReadonly.textContent = SAMPLE_SENTENCE;
    sentenceSection.appendChild(sentReadonly);
  }
  preview.appendChild(sentenceSection);

  var divider = document.createElement('div');
  divider.className = 'annotation-preview-divider';
  preview.appendChild(divider);

  var listTitle = document.createElement('div');
  listTitle.className = 'annotation-preview-task-title';
  listTitle.textContent = t('aspectListPreviewTitle');
  preview.appendChild(listTitle);

  var rowsWrap = document.createElement('div');
  rowsWrap.className = 'aspect-list-preview-rows';

  var aspects = SAMPLE_ASPECTS.slice();

  function renderRows() {
    while (rowsWrap.firstChild) rowsWrap.removeChild(rowsWrap.firstChild);
    aspects.forEach(function(aspect, i) {
      var row = document.createElement('div');
      row.className = 'aspect-list-preview-row';

      var rowLabel = document.createElement('span');
      rowLabel.className = 'aspect-list-preview-row-label';
      rowLabel.textContent = 'Aspect ' + (i + 1);
      row.appendChild(rowLabel);

      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'aspect-list-preview-input';
      inp.value = aspect;
      inp.placeholder = t('aspectRowPlaceholder');
      (function(idx) {
        inp.addEventListener('input', function() { aspects[idx] = inp.value; });
      }(i));
      row.appendChild(inp);

      if (allowDel) {
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'aspect-list-preview-delete';
        delBtn.setAttribute('aria-label', '刪除');
        delBtn.appendChild(makeXIcon(12));
        (function(idx) {
          delBtn.addEventListener('click', function() { aspects.splice(idx, 1); renderRows(); });
        }(i));
        row.appendChild(delBtn);
      }
      rowsWrap.appendChild(row);
    });

    if (allowAdd) {
      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'aspect-list-preview-add';
      addBtn.appendChild(makePlusIcon(12));
      addBtn.appendChild(document.createTextNode(' ' + t('addAspectBtnLabel').replace(/^[+＋]\s*/, '')));
      addBtn.addEventListener('click', function() { aspects.push(''); renderRows(); });
      rowsWrap.appendChild(addBtn);
    }
  }
  renderRows();
  preview.appendChild(rowsWrap);

  if (showSentimentHint) {
    var hint = document.createElement('div');
    hint.className = 'aspect-list-preview-hint';
    hint.textContent = t('requireSentimentContextHint');
    preview.appendChild(hint);
  }

  if (!state.codeDraftDirty) {
    el('codeEditor').value = configToCode();
  }
}

function renderRelationExtractionPreview(preview, config) {
  var entityTypes = Array.isArray(config.entity_types) ? config.entity_types.filter(function(e) { return e && e.name; }) : [];
  var relationTypes = Array.isArray(config.relation_types) ? config.relation_types.filter(Boolean) : [];

  /* Sample sentence — use uploaded data if available */
  var realText = getDatasetPreviewText();
  var sampleEl = document.createElement('div');
  sampleEl.className = 'annotation-preview-sample';
  sampleEl.textContent = realText ? (realText.length > 300 ? realText.substring(0, 300) + '…' : realText) : t('previewSampleSentenceRelation');
  preview.appendChild(sampleEl);

  var divider = document.createElement('div');
  divider.className = 'annotation-preview-divider';
  preview.appendChild(divider);

  /* Entity type buttons */
  var etLabel = document.createElement('div');
  etLabel.className = 'annotation-preview-task-title';
  etLabel.textContent = t('previewTaskEntityType');
  preview.appendChild(etLabel);

  var btnsRow = document.createElement('div');
  btnsRow.className = 're-preview-entity-btns';
  (entityTypes.length ? entityTypes : [{ name: 'BODY', color: '#6366F1' }, { name: 'SYMP', color: '#F59E0B' }]).forEach(function(et) {
    var btn = document.createElement('span');
    btn.className = 're-preview-entity-btn';
    btn.textContent = et.name;
    btn.style.borderColor = et.color || '#94A3B8';
    btn.style.color = et.color || '#94A3B8';
    btnsRow.appendChild(btn);
  });
  preview.appendChild(btnsRow);

  /* Sample entity list */
  var elLabel = document.createElement('div');
  elLabel.className = 'annotation-preview-task-title';
  elLabel.textContent = t('previewEntityList');
  preview.appendChild(elLabel);

  var sampleEntities = state.lang === 'zh'
    ? [{ text: '阿司匹靈', type: 'DRUG', color: '#10B981' }, { text: '頭痛', type: 'SYMP', color: '#F59E0B' }]
    : [{ text: 'Aspirin', type: 'DRUG', color: '#10B981' }, { text: 'headache', type: 'SYMP', color: '#F59E0B' }];
  var entityListEl = document.createElement('div');
  entityListEl.className = 're-preview-entity-list';
  sampleEntities.forEach(function(e) {
    var row = document.createElement('div');
    row.className = 're-preview-entity-row';
    var badge = document.createElement('span');
    badge.className = 're-preview-entity-badge';
    badge.style.background = e.color + '22';
    badge.style.color = e.color;
    badge.style.borderColor = e.color + '66';
    badge.textContent = e.type;
    var text = document.createElement('span');
    text.className = 're-preview-entity-text';
    text.textContent = e.text;
    row.appendChild(badge);
    row.appendChild(text);
    entityListEl.appendChild(row);
  });
  preview.appendChild(entityListEl);

  var div2 = document.createElement('div');
  div2.className = 'annotation-preview-divider';
  preview.appendChild(div2);

  /* Relation builder */
  var relLabel = document.createElement('div');
  relLabel.className = 'annotation-preview-task-title';
  relLabel.textContent = t('previewRelationType');
  preview.appendChild(relLabel);

  var grid = document.createElement('div');
  grid.className = 're-preview-relation-grid';
  [{ key: 'E1/Arg1', idx: 0 }, { key: 'Relation', idx: -1 }, { key: 'E2/Arg2', idx: 1 }].forEach(function(col) {
    var cell = document.createElement('div');
    var lbl = document.createElement('div');
    lbl.className = 're-preview-role-label';
    lbl.textContent = col.key;
    var sel = document.createElement('select');
    sel.className = 're-preview-select';
    if (col.idx === -1) {
      (relationTypes.length ? relationTypes : ['causes', 'treats']).forEach(function(r) {
        var opt = document.createElement('option');
        opt.textContent = r;
        sel.appendChild(opt);
      });
    } else {
      sampleEntities.forEach(function(e) {
        var opt = document.createElement('option');
        opt.textContent = '[' + e.type + '] ' + e.text;
        sel.appendChild(opt);
      });
    }
    cell.appendChild(lbl);
    cell.appendChild(sel);
    grid.appendChild(cell);
  });
  preview.appendChild(grid);

  /* Sample triple */
  var tlLabel = document.createElement('div');
  tlLabel.className = 'annotation-preview-task-title';
  tlLabel.textContent = t('previewTripleList');
  preview.appendChild(tlLabel);

  var tripleRow = document.createElement('div');
  tripleRow.className = 're-preview-triple-row';
  var sampleRel = relationTypes.length ? relationTypes[0] : 'treats';
  [sampleEntities[0].text + '/' + sampleEntities[0].type, '→', sampleRel, '→', sampleEntities[1].text + '/' + sampleEntities[1].type].forEach(function(part, i) {
    if (i === 2) {
      var rb = document.createElement('span');
      rb.className = 're-preview-relation-badge';
      rb.textContent = part;
      tripleRow.appendChild(rb);
    } else if (i === 0 || i === 4) {
      var eb = document.createElement('span');
      eb.style.fontWeight = '600';
      eb.style.fontSize = '11px';
      eb.textContent = part;
      tripleRow.appendChild(eb);
    } else {
      var ar = document.createElement('span');
      ar.style.color = 'var(--color-text-soft)';
      ar.textContent = part;
      tripleRow.appendChild(ar);
    }
  });
  preview.appendChild(tripleRow);
}

function updateAnnotationPreview() {
  var preview = el('annotationPreview');
  if (!preview) return;
  while (preview.firstChild) preview.removeChild(preview.firstChild);

  /* ADR-029: output-type composition preview */
  if (state.selectedOutputTypes.length >= 1) {
    var hasOutputOwnedInputPreview = state.selectedOutputTypes.some(function(outKey) {
      var outReg = OUTPUT_TYPE_REGISTRY[outKey];
      return outReg && outReg.rendersInputPreview === true;
    });
    var hasEvidencePreviewOutput = state.selectedOutputTypes.some(function(outKey) {
      var outReg = OUTPUT_TYPE_REGISTRY[outKey];
      return outReg && outReg.rendersEvidencePreview === true;
    });
    var evidenceCols = getFieldsByRole('evidence');
    if (hasEvidencePreviewOutput && evidenceCols.length > 0) {
      var evidenceWrap = document.createElement('div');
      evidenceWrap.setAttribute('data-testid', 'generation-evidence-preview');

      var evidenceHeading = document.createElement('div');
      evidenceHeading.className = 'annotation-preview-task-title';
      evidenceHeading.style.marginBottom = '8px';
      evidenceHeading.textContent = t('previewEvidenceHeading');
      evidenceWrap.appendChild(evidenceHeading);

      evidenceCols.forEach(function(col) {
        if (evidenceCols.length > 1) {
          var evidenceLabel = document.createElement('div');
          evidenceLabel.className = 'annotation-preview-pair-label';
          evidenceLabel.textContent = col;
          evidenceWrap.appendChild(evidenceLabel);
        }
        var evidenceValue = state.datasetRawFirstRow ? state.datasetRawFirstRow[col] : undefined;
        var evidenceText = evidenceValue === undefined || evidenceValue === null
          ? ''
          : (typeof evidenceValue === 'object' ? JSON.stringify(evidenceValue) : String(evidenceValue));
        var evidenceContent = document.createElement('div');
        evidenceContent.className = 'annotation-preview-sample';
        evidenceContent.textContent = evidenceText.length > 500 ? evidenceText.substring(0, 500) + '…' : evidenceText;
        evidenceWrap.appendChild(evidenceContent);
      });

      preview.appendChild(evidenceWrap);
    }
    /* Show input text (single_item or item_pair) before output previews */
    var currentInputType = (state.taskInputTypes && state.taskInputTypes[0]) || 'single_item';
    if (!hasOutputOwnedInputPreview && currentInputType === 'item_pair') {
      var pairTexts = getDatasetPairTexts();
      var pairLabels = getItemPairLabels();
      var pairWrap = document.createElement('div');
      pairWrap.className = 'annotation-preview-pair';

      var pairHeading = document.createElement('div');
      pairHeading.className = 'annotation-preview-task-title';
      pairHeading.textContent = t('previewSourceTextTitle');
      pairWrap.appendChild(pairHeading);

      var p1Label = document.createElement('div');
      p1Label.className = 'annotation-preview-pair-label';
      p1Label.textContent = pairLabels[0];
      pairWrap.appendChild(p1Label);
      var p1 = document.createElement('div');
      p1.className = 'annotation-preview-sample';
      var _t1 = pairTexts ? pairTexts.text1 : t('previewSampleSentenceA');
      p1.textContent = _t1.length > 300 ? _t1.substring(0, 300) + '…' : _t1;
      pairWrap.appendChild(p1);

      var p2Label = document.createElement('div');
      p2Label.className = 'annotation-preview-pair-label';
      p2Label.textContent = pairLabels[1];
      pairWrap.appendChild(p2Label);
      var p2 = document.createElement('div');
      p2.className = 'annotation-preview-sample';
      var _t2 = pairTexts ? pairTexts.text2 : t('previewSampleSentenceB');
      p2.textContent = _t2.length > 300 ? _t2.substring(0, 300) + '…' : _t2;
      pairWrap.appendChild(p2);

      preview.appendChild(pairWrap);
      var _pairDiv = document.createElement('div');
      _pairDiv.className = 'annotation-preview-divider';
      preview.appendChild(_pairDiv);
    } else if (!hasOutputOwnedInputPreview) {
      var inputCols = getFieldsByRole('input');
      var _rawInputVal = (inputCols.length > 0 && state.datasetRawFirstRow) ? state.datasetRawFirstRow[inputCols[0]] : undefined;
      var sampleText = (_rawInputVal !== undefined && _rawInputVal !== null) ? String(_rawInputVal) : (getDatasetPreviewText() || t('previewSampleSentence'));
      var _inputLabel = document.createElement('div');
      _inputLabel.className = 'annotation-preview-task-title';
      _inputLabel.style.marginBottom = '6px';
      _inputLabel.textContent = t('previewSourceTextTitle');
      preview.appendChild(_inputLabel);

      var _sample = document.createElement('div');
      _sample.className = 'annotation-preview-sample';
      if (hasEvidencePreviewOutput) {
        _sample.setAttribute('data-testid', 'generation-input-preview');
      }
      _sample.textContent = sampleText.length > 300 ? sampleText.substring(0, 300) + '…' : sampleText;
      preview.appendChild(_sample);
      var _sampleDiv = document.createElement('div');
      _sampleDiv.className = 'annotation-preview-divider';
      preview.appendChild(_sampleDiv);
    }

    /* Check if any output has a dependency on another selected output */
    var hasDependency = state.selectedOutputTypes.some(function(outKey) {
      var srcKey = OUTPUT_TYPE_DEPS[outKey];
      return srcKey && state.selectedOutputTypes.indexOf(srcKey) >= 0;
    });

    if (hasDependency) {
      /* Unified preview for dependent outputs (e.g. ABSA: Entity Recognition + Relation Identification) */
      var unifiedWrap = document.createElement('div');
      unifiedWrap.className = 'preview-unified';
      renderAbsaUnifiedPreview(unifiedWrap);
      preview.appendChild(unifiedWrap);

      /* Render independent outputs that aren't part of a dependency chain */
      var depSet = {};
      state.selectedOutputTypes.forEach(function(outKey) {
        var srcKey = OUTPUT_TYPE_DEPS[outKey];
        if (srcKey && state.selectedOutputTypes.indexOf(srcKey) >= 0) {
          depSet[outKey] = true;
          depSet[srcKey] = true;
        }
      });
      var independentOuts = state.selectedOutputTypes.filter(function(outKey) { return !depSet[outKey]; });
      if (independentOuts.length > 0) {
        independentOuts.forEach(function(outKey) {
          var outReg = OUTPUT_TYPE_REGISTRY[outKey];
          var divider = document.createElement('div');
          divider.className = 'annotation-preview-divider';
          preview.appendChild(divider);
          if (!(outReg && outReg.hidePreviewTitle)) {
            var cardTitle = document.createElement('div');
            cardTitle.className = 'annotation-preview-task-title';
            cardTitle.textContent = outReg ? (outReg[state.lang] || outReg.zh) : outKey;
            preview.appendChild(cardTitle);
          }
          var outWrap = document.createElement('div');
          preview.appendChild(outWrap);
          renderOutputPreview(outWrap, outKey);
        });
      }
    } else {
      /* Preview cards for independent outputs */
      var orderedPreviewOutputs = state.selectedOutputTypes
        .map(function(outKey, originalIndex) {
          var outReg = OUTPUT_TYPE_REGISTRY[outKey] || {};
          var previewRank = outReg.rendersEvidencePreview === true
            ? 2
            : (outReg.rendersInputPreview === true ? 0 : 1);
          return { key: outKey, rank: previewRank, originalIndex: originalIndex };
        })
        .sort(function(a, b) {
          return a.rank - b.rank || a.originalIndex - b.originalIndex;
        })
        .map(function(item) { return item.key; });
      orderedPreviewOutputs.forEach(function(outKey, idx) {
        if (idx > 0) {
          var divider = document.createElement('div');
          divider.className = 'annotation-preview-divider';
          preview.appendChild(divider);
        }
        var outReg = OUTPUT_TYPE_REGISTRY[outKey];
        if (!(outReg && outReg.hidePreviewTitle)) {
          var cardTitle = document.createElement('div');
          cardTitle.className = 'annotation-preview-task-title';
          cardTitle.style.marginBottom = '8px';
          cardTitle.textContent = outReg ? (outReg[state.lang] || outReg.zh) : outKey;
          preview.appendChild(cardTitle);
        }
        var outWrap = document.createElement('div');
        preview.appendChild(outWrap);
        renderOutputPreview(outWrap, outKey);
      });
    }
    if (!state.codeDraftDirty) {
      el('codeEditor').value = configToCode();
    }
    return;
  }

  var taskType = state.taskType;
  var config = state.configData || {};
  var titleText = t('previewTaskChooseLabel');
  var options = [];

  if (taskType === 'sentence_pairs') {
    renderSentencePairsPreview(preview, config);
    return;
  } else if (taskType === 'sequence_labeling' && currentSubtype() === 'aspect_list') {
    renderAspectListPreview(preview, config);
    return;
  } else if (taskType === 'relation_extraction') {
    renderRelationExtractionPreview(preview, config);
    return;
  } else if (taskType === 'sequence_labeling' && currentSubtype() === 'entity_recognition') {
    var spanMode = config.span_mode || 'entity_based';
    if (spanMode === 'polarity_based') {
      titleText = t('previewSpanPolarityTitle');
      options = Array.isArray(config.polarity_options) ? config.polarity_options.filter(function(tag) { return tag && tag.trim(); }).map(function(tag) {
        return { text: tag.trim(), color: null };
      }) : [];
    } else {
      titleText = t('previewTaskEntity');
      options = Array.isArray(config.entities) ? config.entities.filter(function(ent) { return ent && ent.name && ent.name.trim(); }).map(function(ent) {
        return { text: ent.name.trim(), color: ent.color || null };
      }) : [];
    }
  } else if (taskType === 'sequence_labeling') {
    titleText = t('previewTaskEntity');
    options = Array.isArray(config.entities) ? config.entities.filter(function(ent) { return ent && ent.name && ent.name.trim(); }).map(function(ent) {
      return { text: ent.name.trim(), color: ent.color || null };
    }) : [];
  } else if (taskType === 'single_sentence_va_scoring') {
    titleText = t('previewTaskValence');
    options = buildScoreOptionsFromDimension(config.valence);
  } else {
    options = Array.isArray(config.labels) ? config.labels.filter(function(tag) { return tag && tag.trim(); }).map(function(tag) {
      return { text: tag.trim(), color: null };
    }) : [];
  }

  {
    var sampleTextKey = 'previewSampleSentence';
    if (taskType === 'single_sentence_va_scoring') sampleTextKey = 'previewSampleSentenceVA';
    else if (taskType === 'sequence_labeling' && currentSubtype() === 'entity_recognition') sampleTextKey = 'previewSampleSentenceSpan';
    else if (taskType === 'sequence_labeling') sampleTextKey = 'previewSampleSentenceSequence';
    else if (taskType === 'relation_extraction') sampleTextKey = 'previewSampleSentenceRelation';
    var realText = getDatasetPreviewText();
    var sample = document.createElement('div');
    sample.className = 'annotation-preview-sample';
    sample.textContent = realText ? (realText.length > 300 ? realText.substring(0, 300) + '…' : realText) : t(sampleTextKey);
    preview.appendChild(sample);
  }

  var divider = document.createElement('div');
  divider.className = 'annotation-preview-divider';
  preview.appendChild(divider);

  var title = document.createElement('div');
  title.className = 'annotation-preview-task-title';
  title.textContent = titleText;
  preview.appendChild(title);

  var optionsWrap = document.createElement('div');
  optionsWrap.className = 'annotation-preview-options';
  preview.appendChild(optionsWrap);

  var singleSelectPreview =
    taskType === 'single_sentence_va_scoring' ||
    (taskType === 'single_sentence_classification' && !config.allow_multiple);

  if (taskType === 'single_sentence_va_scoring') {
    var arousalTitle = document.createElement('div');
    arousalTitle.className = 'annotation-preview-task-title';
    arousalTitle.style.marginTop = '8px';

    if (!options.length) {
      var emptyVa = document.createElement('div');
      emptyVa.className = 'annotation-preview-empty';
      emptyVa.textContent = t('previewEmpty');
      optionsWrap.appendChild(emptyVa);
    } else {
      appendPreviewOptionRows(optionsWrap, options, singleSelectPreview);
    }

    arousalTitle.textContent = t('previewTaskArousal');
    preview.appendChild(arousalTitle);

    var arousalOptionsWrap = document.createElement('div');
    arousalOptionsWrap.className = 'annotation-preview-options';
    preview.appendChild(arousalOptionsWrap);

    var arousalOptions = buildScoreOptionsFromDimension(config.arousal);
    if (!arousalOptions.length) {
      var emptyArousal = document.createElement('div');
      emptyArousal.className = 'annotation-preview-empty';
      emptyArousal.textContent = t('previewEmpty');
      arousalOptionsWrap.appendChild(emptyArousal);
    } else {
      appendPreviewOptionRows(arousalOptionsWrap, arousalOptions, singleSelectPreview);
    }
  } else if (!options.length) {
    var empty = document.createElement('div');
    empty.className = 'annotation-preview-empty';
    empty.textContent = t('previewEmpty');
    optionsWrap.appendChild(empty);
  } else {
    appendPreviewOptionRows(optionsWrap, options, singleSelectPreview);
  }

  if (!state.codeDraftDirty) {
    el('codeEditor').value = configToCode();
  }
}

/* ── Template picker ─────────────────────────────────────────── */
function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getDefaultTemplateForLang(taskType, lang) {
  var schema = taskType ? REGISTRY[taskType] : null;
  if (!schema) return {};
  if (schema.defaultTemplateI18n && schema.defaultTemplateI18n[lang]) {
    return cloneObject(schema.defaultTemplateI18n[lang]);
  }
  return cloneObject(schema.defaultTemplate || {});
}

function syncI18nTemplateConfig(prevLang, nextLang) {
  if (prevLang === nextLang || state.codeDraftDirty || !state.taskType) return;
  var schema = REGISTRY[state.taskType];
  if (!schema || !schema.defaultTemplateI18n) return;

  var prevTpl = schema.defaultTemplateI18n[prevLang];
  var nextTpl = schema.defaultTemplateI18n[nextLang];
  if (!prevTpl || !nextTpl) return;

  if (Array.isArray(prevTpl.labels) && Array.isArray(nextTpl.labels) && Array.isArray(state.configData.labels)) {
    var sameAsPrev = state.configData.labels.length === prevTpl.labels.length && state.configData.labels.every(function(v, i) {
      return v === prevTpl.labels[i];
    });
    if (sameAsPrev) state.configData.labels = nextTpl.labels.slice();
  }
}

function syncOutputConfigI18nDefaults(prevLang, nextLang) {
  if (prevLang === nextLang || state.codeDraftDirty) return;
  state.selectedOutputTypes.forEach(function(outKey) {
    var outReg = OUTPUT_TYPE_REGISTRY[outKey];
    var cfg = state.outputConfigs[outKey];
    if (!outReg || !cfg) return;
    outReg.fields.forEach(function(field) {
      var prevKey = 'defaultValue_' + prevLang;
      var nextKey = 'defaultValue_' + nextLang;
      if (
        Object.prototype.hasOwnProperty.call(field, prevKey)
        && Object.prototype.hasOwnProperty.call(field, nextKey)
        && cfg[field.key] === field[prevKey]
      ) {
        cfg[field.key] = field[nextKey];
      }
    });
  });
}

function renderTemplateBtns() {
  var container = el('templateBtns');
  while (container.firstChild) container.removeChild(container.firstChild);

  function makeTemplateBtn(label, onApply) {
    var btn = document.createElement('button');
    btn.className = 'template-btn';
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.addEventListener('click', onApply);
    container.appendChild(btn);
  }

  /* ADR-029: show template buttons for output-type composition */
  if (state.selectedOutputTypes.length >= 1) {
    var absaKeys = ['entity_recognition', 'relation_identification'];
    var isAbsaCombo = state.selectedOutputTypes.length === absaKeys.length &&
      absaKeys.every(function(k) { return state.selectedOutputTypes.indexOf(k) >= 0; });
    if (isAbsaCombo) {
      makeTemplateBtn(t('absa_template_btn'), function() {
        var tpl = JSON.parse(JSON.stringify(ABSA_MULTI_OUTPUT_TEMPLATE));
        tpl.outputs.forEach(function(out) {
          /* Only apply template entries for currently selected output types;
             an untracked entry would silently resurface later when its type
             is reselected, instead of seeding the registry default */
          if (state.selectedOutputTypes.indexOf(out.type) < 0) return;
          state.outputConfigs[out.type] = JSON.parse(JSON.stringify(out.config));
        });
        state.codeDraftDirty = false;
        renderSchemaFields();
        el('codeEditor').value = configToCode();
        el('saveCodeBtn').disabled = true;
        el('codeErrorBar').classList.add('hidden');
        revalidateCurrentStep();
        track('prototype_task_new_template_applied', { taskType: 'multi:' + state.selectedOutputTypes.join('+') });
      });
    }
    return;
  }

  var schema = state.taskType ? REGISTRY[state.taskType] : null;
  if (!schema) return;

  function makeSingleTemplateBtn(label, templateData) {
    makeTemplateBtn(label, function() {
      state.configData = JSON.parse(JSON.stringify(templateData));
      renderSchemaFields();
      state.codeDraftDirty = false;
      el('codeEditor').value = configToCode();
      el('saveCodeBtn').disabled = true;
      el('codeErrorBar').classList.add('hidden');
      revalidateCurrentStep();
      track('prototype_task_new_template_applied', { taskType: state.taskType });
    });
  }

  if (state.taskType === 'sequence_labeling') {
    makeSingleTemplateBtn(t('templateBtnNer'), schema.nerTemplate);
    makeSingleTemplateBtn(t('templateBtnAspectList'), schema.aspectListTemplate);
    var spanPolTpl = cloneObject(schema.spanPolarityTemplate);
    if (schema.spanPolarityTemplateI18n && schema.spanPolarityTemplateI18n[state.lang]) {
      Object.keys(schema.spanPolarityTemplateI18n[state.lang]).forEach(function(k) { spanPolTpl[k] = cloneObject(schema.spanPolarityTemplateI18n[state.lang][k]); });
    }
    makeSingleTemplateBtn(t('templateBtnSpanEntity'), schema.spanEntityTemplate);
    makeSingleTemplateBtn(t('templateBtnSpanPolarity'), spanPolTpl);
  } else if (state.taskType === 'sentence_pairs') {
    var spTpl = getDefaultTemplateForLang(state.taskType, state.lang);
    makeSingleTemplateBtn(t('templateBtnSentencePairs'), spTpl);
  } else {
    makeSingleTemplateBtn(t('applyTemplate') + (schema[state.lang] || schema.zh), getDefaultTemplateForLang(state.taskType, state.lang));
  }
}

function setCodeFormat(fmt) {
  if (state.codeDraftDirty) return;
  state.codeFormat = fmt;
  el('formatYamlBtn').style.fontWeight = fmt === 'yaml' ? '700' : '400';
  el('formatJsonBtn').style.fontWeight = fmt === 'json' ? '700' : '400';
  el('codeEditor').value = configToCode();
}

function loadConfigFile(file) {
  var name = file.name.toLowerCase();
  var ext = name.slice(name.lastIndexOf('.'));
  if (['.yaml', '.yml', '.json'].indexOf(ext) === -1) {
    showToast(t('errConfigFormat'), 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function() {
    var fmt = ext === '.json' ? 'json' : 'yaml';
    state.codeFormat = fmt;
    el('formatYamlBtn').style.fontWeight = fmt === 'yaml' ? '700' : '400';
    el('formatJsonBtn').style.fontWeight = fmt === 'json' ? '700' : '400';
    el('codeEditor').value = String(reader.result || '');
    state.codeDraftDirty = true;
    el('saveCodeBtn').disabled = false;
    el('codeErrorBar').classList.add('hidden');
    markDirty();
    revalidateCurrentStep();
    showToast(t('toastConfigLoaded'), 'success');
    track('prototype_task_new_config_uploaded', { format: fmt });
  };
  reader.onerror = function() {
    showToast(t('errConfigRead'), 'error');
  };
  reader.readAsText(file);
}

function saveCodeToVisual(showSuccessToast) {
  var schema = state.taskType ? REGISTRY[state.taskType] : null;
  if (!schema) return false;
  var raw = el('codeEditor').value;
  var parsed;
  try {
    if (state.codeFormat === 'json' || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
      parsed = JSON.parse(raw);
    } else {
      parsed = parseYamlSubset(raw);
    }
  } catch (err) {
    el('codeErrorBar').classList.remove('hidden');
    setText('codeErrorMsg', err.message || t('errCodeInvalid'));
    return false;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    el('codeErrorBar').classList.remove('hidden');
    setText('codeErrorMsg', t('errCodeInvalid'));
    return false;
  }

  /* ADR-029 unified output composition. Keep the selected output order from
     Step 1, but replace each config atomically after the whole payload passes. */
  if (Array.isArray(parsed.outputs)) {
    var currentInputType = (state.taskInputTypes && state.taskInputTypes[0]) || 'single_item';
    if (parsed.input_type && parsed.input_type !== currentInputType) {
      el('codeErrorBar').classList.remove('hidden');
      setText('codeErrorMsg', state.lang === 'en' ? 'input_type must match Step 1.' : 'input_type 必須與第一步設定一致。');
      return false;
    }
    if (parsed.item_pair_labels !== undefined) {
      var pairLabelsValid = currentInputType === 'item_pair'
        && Array.isArray(parsed.item_pair_labels)
        && parsed.item_pair_labels.length === 2
        && parsed.item_pair_labels.every(function(v) { return typeof v === 'string'; });
      if (!pairLabelsValid) {
        el('codeErrorBar').classList.remove('hidden');
        setText('codeErrorMsg', state.lang === 'en'
          ? 'item_pair_labels must be an array of exactly 2 strings and requires the item_pair input type.'
          : 'item_pair_labels 必須是恰好 2 個字串的陣列，且輸入類型須為項目對。');
        return false;
      }
    }
    var imported = {};
    var unifiedError = '';
    parsed.outputs.forEach(function(output) {
      if (unifiedError) return;
      if (!output || typeof output !== 'object' || Array.isArray(output) || !OUTPUT_TYPE_REGISTRY[output.type]) {
        unifiedError = state.lang === 'en' ? 'Every output needs a supported type.' : '每個 output 都必須指定支援的 type。';
        return;
      }
      if (imported[output.type]) {
        unifiedError = state.lang === 'en' ? 'Output types cannot be duplicated.' : 'output type 不可重複。';
        return;
      }
      if (!output.config || typeof output.config !== 'object' || Array.isArray(output.config)) {
        unifiedError = state.lang === 'en' ? 'Every output needs a config object.' : '每個 output 都必須包含 config 物件。';
        return;
      }
      /* Registry-declared config invariants (FR-003d-1). Checked on the raw
         payload so a rejected key cannot be normalized away first. */
      var outConfigError = typeof OUTPUT_TYPE_REGISTRY[output.type].validateConfig === 'function'
        ? OUTPUT_TYPE_REGISTRY[output.type].validateConfig(output.config, state.lang)
        : '';
      if (outConfigError) {
        unifiedError = outConfigError;
        return;
      }
      imported[output.type] = normalizeOutputConfig(output.type, output.config, state.lang);
    });
    state.selectedOutputTypes.forEach(function(type) {
      if (!imported[type] && !unifiedError) unifiedError = state.lang === 'en'
        ? 'The code must include every output selected in Step 1.'
        : '程式碼必須包含第一步選取的所有輸出類型。';
    });
    Object.keys(imported).forEach(function(type) {
      if (state.selectedOutputTypes.indexOf(type) === -1 && !unifiedError) unifiedError = state.lang === 'en'
        ? 'The code contains an output not selected in Step 1.'
        : '程式碼包含第一步未選取的輸出類型。';
    });
    if (!unifiedError && imported.multi_label) {
      imported.multi_label.label_options = normalizeTaxonomyNodes(imported.multi_label.label_options);
      var importedTaxonomy = validateTaxonomyNodes(imported.multi_label.label_options);
      if (!importedTaxonomy.valid) unifiedError = importedTaxonomy.error;
    }
    if (unifiedError) {
      el('codeErrorBar').classList.remove('hidden');
      setText('codeErrorMsg', unifiedError);
      return false;
    }
    state.selectedOutputTypes.forEach(function(type) {
      imported[type]._autoPopulated = true;
      state.outputConfigs[type] = imported[type];
    });
    if (parsed.item_pair_labels !== undefined) {
      state.itemPairLabels = parsed.item_pair_labels.slice();
    } else if (currentInputType === 'item_pair') {
      /* Omitting the key resets the labels to the dataset-derived defaults */
      state.itemPairLabels = null;
    }
    state.previewState = {};
    state.previewBypass = {};
    state.codeDraftDirty = false;
    el('saveCodeBtn').disabled = true;
    el('codeErrorBar').classList.add('hidden');
    renderSchemaFields();
    updateAnnotationPreview();
    markDirty();
    validateStep2(true);
    revalidateCurrentStep();
    if (showSuccessToast) showToast(t('toastCodeSaved'), 'success');
    track('prototype_task_new_code_saved', { taskType: state.taskType, format: state.codeFormat });
    return true;
  }

  if (state.taskType === 'sequence_labeling' && (parsed.subtype || currentSubtype()) === 'ner') {
    if (Array.isArray(parsed.entity_types) && !parsed.entities) {
      parsed.entities = parsed.entity_types.map(function(entity, idx) {
        if (entity && typeof entity === 'object') {
          return {
            name: String(entity.name || '').trim(),
            color: entity.color || ENTITY_COLORS[idx % ENTITY_COLORS.length],
          };
        }
        return {
          name: String(entity || '').trim(),
          color: ENTITY_COLORS[idx % ENTITY_COLORS.length],
        };
      });
    }
    if (parsed.span_scheme && !parsed.scheme) parsed.scheme = parsed.span_scheme;
    if (parsed.allow_overlapping_spans !== undefined && parsed.allow_overlapping === undefined) parsed.allow_overlapping = parsed.allow_overlapping_spans;
    delete parsed.entity_types;
    delete parsed.span_scheme;
    delete parsed.allow_overlapping_spans;
  }

  var merged = {};
  Object.keys(parsed).forEach(function(k) { merged[k] = parsed[k]; });
  schema.fields.forEach(function(field) {
    if (field.type === 'va-dimensions') {
      if (!merged.valence || typeof merged.valence !== 'object') merged.valence = { min: 1, max: 9, step: 1 };
      if (!merged.arousal || typeof merged.arousal !== 'object') merged.arousal = { min: 1, max: 9, step: 1 };
      return;
    }
    if (merged[field.key] === undefined && field.defaultValue !== undefined) merged[field.key] = field.defaultValue;
    if (field.type === 'tag-list' && !Array.isArray(merged[field.key])) merged[field.key] = [];
    if (field.type === 'entity-list' && !Array.isArray(merged[field.key])) merged[field.key] = [];
    if (field.type === 'boolean' && typeof merged[field.key] !== 'boolean') merged[field.key] = !!merged[field.key];
  });
  state.configData = merged;
  state.codeDraftDirty = false;
  el('saveCodeBtn').disabled = true;
  el('codeErrorBar').classList.add('hidden');
  renderSchemaFields();
  updateAnnotationPreview();
  markDirty();
  revalidateCurrentStep();
  if (showSuccessToast) showToast(t('toastCodeSaved'), 'success');
  track('prototype_task_new_code_saved', { taskType: state.taskType, format: state.codeFormat });
  return true;
}
function readDatasetFile(file, onSuccess, onError) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var root = parseDatasetText(e.target.result);
    if (root === null || (Array.isArray(root) && root.length === 0)) {
      onError(state.lang === 'en' ? 'Failed to parse JSON.' : '無法解析 JSON，請確認檔案格式正確（UTF-8 編碼）。');
      return;
    }
    onSuccess(root);
  };
  reader.onerror = function() {
    onError(state.lang === 'en' ? 'Failed to read file.' : '讀取檔案失敗。');
  };
  reader.readAsText(file, 'utf-8');
}

/* Recompute records, columns, preview rows, unique values and field profile
   from all parsed roots at the currently selected record path.
   Returns the names of files whose root yields no records at that path, so
   callers can surface the incompatibility instead of dropping rows silently. */
function analyzeDataset() {
  var allRecords = [];
  var skippedFiles = [];
  state._datasetRoots.forEach(function(root, i) {
    var recs = extractRecordsAtPath(root, state.datasetRecordPath);
    if (recs && recs.length > 0) {
      allRecords = allRecords.concat(recs);
    } else {
      skippedFiles.push(state.datasetFiles[i] ? state.datasetFiles[i].name : '#' + (i + 1));
    }
  });
  state.datasetTotalRecords = allRecords.length;
  var fp = buildFieldProfile(allRecords);
  state.datasetParsedColumns = fp.columns;
  state.datasetFieldProfile = fp.profile;
  state.datasetPreviewRawRows = allRecords.slice(0, 2);
  state.datasetParsedRows = state.datasetPreviewRawRows.map(function(row) {
    return fp.columns.map(function(col) { return previewCellValue(row[col]); });
  });
  state.datasetRawFirstRow = allRecords[0] || {};
  var uv = {};
  fp.columns.forEach(function(col) { uv[col] = {}; });
  allRecords.forEach(function(row) {
    fp.columns.forEach(function(col) {
      var v = scalarLabelValue(row[col]);
      if (v !== null) {
        uv[col][v] = true;
      } else if (Array.isArray(row[col])) {
        row[col].forEach(function(item) { var s = scalarLabelValue(item); if (s !== null) uv[col][s] = true; });
      }
    });
  });
  var cuv = {};
  fp.columns.forEach(function(col) { cuv[col] = Object.keys(uv[col]).slice(0, 50); });
  state.datasetColumnUniqueValues = cuv;
  /* Drop roles for columns that no longer exist after source switch / removal */
  Object.keys(state.fieldRoleMap).forEach(function(col) {
    if (fp.columns.indexOf(col) === -1) delete state.fieldRoleMap[col];
  });
  return skippedFiles;
}

/* Show or clear the incompatibility error for files that yield no records at
   the currently selected record path (source switch / file removal paths) */
function reportSkippedFiles(skippedFiles) {
  if (skippedFiles.length > 0) {
    showFieldError('errDatasetCompat', true,
      t('errRecordPathIncompat').replace('{name}', skippedFiles.join(', ')).replace('{path}', state.datasetRecordPath));
    el('datasetUploadZone').classList.add('error');
  } else {
    showFieldError('errDatasetCompat', false);
    el('datasetUploadZone').classList.remove('error');
  }
}

function processFileQueue(queue, idx) {
  if (idx >= queue.length) {
    renderDatasetFileList();
    renderInlineDatasetPreview();
    markDirty(); revalidateCurrentStep();
    return;
  }
  var file = queue[idx];
  readDatasetFile(file, function(root) {
    if (state._datasetRoots.length === 0) {
      var candidates = collectRecordCandidates(root);
      if (candidates.length === 0) {
        showFieldError('errDatasetCompat', true, t('errNoRecords'));
        el('datasetUploadZone').classList.add('error');
        processFileQueue(queue, idx + 1);
        return;
      }
      state.datasetCandidates = candidates;
      state.datasetRecordPath = candidates[0].path;
      state._datasetRoots.push(root);
      state.fieldRoleMap = {};
      state._roleMapBySource = {};
      analyzeDataset();
    } else {
      /* Appended files must expose records at the selected path with the same
         column set as the files already uploaded (FR-002d) */
      var newRecs = extractRecordsAtPath(root, state.datasetRecordPath);
      if (!newRecs || newRecs.length === 0) {
        showFieldError('errDatasetCompat', true,
          t('errRecordPathIncompat').replace('{name}', file.name).replace('{path}', state.datasetRecordPath));
        el('datasetUploadZone').classList.add('error');
        processFileQueue(queue, idx + 1);
        return;
      }
      var newCols = buildFieldProfile(newRecs).columns.slice().sort().join('|');
      var existCols = state.datasetParsedColumns.slice().sort().join('|');
      if (newCols !== existCols) {
        showFieldError('errDatasetCompat', true,
          state.lang === 'en'
            ? 'Column mismatch: "' + file.name + '" has different columns. All files must have identical columns.'
            : '欄位不一致：「' + file.name + '」的欄位與已上傳的檔案不同，請確認所有檔案欄位相同。');
        el('datasetUploadZone').classList.add('error');
        processFileQueue(queue, idx + 1);
        return;
      }
      state._datasetRoots.push(root);
      analyzeDataset();
    }
    state.datasetFiles.push(file);
    state._datasetVersion = (state._datasetVersion || 0) + 1;
    state.previewInited = false; state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
    track('prototype_task_new_dataset_uploaded', { name: file.name, size: file.size });
    el('datasetUploadZone').classList.remove('error');
    showFieldError('errDatasetCompat', false);
    showFieldError('errDataset', false);
    if (state.datasetFiles.length === 1) {
      runGranularityDetection(state.datasetFiles[0]);
    }
    processFileQueue(queue, idx + 1);
  }, function(errMsg) {
    showFieldError('errDatasetCompat', true, errMsg);
    el('datasetUploadZone').classList.add('error');
    processFileQueue(queue, idx + 1);
  });
}

function addDatasetFiles(files) {
  var queue = [];
  Array.prototype.forEach.call(files, function(file) {
    var name = file.name.toLowerCase();
    var ext = name.slice(name.lastIndexOf('.'));
    if (DATASET_ALLOWED.indexOf(ext) === -1) {
      showFieldError('errDataset', true, t('errDatasetFormat'));
      el('datasetUploadZone').classList.add('error');
      return;
    }
    if (file.size > 200 * 1048576) {
      showFieldError('errDataset', true, t('errDatasetSize'));
      el('datasetUploadZone').classList.add('error');
      return;
    }
    queue.push(file);
  });
  if (queue.length > 0) {
    processFileQueue(queue, 0);
  }
}

function removeDatasetFile(idx) {
  state.datasetFiles.splice(idx, 1);
  state._datasetRoots.splice(idx, 1);
  state._datasetVersion = (state._datasetVersion || 0) + 1;
  el('datasetFileInput').value = '';
  if (state.datasetFiles.length === 0) {
    resetInlinePreviewSelection();
  } else {
    /* FR-002d: re-detect record-source candidates from the remaining files so
       the source bar never keeps paths inherited from the removed file */
    var candidates = collectRecordCandidates(state._datasetRoots[0]);
    if (candidates.length > 0) {
      state.datasetCandidates = candidates;
      var stillValid = candidates.some(function(c) { return c.path === state.datasetRecordPath; });
      if (!stillValid) {
        state._roleMapBySource[state.datasetRecordPath] = state.fieldRoleMap;
        state.datasetRecordPath = candidates[0].path;
        state.fieldRoleMap = state._roleMapBySource[state.datasetRecordPath] || {};
      }
    }
    /* Roots are cached, so a removal is a synchronous recompute */
    reportSkippedFiles(analyzeDataset());
    state.previewInited = false; state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
    renderInlineDatasetPreview();
  }
  renderDatasetFileList();
  markDirty(); revalidateCurrentStep();
}

function makeDatasetFileItem(file, idx) {
  var item = document.createElement('div');
  item.className = 'upload-file-preview';
  item.style.marginTop = '8px';

  var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'upload-file-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
  var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  pl.setAttribute('points', '14 2 14 8 20 8');
  icon.appendChild(p); icon.appendChild(pl);
  item.appendChild(icon);

  var nameSpan = document.createElement('span');
  nameSpan.className = 'upload-file-name';
  nameSpan.textContent = file.name;
  item.appendChild(nameSpan);

  var sizeSpan = document.createElement('span');
  sizeSpan.className = 'upload-file-size';
  sizeSpan.textContent = formatBytes(file.size);
  item.appendChild(sizeSpan);

  var previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'upload-file-preview-btn';
  previewBtn.setAttribute('aria-label', t('datasetPreviewAriaLabel'));
  previewBtn.setAttribute('title', t('datasetPreviewTitle'));
  previewBtn.appendChild(makePreviewSvg());
  previewBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    showDatasetPreviewModal(idx);
  });
  item.appendChild(previewBtn);

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'upload-file-remove';
  removeBtn.setAttribute('aria-label', t('datasetRemoveAriaLabel'));
  removeBtn.appendChild(makeRemoveSvg());
  removeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    removeDatasetFile(idx);
  });
  item.appendChild(removeBtn);

  return item;
}

function renderDatasetFileList() {
  var list = el('datasetFileList');
  while (list.firstChild) list.removeChild(list.firstChild);
  state.datasetFiles.forEach(function(file, idx) {
    list.appendChild(makeDatasetFileItem(file, idx));
  });
}

/* ── Inline dataset preview (FR-002c / FR-002c-1) ─────────────── */

function getSelectedColumns() {
  var hasAnyRole = state.datasetParsedColumns.some(function(col) {
    return !!state.fieldRoleMap[col];
  });
  if (!hasAnyRole) {
    return state.datasetParsedColumns;
  }
  return state.datasetParsedColumns.filter(function(col) {
    return !!state.fieldRoleMap[col];
  });
}

/* Small Lucide-style inline icons (alert-circle / info / check / database) */
function makeMiniIcon(kind) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  function add(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function(k) { n.setAttribute(k, attrs[k]); });
    svg.appendChild(n);
  }
  if (kind === 'alert') {
    add('circle', { cx: '12', cy: '12', r: '10' });
    add('line', { x1: '12', y1: '8', x2: '12', y2: '12' });
    add('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' });
  } else if (kind === 'info') {
    add('circle', { cx: '12', cy: '12', r: '10' });
    add('line', { x1: '12', y1: '16', x2: '12', y2: '12' });
    add('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' });
  } else if (kind === 'check') {
    add('polyline', { points: '20 6 9 17 4 12' });
  } else {
    add('ellipse', { cx: '12', cy: '5', rx: '9', ry: '3' });
    add('path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' });
    add('path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' });
  }
  return svg;
}

/* Record-source bar: shows the detected candidate arrays and lets the user
   switch when the heuristic guessed wrong; switching resets all field roles */
function renderInlineSourceBar() {
  var bar = el('inlinePreviewSourceBar');
  if (!bar) return;
  while (bar.firstChild) bar.removeChild(bar.firstChild);
  if (state.datasetCandidates.length === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.appendChild(makeMiniIcon('database'));
  var lbl = document.createElement('span');
  lbl.className = 'inline-preview-source-label';
  lbl.textContent = t('inlineSourceLabel');
  bar.appendChild(lbl);
  var sel = document.createElement('select');
  sel.className = 'inline-preview-source-select';
  sel.setAttribute('aria-label', t('inlineSourceLabel'));
  state.datasetCandidates.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.path;
    opt.textContent = c.path + ' · ' + t('inlineSourceRowUnit').replace('{n}', c.count);
    if (c.path === state.datasetRecordPath) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.disabled = state.datasetCandidates.length === 1;
  sel.addEventListener('change', function() {
    /* Remember role choices per source path so switching back restores them */
    state._roleMapBySource[state.datasetRecordPath] = state.fieldRoleMap;
    state.datasetRecordPath = sel.value;
    state.fieldRoleMap = state._roleMapBySource[sel.value] || {};
    state.previewInited = false; state.previewEntities = []; state.previewTriples = []; state.activeEntityType = null;
    state._datasetVersion = (state._datasetVersion || 0) + 1;
    reportSkippedFiles(analyzeDataset());
    renderInlineDatasetPreview();
    markDirty();
    revalidateCurrentStep();
    track('prototype_task_new_record_source_switched', { path: sel.value });
  });
  bar.appendChild(sel);
  if (state.datasetCandidates.length > 1) {
    var hint = document.createElement('span');
    hint.className = 'inline-preview-source-hint';
    hint.textContent = t('inlineSourceCandidates').replace('{n}', state.datasetCandidates.length);
    bar.appendChild(hint);
  }
}

/* Per-column feedback under the role select:
   Input / Evidence → missing rows block the step (red) or confirm completeness (green)
   Output           → pre-annotation coverage (informational; empty = not yet annotated) */
function makeFieldNote(col) {
  var role = state.fieldRoleMap[col] || '';
  var p = state.datasetFieldProfile[col];
  if (!p || (role !== 'input' && role !== 'evidence' && role !== 'output')) return null;
  var total = state.datasetTotalRecords;
  var note = document.createElement('div');
  note.className = 'inline-preview-field-note';
  note.setAttribute('data-testid', 'field-role-feedback');
  note.setAttribute('data-field-name', col);
  note.setAttribute('data-field-role', role);
  var txt = document.createElement('span');
  if (role === 'input' || role === 'evidence') {
    if (p.missing > 0) {
      note.classList.add('note-error');
      note.appendChild(makeMiniIcon('alert'));
      var line1 = document.createElement('span');
      line1.style.display = 'block';
      line1.textContent = t('fieldNoteMissing').replace('{m}', p.missing).replace('{t}', total);
      var line2 = document.createElement('span');
      line2.style.display = 'block';
      line2.textContent = t('fieldNoteMissingRefs').replace('{refs}',
        p.missingRefs.slice(0, 3).join(', ') + (p.missing > 3 ? '…' : ''));
      txt.appendChild(line1);
      txt.appendChild(line2);
      note.title = p.missingRefs.join(', ') + (p.missing > p.missingRefs.length ? ' …' : '');
    } else {
      note.classList.add('note-ok');
      note.appendChild(makeMiniIcon('check'));
      txt.textContent = t('fieldNoteAllPresent').replace('{t}', total);
    }
  } else {
    note.classList.add('note-info');
    note.appendChild(makeMiniIcon('info'));
    txt.textContent = t('fieldNotePreAnnotated').replace('{p}', p.present).replace('{t}', total);
  }
  note.appendChild(txt);
  return note;
}

function renderInlineDatasetPreview() {
  var container = el('inlineDatasetPreview');
  if (!container) return;

  if (state.datasetFiles.length === 0 || state.datasetParsedColumns.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  renderInlineSourceBar();
  setText('inlinePreviewHint', t('inlinePreviewHint') + (state.lang === 'en' ? ' · ' : '・') +
    t('inlineTotalRecords').replace('{n}', state.datasetTotalRecords));

  var cols = state.datasetParsedColumns;

  // Init fieldRoleMap for any new columns not yet in state
  cols.forEach(function(col) {
    if (state.fieldRoleMap[col] === undefined) {
      state.fieldRoleMap[col] = '';
    }
  });

  var wrap = container.querySelector('.inline-dataset-preview-wrap');
  if (!wrap) return;

  var errEl = container.querySelector('.inline-preview-col-error');

  // Rebuild table
  var oldTable = wrap.querySelector('table');
  if (oldTable) wrap.removeChild(oldTable);

  var table = document.createElement('table');
  table.className = 'inline-preview-table';
  table.setAttribute('role', 'table');

  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  cols.forEach(function(col) {
    var th = document.createElement('th');
    var inner = document.createElement('div');
    inner.className = 'inline-preview-col-header';

    var lbl = document.createElement('div');
    lbl.className = 'inline-preview-col-label';
    lbl.textContent = col + ' ';
    var badge = document.createElement('span');
    badge.className = 'inline-preview-type-badge';
    badge.textContent = fieldTypeLabel(col);
    lbl.appendChild(badge);

    var sel = document.createElement('select');
    sel.className = 'inline-preview-role-select';
    sel.setAttribute('aria-label', (state.lang === 'en' ? 'Role for: ' : '角色：') + col);

    ['', 'evidence', 'input', 'output'].forEach(function(roleKey) {
      var opt = document.createElement('option');
      opt.value = roleKey;
      opt.textContent = FIELD_ROLE_LABELS[state.lang][roleKey];
      if ((state.fieldRoleMap[col] || '') === roleKey) opt.selected = true;
      sel.appendChild(opt);
    });

    (function(colName) {
      sel.addEventListener('change', function() {
        state.fieldRoleMap[colName] = sel.value;
        if (errEl) errEl.classList.remove('show');
        /* Re-render so the per-column completeness note updates instantly */
        renderInlineDatasetPreview();
        markDirty();
        revalidateCurrentStep();
      });
    }(col));

    inner.appendChild(lbl);
    inner.appendChild(sel);
    var note = makeFieldNote(col);
    if (note) inner.appendChild(note);
    th.appendChild(inner);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  state.datasetPreviewRawRows.forEach(function(rawRow) {
    var tr = document.createElement('tr');
    cols.forEach(function(col) {
      var td = document.createElement('td');
      var v = rawRow[col];
      td.textContent = previewCellValue(v);
      /* Hover reveals the underlying JSON for nested values */
      if (v !== null && typeof v === 'object') {
        var json = JSON.stringify(v);
        td.title = json.length > 600 ? json.slice(0, 600) + '…' : json;
      }
      if (!state.fieldRoleMap[col]) td.style.opacity = '0.35';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function resetInlinePreviewSelection() {
  state.fieldRoleMap = {};
  state.datasetParsedColumns = [];
  state.datasetParsedRows = [];
  state.datasetRawFirstRow = {};
  state.datasetColumnUniqueValues = {};
  state._datasetRoots = [];
  state.datasetCandidates = [];
  state.datasetRecordPath = '$';
  state._roleMapBySource = {};
  state.datasetTotalRecords = 0;
  state.datasetFieldProfile = {};
  state.datasetPreviewRawRows = [];
  renderInlineDatasetPreview();
}

/* ── Dataset preview modal ───────────────────────────────────── */
function showDatasetPreviewModal(idx) {
  var root = state._datasetRoots[idx];
  /* Prefer the record shape the rest of Step 1 works with: the current
     record path. Fall back to the file's own best candidate, then the
     raw root, so the modal never opens empty. */
  var recs = extractRecordsAtPath(root, state.datasetRecordPath);
  if (!recs || recs.length === 0) {
    var cands = collectRecordCandidates(root);
    recs = cands.length ? extractRecordsAtPath(root, cands[0].path) : null;
  }
  var record = (recs && recs.length) ? recs[0] : root;
  el('datasetPreviewJson').textContent = JSON.stringify(record, null, 2);
  el('datasetPreviewModal').classList.add('show');
}
function hideDatasetPreviewModal() { el('datasetPreviewModal').classList.remove('show'); }
function makeFileSvg() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'guideline-item-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
  var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute('points', '14 2 14 8 20 8');
  svg.appendChild(path); svg.appendChild(poly);
  return svg;
}

function makePreviewSvg() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = '14px'; svg.style.height = '14px';
  var ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', '12'); ellipse.setAttribute('cy', '12'); ellipse.setAttribute('rx', '10'); ellipse.setAttribute('ry', '6');
  var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '3');
  svg.appendChild(ellipse); svg.appendChild(circle);
  return svg;
}

function makeRemoveSvg() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = '14px'; svg.style.height = '14px';
  var l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
  var l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
  svg.appendChild(l1); svg.appendChild(l2);
  return svg;
}
/* ── Taxonomy branch delete confirm (UXC-10) ─────────────────── */
function showTaxonomyDeleteModal(descendantCount, onConfirm) {
  state.taxonomyDeleteCallback = onConfirm;
  el('taxonomyDeleteModalTitle').textContent = state.lang === 'en' ? 'Delete label branch?' : '刪除標籤分支？';
  el('taxonomyDeleteModalDesc').textContent = state.lang === 'en'
    ? 'This deletes the branch and its ' + descendantCount + ' descendant label' + (descendantCount > 1 ? 's' : '') + '. This action cannot be undone.'
    : '將一併刪除此分支與其 ' + descendantCount + ' 個子節點，此操作無法復原。';
  el('taxonomyDeleteCancelBtn').textContent = state.lang === 'en' ? 'Cancel' : '取消';
  el('taxonomyDeleteConfirmBtn').textContent = state.lang === 'en' ? 'Delete' : '刪除';
  el('taxonomyDeleteModal').classList.add('show');
  el('taxonomyDeleteConfirmBtn').focus();
}
function hideTaxonomyDeleteModal() { el('taxonomyDeleteModal').classList.remove('show'); state.taxonomyDeleteCallback = null; }
/* ── Flat chip: extract items from TASK_TAXONOMY ────────────── */
function extractTaxonomyItems() {
  var categories = [];
  var inputTypesMap = {};
  var outputTypesMap = {};

  Object.keys(TASK_TAXONOMY).forEach(function(catKey) {
    var catDef = TASK_TAXONOMY[catKey];
    categories.push({ key: catKey, zh: catDef.zh, en: catDef.en });
    Object.keys(catDef.granularities).forEach(function(granKey) {
      var granDef = catDef.granularities[granKey];
      if (!inputTypesMap[granKey]) {
        inputTypesMap[granKey] = { key: granKey, zh: granDef.zh, en: granDef.en };
      }
      Object.keys(granDef.subtypes).forEach(function(subKey) {
        var subDef = granDef.subtypes[subKey];
        if (!outputTypesMap[subKey]) {
          outputTypesMap[subKey] = { key: subKey, zh: subDef.zh, en: subDef.en };
        }
      });
    });
  });

  return {
    categories: categories,
    inputTypes: Object.keys(inputTypesMap).map(function(k) { return inputTypesMap[k]; }),
    outputTypes: Object.keys(outputTypesMap).map(function(k) { return outputTypesMap[k]; }),
  };
}

/* ── Flat chip: build chips into a container ─────────────────── */
function buildChips(containerId, items, stateKey, singleSelect) {
  var container = el(containerId);
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  var role = singleSelect ? 'radio' : 'checkbox';
  items.forEach(function(item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'task-type-chip';
    btn.setAttribute('data-key', item.key);
    btn.setAttribute('data-state-key', stateKey);
    btn.setAttribute('role', role);
    btn.setAttribute('aria-checked', 'false');

    var check = document.createElement('span');
    check.className = 'task-type-chip-check';
    btn.appendChild(check);

    var label = document.createElement('span');
    label.className = 'task-type-chip-label';
    label.textContent = item[state.lang] || item.zh;
    btn.appendChild(label);

    btn.addEventListener('click', function() {
      var key = btn.getAttribute('data-key');
      var sk = btn.getAttribute('data-state-key');
      if (singleSelect) {
        // deselect all siblings first
        container.querySelectorAll('.task-type-chip').forEach(function(b) {
          b.classList.remove('selected');
          b.setAttribute('aria-checked', 'false');
        });
        state[sk] = [key];
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
      } else {
        var arr = state[sk];
        var idx = arr.indexOf(key);
        if (idx >= 0) {
          arr.splice(idx, 1);
          btn.classList.remove('selected');
          btn.setAttribute('aria-checked', 'false');
        } else {
          arr.push(key);
          btn.classList.add('selected');
          btn.setAttribute('aria-checked', 'true');
        }
      }
      onChipSelectionChange();
    });

    container.appendChild(btn);
  });
}

/* ── Flat chip: update chip labels when language changes ─────── */
function updateChipLabels(containerId, items) {
  var container = el(containerId);
  if (!container) return;
  items.forEach(function(item) {
    var btn = container.querySelector('[data-key="' + item.key + '"]');
    if (!btn) return;
    var labelEl = btn.querySelector('.task-type-chip-label');
    if (labelEl) labelEl.textContent = item[state.lang] || item.zh;
  });
}

/* ── Flat chip: initialise category + input groups; output is cascade ── */
var _taxonomyItems = null;
function getTaxonomyItems() {
  if (!_taxonomyItems) _taxonomyItems = extractTaxonomyItems();
  return _taxonomyItems;
}
function initTaskTypeChips() {
  var items = getTaxonomyItems();
  buildChips('taskCategoryChips',   items.categories,  'taskCategories');
  buildChips('taskInputTypeChips',  items.inputTypes,  'taskInputTypes', true);
  rebuildOutputChips();
}

var _lastOutputCatsKey = undefined;
/* ── Cascade: rebuild output chips based on selected categories ── */
function rebuildOutputChips() {
  var container = el('taskOutputTypeChips');
  if (!container) return;

  var cats = state.taskCategories || [];
  var inputTypes = state.taskInputTypes || [];
  var catsKey = state.lang + ':' + cats.slice().sort().join(',') + ':' + inputTypes.slice().sort().join(',');
  if (_lastOutputCatsKey === catsKey) {
    container.querySelectorAll('.task-type-chip').forEach(function(btn) {
      var key = btn.getAttribute('data-key');
      var isSelected = state.taskOutputTypes.indexOf(key) >= 0;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
    return;
  }
  _lastOutputCatsKey = catsKey;

  while (container.firstChild) container.removeChild(container.firstChild);

  if (!cats.length) {
    var p = document.createElement('p');
    p.className = 'task-type-placeholder';
    p.id = 'outputTypePlaceholder';
    p.textContent = t('outputTypePlaceholder');
    container.appendChild(p);
    // clear any previously selected outputs from removed categories
    state.taskOutputTypes = [];
    return;
  }

  // collect output types grouped by selected category
  var groups = [];
  cats.forEach(function(catKey) {
    var catDef = TASK_TAXONOMY[catKey];
    if (!catDef) return;
    var outputsMap = {};
    var granKeys = Object.keys(catDef.granularities);
    function inEveryGranularity(subKey) {
      return granKeys.every(function(gk) {
        var gd = catDef.granularities[gk];
        return gd && gd.subtypes && gd.subtypes[subKey];
      });
    }
    granKeys.forEach(function(granKey) {
      /* When an input type is selected, only include output types from matching granularities */
      if (inputTypes.length > 0 && inputTypes.indexOf(granKey) < 0) return;
      var granDef = catDef.granularities[granKey];
      if (granDef && granDef.subtypes) {
        Object.keys(granDef.subtypes).forEach(function(subKey) {
          /* Without a selected input type, hide outputs constrained to a specific
             granularity so an invalid input/output combination cannot be selected */
          if (inputTypes.length === 0 && !inEveryGranularity(subKey)) return;
          if (!outputsMap[subKey]) {
            var subDef = granDef.subtypes[subKey];
            outputsMap[subKey] = { key: subKey, zh: subDef.zh, en: subDef.en };
          }
        });
      }
    });
    groups.push({
      catKey: catKey,
      label: catDef[state.lang] || catDef.zh,
      singleSelect: catDef.outputSelection === 'single',
      outputs: Object.keys(outputsMap).map(function(k) { return outputsMap[k]; }),
    });
  });

  // build set of all valid output keys across selected categories
  var validKeys = {};
  groups.forEach(function(g) { g.outputs.forEach(function(o) { validKeys[o.key] = true; }); });

  // build set of output keys owned by each category (for intra-group exclusion)
  var catOwnership = {};
  groups.forEach(function(g) {
    var keys = {};
    g.outputs.forEach(function(o) { keys[o.key] = true; });
    catOwnership[g.catKey] = keys;
  });

  // prune outputs that no longer belong to any selected category
  state.taskOutputTypes = state.taskOutputTypes.filter(function(k) { return validKeys[k]; });
  groups.forEach(function(group) {
    if (!group.singleSelect) return;
    var keptSelection = false;
    state.taskOutputTypes = state.taskOutputTypes.filter(function(outputKey) {
      if (!catOwnership[group.catKey][outputKey]) return true;
      if (keptSelection) return false;
      keptSelection = true;
      return true;
    });
  });

  var showSubheaders = groups.length > 1;
  groups.forEach(function(group) {
    var groupSingleSelect = group.singleSelect;
    if (showSubheaders) {
      var subLabel = document.createElement('div');
      subLabel.className = 'task-type-subgroup-label';
      subLabel.setAttribute('data-cat', group.catKey);
      subLabel.textContent = group.label;
      container.appendChild(subLabel);
    }
    var grid = document.createElement('div');
    grid.className = 'task-type-chip-grid';
    grid.setAttribute('data-cat', group.catKey);
    grid.setAttribute('role', groupSingleSelect ? 'radiogroup' : 'group');
    grid.setAttribute('aria-label', group.label);
    var groupCatKey = group.catKey;
    group.outputs.forEach(function(item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-type-chip';
      btn.setAttribute('data-key', item.key);
      btn.setAttribute('data-cat', groupCatKey);
      btn.setAttribute('role', groupSingleSelect ? 'radio' : 'checkbox');
      var isPreselected = state.taskOutputTypes.indexOf(item.key) >= 0;
      btn.setAttribute('aria-checked', isPreselected ? 'true' : 'false');
      if (isPreselected) btn.classList.add('selected');

      var check = document.createElement('span');
      check.className = 'task-type-chip-check';
      btn.appendChild(check);

      var label = document.createElement('span');
      label.className = 'task-type-chip-label';
      label.textContent = item[state.lang] || item.zh;
      btn.appendChild(label);

      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-key');
        var arr = state.taskOutputTypes;
        var idx = arr.indexOf(key);

        if (groupSingleSelect) {
          if (idx >= 0) return;
          state.taskOutputTypes = arr.filter(function(outputKey) {
            return !catOwnership[groupCatKey][outputKey];
          });
          state.taskOutputTypes.push(key);
        } else if (idx >= 0) {
          arr.splice(idx, 1);
        } else {
          arr.push(key);
        }
        onChipSelectionChange();
      });
      grid.appendChild(btn);
    });
    container.appendChild(grid);
  });
}

/* ── Flat chip: derive taskType from multi-select state ──────── */
function deriveTaskType() {
  var cats   = state.taskCategories;
  var inputs = state.taskInputTypes;
  var outputs = state.taskOutputTypes;

  if (!cats.length || !outputs.length) {
    state.taskType = '';
    state.selectedOutputTypes = [];
    return;
  }

  /* ADR-029: populate selectedOutputTypes preserving user selection order */
  /* Collect all output type keys that are valid given current taxonomy selections */
  var validOutputKeys = {};
  Object.keys(TASK_TAXONOMY).forEach(function(catKey) {
    if (cats.indexOf(catKey) < 0) return;
    var catDef = TASK_TAXONOMY[catKey];
    Object.keys(catDef.granularities).forEach(function(granKey) {
      var granDef = catDef.granularities[granKey];
      Object.keys(granDef.subtypes).forEach(function(subKey) {
        if (outputs.indexOf(subKey) >= 0) validOutputKeys[subKey] = true;
      });
    });
  });
  /* Preserve the order from outputs[] as selected by user */
  state.selectedOutputTypes = outputs.filter(function(k) { return validOutputKeys[k]; });

  /* Legacy: derive registry keys for backward-compatible single-type rendering */
  var keys = {};
  Object.keys(TASK_TAXONOMY).forEach(function(catKey) {
    if (cats.indexOf(catKey) < 0) return;
    var catDef = TASK_TAXONOMY[catKey];
    Object.keys(catDef.granularities).forEach(function(granKey) {
      if (inputs.length && inputs.indexOf(granKey) < 0) return;
      var granDef = catDef.granularities[granKey];
      Object.keys(granDef.subtypes).forEach(function(subKey) {
        if (outputs.length && outputs.indexOf(subKey) < 0) return;
        var rk = granDef.subtypes[subKey].registryKey;
        if (rk) keys[rk] = true;
      });
    });
  });

  var resolved = Object.keys(keys);
  state.resolvedTaskTypes = resolved;

  if (resolved.length === 0) {
    state.taskType = '';
    return;
  }
  if (resolved.indexOf(state.taskType) >= 0) return;
  state.taskType = resolved[0];
}

/* ── Cascade: detect granularity from uploaded file ─────────── */
function runGranularityDetection(file) {
  // Granularity auto-detection removed — chip selection is now manual.
  // This stub is kept so existing callers (addDatasetFiles) do not error.
}
