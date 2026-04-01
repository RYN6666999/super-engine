/**
 * Smoke Tests — require a real browser and an active provider session.
 *
 * These tests are SKIPPED unless the VITEST_SMOKE environment variable is set
 * AND SMOKE_PROFILE_DIR points to a browser profile with an active session.
 *
 * Run with:
 *   VITEST_SMOKE=1 SMOKE_PROFILE_DIR=/path/to/profile npm run test:smoke
 *
 * These tests are NOT included in `npm test` (unit tests only).
 * They are the final gate in Phase F verification.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GeminiWebDriver } from '../../src/driver/GeminiWebDriver';
import { DriverNotInitializedError } from '../../src/errors/index';
import type { DriverConfig } from '../../src/types/index';

// ─── Environment Gate ──────────────────────────────────────────────────────────

const SMOKE_ENABLED = !!process.env['VITEST_SMOKE'];
const SMOKE_PROFILE = process.env['SMOKE_PROFILE_DIR'];
const SMOKE_URL = process.env['SMOKE_PROVIDER_URL'] ?? 'https://gemini.google.com/app';

const config: DriverConfig = {
  providerUrl: SMOKE_URL,
  profileDir: SMOKE_PROFILE,
  headless: process.env['SMOKE_HEADLESS'] !== 'false',
  firstTokenTimeoutMs: 30_000,
  stabilityTimeoutMs: 120_000,
  stabilityIntervalMs: 1_500,
};

// ─── Smoke Suite ───────────────────────────────────────────────────────────────

describe.runIf(SMOKE_ENABLED && !!SMOKE_PROFILE)('Driver Smoke Tests', () => {
  let driver: GeminiWebDriver;

  beforeAll(async () => {
    driver = new GeminiWebDriver(config);
    await driver.init();
  }, 60_000 /* allow 60s for browser launch + page load */);

  afterAll(async () => {
    if (driver) await driver.shutdown();
  }, 15_000);

  // ── init ────────────────────────────────────────────────────────────────────

  it('health().ok is true after init()', async () => {
    const h = await driver.health();
    expect(h.ok).toBe(true);
    expect(h.initialized).toBe(true);
    expect(h.browserRunning).toBe(true);
    expect(h.pageReady).toBe(true);
  });

  // ── generate ────────────────────────────────────────────────────────────────

  it('generate() returns non-empty text for a simple prompt', async () => {
    const output = await driver.generate({
      prompt: 'Reply with only the word PONG and nothing else.',
      timeoutMs: 60_000,
    });
    expect(typeof output.text).toBe('string');
    expect(output.text.trim().length).toBeGreaterThan(0);
  }, 90_000);

  it('generate() output has correct shape', async () => {
    const output = await driver.generate({ prompt: 'Say "OK".' });
    expect(output).toHaveProperty('text');
    expect(output).toHaveProperty('startedAt');
    expect(output).toHaveProperty('completedAt');
    expect(output).toHaveProperty('provider');
    expect(output).toHaveProperty('sessionId');
    expect(output.completedAt.getTime()).toBeGreaterThanOrEqual(output.startedAt.getTime());
  }, 90_000);

  it('generate() echoes metadata unchanged', async () => {
    const meta = { requestId: 'smoke-001', tag: 'test' };
    const output = await driver.generate({
      prompt: 'Say "hi".',
      metadata: meta,
    });
    expect(output.metadata).toEqual(meta);
  }, 90_000);

  // ── health ──────────────────────────────────────────────────────────────────

  it('health() returns full DriverHealth object', async () => {
    const h = await driver.health();
    expect(h).toHaveProperty('ok');
    expect(h).toHaveProperty('initialized');
    expect(h).toHaveProperty('browserRunning');
    expect(h).toHaveProperty('pageReady');
    expect(h).toHaveProperty('authenticated');
    expect(h).toHaveProperty('providerReachable');
    expect(h).toHaveProperty('mode');
  });

  // ── recover ─────────────────────────────────────────────────────────────────

  it('recover() returns a RecoveryResult without throwing', async () => {
    const result = await driver.recover('smoke-test-probe');
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('message');
  });

  it('generate() succeeds after recover() with timeout reason (page-refresh path)', async () => {
    // Simulate the stuck-page scenario: health looks ok but we pass a timeout reason.
    // RecoveryManager will force a page refresh; then generate should still work.
    const preHealth = await driver.health();
    expect(preHealth.ok).toBe(true);

    const recovery = await driver.recover('timeout');
    // A refresh-page action is expected. If auth expired, rebuild-session is acceptable.
    expect(['refresh-page', 'reopen-page', 'rebuild-session', 'none']).toContain(recovery.action);

    if (recovery.ok) {
      // Only attempt generate if recovery reports success.
      const out = await driver.generate({
        prompt: 'Reply only with: OK',
        timeoutMs: 60_000,
      });
      expect(out.text.toLowerCase()).toContain('ok');
    }
  }, 120_000);

  // ── not-init guard ───────────────────────────────────────────────────────────

  it('a fresh uninitialized driver throws DriverNotInitializedError on generate()', async () => {
    const d2 = new GeminiWebDriver(config);
    await expect(d2.generate({ prompt: 'test' })).rejects.toThrow(DriverNotInitializedError);
  });

  // ── shutdown ─────────────────────────────────────────────────────────────────

  it('shutdown() completes without throwing', async () => {
    // Shut down the shared driver first to release the profile lock,
    // then verify a fresh driver can init + shutdown cleanly.
    await driver.shutdown();
    const d3 = new GeminiWebDriver(config);
    await d3.init();
    await expect(d3.shutdown()).resolves.toBeUndefined();
    const h = await d3.health();
    expect(h.mode).toBe('shutdown');
  }, 60_000);
});

// ─── Fallback notice when smoke is not enabled ─────────────────────────────────

describe.skipIf(SMOKE_ENABLED)('Smoke Tests (skipped — set VITEST_SMOKE=1 to enable)', () => {
  it('smoke tests are disabled in this run', () => {
    // This test always passes — it just makes the skip visible in the report.
    expect(true).toBe(true);
  });
});
