# CLAUDE.md

Codex will review your output once you are done

## Project Overview

Label Suite — A configurable, general-purpose NLP data labeling and automated evaluation portal, developed as a master's thesis research outcome (Demo Paper).

## Architecture & Code Style

> **Decision:** Modular Monorepo. All architectural decisions in [docs/adr/](docs/adr/).

Rules in `.claude/rules/` load per situation: files with `paths:` frontmatter load only when Claude reads a file matching the glob; files without frontmatter load in every session.

- `frontend/**` → `frontend.md`, `testing-frontend.md`
- `backend/**` → `backend.md`, `api.md`, `testing-backend.md`
- `e2e/**` → `testing-e2e.md`
- Always loaded: `general.md`, `git-workflow.md`, `issue-reporting.md`

## Communication

- **English:** code, comments, commit messages, API contracts, `design/system/MASTER.md`
- **Traditional Chinese allowed:** `docs/`, `specs/`, `design/prototype/`, `design/wireframes/`, `design/system/inventory.md`
- **Traditional Chinese REQUIRED:** every OpenSpec-produced artifact (`openspec/changes/**`, `openspec/specs/**` — proposal.md, spec deltas, design.md, tasks.md, derived views) must be written in Traditional Chinese; only technical terms stay in English (FR/AC IDs, code identifiers, commands, file paths, and OpenSpec structural keywords such as `## ADDED Requirements`, `### Requirement:`, `#### Scenario:`, WHEN/THEN). `proposal.md`'s two section headings — `## Why` and `## What Changes` — are structural keywords too and must stay exactly that, with no Chinese gloss appended: the OpenSpec CLI matches them literally and `openspec archive` warns when they differ (issue #356 pilot finding ①). Their body text is still Traditional Chinese. These documents are reviewed by the maintainer.
- **Traditional Chinese REQUIRED:** GitHub issues (every issue type) and pull requests opened by an AI agent — both the body and the descriptive part of the title. Titles keep an English structural head: `[Enhancement] <scope>: <中文描述>` for issues, `<type>: <中文描述>` for PRs. Only technical terms stay in English — title prefixes (`[Bug]`, `[Enhancement]`, ...), Conventional Commit types (`feat`, `fix`, ...), GitHub label names, FR/AC IDs, code identifiers, file paths, commands, and verbatim error output. Commit messages are NOT covered and remain English-only (see Prohibitions); this stays safe because `main` merges with merge commits, so a Chinese PR title never becomes a commit subject.
- All conversations with Claude should be responded to in Traditional Chinese.

## General Coding Rules

@.claude/rules/general.md

## Agent Execution Rules

**Model selection** (by files touched): 0–1 → Haiku 4.5 · 2–9 → Sonnet 4.6 · 10+ → Sonnet + `advisor()` or Opus 4.7. Borderline: bias up.

**Escalation gates** — escalate one tier or surface to user when any triggers:

- Same problem failed ≥ 3 attempts
- Task touches ≥ 10 files
- Task type ∈ {Architecture · Counter-factual · Security threat modeling} → Opus or `advisor()`
- Unrequested code gen > 300 LoC → halt first
- Single PR diff > 5 files or > 300 lines → halt, split into separate PRs before opening `[Principle: X]`. Both counts exclude tests, lockfiles, generated files, tool/project config files, empty or re-export-only `__init__.py`/`index.ts`, and `specs/**`/`openspec/**`

**Context management**: **Generator phase** → `/compact` is forbidden; on context limit → full `/clear`, then re-read spec from disk before continuing. All other phases → compact at **70%** (general) or **30–35%** (complex agentic). Behavioral signal (model seems lost) → `/compact` immediately. At 95%+: `/clear`.

**Context anchoring** (proactive): After each SDD stage transition or escalation gate resolution, save confirmed decisions to MEMORY.md. When switching modules, re-read the relevant spec before proceeding.

**Checkpoint reporting**: For multi-step tasks, report at each checkpoint: completed · verified · remaining. If unable to describe current state, stop immediately.

**Error recovery**: Verification command fails → fix before proceeding; never skip or continue past a red gate. Tool call fails ≥ 2 attempts → surface exact error to user before retrying. Ambiguous file state (conflict, missing, unexpected content) → investigate before overwriting; never assume.

**Cross-session tasks**: Create `claude-progress.md` **before starting** when any trigger applies: task spans ≥ 2 SDD pipeline stages · task touches ≥ 5 files · task type ∈ {feature implementation · refactor · migration}. Format: task name, checklist of steps with `[x]` / `[ ]`, last updated date. File is gitignored.

**Source-Verify gate**: any cited number / benchmark / verbatim quote must be locatable via `grep -i <term> <source>`. If not found → remove or correct; never approximate.

## Git Workflow

### PR Scope — Single Purpose (Enforced)

Every PR must serve exactly **one purpose**. Unrelated changes belong in a separate PR. Decision test: "Can I describe this PR's purpose in one sentence without using 'and' or 'also'?" No → split.

@.claude/rules/git-workflow.md

### Branch Naming

Format: `<type>/<short-description>`, lowercase with `-` separator. Example: `feat/labeling-ui` · `fix/score-calculation`

## Three-Layer Sprint Architecture

Every implementation sprint follows a strict **Planner → Generator → Evaluator** pipeline.

| Layer | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| **Planner** | Task decomposition, spec generation | User brief (may be vague) | Atomic, executable spec items |
| **Generator** | Implementation | One spec item | Code change (impl + test) |
| **Evaluator** | Validation | Code changes | Pass / Fail + exact error details |

**Planner**: Convert vague briefs into fine-grained atomic items before any code is written. Scope is locked once Generator starts — no additions mid-sprint.

**Generator**: Implement exactly one spec item per invocation. On context limit → full `/clear` reset, re-read spec from disk. Never rely on `/compact` summary.

**Evaluator**: External tools only — pytest, mypy, ruff, tsc, Playwright. No self-assessment. **Hard threshold**: any single failure = sprint failure; stop and surface to user.

> SDD mapping: Planner ≈ `speckit.specify` / `speckit.clarify` + OpenSpec propose · Generator ≈ OpenSpec apply · Evaluator ≈ verification commands + write-back Source-Verify gate

## Spec-Driven Development (SDD)

Full pipeline — each stage is a hard gate. OpenSpec is the implementation/change-workflow layer; `specs/` remains the sole canon (SSoT). For authoritative stages, Frontend Ready Gate checklist, gate boundaries, and archive timing, follow [docs/sdd-workflow.md](docs/sdd-workflow.md); this file is a Claude-facing summary, not a second policy source.

```text
/superpowers:brainstorm → /speckit.specify → Spec Lint
  → /label-suite-design (prototype) → prototype shell → Red → Green → page design
  → /speckit.clarify (optional) → Frontend Ready Gate
  → /opsx:propose → OpenSpec schema validation + Project SDD lint
  → /opsx:apply → final PR /opsx:archive write-back → /pr-flow final merge
  → post-merge `specs/STATUS.md` update and canonical spec movement to `specs/_archive/`
```

Visual walkthrough of the same pipeline — the four gates, the TDD role split, archive timing, and the Lightweight Path branch: [docs/diagrams/workflow/sdd-openspec-pipeline.html](docs/diagrams/workflow/sdd-openspec-pipeline.html). The ASCII block above stays because it is inline context an agent reads without opening a file; the diagram is the human-facing companion, not a replacement.

**TDD (REQUIRED)**: `senior-qa` owns each separate Red test task and must commit and run its expected failure before the paired Green task starts. The implementation agent owns Green work and must not weaken or rewrite the Red contract to make it pass. The main agent/team lead verifies the committed Red evidence and Green exit-0 evidence, and is the only role that updates `tasks.md` checkboxes. A static prototype shell may precede Red, but target selectors and behavior may not.

**Four verification gates (REQUIRED)**: these gates have distinct responsibilities and must not be treated as equivalents:

1. **OpenSpec schema validation** checks schema, delta, and scenario structure. Use a non-strict schema gate such as `openspec validate --changes --no-interactive`; it does not validate project headings, ownership, status, or retired paths.
2. **Project SDD lint** checks project headings plus goal/status/ownership/retired-path rules. Until tooling exists, use the canonical workflow checklist and review evidence.
3. **Code/test gates** check affected Red/Green evidence and applicable type, lint, unit, integration, prototype, E2E, and security commands.
4. **Source-Verify + write-back/archive** checks archive-time canonical IDs, version, and Changelog integrity, and — after archiving — that every canonical citation in the derived view is individually locatable by `grep` (FR/AC IDs, section references, file paths, ADR/issue/PR numbers, and requirement clauses that were paraphrased). `openspec archive` copies propose-time delta text verbatim, so wrong or omitted citations survive into the derived view and no CLI check catches them; see [docs/sdd-workflow.md](docs/sdd-workflow.md) §6.2 for the required step.

`/opsx:verify` may run applicable checks, but does not replace any gate. `openspec validate` is only the non-strict OpenSpec schema gate.

**Archive and delivery timing**: intermediate stacked PR groups complete Red, Green, task verification, and group review, then merge while the OpenSpec change stays open. Only the final PR group may collect Source-Verify evidence and run `/opsx:archive`; its archive/write-back belongs in that final PR and completes gate 4 only after successful canonical write-back. Archiving must write back to the canonical `specs/[module]/NNN-feature/spec.md` with a version bump and Changelog entry. After the final PR merges, update `specs/STATUS.md` to archived and move the canonical spec to `specs/_archive/`.

**Module names** (align with `features/` and `specs/[module]/`):
`account` · `dashboard` · `task-management` · `annotation` · `dataset` · `admin`

**Design artifact paths:**

- Wireframes: `design/wireframes/pages/[module]/[page].pen` (frozen 2026-08-20, issue #183 — see design/wireframes/README.md)
- Prototypes: `design/prototype/pages/[module]/[page].html`
- Living styleguide: `design/prototype/components-showcase.html`
- Specs: `specs/[module]/NNN-feature/`

**Spec status**: Update `specs/STATUS.md` at every pipeline stage transition (see STATUS.md for full trigger list).

**Archive**: Only the final PR runs archive/write-back. After the final PR merges → update `specs/STATUS.md` → `mv specs/[module]/NNN-feature specs/_archive/`.

**Modify Existing Feature**: When changing an already-merged feature, carry the change in an OpenSpec change folder — do NOT create a new spec from scratch:

1. `openspec/changes/<change>/proposal.md` names the corresponding canonical spec (`specs/[module]/NNN-feature/spec.md`) in its frontmatter; retrieve the spec from `specs/_archive/` first only if it needs direct editing during apply
2. `/opsx:propose` — draft the delta (`## MODIFIED Requirements`, referencing stable FR/AC IDs) + `tasks.md` (+ `design.md` if the change touches an API contract or DB schema)
3. `/opsx:apply` — implement via TDD
4. In the final PR group only, `/opsx:archive` — dual-write: auto-merge into the derived `openspec/specs/` view, and write back to the canonical `specs/[module]/NNN-feature/spec.md` (version bump + Changelog entry — the final archive gate)
5. After the final PR merges, update `specs/STATUS.md` and re-archive the canonical spec if it was retrieved from `specs/_archive/`

**Lightweight Path**: Skip the full OpenSpec change container when ALL of the following are true: ≤ 2 production code files changed (spec and test files excluded) · no API contract changes · minor behavior change requiring a spec update · **no requirement (FR/AC) is added or removed, only clarified**.
Lightweight sequence: **TDD → implement → spec consistency review → `/pr-flow`**
(Spec consistency review: verify spec version bump and Changelog entry, confirm no downstream specs affected, confirm no API contracts changed.)
If any condition is uncertain, default to the full OpenSpec change flow.

## Constitution

All development must follow all applicable constitution principles in [constitution.md](specs/_governance/constitution.md) and every applicable domain constitution.

NON-NEGOTIABLEs: **Generalization-First** (config-driven, no hardcoded task logic) · **Data Fairness** (prevent test-set answer leakage).

## Verification Commands

Run after every change. Task is NOT complete until all pass.

```bash
# Project SDD lint (run from project root)
scripts/check-sdd.sh
scripts/speckit-tests.sh

# Repository scripts and git hooks (run from project root)
scripts/check-spec-artifacts.sh
scripts/inventory-tests.sh
scripts/pre-commit-tests.sh
scripts/pre-tool-use-tests.sh

# Backend (run from backend/)
uv run pytest tests/ -q
uv run pytest --cov=app --cov-report=term-missing --cov-fail-under=80
uv run mypy .   # whole tree, tests included — matches CI; `mypy app/` misses test-file errors
uv run ruff check . && uv run ruff format --check .
uv run --no-dev --with pip-audit pip-audit --desc

# Frontend (run from frontend/)
pnpm tsc --noEmit
pnpm lint
pnpm test
pnpm build
pnpm audit --prod --audit-level high

# Prototype (run from design/prototype/, when design/prototype/** changed)
pnpm typecheck
pnpm playwright test

# Bootstrap contract (run from project root — SC-045; see docs/development.md)
bash scripts/verify-bootstrap.sh
```

Local commands and CI jobs are a two-way contract — whichever side a PR adds, it adds the other in the same PR:

- New CI job → add its matching local command above.
- New local verification or test suite → list it above **and** wire it to a matching CI job. A local-only suite stops gating the moment someone changes the code it covers without running it — `scripts/speckit-tests.sh` guarded `check-sdd.sh` locally for months while CI stayed green (issue #613).

The contract is machine-checked, not just documented: `scripts/ci-jobs.tsv` declares, for every script under `scripts/` and every job in `.github/workflows/ci.yml`, which CI job covers it and which local command above runs it — or, with `none` plus a reason, why it is not a gate. `scripts/check-sdd.sh` reports `CI_JOB_PARITY` when either side is missing, so a script that never declares itself cannot slip through unnoticed (issue #648).

Exceptions, one per direction. `.github/workflows/claude.yml` is an agent trigger (summons Claude Code on `@claude` comments), not a verification gate — it has no local equivalent and never blocks a merge. In the other direction, one-off scripts — seeding, scaffolding, migration, throwaway debugging (`scripts/seed.sh`, `scripts/migrate-labels.sh`) — are not verification suites and need no CI job. The test: can this script fail in a way that should block a change? Only then does it owe CI a job.

Definition of Done: the applicable four verification gates have evidence. Intermediate PR groups require gates 1–3 plus their Red/Green and group-review evidence; the final PR group additionally requires Source-Verify evidence and successful archive/write-back for gate 4. Canonical spec movement occurs only after final merge.

## Prohibitions

Each rule traces to a specific incident (Ratchet Principle — Mitchell Hashimoto).

- ❌ Direct commit or push to `main`
  - Reason: 2026-04 — violated twice; PreToolUse hook now blocks `git push origin main`
- ❌ `pip install` or `npm install`
  - Reason: lockfile divergence causes silent CI failures; use `uv add` / `pnpm add`
  - Exception: global tool installs (e.g. `pnpm add -g openspec`) don't write to a repo lockfile, so they aren't covered by this prohibition (ADR-033 Open Questions #2)
- ❌ Chinese text in commit messages
  - Reason: 2026-04 — PR description contained Chinese; breaks English-only contract
  - Enforcement: `scripts/git-hooks/commit-msg` blocks CJK characters in the commit message (issue #607) — no bypass; merge commits, comment lines, and identity trailers are exempt
  - Scope narrowed 2026-08-25 (issue #380): issue bodies and PR descriptions are human-collaboration documents the maintainer reviews in Traditional Chinese, so they now follow the Communication section. Commit messages stay English-only — Conventional Commit tooling, `git log` readability, and hook/CI parsing depend on it.
- ❌ `allow_origins=["*"]` in CORS config
  - Reason: security boundary; explicitly list allowed origins
- ❌ Hardcoded API keys or secrets in source files
  - Reason: secret exposure risk; use environment variables only
