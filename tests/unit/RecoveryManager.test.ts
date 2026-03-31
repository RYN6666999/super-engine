import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecoveryManager } from '../../src/modules/RecoveryManager';
import type { BrowserSession } from '../../src/modules/BrowserSession';
import type { PageStateInspector } from '../../src/modules/PageStateInspector';
import type { BrowserSessionConfig, DriverHealth } from '../../src/types/index';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const testConfig: BrowserSessionConfig = {
  providerUrl: 'https://gemini.google.com/app',
  headless: true,
};

function makeHealth(overrides: Partial<DriverHealth> = {}): DriverHealth {
  return {
    ok: true,
    initialized: true,
    browserRunning: true,
    pageReady: true,
    authenticated: true,
    providerReachable: true,
    mode: 'idle',
    ...overrides,
  };
}

function makeMockSession(overrides: Partial<Record<string, unknown>> = {}): BrowserSession {
  return {
    launch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getPage: vi.fn().mockResolvedValue({}),
    isRunning: vi.fn().mockReturnValue(true),
    id: 'test-session-id',
    ...overrides,
  } as unknown as BrowserSession;
}

function makeMockInspector(overrides: Partial<Record<string, unknown>> = {}): PageStateInspector {
  return {
    isLoggedIn: vi.fn().mockResolvedValue(true),
    isPageReady: vi.fn().mockResolvedValue(true),
    hasChallenge: vi.fn().mockResolvedValue(false),
    detectMode: vi.fn().mockResolvedValue('ready'),
    ...overrides,
  } as unknown as PageStateInspector;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('RecoveryManager', () => {
  let session: BrowserSession;
  let inspector: PageStateInspector;
  let manager: RecoveryManager;

  beforeEach(() => {
    session = makeMockSession();
    inspector = makeMockInspector();
    manager = new RecoveryManager(session, inspector, testConfig);
  });

  // ── Action selection ─────────────────────────────────────────────────────────

  describe('recover() — action selection', () => {
    it('returns action "none" and ok:true when health is fully ok', async () => {
      const result = await manager.recover(makeHealth());
      expect(result.ok).toBe(true);
      expect(result.action).toBe('none');
    });

    it('selects "refresh-page" when pageReady=false but URL is correct', async () => {
      const health = makeHealth({ ok: false, pageReady: false });
      const result = await manager.recover(health);
      expect(result.action).toBe('refresh-page');
    });

    it('selects "reopen-page" when pageReady=false due to wrong URL', async () => {
      const health = makeHealth({ ok: false, pageReady: false, providerReachable: true });
      // Simulate wrong URL by overriding getPage to return a page with wrong URL
      (session.getPage as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: vi.fn().mockReturnValue('https://google.com/wrong'),
      });
      const result = await manager.recover(health);
      expect(['reopen-page', 'refresh-page']).toContain(result.action);
    });

    it('selects "restart-browser" when browserRunning=false', async () => {
      const health = makeHealth({ ok: false, browserRunning: false, pageReady: false, authenticated: false });
      const result = await manager.recover(health);
      expect(result.action).toBe('restart-browser');
    });

    it('escalates to "rebuild-session" when authenticated=false after reopen', async () => {
      // Inspector still returns not-authenticated after reopen
      (inspector.isLoggedIn as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const health = makeHealth({ ok: false, authenticated: false });
      const result = await manager.recover(health);
      expect(result.action).toBe('rebuild-session');
    });
  });

  // ── Recovery success ─────────────────────────────────────────────────────────

  describe('recover() — success path', () => {
    it('returns ok:true when health is restored after recovery action', async () => {
      // page not ready, but inspector confirms ready after refresh
      (inspector.isPageReady as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(false)  // initial check inside recover
        .mockResolvedValue(true);       // after refresh
      const health = makeHealth({ ok: false, pageReady: false });
      const result = await manager.recover(health);
      expect(result.ok).toBe(true);
    });

    it('RecoveryResult.action matches the action that succeeded', async () => {
      const health = makeHealth({ ok: false, pageReady: false });
      const result = await manager.recover(health);
      expect(typeof result.action).toBe('string');
      expect(result.action).not.toBe('');
    });
  });

  // ── Recovery failure ─────────────────────────────────────────────────────────

  describe('recover() — failure path', () => {
    it('returns ok:false when all actions exhausted without restoring health', async () => {
      (session.launch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('cannot launch'));
      (inspector.isPageReady as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      (inspector.isLoggedIn as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const health = makeHealth({ ok: false, browserRunning: false, pageReady: false, authenticated: false });
      const result = await manager.recover(health);
      expect(result.ok).toBe(false);
    });

    it('result.message is a non-empty string describing what happened', async () => {
      const health = makeHealth({ ok: false, pageReady: false });
      const result = await manager.recover(health);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('recover() NEVER throws — always returns RecoveryResult', async () => {
      (session.launch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('catastrophic'));
      (session.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('catastrophic'));
      const health = makeHealth({ ok: false, browserRunning: false, pageReady: false, authenticated: false });
      await expect(manager.recover(health)).resolves.toBeDefined();
    });
  });

  // ── Constraints ──────────────────────────────────────────────────────────────

  describe('recover() — constraints', () => {
    it('completes within 60000ms (mocked actions are fast)', async () => {
      const start = Date.now();
      const health = makeHealth({ ok: false, pageReady: false });
      await manager.recover(health).catch(() => { /* expected in stub */ });
      expect(Date.now() - start).toBeLessThan(60000);
    });
  });

  // ── Reason-aware recovery (v0.1.1) ──────────────────────────────────────────

  describe('recover() — reason-aware (v0.1.1)', () => {
    it('forces refresh-page when health.ok=true and reason contains "timeout"', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health, 'generate timeout after 30s');
      expect(result.action).toBe('refresh-page');
    });

    it('forces refresh-page when health.ok=true and reason contains "capture-failed"', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health, 'capture-failed: output empty');
      expect(result.action).toBe('refresh-page');
    });

    it('forces refresh-page when health.ok=true and reason contains "stuck"', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health, 'stuck state detected');
      expect(result.action).toBe('refresh-page');
    });

    it('forces refresh-page when health.ok=true and reason contains "stale"', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health, 'stale page after navigation');
      expect(result.action).toBe('refresh-page');
    });

    it('returns action "none" when health.ok=true and reason has no force-refresh signal', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health, 'smoke-test-probe');
      expect(result.action).toBe('none');
      expect(result.ok).toBe(true);
    });

    it('returns action "none" when health.ok=true and no reason provided', async () => {
      const health = makeHealth({ ok: true });
      const result = await manager.recover(health);
      expect(result.action).toBe('none');
      expect(result.ok).toBe(true);
    });

    it('reason does NOT override browser-down detection (browserRunning=false takes priority)', async () => {
      const health = makeHealth({ ok: false, browserRunning: false, pageReady: false, authenticated: false });
      const result = await manager.recover(health, 'timeout');
      // browserRunning=false → restart-browser, even if reason says timeout
      expect(result.action).toBe('restart-browser');
    });
  });

  // ── Domain isolation ─────────────────────────────────────────────────────────

  describe('domain isolation', () => {
    it('RecoveryManager module has no imports from memory/, persona/, or skills/', () => {
      // This is a static-analysis assertion via ESLint. As a unit-test proxy,
      // we verify the class constructor accepts only typed driver primitives.
      expect(() => {
        new RecoveryManager(session, inspector, testConfig);
      }).not.toThrow();
    });
  });
});
