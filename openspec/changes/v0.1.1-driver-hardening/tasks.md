# Tasks — v0.1.1-driver-hardening

## Task Index

| ID | Phase | Task | Status |
|---|---|---|---|
| T1 | Spec | proposal.md | ✓ done |
| T2 | Spec | design.md | ✓ done |
| T3 | Spec | tasks.md (this file) | ✓ done |
| T4 | Spec | specs/observability/spec.md | ✓ done |
| T5 | Spec | specs/smoke/spec.md | ✓ done |
| T6 | Spec | specs/selector-resilience/spec.md | ✓ done |
| T7 | Spec | specs/recovery/spec.md | ✓ done |
| T8 | Impl | src/utils/logger.ts | ✓ done |
| T9 | Impl | Wire DriverLogger into GeminiWebDriver | ✓ done |
| T10 | Impl | Update GeminiSelectors with :is() fallbacks | ✓ done |
| T11 | Impl | src/utils/selectorAudit.ts | ✓ done |
| T12 | Impl | Recovery reason-awareness in RecoveryManager | ✓ done |
| T13 | Impl | Smoke test: add recovery case | ✓ done |
| T14 | Test | DriverLogger unit tests | ✓ done |
| T15 | Test | GeminiWebDriver log-emission tests | ✓ done |
| T16 | Test | RecoveryManager reason-awareness tests | ✓ done |
| T17 | Docs | docs/observability.md — add logging events | ✓ done |
| T18 | Docs | docs/smoke-test-guide.md — readiness checklist | ✓ done |
| T19 | Docs | docs/reliability.md — update recovery | ✓ done |
| T20 | Docs | docs/security.md — logging security note | ✓ done |
| T21 | Release | CHANGELOG.md v0.1.1 entry | ✓ done |
| T22 | Release | package.json version bump to 0.1.1 | ✓ done |
| T23 | Release | acceptance-report.md v0.1.1 section | ✓ done |
| T24 | Release | npm run lint + typecheck + test | ✓ done |
| T25 | Release | git commit + annotated tag v0.1.1-driver-hardening | ✓ done |

---

## Definition of Done

- All unit tests pass (64+ baseline + new hardening tests).
- Lint: zero errors, zero warnings.
- Typecheck: zero errors.
- Smoke tests skip cleanly without env vars.
- CHANGELOG.md has v0.1.1 entry.
- package.json version is `0.1.1`.
- Git tag `v0.1.1-driver-hardening` exists.

---

## Constraints enforced in every task

1. No public API expansion beyond what already exists.
2. No business or domain semantics added to driver code.
3. No external framework or SDK introduced (no npm add).
4. No concurrency support added.
5. Logging never captures: prompts, outputs, cookies, auth tokens, file paths.
