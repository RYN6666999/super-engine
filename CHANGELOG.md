# Changelog

All notable changes to `weblm-driver` will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.5] Live Validation & Compatibility — 2026-04-03

### Summary

First fully verified live release. All public contract fields confirmed against a
real Gemini session. Fixes a `newConversation` false-positive crash in
`OutputCapture`. Adds `executablePath` and `args` passthrough so local Chrome
profiles can be used without Playwright's bundled binary. Adds `examples/ask.ts`
as the canonical correct caller pattern.

134 unit tests pass. Typecheck clean.

### Fixed

#### `OutputCapture` — false-positive `OutputCaptureError` on `newConversation`
- **Root cause**: When `newConversation: true` triggered `page.goto()`, Gemini's
  Angular SPA briefly showed the stop button during hydration. `OutputCapture`
  interpreted this as "generation started and completed with empty output" and
  threw immediately before the prompt was even submitted.
- **Fix 1**: The empty-output guard now requires `firstTokenMs !== null` — actual
  output must have appeared and then vanished before throwing. Pure transition
  flicker (stop seen, no text ever) no longer triggers the error.
- **Fix 2**: `GeminiWebDriver.generate()` now calls
  `page.waitForSelector(inputBox)` after `page.goto()` to let the SPA fully mount
  before submitting, eliminating the race window entirely.
- **Fix 3**: `firstTokenMs` tracking uses `text !== ''` instead of
  `text.trim() !== ''` so whitespace content also counts as a token appearing.

### Added

#### `DriverConfig.executablePath?: string` and `DriverConfig.args?: string[]`
- Infrastructure passthrough to Playwright's `executablePath` and `args` launch
  options. Propagated through `BrowserSessionConfig` → `BrowserSession.launch()`.
- **Why**: Playwright's bundled Chromium crashes (SIGTRAP) when given a Chrome
  profile whose format was written by a newer Chrome binary. Setting
  `executablePath` to the real Chrome binary resolves the incompatibility.
- `args` allows suppressing Chrome dialogs (e.g. "Restore pages?") that appear
  when re-opening an existing profile. Recommended value:
  `['--no-first-run', '--disable-session-crashed-bubble']`
- No changes to public driver methods or generate/health/recover contracts.

#### `examples/ask.ts` — canonical caller pattern
- Shows correct driver lifecycle: `init()` once → `generate()` → `shutdown()` in
  `finally`.
- Gates on `outputKind`: non-`normal` output is not treated as a valid model
  answer.
- Calls `recover()` only when `generate()` throws with `recoverable === true`.
- `newConversation` controlled via explicit `--new-conversation` CLI flag.
- Run via `npm run ask -- "Your prompt" [--new-conversation] [--headed]`.

#### `scripts/validate.ts` — baseline filled from live run
- VALIDATION SUMMARY now contains real observed values from 2026-04-03.

### Live Validation Baseline (2026-04-03)

| Field | Observed |
|---|---|
| `outputKind` (clean run) | `normal` |
| plain `generate()` duration | 5–22 s (network variance) |
| `newConversation: true` total cost | ~19 s |
| `health()` fields on clean run | all `true`, `lastError/Code` = none |
| `recover().action` | `refresh-page` |
| `recover().ok` on healthy driver | `false` (expected) |
| `lastError/Code` after `recover()` | cleared ✓ |
| post-recover `generate()` | `normal` ✓ |
| `shutdown()` | ~900 ms |

---

## [0.1.4] Public Surface Trim — 2026-04-01

### Summary

Minimal public API surface cleanup. Removes `ProviderSelectors` from the package
export — it is an internal provider implementation detail and has no use for
callers. No runtime changes. No test changes. 134 unit tests pass. Typecheck clean.

### Removed

#### `ProviderSelectors` from public exports (breaking for any caller that imported it)
- Removed from `src/index.ts` export list.
- Type still exists in `src/types/index.ts` for internal use.
- **Rationale**: `ProviderSelectors` defines the CSS selector shape used internally
  by `GeminiSelectors`. Exposing it as a public type implied callers could substitute
  their own selectors, which is not a supported use case. Removing it prevents
  accidental dependency on an internal implementation detail.
- **Migration**: remove any `import type { ProviderSelectors }` from caller code
  that imports from the package entry point. If you were using it as a type
  annotation, it was not necessary for calling the driver.

---

## [0.1.3] Contract Cleanup — 2026-04-01

### Summary

Breaking contract cleanup. Removes `GenerateInput.systemPrompt` — a field that
existed in the public API but was never implemented. The field has been silently
ignored since v0.1.0. Removing it makes the contract honest and prevents callers
from passing data that has no effect.

No other contract changes. No new capabilities. 134 unit tests pass (1 new).
Typecheck clean.

### Removed

#### `GenerateInput.systemPrompt` (breaking)
- Removed from `GenerateInput` interface (`src/types/index.ts`).
- Removed from `PromptSubmitter.submit()` signature (`src/modules/PromptSubmitter.ts`).
- Removed from the `generate()` call path (`src/driver/GeminiWebDriver.ts`).
- **Rationale**: Gemini Web UI has no system-level instruction injection surface.
  The field was declared as optional but passed to `PromptSubmitter._systemPrompt`
  which was never read. Any caller passing `systemPrompt` was silently getting
  no effect. Removal is safer than keeping a silent no-op in the public contract.
- **Migration**: remove any `systemPrompt` key from `GenerateInput` objects.
  No runtime behavior changes — the field was never honoured.

### Updated

- `openspec/specs/driver/spec.md` — `GenerateInput` type block updated.
- `docs/security.md` — input boundary and `systemPrompt` section removed.
- `README.md` — `GenerateInput` type comment updated.
- `scripts/validate.ts` — Step 4 pirate test removed; step numbering adjusted.

### Tests

| Suite | Before | After |
|---|---|---|
| Unit — `GeminiWebDriver` | 34 | 35 |
| **Total unit** | **133** | **134** |

New case:
- `generate() — systemPrompt removed from contract > submitter.submit is called with exactly (page, prompt) — no third argument`

---

## [0.1.2] Contract Completion — 2026-04-01

### Summary

Contract completion release. No new driver capabilities. Closes the gap between
what the specs promised and what the code actually delivered. All previously
declared public contract fields are now fully implemented, tested, and honest.
133 unit tests pass (4 new). Typecheck clean.

### Added

#### `GenerateOutput.outputKind` (`src/types/index.ts`, `src/providers/gemini/outputClassifier.ts`)
- New field on every `GenerateOutput`: `'normal' | 'provider-error' | 'unknown'`.
- `provider-error` fires only when text is short (< 300 chars) AND matches a known
  Gemini UI error pattern. Long responses are always `normal`.
- Callers SHOULD check this before treating `.text` as a real model response.

#### Named provider-error patterns + `matchedPattern` diagnostics
- `PROVIDER_ERROR_PATTERNS`: 11 named regex entries covering generic errors,
  rate-limits, quota exhaustion, availability issues, and session expiry.
- `matchedPattern` emitted as a structured field in the `driver.generate.succeeded`
  log event when `outputKind === 'provider-error'`. Log only — not in public output.

#### `ConcurrentGenerationError` (`src/errors/index.ts`)
- New typed error: `code = 'CONCURRENT_GENERATION'`, `recoverable = false`.
- Thrown immediately when `generate()` is called while another generation is still
  in progress. Prevents silent state corruption.

#### `GenerateInput.newConversation` (`src/types/index.ts`)
- Boolean flag: when `true`, the driver performs a **full page reload** to
  `DriverConfig.providerUrl` before submitting the prompt.
- Semantics are now explicit: this is `page.goto()`, not a UI "New chat" click.
- networkidle timeout during reload is intentionally swallowed (non-fatal).

#### `DriverHealth.lastErrorCode` (`src/types/index.ts`)
- Machine-readable error code from the last typed `DriverError`, if any.
- Absent (`undefined`) for generic (non-typed) errors or when no error has occurred.
- Cleared on successful `recover()` or `init()`.

#### Health spec Known Limitations (`openspec/specs/health/spec.md`)
- §6 added: formally documents that `providerReachable` is currently a proxy for
  `browserRunning`, not a real network-level probe. Callers warned not to rely on
  it for network diagnostics.

### Fixed

#### `recover()` — clears `lastError` / `lastErrorCode` on success
- Spec stated both fields are cleared on successful `recover()`. They were not.
- Now: when `RecoveryResult.ok === true`, both fields are reset to `undefined`.
- A failed `recover()` (`ok: false`) leaves the fields intact.

#### `health()` — 5000ms timeout guard
- Spec stated `health()` MUST complete within 5000ms. There was no enforcement.
- Now: internal checks run inside `Promise.race` against a 5000ms deadline.
- On timeout, `health()` resolves with a degraded report (`ok: false`,
  `browserRunning: false`). Non-throwing contract is maintained.

### Tests

| Suite | Before | After |
|---|---|---|
| Unit — `GeminiWebDriver` | 30 | 34 |
| **Total unit** | **129** | **133** |

New cases:
- `recover() > clears lastError and lastErrorCode after a successful recover()`
- `recover() > does NOT clear lastError when recover() fails (ok: false)`
- `health() — 5000ms timeout > resolves with a degraded report when internal checks hang`
- `health() — 5000ms timeout > health() resolves normally when checks complete quickly`

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
