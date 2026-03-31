# Delta Spec: Driver — extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Module:** driver  
**Base Spec:** openspec/specs/driver/spec.md  
**Delta Type:** ADDED (new module from scratch)  
**Status:** DRAFT

---

## Summary of Changes

This delta introduces the `WebLLMDriver` interface and `GeminiWebDriver` implementation as the **only active driver** in the repository. All previously existing driver-like entrypoints (if any) are removed from the active path.

---

## ADDED Requirements

### DR-ADD-001: WebLLMDriver Interface

The repository MUST define and export a `WebLLMDriver` interface with exactly these five methods:

```ts
interface WebLLMDriver {
  init(): Promise<void>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  health(): Promise<DriverHealth>;
  recover(reason?: string): Promise<RecoveryResult>;
  shutdown(): Promise<void>;
}
```

No additional methods may be added to this interface without a new change proposal.

### DR-ADD-002: GeminiWebDriver Implementation

A concrete class `GeminiWebDriver` MUST implement `WebLLMDriver`.  
Constructor: `new GeminiWebDriver(config: DriverConfig)`.

### DR-ADD-003: Domain Isolation Constraint

`GeminiWebDriver` MUST NOT import from:
- `legacy/`
- any memory module
- any persona module
- any skill module
- any MCP module
- any scheduler module
- any adapter (Telegram, Discord, etc.)

Violations are build errors.

### DR-ADD-004: Pre-init Guard

`generate()` MUST throw `DriverNotInitializedError` if called before `init()` succeeds.

### DR-ADD-005: Internal Recovery on Transient Errors

`generate()` MAY attempt one internal `recover()` call on encountering a recoverable error during prompt submission or output capture.  
If recovery succeeds, it MUST retry the operation exactly once.  
If retry fails, it MUST rethrow the original typed error.

### DR-ADD-006: Mode Tracking

`GeminiWebDriver` MUST track its own mode state and reflect it accurately in `health().mode`.

### DR-ADD-007: Idempotent Shutdown

`shutdown()` MUST be safe to call:
- Before `init()`.
- After `shutdown()` has already been called.
- In any error state.

### DR-ADD-008: No Indefinite Hang

Every async operation in the driver MUST have a bounded timeout.  
Minimum: `firstTokenTimeoutMs` for output start, `stabilityTimeoutMs` for output complete.

---

## MODIFIED Requirements

_None (new module — no prior baseline to modify)._

---

## REMOVED Requirements

### DR-REM-001: All Non-Core Driver Entrypoints

Any file that previously served as a "bot", "agent", "persona runner", or "task executor" entrypoint MUST be removed from `src/` and moved to `legacy/`.

### DR-REM-002: Application-Specific Prompt Routing

Any code that routes prompts based on business context, scene, mood, or memory MUST be removed from the driver.

### DR-REM-003: Reply/Action Routing

Any code that routes driver output to memory writes, action queues, or messaging adapters MUST be removed from the driver.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| DR-AC-001 | `new GeminiWebDriver(config).init()` launches browser |
| DR-AC-002 | `generate()` before `init()` raises `DriverNotInitializedError` |
| DR-AC-003 | `shutdown()` is callable multiple times without error |
| DR-AC-004 | `src/driver/GeminiWebDriver.ts` has zero imports from `legacy/` |
| DR-AC-005 | Mode transitions: idle → generating → idle on successful `generate()` |
