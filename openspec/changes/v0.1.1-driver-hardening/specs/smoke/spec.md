# Smoke Validation Spec — v0.1.1-driver-hardening delta

## What changes from v0.1.0

`v0.1.0` had 9 smoke cases covering the happy path. `v0.1.1` adds:

1. A **recovery smoke case** — page-refresh path.
2. A **smoke readiness checklist** in the guide.
3. A documented `generate("Reply only with: OK")` canonical validation case.

---

## Canonical validation sequence

The live smoke flow must exercise, in order:

```
1. init()                              — browser launches, page loads, auth detected
2. health()                            — ok: true confirmed
3. generate("Reply only with: OK")     — output contains "OK"
4. recover("smoke-recovery-probe")     — returns RecoveryResult shape
5. generate("Reply only with: OK")     — output still valid after recovery
6. shutdown()                          — completes without error
```

---

## Recovery smoke case

```
1. Call init()
2. Call health() — assert ok: true
3. Force page state change (reload page directly via BrowserSession.getPage → reload)
4. Call recover("smoke-page-refresh")
5. Assert result.ok = true AND result.action = 'refresh-page' or 'reopen-page'
6. Call generate("Reply only with: OK") again
7. Assert output.text contains "OK"
```

If step 4 returns `ok: false`, the test is marked as a **known degraded case**
(likely auth expired during test run). This is acceptable because:
- Smoke tests run on real sessions which can expire.
- `ok: false` with `action: 'rebuild-session'` is a valid, expected signal.

---

## Environment gate

Smoke tests MUST NOT run without both:

```sh
VITEST_SMOKE=1
SMOKE_PROFILE_DIR=/path/to/existing/profile
```

If either is absent, entire smoke suite skips with a visible notice in the test report.

---

## Acceptable failure modes

| Failure | Classification | Operator action |
|---|---|---|
| Auth expired mid-run | Recoverable (external) | Re-login and re-run |
| Rate limit from provider | Recoverable (transient) | Wait and re-run |
| Selector not found | Potentially non-recoverable | Audit selectors |
| Browser crash | Recoverable (driver restart) | Re-run |
| generate timeout | Recoverable (retry) | Re-run with longer timeout |
| `rebuild-session` returned | Non-recoverable (session) | Re-login |

---

## Smoke readiness checklist

See `docs/smoke-test-guide.md` for the complete checklist.
