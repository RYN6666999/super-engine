# Design — v0.1.1-driver-hardening

## Architecture Constraints

All changes operate within the existing module boundaries:

```
GeminiWebDriver              ← orchestrator, only layer that holds the logger
  ├── BrowserSession         ← unchanged
  ├── PageStateInspector     ← unchanged
  ├── PromptSubmitter        ← unchanged
  ├── OutputCapture          ← unchanged
  └── RecoveryManager        ← reason parameter becomes load-bearing
```

A new internal utility layer is introduced:

```
src/utils/
  logger.ts          ← DriverLogger (internal, not exported)
  selectorAudit.ts   ← selectorAudit() utility (internal, not exported)
```

---

## Phase 3 — Structured Logging

### DriverLogger

Internal class. Not exported from `src/index.ts`. Reads `DriverConfig.logLevel`
(already part of the public type). Emits JSON-L records to `process.stderr` by
default; the write function is injectable for testing.

```typescript
interface DriverLogEvent {
  event: string;
  sessionId?: string;
  requestId?: string;
  durationMs?: number;
  errorCode?: string;
  recoverable?: boolean;
  action?: string;
  selectorName?: string;
}
```

`pageUrl` is intentionally **not** a field on `DriverLogEvent` — the driver
navigates to a fixed `providerUrl` which the operator already knows. No
dynamic URL values are emitted.

Full prompt text, model output, cookies, auth tokens, and file paths are
**never logged** by the driver.

### Log level mapping

| Event | Level |
|---|---|
| `driver.*.started` | `info` |
| `driver.*.succeeded` | `info` |
| `driver.health.checked` | `debug` |
| `driver.auth.required` | `warn` |
| `driver.selector.missing` | `warn` |
| `driver.capture.timeout` | `warn` |
| `driver.*.failed` | `error` |

All events suppressed at `silent` (the default). The level hierarchy is:
`silent < error < warn < info < debug`.

### Where logging lives

Logging is **only** in `GeminiWebDriver`. Internal modules do not log.
The driver catches typed errors from its modules and emits the appropriate
log event before re-throwing.

---

## Phase 4 — Selector Hardening

### Fallback strategy

Use CSS `:is()` pseudo-class to encode multiple candidate selectors in a
single `ProviderSelectors` string value. `ProviderSelectors` type is
**not changed** — it remains `Record<string, string>`. This means:

- All Playwright APIs (`$`, `isVisible`, `fill`, `$eval`) receive valid CSS.
- No module code changes required.
- The browser's own selector engine resolves the first matching alternative.
- The fallback is declarative and co-located with the primary selector.

### Selector audit utility

`src/utils/selectorAudit.ts` — async function that receives a Playwright `Page`
and a `ProviderSelectors` map, checks visibility/presence of each selector,
and returns a typed audit report. Used in manual verification before release.

```typescript
interface SelectorAuditResult {
  selector: keyof ProviderSelectors;
  css: string;
  found: boolean;
  visible: boolean;
}
```

### Critical vs advisory selectors

| Selector | Criticality | Impact if missing |
|---|---|---|
| `inputBox` | **Critical** | Cannot submit prompt |
| `submitButton` | High | Prompt must use Enter key |
| `outputContainer` | **Critical** | Cannot capture output |
| `stopButton` | High | Cannot detect generation end |
| `loginIndicator` | **Critical** | Auth check fails |
| `challengeIndicator` | Medium | Challenge detection misses |
| `streamingIndicator` | Low | Stability detection degrades |

---

## Phase 5 — Recovery Hardening

### Reason-aware recovery

The `RecoveryManager.recover(health, reason?)` signature is unchanged.
The `reason` string is now actually read:

- If `reason` contains `'timeout'` AND `health.ok` is `true` (driver thinks
  it's healthy but a generate just timed out), force a `refresh-page` action
  to clear potentially stuck generation state.
- If `reason` contains `'capture-failed'` AND `health.ok` is `true`, same.

This handles the specific failure mode where the page is alive and authenticated
but in a stale/stuck generating state that `health()` cannot detect.

### Recovery decision table (updated)

```
health.ok = true AND reason = timeout/capture-failed → refresh-page (force)
health.ok = true AND no problematic reason            → none
health.browserRunning = false                          → restart-browser
health.authenticated = false                           → reopen-page → rebuild-session
health.pageReady = false                               → refresh-page
```

### Non-recoverable classification

| Condition | action | ok | Operator action needed |
|---|---|---|---|
| Auth expired after reopen | `rebuild-session` | false | Yes — re-login |
| Browser launch failed | `restart-browser` | false | Yes — check system |
| Unexpected exception | `none` | false | Yes — inspect logs |

---

## Public API delta

**Zero public API changes.** `DriverConfig.logLevel` already exists.
`ProviderSelectors` type is unchanged. `RecoveryManager.recover` signature is
unchanged. No new exports.

---

## Testing strategy

- `DriverLogger` unit tests: emit events at correct levels, suppress at `silent`,
  inject write function to capture output.
- `GeminiWebDriver` log-emission tests: verify event names emitted via injected
  logger write, do not assert on exact field values or JSON formatting.
- `RecoveryManager` reason-awareness tests: verify timeout-reason forces
  refresh-page when health looks ok.
- Selector audit: documented manual workflow; no automated unit test needed
  (requires live page).
- Smoke recovery case: `describe.runIf(SMOKE_ENABLED)` block for page-refresh
  recovery path.
