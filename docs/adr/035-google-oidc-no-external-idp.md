# ADR-035: Google SSO via Direct OIDC Integration — No External IdP

**Status**: Accepted
**Date**: 2026-09-08

## Context

The login page's Google SSO button is currently a clickable no-op placeholder (`specs/account/002-login-google-sso/spec.md` v1.2.3, status `Clarified`, generation rule 1 explicitly excludes real OAuth redirect, callback, token exchange, account linking, and session issuance from that version's scope). Turning it into a real login flow requires a decision this repository has never made: whether Google SSO should be brokered through an external identity platform (Casdoor, Keycloak, Authentik, Zitadel, Logto, Auth0, Okta, …) or integrated directly against Google's OIDC endpoints.

A repository-wide search for every major IdP name returns **zero real hits** — the only two matches are unrelated third-party strings inside `backend/.venv/`. No ADR 001–034 covers this question. The gap needed to be closed explicitly rather than re-litigated on demand.

### Constraints that bear on the choice

| Constraint | Source | Effect on an external IdP |
|---|---|---|
| 5–10 users; the system is explicitly a research prototype, not a production-scale service | `docs/product/prd.md` (goal G-05, non-goals table) | IdP platforms solve "shared identity across many apps, many providers, centralized authorization." This project is one app, one provider, ten people. |
| Demo must run with zero prerequisites via `docker compose up`, defaulting to SQLite | ADR-024 | An IdP is one more service that must be started and provisioned before login works — breaks the Quick Start contract directly. |
| Identity hub is a self-issued JWT plus a self-owned `refresh_tokens` table, already `Accepted` | ADR-021 | Moving the identity hub to an external IdP would supersede ADR-021 and requires its own migration story. |
| Dual-layer role model — system role (`user` / `super_admin`) in the JWT, task role fetched on demand from the membership API | ADR-021, `docs/product/prd.md` | An external IdP's RBAC is not used by this model; adopting one adds a second, unused authorization source. |
| An unresolved identity-namespace fragmentation already exists across the codebase (issue #688 investigation findings) | issue #688 | Adding a fourth namespace (external IdP user IDs) compounds a known, already-tracked debt rather than resolving it. |
| The thesis contribution is the config-driven labeling pipeline and the IAA quality loop, not identity management | `docs/product/prd.md` | Introducing an IdP adds defense-risk surface to a part of the system that is not the contribution. |

## Options Evaluated

**Self-hosted IdP** (Casdoor, Keycloak, Authentik, Zitadel, Logto): rejected. Each requires its own deployable service, its own admin bootstrap, and its own data store — directly incompatible with the ADR-024 zero-prerequisite Quick Start, and disproportionate to a 5–10 user research prototype.

**SaaS IdP** (Auth0, Okta, Clerk): rejected for the same proportionality reason, plus an added concern specific to this project: it is a research tool, and routing annotator/participant identity data through a third-party SaaS raises data-residency questions that a self-issued JWT does not.

**Direct Google OIDC integration** (selected): Google is treated purely as an identity assertion source — it returns a verified `sub` + `email` + `email_verified` and nothing else joins the trust boundary. Every downstream step (user upsert, session issuance) reuses the existing ADR-021 flow unchanged.

## Decision

Label Suite does **not** adopt an external identity platform. Google SSO is implemented as a **direct OIDC integration using `authlib`**, feeding into the existing self-issued session model:

```text
Google OIDC → callback: verify id_token
            → upsert users row
            → issue self-owned httpOnly access + refresh cookies   ← ADR-021 unchanged
```

### Optional-integration guarantee

When `GOOGLE_CLIENT_ID` is not configured, the button falls back to the existing no-op behavior. This keeps SSO a strictly optional add-on rather than required infrastructure, so ADR-024's zero-prerequisite `docker compose up` contract is unaffected. It also upgrades spec 002's current no-op entry point from an unfinished placeholder into a formal degraded path for the unconfigured case.

### Account-linking strategy

If a Google login's email already has an existing Email/Password account, the two are **auto-linked only when Google reports `email_verified: true`**; otherwise the login is rejected. This avoids account takeover via an unverified email address while not requiring a manual linking flow for the common case.

### Reversal trigger

If a faculty advisor requires institutional-account login (SAML/Shibboleth), this ADR should be revisited — but the correct response even then is to integrate directly against the institution's existing IdP, not to introduce a general-purpose self-hosted identity platform.

## Consequences

### Easier

- No new deployable service, no new admin console, no new data store to operate or secure.
- ADR-024's zero-prerequisite Quick Start is untouched — Google SSO is additive and silently degrades when unconfigured.
- ADR-021's session model (httpOnly JWT + `refresh_tokens` table) is reused verbatim; there is exactly one identity hub, not two.
- No RBAC duplication — the dual-layer role model keeps authorization decisions in one place.

### Harder

- `authlib` and the Google OIDC callback surface (token verification, nonce/state handling) become a piece of security-sensitive code this project owns directly, rather than delegating it to a hardened third-party IdP implementation.
- If a second OAuth provider is ever needed, this integration does not give it "for free" the way a broker-style external IdP would — each additional provider is its own `authlib` client.

## Blocked Work

Implementing the callback itself is blocked on `account-001` (Login — Email/Password) and `account-003` (Register — Email/Password) landing first: the callback's "upsert user → issue session cookie" steps have no `users` table or session-issuance code to call yet, and the account-linking rule above cannot be verified without an existing Email/Password account to link against. This ADR records the identity-platform decision only; it does not itself unblock or schedule the callback implementation.

## Referenced by

- [Issue #735](https://github.com/singyichen/label-suite/issues/735) — tracking issue for the Google SSO upgrade from no-op to real OIDC integration
- [ADR-021](021-jwt-refresh-token-auth.md) — session/identity hub this ADR builds on unchanged
- [ADR-024](024-database-quickstart-sqlite-tiered.md) — zero-prerequisite Quick Start contract this ADR preserves
- `specs/account/002-login-google-sso/spec.md` — canonical spec whose no-op scope this ADR will eventually extend
- [Issue #688](https://github.com/singyichen/label-suite/issues/688) — pre-existing identity-namespace fragmentation this ADR avoids compounding
