# Spec: Health

**Spec ID:** specs/health  
**Version:** 1.0.0  
**Status:** ACTIVE  
**Last Updated:** 2026-03-31

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
| `providerReachable` | boolean | Provider domain is reachable (network-level) |
| `mode` | enum | Current driver operational state |
| `lastError` | string? | Last known error message if any |

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
