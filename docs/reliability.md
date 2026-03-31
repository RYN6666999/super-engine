# Reliability Spec — weblm-driver v0.1.1-driver-hardening

## Goals

The driver must degrade gracefully and remain operable across transient provider failures, network hiccups, and ephemeral DOM state changes. All observable error paths produce typed, actionable error objects; no silent swallowing.

---

## Health Contract

`health()` is **non-throwing by specification.** It returns a `DriverHealth` snapshot regardless of internal state. If any internal check throws, the field defaults to `false` and the exception is absorbed.

```
ok = initialized ∧ browserRunning ∧ pageReady ∧ authenticated
```

| Dimension | Source | Default on failure |
|---|---|---|
| `initialized` | In-memory flag | `false` |
| `browserRunning` | `BrowserSession.isRunning()` | `false` |
| `pageReady` | `PageStateInspector.isPageReady()` | `false` |
| `authenticated` | `PageStateInspector.isLoggedIn()` | `false` |
| `providerReachable` | aliased to `browserRunning` | `false` |

---

## Recovery Decision Matrix

`recover()` **never throws**. It maps health state to action:

```
health.ok = true AND reason = 'timeout'/'capture-failed'/'stuck'/'stale'
                                        →  refresh-page (forced — v0.1.1)
health.ok = true AND no problematic reason
                                        →  none
browserRunning = false                  →  restart-browser
authenticated = false                   →  reopen-page → (if still no auth) rebuild-session
pageReady = false                       →  refresh-page
```

The `reason` parameter to `recover()` is now load-bearing (v0.1.1): if health appears OK
but the reason string contains `timeout`, `capture-failed`, `stuck`, or `stale`, a forced
`refresh-page` action clears potentially stuck generation state that `health()` cannot detect.

Recovery actions are **ordered by severity** (ascending). Each action is self-contained and does not assume prior actions succeeded.

| Action | Side effects |
|---|---|
| `none` | No-op |
| `refresh-page` | `page.reload()` (best-effort, not fatal if it fails) |
| `reopen-page` | `page.goto(providerUrl)` + re-check authentication |
| `restart-browser` | `session.close()` (best-effort) + `session.launch()` |
| `rebuild-session` | Signals need for manual re-authentication; returns `ok: false` |

---

## Timeout Semantics

| Timeout | Default | Override |
|---|---|---|
| `DriverConfig.firstTokenTimeoutMs` | 30 000 ms | per-config |
| `DriverConfig.stabilityTimeoutMs` | 120 000 ms | per `generate()` call via `input.timeoutMs` |
| `DriverConfig.stabilityIntervalMs` | 1 500 ms | per-config |
| `PageStateInspector` per-check | 5 000 ms | hardcoded |

`TimeoutError` always carries `elapsedMs` and optionally carries `partial` (any text captured before timeout).

---

## Stability Condition

Output capture resolves only when **both** conditions are simultaneously true:

1. DOM text unchanged between two consecutive polls separated by `stabilityIntervalMs`
2. Provider "stop generating" button is absent from the DOM

Neither condition alone is sufficient.

---

## Error Classification

| Error class | Recoverable | Recommended next step |
|---|---|---|
| `DriverNotInitializedError` | false | Call `init()` |
| `AuthenticationRequiredError` | true | Provide a browser profile with active session |
| `PageNotReadyError` | true | Call `recover()` |
| `PromptSubmitError` | true | Call `recover()` |
| `OutputCaptureError` | true | Call `recover()` |
| `TimeoutError` | true | Inspect `.partial`; call `recover()` |
| `RecoveryFailedError` | false | Manual intervention required |

---

## Idempotency Guarantees

- `shutdown()` — safe to call any number of times, before or after `init()`
- `health()` — safe to call at any time, including during generation
- `recover()` — safe to call concurrently (caller's responsibility to sequence)

---

## Known Risks

1. **Selector drift** — Gemini Web DOM changes without notice. `GeminiSelectors` must be verified against the live UI before each deployment.
2. **Session expiry during generation** — If the browser session expires mid-generation, subsequent calls will fail with `AuthenticationRequiredError`. Recovery requires a fresh profile.
3. **Concurrent `generate()` calls** — Not safe. The driver is single-stream by design. Callers must serialize.
