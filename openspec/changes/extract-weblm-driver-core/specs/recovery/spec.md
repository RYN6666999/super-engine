# Delta Spec: Recovery — extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Module:** recovery  
**Base Spec:** openspec/specs/recovery/spec.md  
**Delta Type:** ADDED (new module from scratch)  
**Status:** DRAFT

---

## Summary of Changes

This delta introduces `RecoveryManager` as a first-class, isolated module responsible for executing structured recovery actions. Recovery is no longer ad-hoc or embedded in business logic. It is typed, logged, and bounded.

---

## ADDED Requirements

### RC-ADD-001: RecoveryManager Module

A standalone `RecoveryManager` class MUST be created with the following signature:

```ts
class RecoveryManager {
  constructor(
    session: BrowserSession,
    inspector: PageStateInspector,
    config: BrowserSessionConfig
  ) {}

  async recover(health: DriverHealth, reason?: string): Promise<RecoveryResult>;
}
```

### RC-ADD-002: Four Recovery Actions

`RecoveryManager` MUST support exactly four escalating recovery actions:

| Action | Trigger | Impl |
|--------|---------|------|
| `refresh-page` | `pageReady = false`, page is loaded | `page.reload()` |
| `reopen-page` | `pageReady = false`, wrong URL | `page.goto(providerUrl)` |
| `restart-browser` | `browserRunning = false` | close + relaunch browser |
| `rebuild-session` | auth still invalid after reopen | full teardown + `init()` |

### RC-ADD-003: Recovery Decision is Data-Driven

Recovery action selection MUST be based solely on the `DriverHealth` argument passed in.  
It MUST NOT re-check health internally before deciding — it trusts the snapshot provided.  
After executing an action, it MUST re-run `health()` to verify.

### RC-ADD-004: Escalating Retry

If the primary recovery action does not restore health, `RecoveryManager` MUST escalate to the next severity action.  
Maximum escalation: up to `rebuild-session`.  
If `rebuild-session` also fails, return `ok: false` and throw `RecoveryFailedError` on the NEXT call.

### RC-ADD-005: recover() Never Throws

`recover()` MUST catch all internal errors and return `RecoveryResult`.  
If a catastrophic error occurs during recovery (e.g., cannot launch browser at all), return:
```ts
{ ok: false, action: 'restart-browser', message: '<error details>' }
```

### RC-ADD-006: Recovery Bounded at 60 Seconds

The total duration of a single `recover()` call MUST NOT exceed `60000ms`.  
If time is exhausted, return `ok: false` with partial action log in `message`.

### RC-ADD-007: Audit Log

`RecoveryManager` MUST log each action attempted (including timestamp and outcome) to the driver's configured logger. This log is available in `RecoveryFailedError.attemptsLog`.

### RC-ADD-008: Re-entrant Safety

If `recover()` is called while a recovery is already in progress, the second call MUST either:
- Be queued and run after the first completes, OR
- Return immediately with `{ ok: false, action: 'none', message: 'recovery already in progress' }`.

### RC-ADD-009: Domain-Agnostic

`RecoveryManager` MUST NOT know about:
- Memory
- Persona
- Conversation context
- Business rules
- Application state beyond browser/page/session

---

## MODIFIED Requirements

_None (new module — no prior baseline)._

---

## REMOVED Requirements

### RC-REM-001: Ad-hoc Recovery in Business Logic

Any recovery logic that was embedded in task controllers, action queues, bots, or agent loops MUST be removed. Recovery is now exclusively routed through `RecoveryManager`.

### RC-REM-002: Infinite Retry Loops

Any pattern of indefinite reconnect/retry loops MUST be replaced with bounded `recover()` calls that return `RecoveryResult`.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| RC-AC-001 | `recover()` returns `RecoveryResult` — never throws |
| RC-AC-002 | `pageReady = false` alone triggers `refresh-page` first |
| RC-AC-003 | `browserRunning = false` triggers `restart-browser` |
| RC-AC-004 | `authenticated = false` after reopen triggers `rebuild-session` |
| RC-AC-005 | `recover()` completes within 60 seconds |
| RC-AC-006 | After successful recovery, `driver.health().ok === true` |
| RC-AC-007 | `RecoveryManager` has zero imports from `memory/`, `persona/`, `skills/` |
