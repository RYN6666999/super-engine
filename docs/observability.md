# Observability Spec — weblm-driver v0.1.0-driver-core

## Philosophy

The driver emits **structured, typed signals**. It does not wire to any external telemetry sink (no OpenTelemetry, no StatsD, no HTTP endpoint). Observability is achieved by callers reading typed return values and errors — not by internal side effects.

---

## Health as the Observability Surface

`health()` is the primary observability endpoint. Call it at any time; it never throws.

```typescript
const h = await driver.health();
// h.ok              → boolean overall health
// h.initialized     → has init() completed?
// h.browserRunning  → is Playwright alive?
// h.pageReady       → is the input box visible?
// h.authenticated   → is the session valid?
// h.mode            → 'idle' | 'generating' | 'recovering' | 'degraded' | 'shutdown'
// h.lastError       → last error message, if any
```

Recommended polling interval: **30 000 ms** in production. Sub-second polling will degrade performance.

---

## Typed Errors as Signals

Every failure path produces a typed `DriverError` subclass. All carry:

- `error.code` — machine-readable string constant (e.g. `"TIMEOUT"`, `"AUTH_REQUIRED"`)
- `error.recoverable` — boolean; if `true`, `recover()` may restore operation
- `error.timestamp` — `Date` at time of failure
- `error.context` — optional `Record<string, unknown>` for additional structured data

```typescript
try {
  const out = await driver.generate({ prompt });
} catch (e) {
  if (e instanceof TimeoutError) {
    console.log('timeout after', e.elapsedMs, 'ms, partial:', e.partial);
    if (e.recoverable) await driver.recover('generate timeout');
  }
}
```

---

## Recovery Audit Trail

`RecoveryResult` provides a structured outcome:

```typescript
const r = await driver.recover('page not ready');
// r.ok      → boolean — was health restored?
// r.action  → which action was taken
// r.message → human-readable description
```

Callers may log `r` as a structured event for external aggregation.

---

## Structured Log Events (v0.1.1+)

`DriverConfig.logLevel` activates structured JSON-Lines output to `stderr`.
Default is `'silent'` — no output unless explicitly set.

```typescript
const driver = new GeminiWebDriver({
  providerUrl: '...',
  logLevel: 'info',  // or 'debug' | 'warn' | 'error'
});
```

### Event catalogue

| Event | Level | Key fields |
|---|---|---|
| `driver.init.started` | info | sessionId |
| `driver.init.succeeded` | info | sessionId, durationMs |
| `driver.init.failed` | error | sessionId, durationMs, errorCode, recoverable |
| `driver.generate.started` | info | sessionId, requestId? |
| `driver.generate.succeeded` | info | sessionId, durationMs, requestId? |
| `driver.generate.failed` | error | sessionId, durationMs, errorCode, recoverable, requestId? |
| `driver.capture.timeout` | warn | sessionId, durationMs, errorCode, recoverable |
| `driver.health.checked` | debug | sessionId |
| `driver.recover.started` | info | sessionId |
| `driver.recover.succeeded` | info | sessionId, action |
| `driver.recover.failed` | info | sessionId, action |
| `driver.shutdown.started` | info | sessionId |
| `driver.shutdown.succeeded` | info | sessionId |
| `driver.shutdown.failed` | error | sessionId, errorCode? |
| `driver.auth.required` | warn | sessionId |
| `driver.selector.missing` | warn | sessionId, selectorName |

All records include `timestamp` (ISO 8601) and `level` fields.

### What is never logged

- Full prompt text or model output
- Cookies, auth tokens, or session credentials
- Local file paths (including `profileDir`)
- Any `GenerateInput.metadata` field except `requestId` (when string-typed)

### Level hierarchy

`silent` (default) < `error` < `warn` < `info` < `debug`

---

## Recommended Observability Patterns for Callers

### 1. Periodic health probe
```typescript
setInterval(async () => {
  const h = await driver.health();
  myMetrics.gauge('driver.ok', h.ok ? 1 : 0);
  myMetrics.gauge('driver.mode', h.mode);
}, 30_000);
```

### 2. Error classification on every generate()
```typescript
import { DriverError, TimeoutError, OutputCaptureError } from 'weblm-driver';

try {
  return await driver.generate(input);
} catch (e) {
  if (e instanceof DriverError) {
    myLogger.error({ code: e.code, recoverable: e.recoverable, ts: e.timestamp });
    if (e.recoverable) {
      const r = await driver.recover(e.code);
      myMetrics.increment('driver.recovery', { action: r.action, ok: r.ok });
    }
  }
  throw e;
}
```

### 3. Smoke probe (aliveness check)
See [smoke-test-guide.md](smoke-test-guide.md) for the canonical aliveness check sequence.

---

## Not in Scope

- Built-in metrics emission
- Trace span injection
- Log sink configuration
- Dashboard or alerting
- Event bus integration
