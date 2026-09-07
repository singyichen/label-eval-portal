# ADR-010: Config-Driven Task Architecture

**Status**: Accepted
**Date**: 2026-03-19
**Amended**: 2026-06-29 — ADR-029 evolves the fixed task-type schema into composable `input_type + outputs[]`

## Context

The core research contribution of Label Suite is a **general-purpose NLP labeling and evaluation platform** — one that supports multiple task types (classification, regression, span labeling, etc.) without requiring custom code for each new task.

A naive implementation would hardcode task-specific logic:
```python
# Anti-pattern: hardcoded task logic
if task_type == "sentiment":
    labels = ["positive", "negative", "neutral"]
    metric = "f1_macro"
elif task_type == "ner":
    labels = ["PER", "ORG", "LOC"]
    metric = "entity_f1"
# ... grows indefinitely
```

This approach:
- Forces code changes for every new task type.
- Cannot be reused by other research teams without modification.
- Contradicts the "minimal setup" value proposition of the platform.

### Design Options Evaluated

#### Option A — Hardcoded Task Types (anti-pattern)
Each task type is a separate code path. Adding a new task requires code changes and deployment.

#### Option B — Config-Driven (selected)
Task behavior is fully defined by a YAML/JSON configuration file. The platform reads the config at task creation time and adapts its behavior accordingly. No code changes are required for new task types.

#### Option C — Plugin System
Task types are implemented as Python plugins loaded at runtime. Maximum flexibility but significantly higher complexity for a research system.

**Option C rejected**: Plugin architecture requires a stable plugin API, versioning, and documentation — overkill for the research prototype stage. Config-driven achieves the same generalizability for the task types in scope.

## Decision

Adopt a **Config-Driven Architecture** as a NON-NEGOTIABLE design principle.

Every task type is defined by a configuration object stored in the database (`JSONB`) and loaded from a user-supplied config file at task creation. The platform core never contains task-specific logic.

### Config Schema

> **Current architecture:** [ADR-029 Output-Type Composition Model](029-output-type-composition.md) and [013 New Task spec](../../specs/task-management/013-task-new/spec.md) define the composable `input_type + outputs[]` model. [`docs/schema/config-schema.md`](../schema/config-schema.md) remains a Legacy v1 reference pending a complete v2 rewrite. The fixed `task.type + annotation` example below is retained only as historical context and is not a canonical contract.

```yaml
# example task config
task:
  name: "Chinese Medical NER"
  type: ner                         # classification | scoring | sentence_pair | ner | relation
  description: "Named entity recognition for Chinese medical text"

annotation:
  entity_types:
    - id: disease
      display: "Disease"
      color: "#EF4444"
    - id: symptom
      display: "Symptom"
      color: "#F59E0B"
  allow_overlapping: false

evaluation:
  metric: entity_f1                 # f1_macro | accuracy | krippendorff_alpha | entity_f1 | triple_f1
  primary_metric: entity_f1
  higher_is_better: true
  decimal_places: 4

leaderboard:
  visible: true
  submission_limit_per_day: 3
  show_scores_after_deadline: true
```

### Enforcement Rules

1. **No `if task_type ==` in service code** — task behavior must be derived from the config object.
2. **Config schema is validated by Pydantic** at task creation — invalid configs are rejected before any data is saved.
3. **New combinations of registered output capabilities require config only**. A genuinely new output capability still requires a fragment schema, registry renderer, validation, and metric registration; core task flows must remain registry-driven.
4. **Evaluation metrics are registered** in a metric registry (`metrics/registry.py`); new metrics are added to the registry, not inlined in scoring logic.

## Consequences

### Easier
- Any NLP research team can deploy a new labeling task by writing a config file — no programming required.
- The same platform codebase supports the Demo Paper's target domains: Chinese medical NER, sentiment analysis, and general classification tasks.
- Config validation at creation time (Pydantic) catches misconfiguration before annotators encounter it.
- The metric registry pattern decouples metric implementation from task definition — metrics are reusable across tasks.
- Research teams can fork the config repository, not the codebase, to define their own tasks.

### Harder
- Config schema design must be broad enough to cover all planned task types from the start — schema changes after deployment require migration of existing task configs (JSONB in PostgreSQL).
- Debugging "why does this task behave differently?" now requires reading the config, not the code.
- The metric registry must be maintained as new metrics are added — undocumented metrics cannot be referenced in configs.
- Config-driven flexibility can mask performance issues — a config that requests 10 metrics on a large dataset may be slow; the platform must validate resource constraints.

## Diagram

[Config-Driven Task Engine Data Flow](../diagrams/architecture/config-driven-task-engine-data-flow.html) (issue #668) visualizes how a single `input_type + outputs[]` config object drives all four consumers — task-new wizard, annotation-workspace rendering, the IAA metric registry, and dataset export — through `OUTPUT_TYPE_REGISTRY`, with no per-task-type branching. This is a derived view; this ADR's text is authoritative on conflict.

## Referenced by

- [Constitution](../../.specify/memory/constitution.md) — Principle 2: Generalization-First (NON-NEGOTIABLE)
- [ADR-029](029-output-type-composition.md) — evolves the fixed schema into output-type composition
- [README.md](../../README.md) — Key Contributions §1: Configurable and General-Purpose
