# BDD Scenarios: extract-weblm-driver-core

**Change ID:** extract-weblm-driver-core  
**Status:** DRAFT — Awaiting Confirmation  
**Date:** 2026-03-31

---

## Overview

These scenarios define the **externally observable behavior** of `GeminiWebDriver`.  
They are provider and implementation agnostic — they describe _what_ happens, not _how_.  
Each scenario maps to one or more unit or smoke tests.

---

## Feature: Driver Initialization

### Scenario 1 — 正常初始化 (Happy Path Init)

```gherkin
GIVEN a valid browser profile directory exists
  AND the provider URL is reachable
WHEN driver.init() is called
THEN a browser session is created
  AND the target provider page is loaded
  AND driver.health() returns { initialized: true, browserRunning: true, pageReady: true }
  AND driver.health() returns { ok: true }
```

**Maps to:** `GeminiWebDriver.test.ts` → `init works`

---

### Scenario 2 — 二次 init 不重複啟動 (Idempotent Init)

```gherkin
GIVEN driver has already been initialized
WHEN driver.init() is called a second time
THEN the existing browser session is reused (or safely restarted)
  AND driver.health() returns { initialized: true, ok: true }
  AND no orphan browser processes are created
```

**Maps to:** `GeminiWebDriver.test.ts` → `double init is safe`

---

## Feature: Prompt Generation

### Scenario 3 — 正常生成 (Happy Path Generate)

```gherkin
GIVEN driver has been initialized
  AND the provider page is authenticated and ready
WHEN driver.generate({ prompt: "What is 2+2?" }) is called
THEN the prompt is submitted to the provider page
  AND the driver waits for output to stabilize
  AND a GenerateOutput is returned containing:
    - text (non-empty string)
    - startedAt (Date)
    - completedAt (Date, after startedAt)
    - provider (non-empty string)
    - sessionId (non-empty string)
```

**Maps to:** `GeminiWebDriver.test.ts` → `generate returns typed output` + `driver.smoke.test.ts`

---

### Scenario 4 — 未初始化禁止生成 (Guard: Not Initialized)

```gherkin
GIVEN driver has NOT been initialized
WHEN driver.generate({ prompt: "Hello" }) is called
THEN a DriverNotInitializedError is raised
  AND the error has code "DRIVER_NOT_INITIALIZED"
  AND the error has recoverable = false
```

**Maps to:** `GeminiWebDriver.test.ts` → `throws on generate before init`

---

### Scenario 5 — systemPrompt 可選傳遞 (Optional systemPrompt)

```gherkin
GIVEN driver has been initialized
WHEN driver.generate({ prompt: "Hello", systemPrompt: "Reply in one word." }) is called
THEN the system prompt context is included in the submission
  AND GenerateOutput is returned normally
```

**Maps to:** `GeminiWebDriver.test.ts` → `generate with systemPrompt`

---

## Feature: Health Reporting

### Scenario 6 — 健康檢查成功 (Happy Path Health)

```gherkin
GIVEN browser is running
  AND provider page is loaded and authenticated
WHEN driver.health() is called
THEN DriverHealth is returned with:
  - ok: true
  - initialized: true
  - browserRunning: true
  - pageReady: true
  - authenticated: true
  - providerReachable: true
```

**Maps to:** `GeminiWebDriver.test.ts` → `returns typed health`

---

### Scenario 7 — Session 失效被偵測 (Auth Expiry Detection)

```gherkin
GIVEN the provider page no longer reflects a valid authenticated session
  AND the browser is still running
WHEN driver.health() is called
THEN DriverHealth is returned with:
  - authenticated: false
  - ok: false
  - mode: "degraded"
```

**Maps to:** `PageStateInspector.test.ts` → `detects unauthenticated page`

---

### Scenario 8 — health() 不拋例外 (health() Never Throws)

```gherkin
GIVEN the browser process has crashed
WHEN driver.health() is called
THEN a DriverHealth object is returned (NOT an exception)
  AND ok: false
  AND browserRunning: false
  AND mode: "degraded"
```

**Maps to:** `GeminiWebDriver.test.ts` → `health never throws`

---

### Scenario 9 — 生成中可查健康 (Health During Generate)

```gherkin
GIVEN driver.generate() is in progress
WHEN driver.health() is called concurrently
THEN a DriverHealth is returned with mode: "generating"
  AND health() does not interrupt or corrupt the ongoing generation
```

**Maps to:** `GeminiWebDriver.test.ts` → `health during generation returns generating mode`

---

## Feature: Recovery

### Scenario 10 — 頁面損壞可 refresh (Page Inconsistency → Refresh)

```gherkin
GIVEN the provider page is loaded
  AND the input box is not present (pageReady = false)
  AND the page URL is correct
WHEN driver.recover() is called
THEN RecoveryManager attempts "refresh-page"
  AND RecoveryResult is returned with:
    - action: "refresh-page"
  AND if successful: ok: true
  AND if unsuccessful: escalates to "reopen-page"
```

**Maps to:** `RecoveryManager.test.ts` → `page inconsistency triggers refresh-page`

---

### Scenario 11 — Browser 崩潰可 restart (Browser Crash → Restart)

```gherkin
GIVEN the browser process is unavailable (browserRunning = false)
WHEN driver.recover() is called
THEN RecoveryManager attempts "restart-browser"
  AND RecoveryResult is returned with:
    - action: "restart-browser"
  AND if successful: ok: true
```

**Maps to:** `RecoveryManager.test.ts` → `browser crash triggers restart-browser`

---

### Scenario 12 — Auth 失效觸發 rebuild-session (Auth Invalidation)

```gherkin
GIVEN browser is running
  AND page is loaded
  AND authenticated = false after reopen attempt
WHEN driver.recover() is called
THEN RecoveryManager attempts "reopen-page"
  AND if authenticated still false: escalates to "rebuild-session"
  AND RecoveryResult is returned with action: "rebuild-session"
```

**Maps to:** `RecoveryManager.test.ts` → `auth invalidation triggers rebuild-session`

---

### Scenario 13 — recovery() 不拋例外 (recover() Never Throws)

```gherkin
GIVEN a catastrophic failure where even browser restart fails
WHEN driver.recover() is called
THEN a RecoveryResult is returned (NOT an exception)
  AND ok: false
  AND action: last-attempted action
  AND message: contains error description
```

**Maps to:** `RecoveryManager.test.ts` → `recover never throws`

---

## Feature: Output Capture

### Scenario 14 — 輸出完成才回傳 (No Premature Return)

```gherkin
GIVEN the provider has begun generating output (streaming)
WHEN output capture is active
THEN the driver continues polling
  AND does NOT return until BOTH:
    - output content has been stable for stabilityIntervalMs
    - the "stop generating" indicator is absent
  AND returns the complete, final text
```

**Maps to:** `OutputCapture.test.ts` → `does not mark partial output as complete too early`

---

### Scenario 15 — 超時有明確錯誤 (Timeout Raises Typed Error)

```gherkin
GIVEN output never stabilizes within timeoutMs
WHEN capture exceeds timeout
THEN TimeoutError is raised
  AND error.code = "TIMEOUT"
  AND error.partial contains whatever text was captured before timeout
  AND error.elapsedMs is set
```

**Maps to:** `OutputCapture.test.ts` → `throws timeout on stalled generation`

---

### Scenario 16 — 空輸出被拒絕 (Empty Output Rejected)

```gherkin
GIVEN output reaches stable state
  AND the extracted text is empty or whitespace-only
WHEN capture returns
THEN OutputCaptureError is raised
  AND error.code = "OUTPUT_CAPTURE_FAILED"
  AND error.message contains "empty output"
```

**Maps to:** `OutputCapture.test.ts` → `rejects empty output`

---

## Feature: Shutdown

### Scenario 17 — 正常 shutdown (Graceful Shutdown)

```gherkin
GIVEN driver has been initialized
WHEN driver.shutdown() is called
THEN the browser page is closed
  AND the browser context is closed
  AND the browser process terminates
  AND driver.health() returns { mode: "shutdown", ok: false }
```

**Maps to:** `GeminiWebDriver.test.ts` → `shutdown closes browser` + `driver.smoke.test.ts`

---

### Scenario 18 — 重複 shutdown 安全 (Idempotent Shutdown)

```gherkin
GIVEN driver.shutdown() has already been called
WHEN driver.shutdown() is called again
THEN no error is raised
  AND no orphan processes remain
```

**Maps to:** `GeminiWebDriver.test.ts` → `double shutdown is safe`

---

## Scenario → Test Mapping Summary

| Scenario | Test File | Test Name |
|----------|-----------|-----------|
| 1 | `GeminiWebDriver.test.ts` | `init works` |
| 2 | `GeminiWebDriver.test.ts` | `double init is safe` |
| 3 | `GeminiWebDriver.test.ts` + smoke | `generate returns typed output` |
| 4 | `GeminiWebDriver.test.ts` | `throws on generate before init` |
| 5 | `GeminiWebDriver.test.ts` | `generate with systemPrompt` |
| 6 | `GeminiWebDriver.test.ts` | `returns typed health` |
| 7 | `PageStateInspector.test.ts` | `detects unauthenticated page` |
| 8 | `GeminiWebDriver.test.ts` | `health never throws` |
| 9 | `GeminiWebDriver.test.ts` | `health during generation returns generating mode` |
| 10 | `RecoveryManager.test.ts` | `page inconsistency triggers refresh-page` |
| 11 | `RecoveryManager.test.ts` | `browser crash triggers restart-browser` |
| 12 | `RecoveryManager.test.ts` | `auth invalidation triggers rebuild-session` |
| 13 | `RecoveryManager.test.ts` | `recover never throws` |
| 14 | `OutputCapture.test.ts` | `does not mark partial output as complete too early` |
| 15 | `OutputCapture.test.ts` | `throws timeout on stalled generation` |
| 16 | `OutputCapture.test.ts` | `rejects empty output` |
| 17 | `GeminiWebDriver.test.ts` + smoke | `shutdown closes browser` |
| 18 | `GeminiWebDriver.test.ts` | `double shutdown is safe` |
