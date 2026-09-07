# Label Suite — Agent Rules

> Full context: [CLAUDE.md](CLAUDE.md) · Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Architecture Boundaries

```
frontend/src/features/[module]/    ← feature-owned; no cross-feature imports
frontend/src/shared/               ← only if used by 2+ distinct feature modules
specs/[module]/NNN-feature/        ← spec artifacts per feature
design/wireframes/pages/[module]/  ← Pencil wireframes (.pen files; frozen 2026-08-20 — see design/wireframes/README.md)
design/prototype/pages/[module]/   ← HTML prototypes
```

**Feature modules**: `account` · `dashboard` · `task-management` · `annotation` · `dataset` · `admin`

**Architecture diagrams** — read the one covering your module before changing cross-module wiring. Each is a standalone HTML file (open it directly in a browser); the paired `.json` is the editable source, so change the `.json` and regenerate, never hand-edit the HTML.

| Diagram | Covers |
|---------|--------|
| [`docs/diagrams/architecture/system-container-architecture.html`](docs/diagrams/architecture/system-container-architecture.html) | System/container boundaries — which container owns which responsibility and how they talk (issue #667) |
| [`docs/diagrams/architecture/config-driven-task-engine-data-flow.html`](docs/diagrams/architecture/config-driven-task-engine-data-flow.html) | Config-driven task engine data flow — task config → validation → workspace dispatch (issue #668) |
| [`specs/foundation/000-foundation/diagrams/backend-layering-and-celery-boundary.html`](specs/foundation/000-foundation/diagrams/backend-layering-and-celery-boundary.html) | Backend layering contract — Router/Service/Repository/ORM responsibilities, dependency direction, and the Celery task boundary (issue #670) |

Tool choice and output-location conventions for new diagrams: [`docs/diagrams/README.md`](docs/diagrams/README.md).

## Hard Rules

1. **No cross-feature imports** — `features/A/` must not import from `features/B/`. Use `shared/` only when 2+ features need it.
2. **No commits to `main`** — always create a `feat/` or `fix/` branch first.
3. **No `pip install`** — use `uv add`. No `npm install` — use `pnpm add`.
4. **No version bumps** — do not modify versions in `pyproject.toml` or `package.json` unless explicitly asked.
5. **No hardcoded task logic** — all task types must be config-driven; new task types must not require modifying core code (Constitution II — NON-NEGOTIABLE).
6. **No test-set answer exposure** — API responses accessible to annotators must never include ground-truth answers (Constitution III — NON-NEGOTIABLE).
7. **No `any` in TypeScript** — strict mode is enforced.
8. **No `allow_origins=["*"]`** — list CORS origins explicitly.
9. **No unconfirmed destructive Bash** — `rm`, `git reset --hard`, `git push --force`, `git branch -D` require explicit user confirmation in the same turn before executing.

## Required Behaviors

- All Python commands via `uv run` (`uv run pytest`, `uv run uvicorn app.main:create_app --factory --reload`, etc.)
- All frontend commands via `pnpm` from `frontend/`
- Write a failing test before writing implementation — no exceptions (TDD)
- Complete the four distinct gates at their applicable stages: OpenSpec schema validation (`openspec validate` for schema/delta/scenario structure); Project SDD lint (project headings, goal/status/ownership/retired-path rules); code/test gates (affected implementation verification); and Source-Verify + write-back/archive (archive-time canonical ID/version/Changelog integrity, plus a post-archive `grep` check that every canonical citation in the derived view is locatable — `openspec archive` copies propose-time delta text verbatim and no CLI check catches a wrong or omitted citation; see `docs/sdd-workflow.md` §6.2). `/opsx:verify` may coordinate workflow-specific checks but does not replace these gates.
- Read relevant files before making any changes
- Always read the main constitution plus every applicable domain constitution before planning, analyzing, implementing, or reviewing work:
  - `.specify/memory/backend-constitution.md` for backend/API/schema/service/database/migration/Redis/Celery/OpenAPI/backend security/backend performance/backend deployment work
  - `.specify/memory/frontend-constitution.md` for React/prototype-to-React/frontend routing/shared UI/i18n/Storybook/accessibility/frontend state/selector/frontend performance work
  - `.specify/memory/testing-constitution.md` for all behavior changes, bug fixes with regression tests, test strategy, coverage, fixtures, CI checks, Playwright, Vitest, pytest, or security leakage tests
- Follow the commit convention in [`.claude/commands/commit.md`](.claude/commands/commit.md): `<type>: <subject>` in English; every commit must include body bullets with bold action words — no subject-only commits
- Remove all debug `print` / `console.log` before finishing
- Surface exact error to user when any tool call fails twice; never silently retry a third time

## Codex-Specific Notes

- Give short progress updates while working, especially before edits and during longer verification steps.
- Prefer `rg` for search and `apply_patch` for manual file edits.
- When reading [CLAUDE.md](CLAUDE.md) for context, treat Claude-only sections as non-binding: do not use `/compact`, `/clear`, `advisor()`, or Claude model-selection rules.
- If a required Claude slash command has no Codex equivalent, report that limitation and continue with the closest manual workflow.

## Review Guidelines

When assisting with code review, keep the review narrow, actionable, and tied to the requested scope:

- Prioritize correctness, security, data leakage, type safety, architecture-boundary violations, regression risk, and missing tests.
- Only report issues that are directly supported by the changed code, surrounding code, failing checks, or project rules.
- Do not expand into unrelated refactors, style preferences, speculative edge cases, or broad architecture redesigns unless they create a concrete bug or policy violation.
- Treat unchanged code as context, not review scope. Mention unchanged-code concerns only when the PR makes the risk worse.
- Prefer a small number of high-signal findings over exhaustive commentary. Report at most 5 findings total, but always fully report every blocking Critical/High finding; if more non-blocking issues exist, summarize the rest as residual risk.
- Each finding must include the impacted file/line, the observable risk, and the smallest practical fix direction.
- Verify project-specific constraints before flagging them: no cross-feature imports, config-driven task types, no annotator access to ground-truth answers, no `any`, explicit CORS origins, and required tests.
- If review context is incomplete, state the limitation once and continue with the available diff instead of broadening the review.

Classify every finding by severity:

- **Critical** — Must fix before merge. Security vulnerabilities, auth/RBAC bypass, test-set answer or ground-truth leakage, data loss, destructive behavior, production crashes, major correctness regressions, unreviewed breaking API/schema changes, hardcoded task logic, `allow_origins=["*"]`, or other violations of non-negotiable constitution rules.
- **High** — Should fix before merge unless the maintainer explicitly accepts the risk. Missing tests for changed behavior, clear regression scenarios, cross-feature imports, `any` in changed TypeScript, or performance issues likely to affect normal production usage.
- **Medium** — Non-blocking unless it accumulates into concrete risk. Incomplete docs for changed public behavior, weak non-critical error handling, maintainability issues that make near-term bugs more likely, or edge-case test gaps outside the main path.
- **Low** — Non-blocking suggestion only. Naming, formatting, minor readability, small duplication, comment wording, polish, or speculative improvements.

Blocking policy:

- Only **Critical** and **High** findings are blocking.
- **Medium** and **Low** findings must be clearly labeled as non-blocking and must not request changes unless the user explicitly asks for cleanup.
- If there are no Critical or High findings, state: "No blocking findings." Then list Medium/Low items only when they are useful and directly supported by the diff.
- Do not request changes for minor polish, naming, or formatting if existing tooling can handle it.

Review output format:

- Every finding title must start with one of these prefixes:
  - `[Critical]`
  - `[High]`
  - `[Medium][Non-blocking]`
  - `[Low][Non-blocking]`
- Blocking findings must explain why they block merge.
- Non-blocking findings must not use language such as "must fix", "required", or "blocks merge".
- If there are no Critical or High findings, start the review summary with: `No blocking findings.`

## When SDD Is Required

New features, behavior changes, breaking API changes, and architectural changes must go through:

```
/superpowers:brainstorm → /speckit.specify → Spec Lint
→ /label-suite-design (prototype) → prototype shell → Red → Green → page design
→ Frontend Ready Gate → /opsx:propose → OpenSpec schema validation + Project SDD lint
→ /opsx:apply → final PR /opsx:archive write-back → /pr-flow final merge
→ post-merge `specs/STATUS.md` update and canonical spec movement to `specs/_archive/`
```

For the authoritative SDD stages, Frontend Ready Gate checklist, four-gate boundaries, and archive timing, follow [docs/sdd-workflow.md](docs/sdd-workflow.md). `AGENTS.md` is a concise Codex-facing summary, not a second policy source.

**Skip SDD only for**: bug fixes, typo/comment changes, non-breaking dep updates, adding tests for existing behavior.

## Language Rules

| Artifact | Language |
|----------|----------|
| Code, comments, commits, API contracts | English only |
| `docs/`, `specs/`, `design/prototype/`, `design/wireframes/` | Traditional Chinese allowed |
| `design/system/MASTER.md` | English only (consumed by AI agents) |
| GitHub issues and PRs opened by an agent | Traditional Chinese REQUIRED — body and the descriptive part of the title; titles keep an English structural head (`[Enhancement] <scope>: ...`, `<type>: ...`) and technical terms stay in English. Commit messages are excluded and stay English-only (issue #380) |

## Dev Commands

```bash
# Frontend (run from frontend/)
pnpm dev
pnpm build
pnpm tsc --noEmit
pnpm lint
pnpm playwright test

# Backend (run from backend/)
uv run uvicorn app.main:create_app --factory --reload
uv run pytest
uv run ruff check . && uv run ruff format .
uv run mypy .
```

## Protected Files

Do not modify without explicit instruction:
- `CLAUDE.md`, `AGENTS.md` — project rule files
- `.specify/memory/constitution.md` — use `/speckit.constitution` to amend

## Sub-agents

26 specialist agents available. See `.claude/agents/` for full definitions.
Multi-agent workflow: `/agent-team` command · `.claude/commands/agent-team.md` for full spawn templates.

---

## Agent Team

### Team Lead

`team-lead` is the orchestrator — the only agent that talks directly to you. It sequences all other agents, enforces file ownership, and reports progress in Traditional Chinese at every checkpoint.

The main session/team lead alone verifies Red and Green evidence and updates `tasks.md` checkboxes. Detailed TDD ownership and evidence requirements are in [specs/_governance/testing-constitution.md](specs/_governance/testing-constitution.md).

Invoke at the start of any multi-agent sprint:

```text
Use team-lead to orchestrate implementation of [feature] from openspec/changes/<change>/tasks.md
```

### Phase Mapping

#### Phase 1 — Research (read-only, before `/opsx:propose`)

| Agent | Role | When |
|---|---|---|
| `senior-architect` | Codebase structure, ADR conflicts, naming conventions | Complex / cross-cutting features |
| `senior-dba` | Existing schema review, migration strategy | Any DB change |
| `senior-api-designer` | API contract review, OpenAPI consistency | Any API change |
| `senior-backend` | Service boundaries in `backend/app/services/` | New backend module |
| `senior-frontend` | Reusable components in `frontend/src/shared/` | New frontend module |
| `senior-uiux` | Annotation interface UX feasibility | Any labeling UI |
| `senior-i18n` | zh-TW / en strings to externalize | Any UI text |
| `nlp-research-advisor` | Annotation schema, IAA metrics, Demo Paper framing | NLP task design |

#### Phase 2A — Test Definition (TDD Red phase, before implementation)

| Agent | Owns |
|---|---|
| `senior-qa` | Separate Red test tasks |

> Red test tasks are owned by `senior-qa`, which commits and runs each Red task before its paired Green task starts, recording the expected failure reason. Existing tests must remain green; the main session/team lead confirms Red evidence before Phase 2B.

#### Phase 2B — Green Implementation (parallel, after committed Red evidence is confirmed)

| Agent | Owns | Model |
|---|---|---|
| `senior-backend` | `backend/app/` | Sonnet 4.6 |
| `senior-frontend` | `frontend/src/` | Sonnet 4.6 |
| `senior-i18n` | `frontend/src/locales/` | Haiku 4.5 |
| `senior-devops` _(optional)_ | `docker-compose.yml`, `.github/` | Haiku 4.5 |

> Implementation agents own only their paired Green tasks and must not weaken or rewrite the Red contract to make it pass. ⚠️ **User checkpoint required** before any DB schema or API contract change proceeds.

#### Phase 2C — DB Migrations (after Phase 2B models confirmed)

| Agent | Owns |
|---|---|
| `senior-dba` | `backend/migrations/` |

#### Phase 3 — Review (parallel, after all impl complete)

| Agent | Focus | Stage |
|---|---|---|
| `senior-code-reviewer` | Code quality, type safety, logic | Stage 1 (always) |
| `senior-security` | RBAC, JWT, input validation, test-set leakage | Stage 2 (always) |
| `senior-performance` | API latency, DB query efficiency | Stage 3 (milestone 2+) |

#### On-Demand

| Agent | When to Spawn |
|---|---|
| `senior-error-resolver` | Implementation teammate fails 3 quality gate attempts (2 retries exhausted) |
| `senior-debugger` | pytest / Vitest / Playwright failures that block progress |
| `senior-technical-writer` | After PR merge — update README / API docs / thesis chapter |
| `senior-full-stack` | Cross-boundary integration task that cannot be split |
| `senior-tech-lead` | ADR decisions, constitution compliance review, cross-cutting concerns |
| `senior-sa` | Technical specification writing for new modules |
| `user-researcher` | New module requires user journey research |
| `senior-ba` | Requirements unclear — needs structured analysis before specifying |

### Inter-Agent Communication Protocol

Phase 1 research agents read files directly — that is their primary function. For Phase 2 implementation agents, the Team Lead provides full task context rather than expecting agents to read files autonomously:

```text
1. Full task text (copied from tasks.md)
2. API contract (if crossing BE/FE boundary)
3. File ownership boundary (what they own / must not touch)
4. Quality gate command to run after completion
```

Agents report back with one of four statuses: `DONE` · `DONE_WITH_CONCERNS` · `NEEDS_CONTEXT` · `BLOCKED`.
Team Lead handles each per the escalation rules in `.claude/agents/team-lead.md`.
