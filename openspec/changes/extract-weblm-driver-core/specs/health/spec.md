# Delta Spec: Health — extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Module:** health  
**Base Spec:** openspec/specs/health/spec.md  
**Delta Type:** ADDED (new capability from scratch)  
**Status:** DRAFT

---

## Summary of Changes

This delta introduces the structured `health()` method as a first-class, non-throwing, always-available inspection channel. Previously there was no canonical health reporting mechanism.

---

## ADDED Requirements

### HL-ADD-001: health() Never Throws

`health()` MUST catch all internal errors and return a `DriverHealth` object regardless.  
If the check itself fails, it MUST return:
```ts
{
  ok: false,
  initialized: false,
  browserRunning: false,
  pageReady: false,
  authenticated: false,
  providerReachable: false,
  mode: 'degraded',
  lastError: '<error message>',
}
```

### HL-ADD-002: health() Bounded Execution

`health()` MUST complete within `5000ms`.  
If internal inspection times out, return a degraded health report immediately — never hang.

### HL-ADD-003: health() is Read-Only

`health()` MUST NOT:
- Mutate any driver state.
- Trigger `recover()`.
- Navigate the page.
- Submit anything.

### HL-ADD-004: mode Reflects Real State

The `mode` field in `DriverHealth` MUST accurately reflect the driver's current operational state at time of calling.

| State | mode value |
|-------|-----------|
| Before init() | `'idle'` (with `initialized: false`) |
| generate() in progress | `'generating'` |
| recover() in progress | `'recovering'` |
| health degraded, operation possible | `'degraded'` |
| shutdown() called | `'shutdown'` |

### HL-ADD-005: ok is Computed, Not Stored

`ok` MUST be derived from the real-time check of all critical dimensions, not cached.  
Exception: during `mode = 'generating'`, `health()` may return the last known values for `pageReady` and `authenticated` without re-evaluating them (to avoid interfering with active generation).

### HL-ADD-006: providerReachable is Network-Level Check

`providerReachable` checks DNS resolution or a lightweight HEAD request to the provider domain.  
It MUST have a `3000ms` timeout.

### HL-ADD-007: Safe to Call in Any Mode

`health()` is safe to call when:
- Driver is `idle`.
- Driver is `generating`.
- Driver is `recovering`.
- Driver is `degraded`.
- Driver is `shutdown`.

### HL-ADD-008: lastError Reset on Success

`lastError` MUST be cleared (`undefined`) when a subsequent `init()` or `recover()` succeeds.

---

## MODIFIED Requirements

_None (new capability — no prior baseline)._

---

## REMOVED Requirements

### HL-REM-001: No Heartbeat Loop

There MUST NOT be an internal polling heartbeat that automatically calls `health()` on a timer.  
Health is pull-based (caller decides when to check), not push-based.

### HL-REM-002: No Health → Auto-Recover Coupling

`health()` MUST NOT automatically trigger `recover()`.  
The caller decides what to do with the health report.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| HL-AC-001 | `health()` returns `DriverHealth` even if browser has crashed |
| HL-AC-002 | `health()` returns within 5000ms under all conditions |
| HL-AC-003 | `health()` does not modify any driver state |
| HL-AC-004 | `ok = true` iff all 5 critical dimensions are true |
| HL-AC-005 | `mode` reflects correct state during `generating` |
| HL-AC-006 | After `shutdown()`, `health()` returns `mode: 'shutdown', ok: false` |
