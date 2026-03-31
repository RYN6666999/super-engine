# Change Proposal: extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Status:** DRAFT — Awaiting Confirmation  
**Date:** 2026-03-31  
**Author:** Refactor Agent  
**Phase:** A (Spec First)

---

## 1. Problem Statement

The current repository has accumulated layered capabilities that have nothing to do with the core act of submitting a prompt to a browser-held Web LLM and returning an output. The active runtime path is entangled with:

- Long-term memory and pyramid summaries
- Persona management and persona market
- Multi-agent orchestration
- MCP manager
- Scheduler (Chronos / ULTIMATE_CHRONOS)
- Social adapters (Telegram, Discord)
- Web UI / dashboards
- GOLEM_PROTOCOL, NeuroShunter
- Skills system
- Bots, diary, office automation
- Domain-specific business logic

This entanglement means:
1. The browser/LLM interaction layer cannot be tested in isolation.
2. Failure in any peripheral subsystem can destabilize the core generation path.
3. The codebase cannot be understood or maintained without understanding all layers simultaneously.
4. The only genuinely reusable unit — the browser-in-the-loop driver — is buried.

---

## 2. Proposed Change

Extract and isolate a **single, minimal, recoverable, and testable** browser-in-the-loop Web LLM driver.

**Change Name:** `extract-weblm-driver-core`

The extracted core will be the **only active runtime path**. Everything else will be moved to `legacy/` and removed from all active imports.

---

## 3. Target Architecture (After)

```
src/
  driver/
    GeminiWebDriver.ts          ← top-level driver (implements WebLLMDriver)
  modules/
    BrowserSession.ts
    PageStateInspector.ts
    PromptSubmitter.ts
    OutputCapture.ts
    RecoveryManager.ts
  types/
    index.ts                    ← GenerateInput, GenerateOutput, DriverHealth, RecoveryResult, DriverConfig
  errors/
    index.ts                    ← all typed error classes
  index.ts                      ← package entry (only exports above)

legacy/                         ← all removed subsystems archived here
  memory/
  persona/
  dashboard/
  skills/
  mcp/
  scheduler/
  agents/
  adapters/
  ...

tests/
  unit/
    PageStateInspector.test.ts
    OutputCapture.test.ts
    RecoveryManager.test.ts
    GeminiWebDriver.test.ts
  smoke/
    driver.smoke.test.ts
```

---

## 4. The Extracted Core: WebLLMDriver

```ts
interface WebLLMDriver {
  init(): Promise<void>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  health(): Promise<DriverHealth>;
  recover(reason?: string): Promise<RecoveryResult>;
  shutdown(): Promise<void>;
}
```

The driver is **domain-agnostic**. It does not know about memory, persona, scene, negotiation, RAG, workflows, or business schema. It knows only: prompt, output, browser state, page state, session state, timeout, recovery, and health.

---

## 5. What Is Removed from Active Runtime

| Category | Status |
|----------|--------|
| Memory system / long-term memory / pyramid summaries | → `legacy/memory/` |
| Persona / persona market | → `legacy/persona/` |
| Dashboard / web UI | → `legacy/dashboard/` |
| Skills system | → `legacy/skills/` |
| MCP manager | → `legacy/mcp/` |
| Task controller / action queue | → `legacy/scheduler/` |
| Multi-agent orchestration | → `legacy/agents/` |
| Scheduler / Chronos | → `legacy/scheduler/` |
| Telegram / Discord adapters | → `legacy/adapters/` |
| Diary / office automation | → `legacy/apps/` |
| GOLEM_PROTOCOL / NeuroShunter | → `legacy/protocols/` |
| Reply/memory/action routing | → `legacy/routing/` |
| Prompt pool / prompt trends | → `legacy/prompts/` |
| Social node / bots | → `legacy/social/` |
| Business workflow / domain logic | → `legacy/business/` |

None of the above may be imported from `src/index.ts` or any active driver module after this change.

---

## 6. Success Criteria

| # | Criterion | Verifiable By |
|---|-----------|--------------|
| 1 | `GeminiWebDriver` implements all 5 methods | Code review |
| 2 | `health()` never throws | Unit test |
| 3 | `generate()` before `init()` raises `DriverNotInitializedError` | Unit test |
| 4 | Partial output is not returned unless `TimeoutError` | Unit test |
| 5 | All unit tests pass | `npm test` |
| 6 | Smoke tests pass (init → generate → shutdown) | `npm run test:smoke` |
| 7 | `src/index.ts` has zero imports from `legacy/` | Static analysis |
| 8 | README describes only driver capabilities | Code review |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Legacy code shares utilities with driver | Medium | Audit all imports before moving to `legacy/` |
| Provider DOM changes break selectors | High | Isolate all selectors in a versioned `config/selectors.ts` |
| Session profile lost during browser restart | Low | Preserve `profileDir` in `BrowserSession`, never delete on recovery |
| Partial output incorrectly treated as complete | Medium | Strict stability detection with dual condition check |
| `OutputCapture` hangs indefinitely | Low | Hard timeout on every `waitFor` call |

---

## 8. Out of Scope for This Change

- Implementing a new memory or orchestration layer on top of the driver.
- Supporting multiple providers simultaneously (only GeminiWeb today).
- CI/CD pipeline setup.
- Docker/containerization.
- Any REST API wrapping the driver.
