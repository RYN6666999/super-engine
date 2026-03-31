# Recovery Behavior Spec — v0.1.1-driver-hardening delta

## What changes from v0.1.0

`v0.1.0` recovery ignored the `reason` parameter entirely. `v0.1.1` makes
`reason` load-bearing for one important edge case: **stuck generating state**.

---

## The stuck-page problem

`health()` checks browser liveness, auth, and input-box visibility. It does NOT
detect "page is stuck in generating state from a previous timed-out generate()".

When `generate()` times out:
1. Driver mode becomes `'degraded'`.
2. Page is alive, authenticated, and input box may still be visible.
3. `health()` would return `ok: true` because it only checks static DOM state.
4. Without force-refresh, the next `generate()` might fail or misfire.

The fix: when `recover()` is called with a timeout/stuck reason AND `health.ok`
is `true`, force a page refresh anyway.

---

## Updated decision table

```
health.ok = true AND reason includes 'timeout'        → refresh-page (forced)
health.ok = true AND reason includes 'capture-failed' → refresh-page (forced)
health.ok = true AND reason has no problematic signal → none
health.browserRunning = false                          → restart-browser
health.authenticated = false                           → reopen-page
  └─ still not authenticated after reopen              → rebuild-session
health.pageReady = false                               → refresh-page
```

---

## Non-recoverable vs recoverable classification

### Recoverable (driver can self-restore)

| Condition | Action |
|---|---|
| Page stale / stuck generating | `refresh-page` |
| Page navigated away | `reopen-page` |
| Browser crashed | `restart-browser` |

### Non-recoverable (requires operator intervention)

| Condition | Action | Signal |
|---|---|---|
| Auth expired after reopen | `rebuild-session` | `ok: false`, `action: 'rebuild-session'` |
| Browser launch failed | `restart-browser` | `ok: false`, `action: 'restart-browser'` |
| Unexpected exception | `none` | `ok: false`, `message` contains error |

Operator actions required: re-login to provider, restart host, inspect logs.

---

## Constraints

- `RecoveryManager.recover()` signature is **unchanged**.
- `RecoveryResult` shape is **unchanged**.
- No auto-login is implemented.
- No retry policy is implemented.
- No autonomous escalation loop.
- `recover()` NEVER throws — always returns `RecoveryResult`.

---

## Test coverage additions

- `reason = 'timeout'` with `health.ok = true` → triggers `refresh-page`.
- `reason = 'capture-failed'` with `health.ok = true` → triggers `refresh-page`.
- Existing tests for `health.ok = false` paths remain passing.
