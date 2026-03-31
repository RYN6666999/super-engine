# Changelog

All notable changes to `weblm-driver` will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1-driver-hardening] — 2026-03-31

### Summary

Hardening release focused on runtime robustness, observability, selector resilience,
and recovery reliability. No public API changes. Zero new product features.
90 unit tests pass (26 new). Lint and typecheck clean.

### Added

#### Structured logging (`src/utils/logger.ts`)
- `DriverLogger` — internal class; not exported. Reads `DriverConfig.logLevel`.
- Emits JSON-Lines records to `stderr` (via `console.error`) at configured level.
- 15 structured log events across `init`, `generate`, `health`, `recover`, `shutdown` lifecycles.
- Security: never logs prompt text, model output, cookies, auth tokens, or file paths.

#### Selector fallbacks (`src/providers/gemini/selectors.ts`)
- All 7 selector slots upgraded to CSS `:is()` multi-candidate expressions.
- 2–3 fallback candidates per critical slot (inputBox, outputContainer, loginIndicator).
- Zero module code changes required — browser CSS engine handles fallback resolution.

#### Selector audit utility (`src/utils/selectorAudit.ts`)
- `selectorAudit(page, selectors)` — internal async function; not exported.
- Returns per-selector `{ found, visible }` audit report for pre-release verification.

#### Smoke test: recovery path
- Added smoke case: `generate()` succeeds after `recover('timeout')` (page-refresh path).
- Smoke suite now has 10 tests (up from 9).

#### Observability spec (`openspec/changes/v0.1.1-driver-hardening/`)
- `proposal.md`, `design.md`, `tasks.md`
- Delta specs: `specs/observability/`, `specs/smoke/`, `specs/selector-resilience/`, `specs/recovery/`

### Changed

#### `RecoveryManager.recover()` — reason-awareness
- `reason` parameter is now load-bearing (was previously ignored).
- Keywords `timeout`, `capture-failed`, `stuck`, `stale` in reason trigger forced `refresh-page`
  even when `health.ok = true`, clearing stuck generation state the health check cannot detect.

#### `GeminiWebDriver` — logger injection
- `GeminiWebDriverDeps` now accepts optional `logger?: DriverLogger` for testing.
- All 5 public methods (`init`, `generate`, `health`, `recover`, `shutdown`) emit structured events.

#### Documentation updated
- `docs/observability.md` — structured log events catalogue
- `docs/reliability.md` — updated recovery decision table with reason-awareness
- `docs/security.md` — logging security note (never-logged field list)
- `docs/smoke-test-guide.md` — smoke readiness checklist, recovery case, acceptable failure modes

### Tests

| Suite | Before | After |
|---|---|---|
| Unit — `DriverLogger` | 0 | 12 |
| Unit — `RecoveryManager` | 12 | 19 |
| Unit — `GeminiWebDriver` | 23 | 30 |
| Unit — `PageStateInspector` | 14 | 14 |
| Unit — `OutputCapture` | 15 | 15 |
| **Total unit** | **64** | **90** |

---

## [0.1.0-driver-core] — 2026-03-31

### Summary

First tagged release of the driver core. Implements the complete `WebLLMDriver` interface backed by Playwright against the Gemini Web provider. All 64 unit tests pass; smoke infrastructure is in place and gate-gated by environment variable.

### Added

#### Public interface
- `WebLLMDriver` — the canonical five-method driver interface (`init`, `generate`, `health`, `recover`, `shutdown`)
- `GeminiWebDriver` — concrete implementation for Gemini Web

#### Typed errors (8 classes)
- `DriverError` (abstract base with `code`, `recoverable`, `timestamp`, `context`)
- `DriverNotInitializedError` — pre-init guard, `recoverable: false`
- `AuthenticationRequiredError` — session expired, `recoverable: true`
- `PageNotReadyError` — input box absent, `recoverable: true`
- `PromptSubmitError` — input interaction failed, `recoverable: true`
- `OutputCaptureError` — output element missing or empty, `recoverable: true`
- `TimeoutError` — with `elapsedMs` + optional `partial` text, `recoverable: true`
- `RecoveryFailedError` — all actions exhausted, `recoverable: false`

#### Internal modules (not exported from `src/index.ts`)
- `BrowserSession` — Playwright browser/context/page lifecycle, minimal, no business logic
- `PageStateInspector` — non-throwing, 5 000 ms timeout-bounded DOM checks; `isLoggedIn`, `isPageReady`, `hasChallenge`, `detectMode`
- `PromptSubmitter` — `fill` + `keyboard.press('Enter')` submission
- `OutputCapture` — two-phase polling: first-token timeout + dual stability condition (text unchanged AND stop button absent)
- `RecoveryManager` — spec decision matrix: `none → refresh-page → reopen-page → restart-browser → rebuild-session`; never throws

#### Infrastructure
- `vitest.config.ts` — unit test config (`tests/unit/**`)
- `vitest.smoke.config.ts` — smoke test config (`tests/smoke/**`), gated by `VITEST_SMOKE + SMOKE_PROFILE_DIR`
- ESLint config with `no-restricted-imports` blocking `**/legacy/**`
- `tsconfig.json` with `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `strict: true`

#### Non-functional specs (new in Phase E)
- `docs/reliability.md`
- `docs/observability.md`
- `docs/security.md`
- `docs/compatibility.md`
- `docs/smoke-test-guide.md`
- `docs/boundary-audit.md`

### Changed

- `src/index.ts` — trimmed public exports; removed `CaptureConfig`, `CaptureResult`, `BrowserSessionConfig`, `PageMode` (internal implementation details not part of the driver contract)
- `package.json` — bumped version to `0.1.0-alpha` → finalised as `0.1.0-driver-core` at tag time

### Constraints honored

- Zero agent, persona, workflow, MCP, memory, HTTP API, queue, or dashboard logic introduced
- All typed errors used; no `throw new Error(...)` on core failure paths
- `health()` never throws; `shutdown()` is idempotent; `recover()` never throws
- Legacy import guard active (ESLint `no-restricted-imports: **/legacy/**`)

---

## Release tag proposal

```
git tag -a v0.1.0-driver-core -m "feat: initial driver-core release — 64/64 unit tests, full WebLLMDriver implementation"
git push origin v0.1.0-driver-core
```

---

## Unreleased

_(tracking next potential items — no timeline commitment)_

- `logLevel` structured logging implementation (field reserved in `DriverConfig`)
- Additional provider selectors (may drift with Gemini UI updates — live verification required before each deployment)
- Abstract `WebLLMDriver` base class to simplify new provider integration
