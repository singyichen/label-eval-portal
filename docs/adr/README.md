# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records for the Label Suite project.

## What is an ADR?

An ADR captures an important architectural decision along with its context and consequences. Each record is immutable once accepted — if a decision changes, a new ADR supersedes the old one.

## Format

Each ADR follows this structure:

- **Status**: Accepted / Proposed / Deprecated / Superseded
- **Context**: The forces at play, including technical, research, and project constraints.
- **Decision**: The change we are making.
- **Consequences**: What becomes easier or harder as a result (and alternatives rejected).

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-monorepo-structure.md) | Modular Monorepo Structure | Accepted | 2026-03-19 |
| [002](002-package-managers.md) | Package Managers — uv (Backend) + pnpm (Frontend) | Accepted | 2026-03-19 |
| [003](003-backend-framework-fastapi.md) | Use FastAPI as Backend Framework | Accepted | 2026-03-19 |
| [004](004-frontend-framework-react-vite.md) | Use React + Vite as Frontend Framework | Accepted | 2026-03-19 |
| [005](005-database-postgresql.md) | Use PostgreSQL as Primary Database | Accepted | 2026-03-19 |
| [006](006-caching-queue-redis.md) | Use Redis as Caching Layer and Message Broker | Accepted | 2026-03-19 |
| [007](007-async-tasks-celery.md) | Use Celery for Async Task Execution | Accepted | 2026-03-19 |
| [008](008-containerization-docker-compose.md) | Docker and Docker Compose for Containerization | Accepted | 2026-03-19 |
| [009](009-testing-strategy.md) | Testing Strategy — pytest + Playwright | Accepted | 2026-03-19 |
| [010](010-config-driven-architecture.md) | Config-Driven Task Architecture | Accepted | 2026-03-19 |
| [011](011-frontend-source-structure.md) | Frontend Source Directory Structure — Vertical Feature Slicing | Accepted | 2026-04-03 |
| [012](012-frontend-testing-strategy.md) | Frontend Testing Strategy — Vitest + RTL + Playwright | Accepted | 2026-04-03 |
| [013](013-email-service-resend.md) | Email Service — Resend | Accepted | 2026-04-05 |
| [014](014-prototype-playwright-testing.md) | Prototype-Layer Playwright Testing — Static HTML as Spec Validation | Accepted | 2026-04-07 |
| [015](015-role-based-progressive-onboarding.md) | Role-Based Progressive Onboarding | Accepted | 2026-04-14 |
| [016](016-frontend-component-library-shadcn-storybook.md) | Use shadcn/ui + Storybook for Frontend Component Library | Accepted | 2026-05-19 |
| [017](017-three-layer-agent-architecture.md) | Three-Layer Agent Architecture (Planner / Generator / Evaluator) | Accepted | 2026-05-27 |
| [018](018-observability-prometheus-grafana.md) | Observability Stack — Prometheus + Grafana | Accepted | 2026-05-29 |
| [019](019-ai-traceability-audit-logging.md) | AI Traceability and Audit Logging | Accepted | 2026-05-29 |
| [020](020-application-error-tracking-sentry.md) | Application Error Tracking — Sentry | Accepted | 2026-05-29 |
| [021](021-jwt-refresh-token-auth.md) | JWT Authentication and Refresh Token Strategy | Accepted | 2026-05-29 |
| [022](022-task-state-machine-location.md) | Task State Machine Implementation Location | Accepted | 2026-05-29 |
| [023](023-cicd-docker-compose-nginx-deployment.md) | CI/CD Deployment with Docker Compose and Nginx | Accepted | 2026-05-29 |
| [024](024-database-quickstart-sqlite-tiered.md) | Tiered Database Strategy — SQLite for Quick Start, PostgreSQL for Production | Accepted | 2026-06-03 |
| [025](025-api-collection-bruno.md) | API Collection Tool — Bruno | Accepted | 2026-06-03 |
| [026](026-i18n-two-layer-strategy.md) | Two-Layer i18n Strategy — Frontend UI vs. Backend Response | Accepted | 2026-06-04 |
| [027](027-project-management-github-projects.md) | Project Management Tool — GitHub Projects | Accepted | 2026-06-09 |
| [028](028-ci-security-scanning.md) | CI Security Scanning Strategy — SCA + Deferred SAST | Accepted | 2026-06-11 |
| [029](029-output-type-composition.md) | Output-Type Composition Model | Accepted | 2026-06-29 |
| [030](030-icon-library-lucide.md) | Icon Library — Lucide | Accepted | 2026-07-02 |
| [031](031-sequence-tagging-tokenization-contract.md) | Sequence Tagging Tokenization — Versioned Annotation Contract | Superseded | 2026-07-28 |
| [032](032-user-action-audit-trail.md) | User-Action Audit Trail | Proposed | 2026-08-19 |
| [033](033-openspec-change-workflow.md) | OpenSpec as the Change Workflow Layer (`specs/` Remains Canon) | Proposed | 2026-08-24 |
| [034](034-formal-e2e-directory-location.md) | Formal E2E Test Directory — Root `e2e/[module]/` | Proposed | 2026-08-24 |
| [035](035-google-oidc-no-external-idp.md) | Google SSO via Direct OIDC Integration — No External IdP | Accepted | 2026-09-08 |
