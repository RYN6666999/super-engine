# Spec: API

**Spec ID:** specs/api  
**Version:** 1.0.0  
**Status:** ACTIVE  
**Last Updated:** 2026-03-31

---

## 1. Purpose

Define the public API surface of the `WebLLMDriver` package — what consumers import, what they configure, and what they receive.

---

## 2. Package Entry Point

The package exports exactly:

```ts
// Public interface
export type { WebLLMDriver };

// Public types
export type {
  GenerateInput,
  GenerateOutput,
  DriverHealth,
  RecoveryResult,
  DriverConfig,
};

// Typed errors
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

No other symbols are exported from the package entry point.

---

## 3. DriverConfig

```ts
interface DriverConfig {
  providerUrl: string;           // Target Web LLM page URL
  profileDir?: string;           // Browser profile directory path
  headless?: boolean;            // Default: true
  firstTokenTimeoutMs?: number;  // Default: 30000
  stabilityTimeoutMs?: number;   // Default: 120000
  stabilityIntervalMs?: number;  // Default: 1500
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}
```

---

## 4. Instantiation

```ts
const driver = new GeminiWebDriver({
  providerUrl: 'https://gemini.google.com/app',
  profileDir: '/path/to/browser-profile',
  headless: true,
});

await driver.init();
const output = await driver.generate({ prompt: 'Hello' });
await driver.shutdown();
```

---

## 5. API Guarantees

| Guarantee | Description |
|-----------|-------------|
| Type safety | All inputs and outputs are fully typed — no `any` |
| No side effects on import | Driver does not start browser on import |
| Lazy initialization | Browser starts only when `init()` is called |
| Idempotent shutdown | `shutdown()` is safe to call multiple times |
| Non-throwing health | `health()` never throws |
| Structured errors | All errors extend `DriverError` with `code` and `recoverable` fields |

---

## 6. Error Base Class

```ts
abstract class DriverError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
}
```

---

## 7. What the API Does NOT Expose

The following are explicitly **not** part of the public API:

- Memory / storage operations
- Persona management
- Skill invocation
- Agent orchestration
- Event bus / pubsub
- Conversation history
- Any application-specific types
- Any Telegram / Discord / social adapters

The API boundary is strictly: **prompt in → text out → health/recovery lifecycle**.
