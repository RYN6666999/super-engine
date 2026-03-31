# Task Plan: extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Status:** DRAFT — Awaiting Confirmation  
**Date:** 2026-03-31  
**Phase:** A (Spec complete, pending impl confirmation)

---

## Phase Overview

| Phase | Name | Status |
|-------|------|--------|
| A | Spec First | ✅ Complete (this document) |
| B | Interface First | ⏳ Pending confirmation |
| C | TDD First | ⏳ Pending confirmation |
| D | Minimal Implementation | ⏳ Pending confirmation |
| E | Cleanup (move to legacy/) | ⏳ Pending confirmation |
| F | Verification | ⏳ Pending confirmation |

---

## Phase A — Spec First ✅

| # | Task | Artifact | Status |
|---|------|----------|--------|
| A1 | Create `openspec/specs/driver/spec.md` | Baseline driver spec | ✅ |
| A2 | Create `openspec/specs/health/spec.md` | Baseline health spec | ✅ |
| A3 | Create `openspec/specs/recovery/spec.md` | Baseline recovery spec | ✅ |
| A4 | Create `openspec/specs/output-capture/spec.md` | Baseline output-capture spec | ✅ |
| A5 | Create `openspec/specs/api/spec.md` | Baseline API spec | ✅ |
| A6 | Create `proposal.md` | Change proposal | ✅ |
| A7 | Create `design.md` | Architecture design | ✅ |
| A8 | Create `tasks.md` | This file | ✅ |
| A9 | Create delta specs (5 modules) | Delta specs per module | ✅ |
| A10 | Create `bdd-scenarios.md` | BDD scenarios | ✅ |
| A11 | Create `tdd-plan.md` | TDD test plan | ✅ |

**Blocker:** Human confirmation required before Phase B.

---

## Phase B — Interface First

| # | Task | File | Notes |
|---|------|------|-------|
| B0 | Init `package.json`, `tsconfig.json`, `vitest.config.ts` | project root | **Test runner: Vitest (locked)** |
| B0b | Init `.eslintrc.json` with `no-restricted-imports` blocking `legacy/` | project root | Static import guard |
| B1 | Define `GenerateInput`, `GenerateOutput`, `DriverHealth`, `RecoveryResult`, `DriverConfig` | `src/types/index.ts` | `metadata` is opaque pass-through |
| B2 | Define `WebLLMDriver` interface | `src/types/index.ts` | |
| B3 | Define all typed error classes | `src/errors/index.ts` | extend `DriverError` |
| B4 | Define `ProviderSelectors`, `CaptureConfig`, `BrowserSessionConfig`, `PageMode`, `CaptureResult` types | `src/types/index.ts` | |
| B5 | Define Gemini selectors config | `src/providers/gemini/selectors.ts` | selectors are versioned, not hardcoded in modules |
| B6 | Create `src/index.ts` entry point | `src/index.ts` | exports only canonical public surface |
| B7 | Create stub module files (compile but throw `not implemented`) | `src/modules/*.ts`, `src/driver/*.ts` | required so test files can import |

**Gate:** All types compile with zero errors before Phase C.

---

## Phase C — TDD First

| # | Task | File | Notes |
|---|------|------|-------|
| C1 | `PageStateInspector` unit tests | `tests/unit/PageStateInspector.test.ts` | Must be RED before impl |
| C2 | `OutputCapture` unit tests | `tests/unit/OutputCapture.test.ts` | Must be RED before impl |
| C3 | `RecoveryManager` unit tests | `tests/unit/RecoveryManager.test.ts` | Must be RED before impl |
| C4 | `GeminiWebDriver` unit tests | `tests/unit/GeminiWebDriver.test.ts` | Must be RED before impl |
| C5 | Smoke test scaffold | `tests/smoke/driver.smoke.test.ts` | Requires real browser — mark as skip initially |

**Gate:** All tests compile and fail (RED) before Phase D begins.

---

## Phase D — Minimal Implementation

| # | Task | File | Depends On |
|---|------|------|-----------|
| D1 | Implement `BrowserSession` | `src/modules/BrowserSession.ts` | B1–B5 |
| D2 | Implement `PageStateInspector` | `src/modules/PageStateInspector.ts` | D1 |
| D3 | Implement `PromptSubmitter` | `src/modules/PromptSubmitter.ts` | D1, D2 |
| D4 | Implement `OutputCapture` | `src/modules/OutputCapture.ts` | D1 |
| D5 | Implement `RecoveryManager` | `src/modules/RecoveryManager.ts` | D1, D2 |
| D6 | Implement `GeminiWebDriver` | `src/driver/GeminiWebDriver.ts` | D1–D5 |
| D7 | Write `src/index.ts` | `src/index.ts` | D6 |

**Gate:** All unit tests pass (GREEN) before Phase E.

---

## Phase E — Cleanup

| # | Task | Notes |
|---|------|-------|
| E1 | Audit all imports in `src/` for non-core references | zero legacy/ imports allowed |
| E2 | Move `memory/` to `legacy/memory/` | |
| E3 | Move `persona/` to `legacy/persona/` | |
| E4 | Move `dashboard/` to `legacy/dashboard/` | |
| E5 | Move `skills/` to `legacy/skills/` | |
| E6 | Move `mcp/` to `legacy/mcp/` | |
| E7 | Move `scheduler/` to `legacy/scheduler/` | |
| E8 | Move `agents/` to `legacy/agents/` | |
| E9 | Move `adapters/` to `legacy/adapters/` | |
| E10 | Move all other non-core modules to `legacy/` | |
| E11 | Remove all non-core imports from `src/index.ts` | |
| E12 | Update `package.json` entry point | point to `src/index.ts` |
| E13 | Rewrite `README.md` | minimal driver focus only |
| E14 | Verify `.eslintrc.json` `no-restricted-imports` blocks all `legacy/` patterns | lint-time guard added in B0b |

**Gate:** BOTH `grep -r "from.*legacy/" src/` AND `npm run lint` return zero violations.

---

## Phase F — Verification

| # | Task | Command | Pass Criteria |
|---|------|---------|--------------|
| F1 | Run unit tests | `npm test` | All pass |
| F2 | Run smoke tests | `npm run test:smoke` | `init`, `generate`, `shutdown` pass |
| F3 | Type check | `npm run typecheck` | Zero errors |
| F4 | Import audit | `grep -r "legacy" src/` | Zero results |
| F5 | Health check | manual `driver.health()` | `ok: true` |
| F6 | Recovery check | manual `driver.recover()` | Returns typed `RecoveryResult` |

**Gate:** All F tasks pass → change is complete.

---

## Definition of Done

The change `extract-weblm-driver-core` is complete when:

1. ✅ `GeminiWebDriver` is the only active driver.
2. ✅ All 5 methods (`init`, `generate`, `health`, `recover`, `shutdown`) are implemented and tested.
3. ✅ All unit tests pass.
4. ✅ Smoke tests pass.
5. ✅ Zero active imports from `legacy/`.
6. ✅ README describes only driver capabilities.
7. ✅ Typed errors cover all failure modes.
8. ✅ No `any` in public types.
9. ✅ No indefinite hangs (all operations bounded).
10. ✅ No silent fails.
