# weblm-driver

A minimal, recoverable, browser-in-the-loop Web LLM driver core.

Drives a real browser to interact with a web-based LLM provider (currently Gemini Web) and exposes a clean, typed TypeScript interface for prompt submission and output capture.

---

## Scope

This package is **strictly scoped** to the following capabilities:

| Capability | Description |
|---|---|
| **Browser session lifecycle** | Launch, maintain, and close a Playwright-managed browser context |
| **Page state inspection** | Detect login status, page readiness, and challenge indicators |
| **Prompt submission** | Fill and submit a prompt to the provider input box |
| **Output capture** | Two-phase polling capture with stability + stop-indicator conditions |
| **Health reporting** | Non-throwing snapshot of all five driver health dimensions |
| **Recovery** | Decision-matrix recovery: refresh → reopen → restart → rebuild |
| **Shutdown** | Idempotent, safe-to-call-anytime session teardown |

### Non-goals (explicitly out of scope)

The following concerns are **permanently excluded** from this package:

- Agent/persona/workflow orchestration
- Memory systems (short-term, long-term, vector, episodic)
- HTTP API / REST endpoints
- Queue or task orchestrator integration
- MCP (Model Context Protocol) server or client
- Dashboard, monitoring UI, or telemetry pipeline
- Business domain logic of any kind
- Multi-provider routing or load balancing
- Rate limiting or quota management
- Authentication credential storage

---

## Installation

```bash
npm install weblm-driver
npx playwright install chromium
```

---

## Quick Start

```typescript
import { GeminiWebDriver } from 'weblm-driver';

const driver = new GeminiWebDriver({
  providerUrl: 'https://gemini.google.com/app',
  profileDir: '/path/to/browser-profile',  // must have active session
  headless: true,
  firstTokenTimeoutMs: 30_000,
  stabilityTimeoutMs: 120_000,
  stabilityIntervalMs: 1_500,
});

await driver.init();

const result = await driver.generate({ prompt: 'What is 2 + 2?' });
console.log(result.text);   // "4"
console.log(result.provider);  // "gemini-web"

await driver.shutdown();
```

---

## Public API

### `GeminiWebDriver`

Implements the `WebLLMDriver` interface:

```typescript
interface WebLLMDriver {
  init(): Promise<void>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  health(): Promise<DriverHealth>;
  recover(reason?: string): Promise<RecoveryResult>;
  shutdown(): Promise<void>;
}
```

#### `init()`
Launches the browser, opens the provider URL, and verifies the session is authenticated.  
Throws `AuthenticationRequiredError` if no valid session is detected.

#### `generate(input)`
Submits a prompt and waits for stable output.  
Throws `DriverNotInitializedError` if called before `init()`.  
Throws `TimeoutError` if output never arrives or never stabilizes.  
Throws `OutputCaptureError` on empty or missing output.

#### `health()`
Returns `DriverHealth` — **never throws**.

#### `recover(reason?)`
Executes the spec decision matrix. **Never throws** — always returns `RecoveryResult`.

#### `shutdown()`
Tears down the browser session. **Idempotent** — safe to call multiple times or before `init()`.

---

## Types

```typescript
// Core I/O
GenerateInput      // { prompt, timeoutMs?, newConversation?, metadata? }
GenerateOutput     // { text, startedAt, completedAt, provider, sessionId, metadata? }

// Health
DriverHealth       // { ok, initialized, browserRunning, pageReady, authenticated, providerReachable, mode, lastError? }
DriverMode         // 'idle' | 'generating' | 'recovering' | 'degraded' | 'shutdown'

// Recovery
RecoveryResult     // { ok, action, message }
RecoveryAction     // 'none' | 'refresh-page' | 'reopen-page' | 'restart-browser' | 'rebuild-session'

// Config
DriverConfig       // { providerUrl, profileDir?, headless?, firstTokenTimeoutMs?, stabilityTimeoutMs?, stabilityIntervalMs?, logLevel? }
ProviderSelectors  // { inputBox, outputContainer, stopButton, loginIndicator, ... }
```

---

## Typed Errors

All core failure paths use typed errors, never `Error`:

| Class | Code | Recoverable |
|---|---|---|
| `DriverNotInitializedError` | `DRIVER_NOT_INITIALIZED` | false |
| `AuthenticationRequiredError` | `AUTH_REQUIRED` | true |
| `PageNotReadyError` | `PAGE_NOT_READY` | true |
| `PromptSubmitError` | `PROMPT_SUBMIT_FAILED` | true |
| `OutputCaptureError` | `OUTPUT_CAPTURE_FAILED` | true |
| `TimeoutError` | `TIMEOUT` | true |
| `RecoveryFailedError` | `RECOVERY_FAILED` | false |

All extend `DriverError` which carries `code`, `recoverable`, `timestamp`, and optional `context`.

---

## Configuration Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `providerUrl` | `string` | required | Target Web LLM page URL |
| `profileDir` | `string?` | — | Browser profile directory (keeps cookies/localStorage for session persistence) |
| `headless` | `boolean?` | `true` | Run browser without UI |
| `firstTokenTimeoutMs` | `number?` | `30000` | Max ms to wait for first output token |
| `stabilityTimeoutMs` | `number?` | `120000` | Max ms to wait for stable output |
| `stabilityIntervalMs` | `number?` | `1500` | Polling interval for output stability check |
| `logLevel` | `'silent'\|'error'\|'warn'\|'info'\|'debug'?` | — | Reserved for future structured logging |

---

## Testing

```bash
# Unit tests (no browser required)
npm test

# Smoke tests (requires live browser profile)
VITEST_SMOKE=1 SMOKE_PROFILE_DIR=/path/to/profile npm run test:smoke

# Typecheck
npm run typecheck

# Lint
npm run lint
```

See [docs/smoke-test-guide.md](docs/smoke-test-guide.md) for a complete smoke test walkthrough.

---

## Architecture

```
src/
  index.ts                      ← public exports (trimmed to driver contract)
  types/index.ts                ← all public types, single source of truth
  errors/index.ts               ← typed error hierarchy
  driver/
    GeminiWebDriver.ts          ← WebLLMDriver implementation, wires modules
  modules/
    BrowserSession.ts           ← Playwright lifecycle only
    PageStateInspector.ts       ← non-throwing DOM state reads
    PromptSubmitter.ts          ← fill + submit, no output concern
    OutputCapture.ts            ← two-phase polling capture
    RecoveryManager.ts          ← decision-matrix recovery, never throws
  providers/
    gemini/selectors.ts         ← versioned CSS selectors, never hardcoded
```

---

## Release

Current: `v0.1.0-driver-core`

See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

## License

MIT
