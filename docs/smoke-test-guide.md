# Smoke Test Guide — weblm-driver v0.1.1-driver-hardening

A smoke test verifies the full driver pipeline against a **real, live browser session**. It requires a Chromium browser profile that already has an active Gemini session (you are already logged in).

No mocks. No stubs. Real network. Real DOM.

---

## Prerequisites

1. **Install Playwright browser:**
   ```bash
   npx playwright install chromium
   ```

2. **Prepare a browser profile with an active Gemini session:**
   ```bash
   # Open a visible browser pointed at your profile directory to log in
   npx playwright open --browser chromium --user-data-dir /tmp/gemini-profile https://gemini.google.com/app
   # Log in manually, then close the browser — cookies are saved to /tmp/gemini-profile
   ```

3. **Set environment variables:**
   ```bash
   export SMOKE_PROFILE_DIR=/tmp/gemini-profile
   export SMOKE_PROVIDER_URL=https://gemini.google.com/app   # optional, this is the default
   export VITEST_SMOKE=1
   ```

---

## Run the Automated Smoke Suite

```bash
# All 8 smoke tests (requires SMOKE_PROFILE_DIR)
VITEST_SMOKE=1 SMOKE_PROFILE_DIR=/tmp/gemini-profile npm run test:smoke

# With visible browser (for debugging)
VITEST_SMOKE=1 SMOKE_HEADLESS=false SMOKE_PROFILE_DIR=/tmp/gemini-profile npm run test:smoke
```

The smoke suite tests:
1. `health().ok` is `true` after `init()`
2. `generate()` returns non-empty text
3. `generate()` output has all required fields
4. `generate()` echoes metadata unchanged
5. `health()` returns a complete `DriverHealth` object
6. `recover()` returns a `RecoveryResult` without throwing
7. An uninitialised driver throws `DriverNotInitializedError` on `generate()`
8. `shutdown()` completes without throwing
9. `generate()` succeeds after `recover('timeout')` — page-refresh recovery path **(new in v0.1.1)**

**Smoke tests are excluded from `npm test` (unit tests only).** They run only when `VITEST_SMOKE=1` and `SMOKE_PROFILE_DIR` are both set.

---

## Smoke Readiness Checklist (v0.1.1)

Before running smoke tests, verify each item:

### Browser profile requirements

- [ ] Chromium profile directory exists and is readable: `ls -la $SMOKE_PROFILE_DIR`
- [ ] Profile was created with Playwright chromium (not plain Chrome): `npx playwright open ...`
- [ ] Session cookies are not expired: open the profile in a visible browser and confirm login

### Logged-in session assumption

- [ ] You are logged into `https://gemini.google.com/app` in the profile
- [ ] The Gemini app interface is visible (not a login wall or CAPTCHA)
- [ ] No active rate-limiting or quota exhaustion on the account

### Selector health (pre-release only)

- [ ] Run `selectorAudit(page, GeminiSelectors)` on a live page to verify all selectors resolve
- [ ] Confirm `inputBox`, `outputContainer`, and `loginIndicator` show `found: true, visible: true`
- [ ] Review any `found: false` results against the current live DOM before releasing

### Environment variables

- [ ] `VITEST_SMOKE=1` — must be set or all smoke tests will skip
- [ ] `SMOKE_PROFILE_DIR` — must point to a valid profile directory
- [ ] `SMOKE_PROVIDER_URL` — optional (defaults to `https://gemini.google.com/app`)
- [ ] `SMOKE_HEADLESS` — set to `false` for debugging with visible browser

### Acceptable failure modes

| Failure | Classification | Operator action |
|---|---|---|
| Auth expired mid-run | Recoverable (external) | Re-login and re-run |
| Rate limit from provider | Recoverable (transient) | Wait and re-run |
| Selector not found (`PageNotReadyError`) | Potentially non-recoverable | Run selector audit |
| Browser crash | Recoverable (driver restart) | Re-run |
| `generate()` timeout | Recoverable (retry) | Re-run with larger timeout |
| `recover()` returns `rebuild-session` | Non-recoverable (session) | Re-login manually |
| CAPTCHA / challenge presented | Non-recoverable (session) | Solve manually in visible browser |

### Recoverable vs non-recoverable

- **Recoverable**: `result.ok = true` or `result.action` in `['refresh-page', 'reopen-page', 'restart-browser']`
- **Non-recoverable (operator intervention)**: `result.action = 'rebuild-session'` — session expired, re-login required

---

## Manual Smoke Test Script

Run this script as a targeted acceptance check:

```typescript
// manual-smoke.ts
// Run with: npx tsx manual-smoke.ts
import { GeminiWebDriver, DriverNotInitializedError } from './src/index';

const PROFILE_DIR = process.env['SMOKE_PROFILE_DIR'];
if (!PROFILE_DIR) throw new Error('Set SMOKE_PROFILE_DIR');

const driver = new GeminiWebDriver({
  providerUrl: 'https://gemini.google.com/app',
  profileDir: PROFILE_DIR,
  headless: true,
  firstTokenTimeoutMs: 30_000,
  stabilityTimeoutMs: 120_000,
  stabilityIntervalMs: 1_500,
});

// ── Step 1: pre-init guard ─────────────────────────────────────────────────────

try {
  await driver.generate({ prompt: 'test' });
  throw new Error('FAIL: should have thrown DriverNotInitializedError');
} catch (e) {
  if (!(e instanceof DriverNotInitializedError)) throw e;
  console.log('✓ pre-init guard: DriverNotInitializedError thrown correctly');
}

// ── Step 2: init ──────────────────────────────────────────────────────────────

console.log('→ calling init()...');
await driver.init();
console.log('✓ init() resolved');

// ── Step 3: health check ───────────────────────────────────────────────────────

const h = await driver.health();
console.log('→ health():', JSON.stringify(h, null, 2));
if (!h.ok) throw new Error(`FAIL: health.ok is false after init(). Mode: ${h.mode}`);
console.log('✓ health.ok = true');

// ── Step 4: generate ──────────────────────────────────────────────────────────

console.log('→ calling generate("Reply only with: OK")...');
const result = await driver.generate({
  prompt: 'Reply only with: OK',
  metadata: { testId: 'smoke-001' },
});

console.log('→ output text:', JSON.stringify(result.text));

if (!result.text.includes('OK')) {
  throw new Error(`FAIL: output does not contain "OK". Got: ${result.text.substring(0, 200)}`);
}
if (result.metadata?.['testId'] !== 'smoke-001') {
  throw new Error('FAIL: metadata not echoed correctly');
}
console.log('✓ generate() returned expected output with metadata echo');
console.log('  provider:', result.provider);
console.log('  sessionId:', result.sessionId);
console.log('  elapsed:', result.completedAt.getTime() - result.startedAt.getTime(), 'ms');

// ── Step 5: shutdown ───────────────────────────────────────────────────────────

await driver.shutdown();
console.log('✓ shutdown() completed');

const h2 = await driver.health();
if (h2.mode !== 'shutdown') throw new Error(`FAIL: expected mode=shutdown, got ${h2.mode}`);
console.log('✓ mode is "shutdown" after shutdown()');

// ── All steps passed ───────────────────────────────────────────────────────────

console.log('\n✅ All smoke steps passed.');
```

### Expected output

```
✓ pre-init guard: DriverNotInitializedError thrown correctly
→ calling init()...
✓ init() resolved
→ health(): { "ok": true, "initialized": true, "browserRunning": true, ... }
✓ health.ok = true
→ calling generate("Reply only with: OK")...
→ output text: "OK"
✓ generate() returned expected output with metadata echo
  provider: gemini-web
  sessionId: session-XXXXXXXXXX
  elapsed: XXXX ms
✓ shutdown() completed
✓ mode is "shutdown" after shutdown()

✅ All smoke steps passed.
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `AuthenticationRequiredError` on `init()` | Profile has no active session | Re-open the browser against the profile and log in manually |
| `TimeoutError` on `generate()` | Network slow or Gemini UI changed | Check internet; verify selectors in `src/providers/gemini/selectors.ts` |
| `OutputCaptureError` | Output container selector mismatch | Inspect `.model-response-text` in the live DOM |
| `PageNotReadyError` | Input box selector mismatch | Inspect `rich-textarea` in the live DOM |
| Health returns `pageReady: false` after `init()` | Page not fully loaded | Increase `stabilityTimeoutMs` or add a wait in `init()` |
| Smoke tests always skip | `VITEST_SMOKE` or `SMOKE_PROFILE_DIR` not set | Verify both env vars are exported in your shell session |

---

## Acceptance Criteria

A smoke run is **accepted** when:

- `init()` resolves without throwing
- `health().ok === true` immediately after `init()`
- `generate({ prompt: 'Reply only with: OK' }).text` contains the string `OK`
- `shutdown()` resolves without throwing
- `health().mode === 'shutdown'` after `shutdown()`
