# Spec: Output Capture

**Spec ID:** specs/output-capture  
**Version:** 1.0.0  
**Status:** ACTIVE  
**Last Updated:** 2026-03-31

---

## 1. Purpose

Define how the driver waits for, detects, and extracts the complete text output from a Web LLM provider page after a prompt has been submitted.

Output capture is the most fragile part of a browser-in-the-loop driver. This spec establishes strict stability requirements to prevent partial output from being returned as complete.

---

## 2. Capture Lifecycle

```
[SUBMITTED]
    │
    ▼
[WAIT: output starts appearing]   ← wait for first token
    │  (max: firstTokenTimeoutMs)
    ▼
[WAIT: output stabilizes]         ← poll until DOM content is stable
    │  (max: stabilityTimeoutMs)
    ▼
[EXTRACT full text]
    │
    ▼
[RETURN GenerateOutput]
```

---

## 3. Stability Detection

Output is considered **stably complete** when:
- The output DOM element has not changed content for `stabilityIntervalMs` (default: `1500ms`).
- A known "generation complete" indicator is present (provider-specific selector), OR
- The "Stop" / "Regenerate" button state transitions to its post-generation state.

Output is **NOT** considered complete if:
- A streaming cursor / spinner is still visible.
- The output element is still mutating.
- Only whitespace has been added in the latest poll window.

---

## 4. Timeouts

| Parameter | Default | Description |
|-----------|---------|-------------|
| `firstTokenTimeoutMs` | `30000` | Max wait for first token to appear |
| `stabilityTimeoutMs` | `120000` | Max total wait from submission to stable output |
| `stabilityIntervalMs` | `1500` | Polling interval for stability check |

All timeouts are configurable per `generate()` call via `GenerateInput.timeoutMs` (overrides `stabilityTimeoutMs`).

---

## 5. Error Conditions

| Condition | Error Raised |
|-----------|-------------|
| No output appears within `firstTokenTimeoutMs` | `TimeoutError` |
| Output begins but never stabilizes within `stabilityTimeoutMs` | `TimeoutError` (with `partial: true` in metadata) |
| Output DOM element not found | `OutputCaptureError` |
| Extracted text is empty | `OutputCaptureError` |

---

## 6. Partial Output Policy

- Partial output MUST NOT be returned as `GenerateOutput.text`.
- On `TimeoutError`, `text` field contains the partial content captured so far, and `GenerateOutput.metadata.partial` is `true`.
- Callers must explicitly handle `TimeoutError` if they wish to use partial output.

---

## 7. OutputCapture Module Responsibilities

`OutputCapture` is the isolated module responsible for the capture pipeline.

It receives:
- `page` reference (Playwright `Page`)
- Timeout configuration
- Provider-specific selectors (injected at construction)

It returns:
- `{ text: string; startedAt: Date; completedAt: Date }` on success
- Raises typed errors on failure

It does NOT:
- Submit prompts
- Navigate pages
- Know anything about session, auth, or recovery
