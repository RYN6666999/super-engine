# Changelog

All notable changes to `weblm-driver` will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
