# Proposal — v0.1.1-driver-hardening

## Summary

A focused hardening release building on the completed `v0.1.0-driver-core` baseline.
The goal is to make the existing driver safe and observable for **live usage** without
any expansion of product scope.

---

## Motivation

`v0.1.0-driver-core` delivered a complete, well-tested driver pipeline.
The next real-world constraint is **runtime fragility**:

- CSS selectors targeting a third-party web app (Gemini) will drift over time.
  There is no fallback mechanism today.
- There is no structured runtime observability. When something goes wrong in
  production, the only signal is a thrown exception.
- The smoke validation infrastructure exists but the test suite does not cover
  recovery paths.
- Recovery logic receives a `reason` parameter that is currently ignored.
- The selector inventory is not auditable without reading source code.

None of these problems require new product features to fix. They require
engineering discipline applied to what already exists.

---

## Scope (hardening only)

| In scope | Out of scope |
|---|---|
| Structured log events (stderr/JSON-L, no SDK) | External telemetry (OpenTelemetry, StatsD, HTTP) |
| CSS selector fallbacks (#2+ alternates per slot) | New provider support |
| Selector audit utility (internal, not public API) | Multi-provider routing |
| Smoke recovery case (page-refresh path) | HTTP/REST API |
| Recovery reason-awareness | Agent/workflow orchestration |
| Smoke readiness checklist | Memory or persona logic |
| Doc updates for all changed behaviour | Concurrent generate |
| Version bump to 0.1.1 | New user-facing product features |

---

## Non-goals (explicit)

- **No public API expansion** unless strictly necessary for testability.
- **No business-specific semantics** — the driver knows nothing about tasks,
  queues, priorities, or intent.
- **No concurrency support** — single-stream, single-generation at a time.
- **No auto-login** — recovery never attempts to re-authenticate.
- **No queue retry policy** — callers own retry logic.
- **No autonomous escalation loops** — the driver surfaces state; it does not act.

---

## Success Criteria

1. Structured log events emitted at correct points in the driver lifecycle.
2. Selector fallbacks are in place for all critical selectors (input, submit, output,
   stop, auth indicator, challenge indicator).
3. Selector audit doc or utility enables pre-release verification.
4. Smoke test suite includes one recovery scenario (page-refresh path).
5. Smoke readiness checklist documents: profile requirements, session assumptions,
   acceptable failure modes, recoverable vs non-recoverable failures.
6. Recovery honours the `reason` parameter; timeout reason triggers force-refresh.
7. All existing 64+ unit tests remain green.
8. Lint and typecheck remain clean (zero errors, zero warnings).
9. Version tagged as `v0.1.1-driver-hardening`.

---

## Version target

`0.1.1` — patch release (no public API breakage).
