# Spec: WebLLMDriver

**Spec ID:** specs/driver  
**Version:** 1.0.0  
**Status:** ACTIVE  
**Last Updated:** 2026-03-31

---

## 1. Purpose

Define the canonical interface and responsibilities for any Web LLM driver implementation.

A **Web LLM driver** is a stateful component that:
1. Maintains a persistent browser session pointed at a Web LLM provider page.
2. Accepts prompt inputs and returns completion outputs.
3. Exposes structured health, recovery, and lifecycle management.

The driver is intentionally **domain-agnostic**. It knows nothing about memory, persona, workflow, or business logic. It knows only: prompt, output, browser state, page state, session state, timeout, recovery, and health.

---

## 2. Interface

```ts
interface WebLLMDriver {
  init(): Promise<void>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  health(): Promise<DriverHealth>;
  recover(reason?: string): Promise<RecoveryResult>;
  shutdown(): Promise<void>;
}
```

---

## 3. Types

### GenerateInput
```ts
interface GenerateInput {
  prompt: string;
  systemPrompt?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}
```

### GenerateOutput
```ts
interface GenerateOutput {
  text: string;
  startedAt: Date;
  completedAt: Date;
  provider: string;
  sessionId: string;
}
```

### DriverHealth
```ts
interface DriverHealth {
  ok: boolean;
  initialized: boolean;
  browserRunning: boolean;
  pageReady: boolean;
  authenticated: boolean;
  providerReachable: boolean;
  mode: 'idle' | 'generating' | 'recovering' | 'degraded' | 'shutdown';
  lastError?: string;
}
```

### RecoveryResult
```ts
interface RecoveryResult {
  ok: boolean;
  action: 'none' | 'refresh-page' | 'reopen-page' | 'restart-browser' | 'rebuild-session';
  message: string;
}
```

---

## 4. Responsibilities

| Method | Responsibility |
|--------|---------------|
| `init()` | Launch browser, open provider page, validate authenticated state |
| `generate()` | Submit prompt, wait for stable output, return typed result |
| `health()` | Inspect browser + page state, return structured report |
| `recover()` | Execute appropriate recovery action based on current failure mode |
| `shutdown()` | Gracefully close page, context, browser |

---

## 5. Constraints

- `generate()` MUST NOT be called before `init()` — raises `DriverNotInitializedError`.
- `generate()` MUST NOT return partial output unless `TimeoutError` is raised.
- `health()` MUST NOT throw — it always returns a `DriverHealth` object.
- `recover()` MUST return a typed `RecoveryResult`, never throw silently.
- Driver MUST NOT import from `legacy/`, `memory/`, `persona/`, `skills/`, `mcp/`, or any business module.

---

## 6. Error Model

All errors extend `DriverError`:

| Error Class | Trigger Condition |
|-------------|------------------|
| `DriverNotInitializedError` | `generate()` called before `init()` |
| `AuthenticationRequiredError` | Provider session expired or missing |
| `PageNotReadyError` | Target page missing required interactive elements |
| `PromptSubmitError` | Failed to locate or interact with input box |
| `OutputCaptureError` | Output capture pipeline failed unexpectedly |
| `TimeoutError` | Output did not stabilize within `timeoutMs` |
| `RecoveryFailedError` | All recovery actions exhausted without success |

Rules:
- No `silent fail` (swallowed exceptions).
- No `indefinite hang` (every operation has a bounded timeout).
- Every error is classifiable, loggable, and maps to a recovery strategy.
