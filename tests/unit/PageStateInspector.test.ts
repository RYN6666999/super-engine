import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { PageStateInspector } from '../../src/modules/PageStateInspector';
import type { ProviderSelectors } from '../../src/types/index';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const testSelectors: ProviderSelectors = {
  inputBox: '[data-testid="input"]',
  outputContainer: '[data-testid="output"]',
  stopButton: '[data-testid="stop"]',
  loginIndicator: '[data-testid="user-menu"]',
  challengeIndicator: '[data-testid="captcha"]',
};

function makePage(overrides: Partial<Record<string, unknown>> = {}): Page {
  return {
    $: vi.fn(),
    evaluate: vi.fn(),
    isVisible: vi.fn(),
    url: vi.fn().mockReturnValue('https://gemini.google.com/app'),
    ...overrides,
  } as unknown as Page;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('PageStateInspector', () => {
  let inspector: PageStateInspector;

  beforeEach(() => {
    inspector = new PageStateInspector(testSelectors);
  });

  // ── isLoggedIn() ─────────────────────────────────────────────────────────────

  describe('isLoggedIn()', () => {
    it('returns true when login indicator element is present', async () => {
      const page = makePage({ $: vi.fn().mockResolvedValue({} /* element */) });
      await expect(inspector.isLoggedIn(page)).resolves.toBe(true);
    });

    it('returns false when login indicator element is absent', async () => {
      const page = makePage({ $: vi.fn().mockResolvedValue(null) });
      await expect(inspector.isLoggedIn(page)).resolves.toBe(false);
    });

    it('returns false when page.$ throws (never propagates)', async () => {
      const page = makePage({ $: vi.fn().mockRejectedValue(new Error('DOM error')) });
      await expect(inspector.isLoggedIn(page)).resolves.toBe(false);
    });
  });

  // ── isPageReady() ────────────────────────────────────────────────────────────

  describe('isPageReady()', () => {
    it('returns true when input box is visible', async () => {
      const page = makePage({ isVisible: vi.fn().mockResolvedValue(true) });
      await expect(inspector.isPageReady(page)).resolves.toBe(true);
    });

    it('returns false when input box is not visible', async () => {
      const page = makePage({ isVisible: vi.fn().mockResolvedValue(false) });
      await expect(inspector.isPageReady(page)).resolves.toBe(false);
    });

    it('returns false when visibility check throws (never propagates)', async () => {
      const page = makePage({ isVisible: vi.fn().mockRejectedValue(new Error('layout')) });
      await expect(inspector.isPageReady(page)).resolves.toBe(false);
    });
  });

  // ── hasChallenge() ───────────────────────────────────────────────────────────

  describe('hasChallenge()', () => {
    it('returns true when challenge indicator element exists', async () => {
      const page = makePage({ $: vi.fn().mockResolvedValue({}) });
      await expect(inspector.hasChallenge(page)).resolves.toBe(true);
    });

    it('returns false when no challenge indicator exists', async () => {
      const page = makePage({ $: vi.fn().mockResolvedValue(null) });
      await expect(inspector.hasChallenge(page)).resolves.toBe(false);
    });
  });

  // ── detectMode() ─────────────────────────────────────────────────────────────

  describe('detectMode()', () => {
    it('returns "ready" when logged in, page ready, no challenge', async () => {
      const page = makePage({
        $: vi.fn().mockResolvedValue({}),
        isVisible: vi.fn().mockResolvedValue(true),
      });
      await expect(inspector.detectMode(page)).resolves.toBe('ready');
    });

    it('returns "unauthenticated" when login indicator absent', async () => {
      const page = makePage({
        $: vi.fn().mockResolvedValue(null),
        isVisible: vi.fn().mockResolvedValue(false),
      });
      await expect(inspector.detectMode(page)).resolves.toBe('unauthenticated');
    });

    it('returns "challenge" when challenge indicator is present', async () => {
      // challenge indicator present, login indicator absent
      const page = makePage({
        $: vi.fn().mockImplementation(async (sel: string) =>
          sel.includes('captcha') ? {} : null
        ),
        isVisible: vi.fn().mockResolvedValue(false),
      });
      await expect(inspector.detectMode(page)).resolves.toBe('challenge');
    });

    it('returns "error" when page checks consistently throw', async () => {
      const page = makePage({
        $: vi.fn().mockRejectedValue(new Error('nav error')),
        isVisible: vi.fn().mockRejectedValue(new Error('nav error')),
      });
      await expect(inspector.detectMode(page)).resolves.toBe('error');
    });
  });

  // ── timeout behaviour ─────────────────────────────────────────────────────────

  describe('timeout behaviour', () => {
    it('isLoggedIn() resolves false (not throws) when check hangs beyond 5000ms', async () => {
      const page = makePage({
        $: vi.fn().mockImplementation(
          () => new Promise<never>(() => { /* intentionally hangs */ }),
        ),
      });
      await expect(inspector.isLoggedIn(page)).resolves.toBe(false);
    }, 7000 /* vitest timeout > 5000ms guard */);

    it('isPageReady() resolves false (not throws) when check hangs beyond 5000ms', async () => {
      const page = makePage({
        isVisible: vi.fn().mockImplementation(
          () => new Promise<never>(() => { /* intentionally hangs */ }),
        ),
      });
      await expect(inspector.isPageReady(page)).resolves.toBe(false);
    }, 7000);
  });
});
