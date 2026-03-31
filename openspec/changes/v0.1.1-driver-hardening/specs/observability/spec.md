# Observability Spec — v0.1.1-driver-hardening delta

## What changes from v0.1.0

`v0.1.0` observability relied entirely on typed return values and exceptions.
`v0.1.1` adds **structured runtime logs** as a second observability layer,
for runtime diagnostics without adding external dependencies.

---

## Log Events Catalogue

All events are emitted at `logLevel >= 'info'` unless noted.

### Lifecycle events

| Event | Level | When emitted |
|---|---|---|
| `driver.init.started` | info | Entry to `init()` |
| `driver.init.succeeded` | info | `init()` completed without error |
| `driver.init.failed` | error | `init()` threw (non-auth) |
| `driver.generate.started` | info | Entry to `generate()` |
| `driver.generate.succeeded` | info | `generate()` returned normally |
| `driver.generate.failed` | error | `generate()` threw |
| `driver.health.checked` | debug | `health()` returned |
| `driver.recover.started` | info | Entry to `recover()` |
| `driver.recover.succeeded` | info | `recover()` returned `ok: true` |
| `driver.recover.failed` | info | `recover()` returned `ok: false` |
| `driver.shutdown.started` | info | Entry to `shutdown()` |
| `driver.shutdown.succeeded` | info | `shutdown()` completed |
| `driver.shutdown.failed` | error | `shutdown()` threw |

### Warning events

| Event | Level | When emitted |
|---|---|---|
| `driver.auth.required` | warn | Auth/challenge mode detected during `init()` |
| `driver.selector.missing` | warn | `PageNotReadyError` or `OutputCaptureError` (selector not found) |
| `driver.capture.timeout` | warn | `TimeoutError` during capture |

---

## Event fields

All events include:

```json
{
  "timestamp": "2026-03-31T12:00:00.000Z",
  "level": "info",
  "event": "driver.generate.started",
  "sessionId": "session-1711882800000"
}
```

Additional fields when available:

| Field | Type | Present on |
|---|---|---|
| `durationMs` | number | `*.succeeded`, `*.failed` |
| `errorCode` | string | `*.failed`, `*.timeout` |
| `recoverable` | boolean | `*.failed` when error has `.recoverable` |
| `action` | string | `driver.recover.*` |
| `selectorName` | string | `driver.selector.missing` |
| `requestId` | string | generate events, when `input.metadata.requestId` is a string |

---

## What is never logged

- Full prompt text
- Full model output text
- Cookies or auth tokens
- Local file paths
- Session profile directory paths
- Any field from `GenerateInput.metadata` except `requestId` (if string-typed)

---

## Log format

JSON-Lines to `process.stderr`. No log file creation. No log rotation.
No timestamps with personally identifiable information.
No external log sink.

---

## Activation

Logging is **disabled by default** (`logLevel: 'silent'`).
Set `DriverConfig.logLevel` to enable:

```typescript
const driver = new GeminiWebDriver({
  providerUrl: '...',
  logLevel: 'info',   // or 'debug', 'warn', 'error'
});
```
