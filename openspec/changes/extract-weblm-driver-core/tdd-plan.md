# TDD Test Plan: extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Status:** DRAFT — Awaiting Confirmation  
**Date:** 2026-03-31  
**Test Framework:** Vitest (preferred) or Jest

---

## Principles

1. Tests are written **before** implementation (Red → Green → Refactor).
2. Unit tests use mocks for browser/page — no real browser in unit tests.
3. Smoke tests use a real browser — marked `@smoke` and run separately.
4. Every BDD scenario maps to at least one test case.
5. No `any` in test code.
6. All async tests must have explicit timeouts.

---

## Test File 1: `tests/unit/PageStateInspector.test.ts`

**Purpose:** Verify that `PageStateInspector` correctly classifies page states from DOM snapshots.  
**Strategy:** Mock `Page` object with controlled DOM state.

### Test Cases

```
PageStateInspector
  ├── isLoggedIn()
  │   ├── [PASS] returns true when login indicator selector is present
  │   ├── [PASS] returns false when login indicator selector is absent
  │   └── [PASS] returns false when page.evaluate() throws
  │
  ├── isPageReady()
  │   ├── [PASS] returns true when input box selector is visible
  │   ├── [PASS] returns false when input box selector is absent
  │   └── [PASS] returns false when input box is hidden (not visible)
  │
  ├── hasChallenge()
  │   ├── [PASS] returns true when challenge/captcha indicator is present
  │   └── [PASS] returns false when no challenge indicator exists
  │
  ├── detectMode()
  │   ├── [PASS] returns "ready" when logged in AND page ready AND no challenge
  │   ├── [PASS] returns "unauthenticated" when not logged in
  │   ├── [PASS] returns "challenge" when challenge indicator present
  │   ├── [PASS] returns "loading" when page is in transition
  │   └── [PASS] returns "error" when page.evaluate() consistently fails
  │
  └── timeout behavior
      ├── [PASS] isLoggedIn() resolves false (not throws) when page check exceeds 5000ms
      └── [PASS] isPageReady() resolves false (not throws) when page check exceeds 5000ms
```

**Mock Strategy:**
```ts
const mockPage = {
  evaluate: vi.fn(),
  $: vi.fn(),
  isVisible: vi.fn(),
} as unknown as Page;
```

---

## Test File 2: `tests/unit/OutputCapture.test.ts`

**Purpose:** Verify output capture lifecycle, stability detection, timeout handling, and error conditions.  
**Strategy:** Mock `Page` with a controlled sequence of DOM state updates.

### Test Cases

```
OutputCapture
  ├── capture() — happy path
  │   ├── [PASS] returns CaptureResult with text when output is stable
  │   ├── [PASS] CaptureResult.startedAt < CaptureResult.completedAt
  │   ├── [PASS] does not return until stop-button is absent (condition 2)
  │   └── [PASS] does not return until content is stable (condition 1)
  │
  ├── capture() — stability edge cases
  │   ├── [PASS] does not treat "content paused mid-stream" as complete
  │   ├── [PASS] waits for second stable poll to confirm (not just one)
  │   └── [PASS] handles content that briefly appears then disappears (transient)
  │
  ├── capture() — timeout
  │   ├── [PASS] raises TimeoutError when first token never appears (within firstTokenTimeoutMs)
  │   ├── [PASS] raises TimeoutError when output never stabilizes (within stabilityTimeoutMs)
  │   ├── [PASS] TimeoutError.partial contains captured text at time of timeout
  │   ├── [PASS] TimeoutError.elapsedMs is approximately correct
  │   └── [PASS] per-call timeoutMs overrides stabilityTimeoutMs
  │
  ├── capture() — error conditions
  │   ├── [PASS] raises OutputCaptureError when output element not found
  │   ├── [PASS] raises OutputCaptureError when captured text is empty string
  │   └── [PASS] raises OutputCaptureError when captured text is whitespace only
  │
  └── selector injection
      ├── [PASS] uses injected outputContainer selector (not hardcoded)
      └── [PASS] uses injected stopButton selector (not hardcoded)
```

**Mock Strategy:**
```ts
// Simulate DOM sequence with vi.fn() returning controlled text at each poll
let callCount = 0;
const mockPage = {
  $eval: vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount < 3) return 'partial text...';  // still streaming
    return 'final complete text';
  }),
  isVisible: vi.fn().mockImplementation(() => callCount < 3),  // stop button
} as unknown as Page;
```

---

## Test File 3: `tests/unit/RecoveryManager.test.ts`

**Purpose:** Verify that `RecoveryManager` correctly decides and executes recovery actions based on health snapshots.  
**Strategy:** Inject mock `BrowserSession` and `PageStateInspector`. Control health snapshots to test each branch.

### Test Cases

```
RecoveryManager
  ├── recover() — action selection
  │   ├── [PASS] pageReady=false, URL correct → action: "refresh-page"
  │   ├── [PASS] pageReady=false, wrong URL → action: "reopen-page"
  │   ├── [PASS] browserRunning=false → action: "restart-browser"
  │   ├── [PASS] authenticated=false after reopen → action: "rebuild-session"
  │   └── [PASS] all healthy → action: "none", ok: true
  │
  ├── recover() — escalation
  │   ├── [PASS] refresh-page fails → escalates to reopen-page
  │   └── [PASS] reopen-page fails → escalates to restart-browser
  │
  ├── recover() — success
  │   ├── [PASS] returns ok: true when health restored after action
  │   └── [PASS] recover() result matches the action that succeeded
  │
  ├── recover() — failure
  │   ├── [PASS] returns ok: false when all actions exhausted
  │   ├── [PASS] message contains description of what was tried
  │   └── [PASS] does NOT throw — always returns RecoveryResult
  │
  ├── recover() — constraints
  │   ├── [PASS] completes within 60000ms (mock fast actions)
  │   ├── [PASS] is re-entrant safe (second call during first returns queued/skipped)
  │   └── [PASS] has zero imports from memory/, persona/, skills/
  │
  └── audit logging
      └── [PASS] each attempted action is recorded in log
```

**Mock Strategy:**
```ts
const mockSession = {
  launch: vi.fn(),
  close: vi.fn(),
  getPage: vi.fn(),
  isRunning: vi.fn(),
} as unknown as BrowserSession;
```

---

## Test File 4: `tests/unit/GeminiWebDriver.test.ts`

**Purpose:** Verify driver lifecycle, guards, composition, and error propagation.  
**Strategy:** Mock all internal modules (`BrowserSession`, `PageStateInspector`, etc.).

### Test Cases

```
GeminiWebDriver
  ├── init()
  │   ├── [PASS] calls BrowserSession.launch()
  │   ├── [PASS] initializes all sub-modules
  │   └── [PASS] sets initialized = true on success
  │
  ├── generate()
  │   ├── [PASS] throws DriverNotInitializedError before init()
  │   ├── [PASS] calls PromptSubmitter.submit() with correct args
  │   ├── [PASS] calls OutputCapture.capture() with correct timeout
  │   ├── [PASS] returns GenerateOutput with all required fields
  │   ├── [PASS] GenerateOutput.provider is set
  │   ├── [PASS] GenerateOutput.sessionId is set
  │   ├── [PASS] attempts recovery on recoverable error during generate
  │   └── [PASS] rethrows original error if recovery fails
  │
  ├── health()
  │   ├── [PASS] returns DriverHealth with all required fields
  │   ├── [PASS] ok=true when all sub-checks pass
  │   ├── [PASS] ok=false when browser not running
  │   ├── [PASS] never throws — even when BrowserSession throws
  │   ├── [PASS] mode="generating" during active generate()
  │   └── [PASS] mode="shutdown" after shutdown()
  │
  ├── recover()
  │   ├── [PASS] delegates to RecoveryManager.recover()
  │   └── [PASS] returns RecoveryResult
  │
  ├── shutdown()
  │   ├── [PASS] calls BrowserSession.close()
  │   ├── [PASS] sets mode to "shutdown"
  │   ├── [PASS] is safe to call before init() (no-op)
  │   └── [PASS] is safe to call twice
  │
  └── isolation
      └── [PASS] GeminiWebDriver has zero imports from legacy/, memory/, persona/
```

---

## Test File 5: `tests/smoke/driver.smoke.test.ts`

**Purpose:** End-to-end verification with a real browser.  
**Strategy:** Requires valid `profileDir` with active session. Tests are tagged `@smoke` and skipped in CI unless explicitly enabled.

### Test Cases

```
Driver Smoke Tests  [@smoke — requires real browser + session]
  ├── init
  │   └── [PASS] driver.init() succeeds and health().ok === true
  │
  ├── generate
  │   └── [PASS] driver.generate({ prompt: "Reply with the word PONG only." })
  │              returns output.text containing "PONG"
  │
  ├── health
  │   └── [PASS] driver.health() returns full DriverHealth object
  │
  ├── recover
  │   └── [PASS] driver.recover() returns RecoveryResult without throwing
  │
  └── shutdown
      └── [PASS] driver.shutdown() succeeds and health().mode === "shutdown"
```

**Smoke Test Config:**
```ts
// tests/smoke/driver.smoke.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GeminiWebDriver } from '../../src';

const SMOKE_PROFILE = process.env.SMOKE_PROFILE_DIR;
const SMOKE_URL = process.env.SMOKE_PROVIDER_URL ?? 'https://gemini.google.com/app';

describe.runIf(!!SMOKE_PROFILE)('Driver Smoke Tests', () => {
  // ... tests here
});
```

---

## Test Execution Commands

```bash
# Phase C — Run unit tests (must be RED before implementation)
npm test

# Phase D — Run unit tests (must be GREEN after implementation)
npm test

# Phase F — Run smoke tests
SMOKE_PROFILE_DIR=/path/to/profile npm run test:smoke

# Type check
npm run typecheck
```

---

## Coverage Targets (Unit Tests Only)

| Module | Line Coverage Target |
|--------|---------------------|
| `PageStateInspector` | 100% |
| `OutputCapture` | 100% |
| `RecoveryManager` | 100% |
| `GeminiWebDriver` | ≥ 90% |
| `src/errors/index.ts` | 100% |

---

## Test Implementation Order (Strict)

Must be written before implementation starts (Phase C precedes Phase D):

1. `PageStateInspector.test.ts` — simplest mocks
2. `OutputCapture.test.ts` — timing-sensitive, requires controlled DOM mock
3. `RecoveryManager.test.ts` — stateful mock of BrowserSession
4. `GeminiWebDriver.test.ts` — integration of all mocks
5. `driver.smoke.test.ts` — scaffold only (skip guards), run after Phase D
