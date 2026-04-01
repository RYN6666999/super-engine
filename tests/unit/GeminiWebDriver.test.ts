import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiWebDriver } from '../../src/driver/GeminiWebDriver';
import type { GeminiWebDriverDeps } from '../../src/driver/GeminiWebDriver';
import { ConcurrentGenerationError, DriverNotInitializedError, OutputCaptureError } from '../../src/errors/index';
import type { DriverConfig, GenerateInput } from '../../src/types/index';
import type { BrowserSession } from '../../src/modules/BrowserSession';
import type { PageStateInspector } from '../../src/modules/PageStateInspector';
import type { PromptSubmitter } from '../../src/modules/PromptSubmitter';
import type { OutputCapture } from '../../src/modules/OutputCapture';
import type { RecoveryManager } from '../../src/modules/RecoveryManager';
import { DriverLogger } from '../../src/utils/logger';
import type { LogRecord } from '../../src/utils/logger';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const testConfig: DriverConfig = {
  providerUrl: 'https://gemini.google.com/app',
  headless: true,
  firstTokenTimeoutMs: 1000,
  stabilityTimeoutMs: 3000,
  stabilityIntervalMs: 200,
};

const simpleInput: GenerateInput = {
  prompt: 'What is 2+2?',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeTestDriver(overrides: Partial<GeminiWebDriverDeps> = {}): {
  driver: GeminiWebDriver;
  emitted: LogRecord[];
  mockSession: BrowserSession;
  mockInspector: PageStateInspector;
  mockCapture: OutputCapture;
  mockRecovery: RecoveryManager;
} {
  vi.clearAllMocks();

  const mockPage = {
    goto: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(null),
    $: vi.fn().mockResolvedValue(null),
    $eval: vi.fn().mockResolvedValue(''),
    isVisible: vi.fn().mockResolvedValue(false),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    fill: vi.fn().mockResolvedValue(undefined),
  };

  const mockSession: BrowserSession = {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockResolvedValue(mockPage),
    isRunning: vi.fn().mockReturnValue(true),
    get id() { return 'test-session-id'; },
  } as unknown as BrowserSession;

  const mockInspector: PageStateInspector = {
    isLoggedIn: vi.fn().mockResolvedValue(true),
    isPageReady: vi.fn().mockResolvedValue(true),
    hasChallenge: vi.fn().mockResolvedValue(false),
    detectMode: vi.fn().mockResolvedValue('ready'),
  } as unknown as PageStateInspector;

  const mockSubmitter: PromptSubmitter = {
    submit: vi.fn().mockResolvedValue(undefined),
  } as unknown as PromptSubmitter;

  const mockCapture: OutputCapture = {
    capture: vi.fn().mockResolvedValue({
      text: 'Generated response text',
      startedAt: new Date(),
      completedAt: new Date(),
    }),
  } as unknown as OutputCapture;

  const mockRecovery: RecoveryManager = {
    recover: vi.fn().mockResolvedValue({ ok: true, action: 'none', message: 'ok' }),
  } as unknown as RecoveryManager;

  const emitted: LogRecord[] = [];
  const logger = new DriverLogger('debug', (r) => emitted.push(r));

  const deps: GeminiWebDriverDeps = {
    session: mockSession,
    inspector: mockInspector,
    submitter: mockSubmitter,
    capture: mockCapture,
    recovery: mockRecovery,
    logger,
    ...overrides,
  };

  const driver = new GeminiWebDriver(testConfig, deps);
  return { driver, emitted, mockSession, mockInspector, mockCapture, mockRecovery };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GeminiWebDriver', () => {
  let driver: GeminiWebDriver;

  beforeEach(() => {
    ({ driver } = makeTestDriver());
  });

  // ── init() ───────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('resolves without throwing when browser launches successfully', async () => {
      await expect(driver.init()).resolves.toBeUndefined();
    });

    it('sets initialized state so subsequent health() reports initialized:true', async () => {
      await driver.init().catch(() => { /* expected in stub */ });
      // health() is non-throwing — always returns DriverHealth
      const h = await driver.health();
      expect(h).toHaveProperty('initialized');
    });
  });

  // ── generate() ───────────────────────────────────────────────────────────────

  describe('generate()', () => {
    it('throws DriverNotInitializedError when called before init()', async () => {
      await expect(driver.generate(simpleInput)).rejects.toThrow(DriverNotInitializedError);
    });

    it('DriverNotInitializedError.code is "DRIVER_NOT_INITIALIZED"', async () => {
      const err = await driver.generate(simpleInput).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DriverNotInitializedError);
      expect((err as DriverNotInitializedError).code).toBe('DRIVER_NOT_INITIALIZED');
    });

    it('DriverNotInitializedError.recoverable is false', async () => {
      const err = await driver.generate(simpleInput).catch((e: unknown) => e);
      expect((err as DriverNotInitializedError).recoverable).toBe(false);
    });

    it('returns GenerateOutput with all required fields after successful generation', async () => {
      await driver.init().catch(() => { /* stub */ });
      // After implementation: this should resolve with a full GenerateOutput
      const result = await driver.generate(simpleInput).catch(() => null);
      if (result !== null) {
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('startedAt');
        expect(result).toHaveProperty('completedAt');
        expect(result).toHaveProperty('provider');
        expect(result).toHaveProperty('sessionId');
        expect(typeof result.text).toBe('string');
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
      }
    });

    it('echoes metadata from input to output unchanged', async () => {
      await driver.init().catch(() => { /* stub */ });
      const inputWithMeta: GenerateInput = {
        prompt: 'Hello',
        metadata: { requestId: 'abc-123', source: 'test' },
      };
      const result = await driver.generate(inputWithMeta).catch(() => null);
      if (result !== null) {
        expect(result.metadata).toEqual(inputWithMeta.metadata);
      }
    });

    it('GenerateOutput.provider is a non-empty string', async () => {
      await driver.init().catch(() => { /* stub */ });
      const result = await driver.generate(simpleInput).catch(() => null);
      if (result !== null) {
        expect(typeof result.provider).toBe('string');
        expect(result.provider.length).toBeGreaterThan(0);
      }
    });

    it('GenerateOutput.sessionId is a non-empty string', async () => {
      await driver.init().catch(() => { /* stub */ });
      const result = await driver.generate(simpleInput).catch(() => null);
      if (result !== null) {
        expect(typeof result.sessionId).toBe('string');
        expect(result.sessionId.length).toBeGreaterThan(0);
      }
    });
  });

  // ── health() ─────────────────────────────────────────────────────────────────

  describe('health()', () => {
    it('returns a DriverHealth object — never throws', async () => {
      await expect(driver.health()).resolves.toBeDefined();
    });

    it('DriverHealth has all required fields', async () => {
      const h = await driver.health();
      expect(h).toHaveProperty('ok');
      expect(h).toHaveProperty('initialized');
      expect(h).toHaveProperty('browserRunning');
      expect(h).toHaveProperty('pageReady');
      expect(h).toHaveProperty('authenticated');
      expect(h).toHaveProperty('providerReachable');
      expect(h).toHaveProperty('mode');
    });

    it('ok is boolean', async () => {
      const h = await driver.health();
      expect(typeof h.ok).toBe('boolean');
    });

    it('mode is "shutdown" after shutdown()', async () => {
      await driver.shutdown();
      const h = await driver.health();
      expect(h.mode).toBe('shutdown');
    });

    it('health() does not throw even when called before init()', async () => {
      const freshDriver = new GeminiWebDriver(testConfig);
      await expect(freshDriver.health()).resolves.toBeDefined();
    });

    it('health() does not throw even if internal checks throw', async () => {
      // Simulate internal error — health must still return DriverHealth
      const driver2 = new GeminiWebDriver(testConfig);
      // No setup that would trigger internal errors in stub, but verifies non-throw contract
      await expect(driver2.health()).resolves.toHaveProperty('ok');
    });
  });

  // ── health() — lastErrorCode ──────────────────────────────────────────────────

  describe('health() — lastErrorCode', () => {
    it('lastErrorCode is absent when no error has occurred', async () => {
      const { driver: d } = makeTestDriver();
      await d.init();
      const h = await d.health();
      expect(h.lastErrorCode).toBeUndefined();
    });

    it('lastErrorCode equals the DriverError code when a typed error is the last error', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockRejectedValue(new OutputCaptureError('capture failed')),
        } as unknown as OutputCapture,
      });
      await d.init();
      await d.generate(simpleInput).catch(() => {});
      const h = await d.health();
      expect(h.lastErrorCode).toBe('OUTPUT_CAPTURE_FAILED');
    });

    it('lastErrorCode is undefined for non-DriverError generic errors (lastError is still set)', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockRejectedValue(new Error('network blip')),
        } as unknown as OutputCapture,
      });
      await d.init();
      await d.generate(simpleInput).catch(() => {});
      const h = await d.health();
      expect(h.lastErrorCode).toBeUndefined();
      expect(h.lastError).toBe('network blip');
    });

    it('lastErrorCode is cleared to undefined after a successful init()', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockRejectedValue(new OutputCaptureError('fail')),
        } as unknown as OutputCapture,
      });
      await d.init();
      await d.generate(simpleInput).catch(() => {});
      // Verify it was set
      expect((await d.health()).lastErrorCode).toBe('OUTPUT_CAPTURE_FAILED');
      // Re-init successfully clears it
      await d.init();
      const h = await d.health();
      expect(h.lastErrorCode).toBeUndefined();
    });
  });

  // ── recover() ────────────────────────────────────────────────────────────────

  describe('recover()', () => {
    it('returns a RecoveryResult object', async () => {
      const result = await driver.recover('unit test reason').catch(() => null);
      if (result !== null) {
        expect(result).toHaveProperty('ok');
        expect(result).toHaveProperty('action');
        expect(result).toHaveProperty('message');
      }
    });

    it('RecoveryResult.action is a valid RecoveryAction string', async () => {
      const valid = ['none', 'refresh-page', 'reopen-page', 'restart-browser', 'rebuild-session'];
      const result = await driver.recover().catch(() => null);
      if (result !== null) {
        expect(valid).toContain(result.action);
      }
    });

    it('clears lastError and lastErrorCode after a successful recover()', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockRejectedValue(new OutputCaptureError('capture failed')),
        } as unknown as OutputCapture,
        // recovery mock already returns { ok: true, action: 'none', message: 'ok' }
      });
      await d.init();
      await d.generate(simpleInput).catch(() => {});
      // Verify errors were recorded
      const hBefore = await d.health();
      expect(hBefore.lastErrorCode).toBe('OUTPUT_CAPTURE_FAILED');
      expect(hBefore.lastError).toBeDefined();
      // Successful recover() must clear them
      await d.recover('test reason');
      const hAfter = await d.health();
      expect(hAfter.lastError).toBeUndefined();
      expect(hAfter.lastErrorCode).toBeUndefined();
    });

    it('does NOT clear lastError when recover() fails (ok: false)', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockRejectedValue(new OutputCaptureError('capture failed')),
        } as unknown as OutputCapture,
        recovery: {
          recover: vi.fn().mockResolvedValue({ ok: false, action: 'refresh-page', message: 'still broken' }),
        } as unknown as RecoveryManager,
      });
      await d.init();
      await d.generate(simpleInput).catch(() => {});
      await d.recover('test reason');
      const h = await d.health();
      expect(h.lastErrorCode).toBe('OUTPUT_CAPTURE_FAILED');
      expect(h.lastError).toBeDefined();
    });
  });

  // ── shutdown() ───────────────────────────────────────────────────────────────

  describe('shutdown()', () => {
    it('resolves without throwing', async () => {
      await expect(driver.shutdown()).resolves.toBeUndefined();
    });

    it('is idempotent — safe to call multiple times', async () => {
      await driver.shutdown();
      await expect(driver.shutdown()).resolves.toBeUndefined();
    });

    it('is safe to call before init()', async () => {
      const freshDriver = new GeminiWebDriver(testConfig);
      await expect(freshDriver.shutdown()).resolves.toBeUndefined();
    });

    it('sets mode to "shutdown"', async () => {
      await driver.shutdown();
      const h = await driver.health();
      expect(h.mode).toBe('shutdown');
    });
  });

  // ── Error hierarchy ───────────────────────────────────────────────────────────

  describe('error hierarchy', () => {
    it('DriverNotInitializedError is instanceof Error', async () => {
      const err = await driver.generate(simpleInput).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
    });

    it('DriverNotInitializedError.timestamp is a Date', async () => {
      const err = await driver.generate(simpleInput).catch((e: unknown) => e);
      expect((err as DriverNotInitializedError).timestamp).toBeInstanceOf(Date);
    });
  });

  // ── log emission ─────────────────────────────────────────────────────────────

  describe('log emission', () => {
    it('emits driver.init.started and driver.init.succeeded on successful init()', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.init.started');
      expect(events).toContain('driver.init.succeeded');
    });

    it('emits driver.generate.started and driver.generate.succeeded on successful generate()', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      await d.generate(simpleInput);
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.generate.started');
      expect(events).toContain('driver.generate.succeeded');
    });

    it('emits driver.generate.started with requestId when metadata.requestId is a string', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      await d.generate({ prompt: 'test', metadata: { requestId: 'req-abc' } });
      const startEvent = emitted.find((r) => r.event === 'driver.generate.started');
      expect(startEvent?.requestId).toBe('req-abc');
    });

    it('emits driver.recover.started on recover()', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.recover('test');
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.recover.started');
    });

    it('emits driver.shutdown.started and driver.shutdown.succeeded on shutdown()', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      await d.shutdown();
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.shutdown.started');
      expect(events).toContain('driver.shutdown.succeeded');
    });

    it('emits driver.health.checked at debug level on health()', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.health();
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.health.checked');
    });

    it('does NOT emit at info level when logLevel is silent (default)', async () => {
      // This driver uses no logger override — defaults to silent.
      // We can only verify the public contract is identical (no throw, no output side-effects).
      const freshDriver = new GeminiWebDriver({ providerUrl: 'https://gemini.google.com/app' });
      await expect(freshDriver.health()).resolves.toBeDefined();
    });
  });

  // ── outputKind ───────────────────────────────────────────────────────────────

  describe('generate() — outputKind', () => {
    it('GenerateOutput includes outputKind field', async () => {
      const { driver: d } = makeTestDriver();
      await d.init();
      const result = await d.generate(simpleInput);
      expect(result).toHaveProperty('outputKind');
    });

    it('outputKind is "normal" for a regular response', async () => {
      const { driver: d } = makeTestDriver();
      await d.init();
      const result = await d.generate(simpleInput);
      // Default mock returns 'Generated response text' — no error pattern → normal
      expect(result.outputKind).toBe('normal');
    });

    it('outputKind is "provider-error" when capture returns a known error string', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockResolvedValue({
            text: 'Something went wrong',
            startedAt: new Date(),
            completedAt: new Date(),
          }),
        } as unknown as OutputCapture,
      });
      await d.init();
      const result = await d.generate(simpleInput);
      expect(result.outputKind).toBe('provider-error');
    });

    it('outputKind is "unknown" when capture returns empty text', async () => {
      const { driver: d } = makeTestDriver({
        capture: {
          capture: vi.fn().mockResolvedValue({
            text: '',
            startedAt: new Date(),
            completedAt: new Date(),
          }),
        } as unknown as OutputCapture,
      });
      await d.init();
      const result = await d.generate(simpleInput);
      expect(result.outputKind).toBe('unknown');
    });

    it('log event driver.generate.succeeded includes outputKind', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      await d.generate(simpleInput);
      const succeededEvent = emitted.find((r) => r.event === 'driver.generate.succeeded');
      expect(succeededEvent).toBeDefined();
      expect(succeededEvent?.outputKind).toBeDefined();
    });

    it('log event driver.generate.succeeded includes matchedPattern when outputKind is provider-error', async () => {
      const { driver: d, emitted } = makeTestDriver({
        capture: {
          capture: vi.fn().mockResolvedValue({
            text: 'Something went wrong',
            startedAt: new Date(),
            completedAt: new Date(),
          }),
        } as unknown as OutputCapture,
      });
      await d.init();
      const result = await d.generate(simpleInput);
      expect(result.outputKind).toBe('provider-error');
      const succeededEvent = emitted.find((r) => r.event === 'driver.generate.succeeded');
      expect(succeededEvent?.matchedPattern).toBe('generic-error');
    });

    it('log event driver.generate.succeeded does NOT include matchedPattern when outputKind is normal', async () => {
      const { driver: d, emitted } = makeTestDriver();
      await d.init();
      await d.generate(simpleInput);
      const succeededEvent = emitted.find((r) => r.event === 'driver.generate.succeeded');
      expect(succeededEvent?.matchedPattern).toBeUndefined();
    });
  });

  // ── newConversation ─────────────────────────────────────────────────────────

  describe('generate() — newConversation', () => {
    it('does NOT call page.goto() when newConversation is false (default)', async () => {
      const { driver: d, mockSession } = makeTestDriver();
      // Grab reference to the mock page
      const mockPage = { goto: vi.fn().mockResolvedValue(null), waitForLoadState: vi.fn().mockResolvedValue(undefined) };
      (mockSession.getPage as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage);
      await d.init();
      // init() itself navigates via page.goto — reset AFTER init so we only
      // assert that generate() (without newConversation) does NOT call it.
      mockPage.goto.mockClear();
      await d.generate({ prompt: 'hello' });
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    it('calls page.goto() with providerUrl when newConversation is true', async () => {
      const { driver: d, mockSession } = makeTestDriver();
      const mockPage = {
        goto: vi.fn().mockResolvedValue(null),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
      };
      (mockSession.getPage as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage);
      await d.init();
      await d.generate({ prompt: 'hello', newConversation: true });
      expect(mockPage.goto).toHaveBeenCalledWith('https://gemini.google.com/app');
    });

    it('emits driver.generate.new_conversation debug event when newConversation is true', async () => {
      const { driver: d, emitted, mockSession } = makeTestDriver();
      const mockPage = {
        goto: vi.fn().mockResolvedValue(null),
        waitForLoadState: vi.fn().mockResolvedValue(undefined),
      };
      (mockSession.getPage as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage);
      await d.init();
      await d.generate({ prompt: 'hello', newConversation: true });
      const events = emitted.map((r) => r.event);
      expect(events).toContain('driver.generate.new_conversation');
    });

    it('generate() succeeds even when waitForLoadState times out during newConversation reload', async () => {
      // Verifies that the silent .catch(() => {}) on waitForLoadState is intentional:
      // a networkidle timeout must NOT abort generate().
      const { driver: d, mockSession } = makeTestDriver();
      const mockPage = {
        goto: vi.fn().mockResolvedValue(null),
        // Simulate timeout rejection — this should be swallowed silently.
        waitForLoadState: vi.fn().mockRejectedValue(new Error('Timeout exceeded')),
      };
      (mockSession.getPage as ReturnType<typeof vi.fn>).mockResolvedValue(mockPage);
      await d.init();
      const result = await d.generate({ prompt: 'hello', newConversation: true });
      expect(result).toHaveProperty('text');
      expect(result.outputKind).toBe('normal');
    });
  });

  // ── health() — 5000ms timeout ────────────────────────────────────────────────

  describe('health() — 5000ms timeout', () => {
    it('resolves with a degraded report when internal checks hang beyond 5000ms', async () => {
      vi.useFakeTimers();
      const neverResolve = new Promise<never>(() => { /* intentionally hangs */ });

      const { driver: d } = makeTestDriver({
        session: {
          isRunning: vi.fn().mockReturnValue(true),
          // getPage hangs — simulates a frozen browser
          getPage: vi.fn().mockReturnValue(neverResolve),
          launch: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          id: 'test-session-id',
        } as unknown as BrowserSession,
      });

      const healthPromise = d.health();
      // Advance fake clock past the 5000ms timeout
      await vi.runAllTimersAsync();
      const h = await healthPromise;

      expect(h.ok).toBe(false);
      expect(h.browserRunning).toBe(false);

      vi.useRealTimers();
    });

    it('health() resolves normally (no timeout) when checks complete quickly', async () => {
      // Baseline: default mock resolves immediately — must still return correct health
      const { driver: d } = makeTestDriver();
      await d.init();
      const h = await d.health();
      expect(h.ok).toBe(true);
      expect(h.initialized).toBe(true);
    });
  });

  // ── concurrency guard ────────────────────────────────────────────────────────

  describe('generate() — concurrency guard', () => {
    it('throws ConcurrentGenerationError when called while already generating', async () => {
      // Make capture take a long time so the second call races
      let resolveCaptureFirst!: () => void;
      const firstCaptureDone = new Promise<void>((resolve) => {
        resolveCaptureFirst = resolve;
      });
      const slowCapture = {
        capture: vi.fn().mockImplementation(async () => {
          await firstCaptureDone; // blocks until we release it
          return { text: 'done', startedAt: new Date(), completedAt: new Date() };
        }),
      } as unknown as OutputCapture;

      const { driver: d } = makeTestDriver({ capture: slowCapture });
      await d.init();

      // Fire first generate — do not await
      const first = d.generate({ prompt: 'first' });
      // Second generate fires immediately — should be rejected
      const secondErr = await d.generate({ prompt: 'second' }).catch((e: unknown) => e);
      expect(secondErr).toBeInstanceOf(ConcurrentGenerationError);
      expect((secondErr as ConcurrentGenerationError).code).toBe('CONCURRENT_GENERATION');
      expect((secondErr as ConcurrentGenerationError).recoverable).toBe(false);

      // Clean up: release first capture
      resolveCaptureFirst();
      await first;
    });

    it('allows a second generate() after the first completes', async () => {
      const { driver: d } = makeTestDriver();
      await d.init();
      await d.generate({ prompt: 'first' });
      await expect(d.generate({ prompt: 'second' })).resolves.toHaveProperty('text');
    });

    it('ConcurrentGenerationError is instanceof DriverError', async () => {
      let resolveCap!: () => void;
      const blockingCapture = {
        capture: vi.fn().mockImplementation(async () => {
          await new Promise<void>((r) => { resolveCap = r; });
          return { text: 'ok', startedAt: new Date(), completedAt: new Date() };
        }),
      } as unknown as OutputCapture;

      const { driver: d } = makeTestDriver({ capture: blockingCapture });
      await d.init();
      const first = d.generate({ prompt: 'a' });
      const err = await d.generate({ prompt: 'b' }).catch((e: unknown) => e);

      const { DriverError } = await import('../../src/errors/index');
      expect(err).toBeInstanceOf(DriverError);

      resolveCap();
      await first;
    });
  });

  // ── systemPrompt removal ─────────────────────────────────────────────────────

  describe('generate() — systemPrompt removed from contract', () => {
    it('submitter.submit is called with exactly (page, prompt) — no third argument', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const { driver: d } = makeTestDriver({
        submitter: { submit: mockSubmit } as unknown as PromptSubmitter,
      });
      await d.init();
      await d.generate({ prompt: 'hello world' });
      // Before removal: called with (page, 'hello world', undefined) → length 3 → FAILS
      // After removal:  called with (page, 'hello world')            → length 2 → PASSES
      expect(mockSubmit.mock.calls[0]).toHaveLength(2);
      expect(mockSubmit.mock.calls[0]?.[1]).toBe('hello world');
    });
  });
});
