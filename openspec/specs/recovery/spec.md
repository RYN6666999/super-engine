# Spec: Recovery

**Spec ID:** specs/recovery  
**Version:** 1.0.0  
**Status:** ACTIVE  
**Last Updated:** 2026-03-31

---

## 1. Purpose

Define how the driver detects failure modes and executes structured recovery actions.

Recovery is a first-class capability of `WebLLMDriver`. It must be deterministic, observable, and typed.

---

## 2. Recovery Actions (Ordered by Severity)

| Action | Trigger Condition | Description |
|--------|------------------|-------------|
| `none` | No failure detected | No-op recovery |
| `refresh-page` | Page DOM inconsistency, missing input box | `page.reload()` |
| `reopen-page` | Page navigation error, wrong URL | `page.goto(providerUrl)` |
| `restart-browser` | Browser process crash or unresponsive | Close and relaunch browser |
| `rebuild-session` | Auth invalidated, cookies destroyed | Full teardown + reinit |

Recovery actions are attempted in escalating order. If a lower-severity action restores health, higher-severity actions are skipped.

---

## 3. Recovery Decision Matrix

| Symptom | Primary Action | Fallback |
|---------|---------------|---------|
| `pageReady = false` (page loaded) | `refresh-page` | `reopen-page` |
| `pageReady = false` (wrong URL) | `reopen-page` | `restart-browser` |
| `authenticated = false` | `reopen-page` then verify | `rebuild-session` |
| `browserRunning = false` | `restart-browser` | `rebuild-session` |
| All actions fail | — | raise `RecoveryFailedError` |

---

## 4. RecoveryResult

```ts
interface RecoveryResult {
  ok: boolean;
  action: 'none' | 'refresh-page' | 'reopen-page' | 'restart-browser' | 'rebuild-session';
  message: string;
}
```

- `ok = true` means driver has returned to `idle` or `generating` mode.
- `ok = false` means recovery was attempted but health still degraded.
- `message` is always a human-readable explanation.

---

## 5. Constraints

- `recover()` MUST NOT throw — it returns `RecoveryResult`.
- `recover()` MUST be re-entrant safe (queued if called during ongoing recovery).
- `recover()` MUST complete within `60000ms`.
- Recovery MUST log each action attempted.
- After successful recovery, `health().ok` MUST return `true`.
- Caller MAY pass an optional `reason` string for diagnostic logging.

---

## 6. RecoveryManager Responsibilities

`RecoveryManager` is the isolated module responsible for executing recovery logic.

It receives:
- Current `DriverHealth` snapshot
- Optional caller-provided `reason`

It returns:
- `RecoveryResult`

It does NOT:
- Make decisions about prompt retry
- Cache or manage conversation history
- Know about business context
