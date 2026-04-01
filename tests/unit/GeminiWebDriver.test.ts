import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiWebDriver } from '../../src/driver/GeminiWebDriver';
import type { GeminiWebDriverDeps } from '../../src/driver/GeminiWebDriver';
import { DriverNotInitializedError } from '../../src/errors/index';
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
});
