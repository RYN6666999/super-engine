# Boundary Audit — weblm-driver v0.1.0-driver-core

This document records the complete scope of the driver core: what remains, what was excluded by design, and what enforcement prevents re-introduction.

---

## What Remains in Core (In-Scope)

### Public exports (`src/index.ts`)

| Export | Kind | Purpose |
|---|---|---|
| `WebLLMDriver` | interface | The canonical five-method driver contract |
| `GeminiWebDriver` | class | Concrete Playwright-backed implementation |
| `GenerateInput` | type | Input to `generate()` |
| `GenerateOutput` | type | Output from `generate()` |
| `DriverHealth` | type | Output from `health()` |
| `DriverMode` | type | Enum of driver operational modes |
| `RecoveryResult` | type | Output from `recover()` |
| `RecoveryAction` | type | Enum of recovery actions |
| `DriverConfig` | type | Driver construction config |
| `ProviderSelectors` | type | CSS selector map for provider customization |
| `DriverError` | class | Abstract typed error base |
| `DriverNotInitializedError` | class | Pre-init guard error |
| `AuthenticationRequiredError` | class | Session expired error |
| `PageNotReadyError` | class | Input box absent error |
| `PromptSubmitError` | class | Input interaction failure |
| `OutputCaptureError` | class | Empty/missing output error |
| `TimeoutError` | class | Timeout with `elapsedMs` + `partial` |
| `RecoveryFailedError` | class | All recovery actions exhausted |

### Internal modules (not in public index — importable directly for DI)

| Module | Responsibility | Boundary |
|---|---|---|
| `BrowserSession` | Playwright lifecycle only — launch/close/getPage/isRunning | No health/recovery/inspection logic |
| `PageStateInspector` | Non-throwing DOM reads — isLoggedIn, isPageReady, hasChallenge, detectMode | No submission, no capture, no recovery |
| `PromptSubmitter` | Fill input + press Enter — submit only | No output concern, no health |
| `OutputCapture` | Two-phase polling capture — first-token + stability | No submission, no health, no recovery |
| `RecoveryManager` | Decision-matrix recovery — never throws | No generate, no submission, no capture |
| `GeminiWebDriver` | Wires all modules — no logic of its own | No business logic |

### Provider selectors

| File | Purpose |
|---|---|
| `src/providers/gemini/selectors.ts` | Versioned CSS selectors — never hardcoded in modules |

---

## What Was Removed from Public Exports (Phase E)

These types were in `src/index.ts` at the end of Phase B but removed in Phase E during the export audit:

| Removed export | Reason |
|---|---|
| `CaptureConfig` | Internal config for `OutputCapture` — not part of driver contract |
| `CaptureResult` | Internal return type — callers only see `GenerateOutput` |
| `BrowserSessionConfig` | Internal config for `BrowserSession` — not part of driver contract |
| `PageMode` | Internal DOM state enum — callers only see `DriverMode` |

These types remain accessible via direct import (`weblm-driver/src/types/index`) for advanced use but are not part of the SemVer-stable public API.

---

## What Must Never Return to Core

The following categories are **permanently excluded**. Any PR introducing these concerns violates the driver boundary and must be rejected:

### Agent / Persona / Workflow
- Task orchestration, planning, agent loops
- Persona definitions, system-prompt templates
- Chain-of-thought management
- Multi-step conversation management

### Memory Systems
- Short-term conversation context storage
- Long-term episodic or semantic memory
- Vector database clients
- RAG (Retrieval-Augmented Generation) pipeline

### HTTP / Network API
- REST or GraphQL server endpoints
- WebSocket server or client
- gRPC server
- Any inbound network listener

### Queue / Orchestrator Integration
- Message queue consumers (SQS, RabbitMQ, etc.)
- Job scheduler clients
- Rate limiter with external state
- Distributed locking

### MCP (Model Context Protocol)
- MCP server implementation
- MCP client
- Tool/resource registration

### Dashboard / Telemetry Sink
- UI component
- Metrics push to external service
- Log aggregation pipeline
- Alerting rule configuration

### Business / Domain Semantics
- Application-specific prompt templates
- User account logic
- Billing or quota tracking
- Multi-tenant isolation

---

## Enforcement Mechanisms

| Mechanism | What it enforces |
|---|---|
| ESLint `no-restricted-imports: **/legacy/**` | Blocks imports from any `legacy/` directory |
| `exactOptionalPropertyTypes: true` | Prevents accidental `undefined` assignment in public types |
| Module boundaries | Each module has a single, documented responsibility |
| Export whitelist in `src/index.ts` | Only the 18 listed exports are public |
| `tests/unit/**` scope | Unit tests target only driver primitives — no external services |
| Smoke gate (`VITEST_SMOKE + SMOKE_PROFILE_DIR`) | Smoke tests excluded from CI run without explicit opt-in |

---

## Boundary Invariants (Machine-checkable)

```
∀ export ∈ src/index.ts → export ∈ { WebLLMDriver contract types ∪ DriverError hierarchy ∪ GeminiWebDriver }
∀ module ∈ src/modules → module has no import from src/agent | src/memory | src/api | src/queue | src/mcp
∀ core failure path → throws DriverError subclass (not `new Error(...)`)
health() → never throws (try-catch wraps all internal calls)
shutdown() → idempotent (safe to call 0..n times)
recover() → never throws (returns RecoveryResult)
```
