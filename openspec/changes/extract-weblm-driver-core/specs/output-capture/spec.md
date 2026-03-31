# Delta Spec: Output Capture — extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Module:** output-capture  
**Base Spec:** openspec/specs/output-capture/spec.md  
**Delta Type:** ADDED (new module from scratch)  
**Status:** DRAFT

---

## Summary of Changes

This delta introduces `OutputCapture` as a dedicated, isolated module with strict stability detection. Previously, output capture was tangled with reply routing, memory writes, and post-processing. This change makes it a pure capture concern.

---

## ADDED Requirements

### OC-ADD-001: OutputCapture Module

A standalone `OutputCapture` class MUST be created:

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
```

### OC-ADD-002: Two-Phase Capture

Phase 1 — Wait for first token:
- Poll for output DOM element to have non-empty text content.
- Timeout: `CaptureConfig.firstTokenTimeoutMs` (default 30000ms).
- If timeout: raise `TimeoutError` with `partial: undefined`.

Phase 2 — Wait for stable output:
- Poll every `CaptureConfig.stabilityIntervalMs` (default 1500ms).
- Consider stable when BOTH:
  - Content has not changed for one full `stabilityIntervalMs`.
  - Provider's stop/generating indicator is absent.
- Timeout: `CaptureConfig.stabilityTimeoutMs` (default 120000ms) from start.
- If timeout during phase 2: raise `TimeoutError` with current content in error metadata.

### OC-ADD-003: Dual Stability Condition

Output is complete ONLY when BOTH conditions are met simultaneously:

1. **Content stability:** DOM text content is identical across two consecutive polls separated by `stabilityIntervalMs`.
2. **Indicator absent:** The provider's "stop generating" button or streaming cursor is no longer present.

Either condition alone is insufficient to declare completion.

### OC-ADD-004: Empty Output Rejection

If the extracted text after stability detection is empty or whitespace-only, MUST raise `OutputCaptureError` with message `"Captured empty output"`.

### OC-ADD-005: Partial Output Policy

- `CaptureResult.partial` is `true` only when returned as part of a `TimeoutError`.
- Normal completed return MUST NOT have `partial: true`.
- Caller MUST explicitly catch `TimeoutError` to access partial text.

### OC-ADD-006: Selector Injection

OutputCapture MUST NOT hardcode provider-specific selectors.  
All selectors MUST be injected via `ProviderSelectors` at construction time.

Required selectors:
- `outputContainer`: where output text lives
- `stopButton`: the "stop generating" button
- `streamingIndicator` (optional): any streaming cursor/spinner

### OC-ADD-007: Pure Capture Responsibility

`OutputCapture` MUST NOT:
- Submit prompts.
- Navigate pages.
- Know about session or authentication.
- Write to memory, files, or logs beyond structured error output.
- Mutate page state.

### OC-ADD-008: Configurable Timeouts per Call

The `timeoutMs` argument to `capture()` MUST override `stabilityTimeoutMs` when provided.  
`firstTokenTimeoutMs` is not overridable per-call (only via constructor config).

---

## MODIFIED Requirements

_None (new module — no prior baseline)._

---

## REMOVED Requirements

### OC-REM-001: Post-Output Processing in Capture Path

Any code that performs memory writes, message routing, or formatting after output is captured MUST be removed from the capture module. Capture returns raw text only.

### OC-REM-002: Silent Partial Return

Any pattern that returned partial text without signaling incompleteness MUST be replaced. Partial text must only be accessible via `TimeoutError`.

### OC-REM-003: Hardcoded Selectors

Any hardcoded CSS selectors or XPaths in capture logic MUST be moved to the provider selectors config.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| OC-AC-001 | `capture()` returns full text when output is stable |
| OC-AC-002 | `capture()` raises `TimeoutError` if first token doesn't appear within 30s |
| OC-AC-003 | `capture()` raises `TimeoutError` with partial text if output never stabilizes |
| OC-AC-004 | `capture()` raises `OutputCaptureError` for empty output |
| OC-AC-005 | `capture()` does not return until BOTH stability conditions are met |
| OC-AC-006 | `capture()` respects per-call `timeoutMs` override |
| OC-AC-007 | `OutputCapture` has zero side effects beyond returning `CaptureResult` |
| OC-AC-008 | All selectors are injected — zero hardcoded strings in module |
