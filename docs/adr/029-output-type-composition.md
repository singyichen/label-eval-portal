# ADR-029: Output-Type Composition Model

**Status**: Accepted
**Date**: 2026-06-29
**Amended**:
- 2026-07-22 — active output keys reduced to eight; `span`, `relation_triple`, and `token_class` migrated without aliases
- 2026-07-24 — `multi_label` adopts a bounded recursive label taxonomy for Task Config and Task New Step 2
**Supersedes**: Partially evolves ADR-010 config schema (ADR-010 principles remain; schema structure changes)

## Context

ADR-010 established the Config-Driven Architecture as a NON-NEGOTIABLE design principle. The current implementation plan defines a fixed `TASK_TYPE_ENUM` with five predefined task types:

```
single_sentence_classification | single_sentence_va_scoring |
sequence_labeling | relation_extraction | sentence_pairs
```

Each task type maps to a fixed schema with predetermined config fields. While this satisfies ADR-010's "no `if task_type ==`" rule, it creates a different rigidity problem: **new task type combinations require extending the enum and designing a new dedicated schema**.

### The Problem: Real NLP Tasks Combine Multiple Output Types

Consider three real research datasets from this project (`docs/product/example-data/`):

| Dataset | What the Annotator Does | Required Output Types |
|---------|------------------------|----------------------|
| **NLI** (nli.json) | Read premise + hypothesis → pick a label | `single_label` |
| **MRC** (mrc.json) | Read background + question → write an answer | `free_text` |
| **ABSA** (absa-va.json) | Read text → mark entities (target, aspect, opinion) → identify their relations | `entity_recognition` + `relation_identification` |

The ABSA task requires **two output types working together** — entity recognition feeds into relation identification. Under the current enum-based model, this either requires:
- A new `TASK_TYPE_ENUM` value (e.g., `absa_combined`) — violates config-driven principle
- Two separate tasks on the same dataset — breaks annotator workflow

### Design Options Evaluated

#### Option A — Extend the TASK_TYPE_ENUM (status quo evolution)

Add new entries for each combination: `entity_recognition_with_relation`, `classification_with_entity_recognition`, etc.

**Rejected**: Combinatorial explosion. With 8 output types and pairwise combinations, the enum would need 36 entries (C(8,2) + 8). Each needs a dedicated schema. This is the `if task_type ==` anti-pattern at the schema level.

#### Option B — Output-Type Composition Model (selected)

Replace the fixed task type enum with a composable `outputs[]` array. Each output type contributes a config fragment. The platform validates each fragment independently and validates cross-output dependencies separately.

#### Option C — Plugin System for Output Types

Each output type is a loadable plugin with its own rendering, validation, and scoring logic.

**Deferred**: Same reasoning as ADR-010 Option C — overkill for thesis stage. The composition model can evolve into a plugin system later without schema-breaking changes.

## Decision

Adopt an **Output-Type Composition Model** that replaces the fixed `TASK_TYPE_ENUM` with a composable architecture.

### New Task Config Structure

The examples in this ADR use `task` as an illustrative create-document envelope. The canonical `TaskConfig` fragment owned by spec 013 is `{ input_type, outputs, field_role_map }`; a concrete create-task API envelope must embed that fragment without redefining its fields and is finalized in the API contract, not by this ADR.

```yaml
# OLD (ADR-010 era): task_type determines everything
task:
  name: "Chinese Medical NER"
  type: ner                        # fixed enum → fixed schema

# NEW: input_type + composable outputs[]
task:
  name: "ABSA Annotation"
  input_type: single_item          # single_item | item_pair

  outputs:
    - type: entity_recognition
      config:
        entities:
          - { name: target, color: "#FF6B6B" }
          - { name: aspect, color: "#4ECDC4" }
          - { name: opinion, color: "#45B7D1" }
        allow_overlapping: true

    - type: relation_identification
      config:
        relation_types: [has_aspect, has_opinion]
        source_output: entity_recognition  # ← references the entity recognition output above

  field_role_map:
    utterances: input
    gold_triplets: output
```

### Core Concepts

#### 1. Input Type (retained from taxonomy)

Two values, unchanged:
- `single_item` — one text per data point
- `item_pair` — two texts per data point (e.g., premise + hypothesis)

Input type affects field_role_map validation (item_pair requires at least two input fields) and annotation workspace layout.

#### 2. Output Type Catalog

Each output type is a self-contained unit with its own config fragment schema, annotation UI component, and scoring metric(s).

| Output Type | Config Fragment | Annotation UI | Scoring Metrics |
|-------------|----------------|---------------|-----------------|
| `single_label` | `label_options[]: {name, color?}` | Radio/button group | accuracy, f1_macro, cohen_kappa |
| `multi_label` | `label_options[]: LabelOptionNode`, `max_selections` | Searchable hierarchical multi-select (all nodes independently selectable) | f1_micro, f1_macro, hamming_loss |
| `single_dim` | `dimension_name`, `min`, `max`, `step` | Slider | pearson_r, spearman_rho, mse |
| `multi_dim` | `dimensions[]: {name, min, max, step}` | Multiple sliders | pearson_r (per dim), mean_mse |
| `sequence_tagging` | `entities[]: {name, color?}`, `tagging_scheme` | Token-level tagging | token_f1, token_accuracy |
| `entity_recognition` | `entities[]` or `polarity_options[]`, `allow_overlapping`, `scheme` | Entity selection + label | entity_f1, span_f1 |
| `relation_identification` | `relation_types[]`, `source_output` | Entity + relation drawing | triple_f1 |
| `free_text` | `max_length` | Text area | ROUGE, BERTScore, BLEU |

The retired keys `entity_relation` and `boundary` are not part of the catalog. The former keys `span`, `relation_triple`, and `token_class` are also invalid; active configs must use `entity_recognition`, `relation_identification`, and `sequence_tagging` respectively.

#### 3. Hierarchical Label Taxonomy for `multi_label`

`multi_label` uses a recursive label option tree. The data model has no fixed number of levels, but validation bounds it for predictable editing, serialization, and rendering:

```ts
interface LabelOptionNode {
  id: string
  name: string
  color?: string
  children?: LabelOptionNode[]
}

type LabelPath = string[] // root node id → selected node id
```

```yaml
- type: multi_label
  config:
    label_options:
      - id: emotion
        name: 情緒
        children:
          - id: negative
            name: 負向
            children:
              - id: sad
                name: 悲傷
                color: "#6366F1"
    max_selections: 0
    allow_bypass: true
```

The following rules are canonical for Task Config and Task New Step 2:

- `id` is a stable identity and must be unique across the entire label taxonomy. Renaming `name` must not change `id`.
- `name` is display text and may repeat in different branches. A complete `LabelPath` distinguishes same-named nodes.
- Every node is independently selectable. A branch exposes a checkbox in addition to a separate expand/collapse control; selecting a parent does not automatically select or clear any child.
- Preview selections use complete root-to-selected-node ID paths as their identity, while selected chips display only the selected node name; assistive labels may retain the complete human-readable path for disambiguation.
- `color` is optional for leaf nodes. Branch nodes must not define `color`; validation rejects it rather than silently ignoring it.
- A flat taxonomy is the valid one-level form of the same recursive model.
- Legacy flat nodes shaped as `{name, color?}` may be accepted only at an import/normalization boundary. They receive `id = name` and are then serialized in canonical node form.
- Legacy flat dataset values shaped as `string[]` normalize to one-segment preview paths. A hierarchical field uses `string[][]`; each segment is a globally unique node ID, and the two shapes may not be mixed in one field. When auto-creating the taxonomy, the source ID is also used as the initial display name; users may later rename `name` without changing `id`.
- The Task New contract is bounded by depth 8 (root depth = 1, so `LabelPath.length <= 8`), 500 total nodes, and 100 characters per `id` or `name`. Validation rejects, rather than truncates, over-limit input.
- `max_selections = 0` means unlimited. A positive value counts selected node paths; a value above the selectable node count is treated as unlimited with a non-blocking prompt.

Runtime annotation submission, Task Detail editing, and dataset statistics/IAA interpretation are deliberately not resolved by this amendment. Specs 014, 015, and 017 must synchronize those consumer contracts before consumer-side implementation or PR review; producer-side prototype iteration under spec 013 is a design-stage artifact and is not gated by this deferral.

#### 4. Output Dependencies

Some output types can reference the results of other output types within the same task. Dependencies are declared via a `source_output` field that references another output's `type` (or index, when the same type appears twice).

**Dependency rules:**
- Dependencies must be acyclic (validated at config creation)
- A dependent output appears **after** its source in the annotation workflow
- The annotation workspace renders source outputs first, then dependent outputs
- Scoring of dependent outputs may use the source output's ground truth

**Known dependency patterns:**

| Dependent | Source | Relationship |
|-----------|--------|-------------|
| `relation_identification` | `entity_recognition` | Uses recognized entities as relation endpoints |
| `single_label` | `entity_recognition` | Classifies each recognized entity (e.g., sentiment per aspect) |
| `single_dim` | `entity_recognition` | Scores each recognized entity (e.g., intensity per aspect) |

**Independent combinations** (no dependency, parallel annotation):

| Combination | Use Case |
|-------------|----------|
| `single_label` + `free_text` | Classification with explanation / justification |
| `entity_recognition` + `single_label` (no dep) | Document-level label + entity recognition |
| `multi_dim` + `free_text` | Multi-dimension scoring with free-form comment |

#### 5. Config Validation

Validation occurs in two stages:

1. **Fragment validation**: Each output's config fragment is validated independently using its output-type-specific Pydantic model.
2. **Composition validation**: Cross-output rules are checked:
   - `source_output` references must point to an existing output in the same task
   - No circular dependencies
   - All output_type + input_type combinations are valid (no compatibility restrictions — researchers decide what makes sense for their use case)

`multi_label` fragment validation additionally requires at least one root, non-empty `id` and `name`, globally unique IDs, non-empty `children` when present, and compliance with the depth/node/string limits above. Every preview `LabelPath` must exactly match an existing root-to-node route; selecting a branch path is valid, while orphaned or nonexistent paths are invalid.

### Example: Mapping the Three Research Datasets

#### NLI (nli.json)

```yaml
task:
  name: "Medical NLI"
  input_type: item_pair
  outputs:
    - type: single_label
      config:
        label_options:
          - { name: entailment }
          - { name: contradiction }
          - { name: neutral }
  field_role_map:
    Premise: input
    Hypothesis: input
    Label: output
    Evidence: evidence
```

#### MRC (mrc.json)

```yaml
task:
  name: "Medical QA"
  input_type: single_item
  outputs:
    - type: free_text
      config:
        max_length: 500
  field_role_map:
    question: input
    background: evidence
    answer: output
```

#### ABSA (absa-va.json)

```yaml
task:
  name: "Aspect-Based Sentiment Analysis"
  input_type: single_item
  outputs:
    - type: entity_recognition
      config:
        entities:
          - { name: target, color: "#FF6B6B" }
          - { name: aspect, color: "#4ECDC4" }
          - { name: opinion, color: "#45B7D1" }
        allow_overlapping: true
    - type: relation_identification
      config:
        relation_types: [has_aspect, has_opinion]
        source_output: entity_recognition
  field_role_map:
    utterances: input
    gold_triplets: output
```

### UI Impact (013-task-new spec)

#### Step 1 Changes

| Before | After |
|--------|-------|
| Three chip groups: category (multi) → input_type (single) → output_type (cascade, single per group) | Three chip groups: category (grouping labels, multi-select filter) + input_type (single) + output_type (multi-select, grouped by category) |
| `deriveTaskType()` maps to enum | No derivation needed — selected output_types[] used directly |
| `TASK_TYPE_ENUM` constant | Removed; replaced by `OUTPUT_TYPE_ENUM` |
| Category chips determine cascade filtering | Category chips serve as grouping labels for output_type display |

#### Step 2 Changes

| Before | After |
|--------|-------|
| Single schema section per task_type | One config section **per selected output_type**, organized as accordion |
| One template per task_type | Templates are per output_type or per common combination |
| One preview panel | Preview adapts based on output dependency (see below) |
| N/A | **One unified config file** — all output types in a single `outputs[]` array |

**Schema section layout — Hybrid accordion:**

- Left side: accordion sections, one per output type. Default behavior: all expanded when ≤ 2 outputs; when > 2 outputs, auto-collapse non-active sections (the one being edited stays expanded).
- Dependent outputs display a dependency badge (e.g., `⤷ depends on: entity_recognition`) beneath their accordion header.
- Right side: code panel always displays the full unified config (all outputs combined).
- Editing either side (schema form or code panel) syncs the other in real-time.

**Preview panel layout:**

- Dependent outputs (linked via `source_output`): rendered in a **single unified preview** — e.g., ABSA shows spans highlighted on text with relation arrows overlaid.
- Independent outputs (no dependency): rendered as **side-by-side preview cards** — each output type gets its own card showing its annotation UI independently.
- Mixed: dependent outputs share one card; independent outputs get separate cards.

### Scoring Pipeline Impact

Each output type registers its own metrics in the metric registry (ADR-010 Enforcement Rule #4). A task with multiple outputs produces a score vector, not a single score:

```json
{
  "scores": {
    "entity_recognition": { "entity_f1": 0.82, "span_f1": 0.78 },
    "relation_identification": { "triple_f1": 0.71 }
  },
  "primary_metric": "entity_recognition.entity_f1"
}
```

The task creator selects which metric is the `primary_metric` for leaderboard ranking.

Hierarchical `multi_label` scoring semantics—including whether each selected node path is an atomic class and whether ancestor roll-up is supported—remain deferred to the Dataset Quality contract (017). This amendment must not be read as defining those statistics.

### IAA Calculation

Inter-Annotator Agreement is computed **per output type independently**. A multi-output task produces an IAA vector:

```json
{
  "iaa": {
    "entity_recognition": { "krippendorff_alpha": 0.82 },
    "relation_identification": { "krippendorff_alpha": 0.71 }
  }
}
```

Each output type's IAA threshold is evaluated separately against `SAMPLING_DEFAULTS_BY_TYPE` (which will be reorganized by output_type instead of task_type).

### Annotation Workflow

For independent (non-dependent) output types, annotators may complete them in **any order**. For dependent outputs (where `source_output` is set), the source must be completed first. The annotation workspace renders all output types simultaneously, with dependent outputs visually linked to their source.

### Migration Path

Since no backend code exists yet (Phase 3 starts 2027-02-01), this is a **design-time migration only**:

1. Update `task-type-taxonomy.md` — replace category-first structure with output-type catalog
2. Update `013-task-new/spec.md` — remove `TASK_TYPE_ENUM`, rewrite Step 1/2 behavior
3. Update `010-config-driven-architecture.md` — add "Referenced by ADR-029" note; config example updated
4. Existing prototype HTML — update to reflect new chip structure
5. Foundation spec — update task config API contract
6. Add a hierarchical multi-label fixture while retaining `multi-label.json` as the flat normalization regression fixture
7. Add recursive JSON/YAML round-trip, tree validation, keyboard interaction, and responsive acceptance tests before implementation
8. Synchronize the consumer-side display, submission, and statistics contracts in specs 014, 015, and 017 before consumer-side implementation or PR review (producer-side prototype iteration under spec 013 is not gated)

No database migrations are needed. Because this remains a design-time migration, old output keys are removed without backwards-compatible aliases.

## Resolved Design Decisions

The following decisions include the original 2026-06-29 resolution and the 2026-07-24 hierarchical taxonomy amendment:

1. **Output type compatibility matrix**: All output_type + input_type combinations are valid. No restrictions — researchers decide what makes sense for their use case.

2. **Same output type twice**: Not allowed in v1. Each output_type may appear at most once per task. Use config-internal differentiation (e.g., `entity_recognition` with `entities[]` vs `polarity_options[]`) to cover multi-purpose scenarios. May be revisited post-thesis if a concrete research need arises.

3. **Maximum outputs per task**: No hard limit. Researchers decide based on their annotation design. The platform does not restrict the number of output types per task.

4. **Category chips**: Retained as grouping labels. Output type chips are displayed grouped under their category headings (Classification / Regression / Sequence / Generation). Categories serve as visual organization, not as a selection filter — all output types are visible, grouped by category.

5. **Annotation workflow ordering**: Free ordering for independent outputs. Annotators may complete independent (non-dependent) output types in any order. Dependent outputs (with `source_output`) must wait for their source to be completed first.

6. **IAA calculation**: Per output type independently. Each output type produces its own IAA score. No weighted average — each is evaluated against its own threshold.

7. **Hierarchical label scope**: Hierarchical options apply to `multi_label` only. `single_label`, entity types, and tag types remain flat in this amendment.

8. **Selection policy**: Every taxonomy node is independently selectable. Branch checkboxes are separate from expand/collapse controls, parent selection does not cascade to children, and selected chips show only the selected node name. These are not user-configurable toggles.

9. **Identity and compatibility**: Node IDs are globally unique and stable; names may repeat. Existing flat config/data are accepted only through the normalization rules above.

10. **Bounded recursion**: A taxonomy is limited to depth 8, 500 total nodes, and 100 characters per node ID/name. “Unlimited levels” is a UI description, not a platform resource contract.

11. **Downstream synchronization**: Specs 014, 015, and 017 are explicitly deferred and must define consumer-side behavior before implementation.

## Consequences

### Easier

- Any NLP task that combines multiple annotation actions can be configured without new code or enum values
- The output type catalog is naturally extensible — adding a new output type requires only a new config fragment schema, a new annotation UI component, and metric registration
- Research teams can create novel task combinations (e.g., QA + evidence span extraction) through config alone
- Aligns with how the NLP research community thinks about annotation — by what the annotator produces, not by an artificial task category

### Harder

- Multi-output annotation UI is more complex to design and implement — each output type needs a composable UI component
- Config validation has two layers (fragment + composition) — more validation logic
- Scoring pipeline must handle score vectors instead of single metrics
- Annotator cognitive load increases with more output types per task — may need UX guardrails
- Template design becomes combinatorial — cannot pre-build a template for every possible combination
- Hierarchical option editing requires recursive validation, accessible tree navigation, search, and bounded rendering
- Full config-schema v2 alignment and downstream consumer contracts must be completed before implementation

## Diagram

[Config-Driven Task Engine Data Flow](../diagrams/architecture/config-driven-task-engine-data-flow.html) (issue #668) visualizes the `input_type + outputs[]` composition this ADR introduces, and how `OUTPUT_TYPE_REGISTRY` fans it out to the four consumers (task-new wizard, annotation-workspace rendering, IAA metric registry, dataset export). This is a derived view; this ADR's text is authoritative on conflict.

## Referenced by

- ADR-010 — Config-Driven Task Architecture (evolved, not superseded)
- `docs/product/functional-map/task-type-taxonomy.md`
- `docs/schema/config-schema.md` — legacy v1 reference pending a complete ADR-029-aligned v2 rewrite
- `specs/task-management/013-task-new/spec.md`
- `specs/_governance/constitution.md` — Principle 2: Generalization-First (reinforced)
