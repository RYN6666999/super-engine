# Delta Spec: API — extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Module:** api  
**Base Spec:** openspec/specs/api/spec.md  
**Delta Type:** ADDED (new public surface from scratch)  
**Status:** DRAFT

---

## Summary of Changes

This delta defines the exact public API surface that the package exposes after this change. The current repository (if it had exports) had a broad, mixed-concern export surface. This change replaces that with a minimal, typed, driver-only API.

---

## ADDED Requirements

### AP-ADD-001: Minimal Entry Point

`src/index.ts` MUST export exactly and only:

```ts
// Interface
export type { WebLLMDriver };

// Types
export type {
  GenerateInput,
  GenerateOutput,
  DriverHealth,
  RecoveryResult,
  DriverConfig,
  ProviderSelectors,
  CaptureConfig,
};

// Errors
export {
  DriverError,
  DriverNotInitializedError,
  AuthenticationRequiredError,
  PageNotReadyError,
  PromptSubmitError,
  OutputCaptureError,
  TimeoutError,
  RecoveryFailedError,
};

// Concrete driver
export { GeminiWebDriver };
```

No other symbols may be exported.

### AP-ADD-002: DriverError Base Class

```ts
abstract class DriverError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.timestamp = new Date();
    this.context = context;
  }
}
```

### AP-ADD-003: Full Typed Error Hierarchy

| Class | `code` | `recoverable` |
|-------|--------|--------------|
| `DriverNotInitializedError` | `DRIVER_NOT_INITIALIZED` | `false` |
| `AuthenticationRequiredError` | `AUTH_REQUIRED` | `true` |
| `PageNotReadyError` | `PAGE_NOT_READY` | `true` |
| `PromptSubmitError` | `PROMPT_SUBMIT_FAILED` | `true` |
| `OutputCaptureError` | `OUTPUT_CAPTURE_FAILED` | `true` |
| `TimeoutError` | `TIMEOUT` | `true` |
| `RecoveryFailedError` | `RECOVERY_FAILED` | `false` |

`TimeoutError` additionally carries:
```ts
class TimeoutError extends DriverError {
  readonly partial?: string;   // partial text captured before timeout
  readonly elapsedMs: number;
}
```

`RecoveryFailedError` additionally carries:
```ts
class RecoveryFailedError extends DriverError {
  readonly attemptsLog: string[];
}
```

### AP-ADD-004: No any in Public Types

All public types MUST be fully typed — zero `any` usage.  
Internal implementation may use `unknown` where necessary, but public surfaces must be concrete types.

### AP-ADD-005: Lazy Initialization Guarantee

Importing the package MUST NOT start a browser.  
`GeminiWebDriver` constructor MUST NOT launch any process.  
Browser is launched only when `init()` is explicitly called.

### AP-ADD-006: DriverConfig Fully Typed

```ts
interface DriverConfig {
  providerUrl: string;
  profileDir?: string;
  headless?: boolean;
  firstTokenTimeoutMs?: number;
  stabilityTimeoutMs?: number;
  stabilityIntervalMs?: number;
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}
```

All fields with `?` default to documented values. `providerUrl` is required.

---

## MODIFIED Requirements

_None (new surface — no prior baseline)._

---

## REMOVED Requirements

### AP-REM-001: Memory API Exports

Any previously exported memory-related types, classes, or functions MUST be removed from the package entry point.

### AP-REM-002: Persona API Exports

Any previously exported persona-related types, classes, or functions MUST be removed.

### AP-REM-003: Agent/Orchestration Exports

Any exported orchestration, agent, scheduler, or router classes MUST be removed.

### AP-REM-004: Adapter Exports

Any exported messaging adapter (Telegram, Discord) or social node MUST be removed.

### AP-REM-005: Business Schema Exports

Any exported business-specific types, constants, or schemas MUST be removed.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AP-AC-001 | `import { GeminiWebDriver } from '.'` works and is the only concrete class exported |
| AP-AC-002 | `import { TimeoutError } from '.'` works and `TimeoutError` has `partial` field |
| AP-AC-003 | TypeScript `tsc --noEmit` passes with zero errors |
| AP-AC-004 | `src/index.ts` contains zero imports from `legacy/` |
| AP-AC-005 | All error classes are `instanceof DriverError` |
| AP-AC-006 | `new GeminiWebDriver(config)` does not start a browser process |
| AP-AC-007 | Package has no public `any` types (`tsc --strict` passes) |
