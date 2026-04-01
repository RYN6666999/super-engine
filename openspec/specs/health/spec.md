# Spec: Health

**Spec ID:** specs/health  
**Version:** 1.0.1  
**Status:** ACTIVE  
**Last Updated:** 2026-04-01

---

## 1. Purpose

Define how the driver inspects and reports the health of its browser session and provider page connectivity.

Health checks are **non-destructive read-only operations**. They must never throw. They must always return a structured `DriverHealth` object.

---

## 2. Health Dimensions

| Dimension | Type | Description |
|-----------|------|-------------|
| `ok` | boolean | Overall health — true only if all critical dimensions pass |
| `initialized` | boolean | `init()` has been successfully called |
| `browserRunning` | boolean | Browser process is running and responsive |
| `pageReady` | boolean | Provider page is open and input box is visible |
| `authenticated` | boolean | Provider page reflects a valid logged-in session |
| `providerReachable` | boolean | See Known Limitations §6 — currently proxied from browser/session state, not a real network probe |
| `mode` | enum | Current driver operational state |
| `lastError` | string? | Last known error message, if any. Cleared on successful `recover()`/`init()` |
| `lastErrorCode` | string? | Machine-readable error code from the last typed `DriverError`, if any. Absent for generic errors or when no error has occurred. Cleared on successful `recover()`/`init()` |

### Mode States

```
idle        → init() called, no active generate()
generating  → generate() is in progress
recovering  → recover() is in progress
degraded    → partial health — driver may still operate with caution
shutdown    → shutdown() has been called
```

---

## 3. Health Evaluation Rules

1. `ok` = `initialized AND browserRunning AND pageReady AND authenticated AND providerReachable`
2. If `browserRunning = false`, all downstream dimensions default to `false`.
3. If `pageReady = false`, `authenticated` defaults to `false`.
4. `health()` MUST complete within `5000ms` — times out with a degraded report, never hangs.
5. `health()` MUST NOT mutate driver state.

---

## 4. Degraded vs. Not OK

| Scenario | `ok` | `mode` |
|----------|------|--------|
| Everything working | true | idle |
| Session expired only | false | degraded |
| Page error / challenge | false | degraded |
| Browser crash | false | degraded |
| During recovery | false | recovering |
| After shutdown | false | shutdown |

---

## 5. Usage Contract

```ts
const h = await driver.health();
if (!h.ok) {
  // caller decides whether to recover() or abort
}
```

`health()` is safe to call at any time, including during `generating` or `recovering` mode.

---

## 6. Known Limitations

### `providerReachable` is not a network-level probe

The field name implies a connectivity check at the network layer (e.g. an HTTP HEAD request or DNS resolution against the provider domain). The current implementation does **not** perform such a probe.

**Actual behaviour:** `providerReachable` is derived from browser/session liveness — specifically, it mirrors `browserRunning`. It will return `true` as long as the browser process is alive, even if the network is unreachable or the provider domain is down.

**Consequence for consumers:**
- Do **not** use `providerReachable` to diagnose real network outages.
- Do **not** branch on `providerReachable` independently of `browserRunning`; the two values are currently identical.
- Use `lastError` / `lastErrorCode` for post-failure diagnostics instead.

This is a known gap. A future revision may replace the proxy value with an actual network probe, at which point this limitation will be removed.
