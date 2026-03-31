# Design Document: extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Status:** DRAFT — Awaiting Confirmation  
**Date:** 2026-03-31  
**Author:** Refactor Agent

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WebLLMDriver API                         │
│   init() │ generate() │ health() │ recover() │ shutdown()       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ implements
              ┌───────────▼───────────┐
              │    GeminiWebDriver    │
              │  (only orchestrates)  │
              └──┬──┬──┬──┬──┬───────┘
                 │  │  │  │  │
    ┌────────────▼  │  │  │  └─────────────────┐
    │ BrowserSession│  │  │                     │
    │ (browser,ctx, │  │  │                     │
    │  page, profile│  │  │                     │
    └───────────────┘  │  └──────────────┐      │
                       │                 │      │
         ┌─────────────▼──┐   ┌──────────▼─┐   │
         │PageStateInspect│   │PromptSubmit│   │
         │- isLoggedIn()  │   │- submit()  │   │
         │- isPageReady() │   └────────────┘   │
         │- detectChallng │                    │
         └────────────────┘                    │
                                    ┌───────────▼───┐
                                    │ OutputCapture │
                                    │ - capture()   │
                                    └───────────────┘
                          ┌──────────────────────────────┐
                          │       RecoveryManager        │
                          │ - decide(health) → action    │
                          │ - execute(action)            │
                          └──────────────────────────────┘
```

---

## 2. Module Breakdown

### 2.1 BrowserSession

**File:** `src/modules/BrowserSession.ts`  
**Responsibility:** Owns the lifecycle of the Playwright browser, context, and page.

```ts
class BrowserSession {
  constructor(config: BrowserSessionConfig) {}

  async launch(): Promise<void>;          // Start browser
  async close(): Promise<void>;           // Close browser
  async getPage(): Promise<Page>;         // Return current page
  isRunning(): boolean;                   // Quick sync check
}

interface BrowserSessionConfig {
  profileDir?: string;
  headless?: boolean;
  providerUrl: string;
}
```

**Rules:**
- Stores `profileDir` as persistent browser profile. Never deletes it on recovery.
- Headless defaults to `true`.
- `getPage()` throws `DriverNotInitializedError` if browser not launched.

---

### 2.2 PageStateInspector

**File:** `src/modules/PageStateInspector.ts`  
**Responsibility:** Reads and classifies the current state of the provider page.

```ts
class PageStateInspector {
  constructor(selectors: ProviderSelectors) {}

  async isLoggedIn(page: Page): Promise<boolean>;
  async isPageReady(page: Page): Promise<boolean>;      // input box visible
  async hasChallenge(page: Page): Promise<boolean>;     // captcha/login wall
  async detectMode(page: Page): Promise<PageMode>;
}

type PageMode = 'ready' | 'unauthenticated' | 'challenge' | 'error' | 'loading';
```

**Rules:**
- All methods timeout after `5000ms` individually.
- Never throws — returns `false`/`'error'` on unexpected DOM state.
- Selectors are injected via `ProviderSelectors` (not hardcoded).

---

### 2.3 PromptSubmitter

**File:** `src/modules/PromptSubmitter.ts`  
**Responsibility:** Locates the prompt input, fills it, and submits.

```ts
class PromptSubmitter {
  constructor(selectors: ProviderSelectors) {}

  async submit(page: Page, prompt: string, systemPrompt?: string): Promise<void>;
}
```

**Rules:**
- Raises `PageNotReadyError` if input box not found.
- Raises `PromptSubmitError` if submission interaction fails.
- Clears existing content before filling.
- Supports both keyboard-submit and button-click patterns.
- Does NOT wait for output — submission only.

---

### 2.4 OutputCapture

**File:** `src/modules/OutputCapture.ts`  
**Responsibility:** Waits for output to begin, stabilize, and then extracts complete text.

```ts
class OutputCapture {
  constructor(selectors: ProviderSelectors, config: CaptureConfig) {}

  async capture(page: Page, timeoutMs?: number): Promise<CaptureResult>;
}

interface CaptureResult {
  text: string;
  startedAt: Date;
  completedAt: Date;
  partial?: boolean;
}

interface CaptureConfig {
  firstTokenTimeoutMs: number;    // default 30000
  stabilityTimeoutMs: number;     // default 120000
  stabilityIntervalMs: number;    // default 1500
}
```

**Rules:**
- Never returns empty text as success.
- On timeout: raises `TimeoutError` with partial text attached to error metadata.
- Uses dual-condition stability check:
  1. DOM content unchanged for `stabilityIntervalMs`.
  2. Provider's "stop generating" indicator no longer present.

---

### 2.5 RecoveryManager

**File:** `src/modules/RecoveryManager.ts`  
**Responsibility:** Decides and executes recovery based on failure context.

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

**Decision Logic:**

```
if (!health.browserRunning)  → restart-browser
elif (!health.pageReady && wrong URL)  → reopen-page
elif (!health.pageReady)  → refresh-page
elif (!health.authenticated)  → reopen-page → verify → rebuild-session if still no auth
else  → none
```

After each action, re-runs `health()` to verify. If health is restored: return `ok: true`.  
If all actions fail: return `ok: false, action: last-attempted`.  
Never throws.

---

### 2.6 GeminiWebDriver

**File:** `src/driver/GeminiWebDriver.ts`  
**Responsibility:** Wires all modules together; implements `WebLLMDriver`.

```ts
class GeminiWebDriver implements WebLLMDriver {
  constructor(config: DriverConfig) {}

  async init(): Promise<void>;
  async generate(input: GenerateInput): Promise<GenerateOutput>;
  async health(): Promise<DriverHealth>;
  async recover(reason?: string): Promise<RecoveryResult>;
  async shutdown(): Promise<void>;
}
```

**Rules:**
- `generate()` guard: throws `DriverNotInitializedError` if `!initialized`.
- Calls `recovery()` internally on transient errors during `generate()`.
- Tracks `mode` state: `idle → generating → idle`.
- Does NOT contain any app logic, memory, prompt routing, or session persistence beyond browser state.

---

## 3. Typed Errors

```
DriverError (abstract base)
├── DriverNotInitializedError     code: DRIVER_NOT_INITIALIZED
├── AuthenticationRequiredError   code: AUTH_REQUIRED
├── PageNotReadyError             code: PAGE_NOT_READY
├── PromptSubmitError             code: PROMPT_SUBMIT_FAILED
├── OutputCaptureError            code: OUTPUT_CAPTURE_FAILED
├── TimeoutError                  code: TIMEOUT
│   └── .partial?: string         (captured text so far)
└── RecoveryFailedError           code: RECOVERY_FAILED
    └── .attemptsLog: string[]    (list of tried actions)
```

All errors:
- Have a `code: string` (machine-readable).
- Have a `recoverable: boolean` flag.
- Have `timestamp: Date`.
- Have optional `context: Record<string, unknown>`.

---

## 4. Provider Selectors (Gemini Web)

Selectors are isolated in a versioned config file:

```ts
// src/providers/gemini/selectors.ts
export const GeminiSelectors: ProviderSelectors = {
  inputBox: 'rich-textarea',
  submitButton: 'button[aria-label="Send message"]',
  outputContainer: '.model-response-text',
  stopButton: 'button[aria-label="Stop generating"]',
  loginIndicator: '[data-test-id="user-menu"]',
  challengeIndicator: '#captcha-container',
};
```

Selectors are never hardcoded inside modules. Modules receive them via constructor injection.

---

## 5. Data Flow: generate()

```
caller
  → generate({ prompt })
    → assert initialized
    → mode = 'generating'
    → submitter.submit(page, prompt)
    → capture = outputCapture.capture(page, timeoutMs)
    → mode = 'idle'
    → return GenerateOutput {
        text: capture.text,
        startedAt: capture.startedAt,
        completedAt: capture.completedAt,
        provider: 'gemini-web',
        sessionId: session.id,
      }
```

On any error during generate:
```
    → recovery attempt (if error is recoverable)
    → if recovery ok → retry once
    → if retry fails → rethrow original typed error
```

---

## 6. State Machine

```
          ┌──────┐
    ──────►│ INIT │◄────────────────────────┐
           └──┬───┘                         │
              │ init() success              │ recover() success
              ▼                             │
          ┌──────┐   generate()   ┌─────────┴──────┐
          │ IDLE ├───────────────►│  GENERATING    │
          └──┬───┘                └───────┬────────┘
             │                           │
             │ error detected            │ error
             ▼                           ▼
         ┌──────────┐           ┌─────────────────┐
         │RECOVERING│           │   RECOVERING    │
         └──────────┘           └─────────────────┘
             │ all fail
             ▼
         ┌──────────┐
         │ DEGRADED │
         └──────────┘

    shutdown() from any state → SHUTDOWN
```

---

## 7. File Structure

```
src/
  driver/
    GeminiWebDriver.ts
  modules/
    BrowserSession.ts
    PageStateInspector.ts
    PromptSubmitter.ts
    OutputCapture.ts
    RecoveryManager.ts
  providers/
    gemini/
      selectors.ts
  types/
    index.ts
  errors/
    index.ts
  index.ts

tests/
  unit/
    PageStateInspector.test.ts
    OutputCapture.test.ts
    RecoveryManager.test.ts
    GeminiWebDriver.test.ts
  smoke/
    driver.smoke.test.ts

legacy/                   ← all removed subsystems

openspec/
  specs/                  ← canonical baseline specs
  changes/
    extract-weblm-driver-core/    ← this change

README.md
package.json
tsconfig.json
```

---

## 8. Dependencies

| Dependency | Purpose |
|------------|---------|--
| `playwright` | Browser automation |
| `typescript` | Type safety |
| `vitest` | **Locked test runner** (not Jest — see below) |
| `eslint` + `@typescript-eslint/*` | Static analysis + import guards |

No additional runtime dependencies are required. The driver intentionally has a minimal footprint.

### Test Runner: Vitest (locked)

Vitest is the confirmed test runner for this project.

- Native TypeScript support via esbuild — no `ts-jest` transform config.
- `vi.fn()` / `vi.mock()` API is identical to Jest; migration cost is a single import-line change.
- `describe.runIf(condition)` enables clean smoke-test environment gating.
- ESM and CommonJS both supported.

### Static Import Guard: ESLint `no-restricted-imports`

A `.eslintrc.json` rule blocks any `import ... from '**/legacy/**'` in `src/` and `tests/`.
This is enforced at lint-time (not only at grep gate in Phase F).
Rule is set up in Phase B alongside project infra.

### metadata: opaque pass-through

`GenerateInput.metadata` and `GenerateOutput.metadata` are `Readonly<Record<string, unknown>>`.
The driver **never reads, parses, or acts on** this field.
It is echoed unchanged from input to output.
If the caller omits it, output also omits it.
No domain-specific keys may be defined in this spec.

---

## 9. Not Designed Here

The following are explicitly out of scope for this design:
- How the caller uses `GenerateOutput` (that's the caller's concern).
- Conversation threading or multi-turn history (caller manages this).
- Retry policies beyond single internal recovery attempt.
- HTTP API wrapping.
- Authentication flow automation (driver assumes user has an active session in `profileDir`).
