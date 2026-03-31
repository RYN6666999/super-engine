import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import { OutputCapture } from '../../src/modules/OutputCapture';
import { TimeoutError, OutputCaptureError } from '../../src/errors/index';
import type { CaptureConfig, ProviderSelectors } from '../../src/types/index';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const testSelectors: ProviderSelectors = {
  inputBox: '[data-testid="input"]',
  outputContainer: '[data-testid="output"]',
  stopButton: '[data-testid="stop"]',
  loginIndicator: '[data-testid="user-menu"]',
};

const defaultConfig: CaptureConfig = {
  firstTokenTimeoutMs: 500,   // low for tests
  stabilityTimeoutMs: 1000,   // low for tests
  stabilityIntervalMs: 100,   // fast polling for tests
};

/** Builds a mock Page whose output text cycles through the provided sequence. */
function makeStreamingPage(textSequence: Array<string | null>): Page {
  let call = 0;
  return {
    $eval: vi.fn().mockImplementation(async () => {
      const val = textSequence[Math.min(call++, textSequence.length - 1)];
      if (val === null) throw new Error('element not found');
      return val;
    }),
    isVisible: vi.fn().mockImplementation(async () => {
      // stop button visible until last two text values
      return call < textSequence.length - 1;
    }),
    $: vi.fn().mockImplementation(async (sel: string) => {
      if (sel.includes('output')) return {};
      return null;
    }),
  } as unknown as Page;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('OutputCapture', () => {
  let capture: OutputCapture;

  beforeEach(() => {
    capture = new OutputCapture(testSelectors, defaultConfig);
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  describe('capture() — happy path', () => {
    it('returns CaptureResult with non-empty text when output is stable', async () => {
      // Stream: starts with partial, then stabilizes
      const page = makeStreamingPage(['Hello', 'Hello world', 'Hello world', 'Hello world']);
      const result = await capture.capture(page);
      expect(result.text).toBe('Hello world');
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('completedAt is after startedAt', async () => {
      const page = makeStreamingPage(['Hi', 'Hi!', 'Hi!', 'Hi!']);
      const result = await capture.capture(page);
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
    });

    it('does not return until stop-button indicator is absent (condition 2)', async () => {
      let stopButtonVisible = true;
      const page = {
        $eval: vi.fn().mockResolvedValue('Final output'),
        isVisible: vi.fn().mockImplementation(async () => {
          // stop button disappears after 2 calls
          const v = stopButtonVisible;
          stopButtonVisible = false;
          return v;
        }),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      const result = await capture.capture(page);
      expect(result.text).toBe('Final output');
      // isVisible must have been called at least twice (once while true, once when false)
      expect((page.isVisible as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('does not return on first stable poll — waits for second confirmation', async () => {
      // Sequence: partial → stable → same stable again (dual poll required)
      const page = makeStreamingPage(['loading...', 'Done', 'Done', 'Done']);
      const result = await capture.capture(page);
      // The key assertion is that it didn't return 'loading...'
      expect(result.text).toBe('Done');
    });
  });

  // ── Timeout cases ────────────────────────────────────────────────────────────

  describe('capture() — timeout', () => {
    it('raises TimeoutError when first token never appears within firstTokenTimeoutMs', async () => {
      const page = {
        $eval: vi.fn().mockResolvedValue(''),  // always empty
        isVisible: vi.fn().mockResolvedValue(true),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await expect(capture.capture(page)).rejects.toThrow(TimeoutError);
    });

    it('TimeoutError.code is "TIMEOUT"', async () => {
      const page = {
        $eval: vi.fn().mockResolvedValue(''),
        isVisible: vi.fn().mockResolvedValue(true),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      const err = await capture.capture(page).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).code).toBe('TIMEOUT');
    });

    it('raises TimeoutError when output starts but never stabilizes', async () => {
      let i = 0;
      const page = {
        $eval: vi.fn().mockImplementation(async () => `partial text ${i++}`), // always changing
        isVisible: vi.fn().mockResolvedValue(true), // stop button never disappears
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await expect(capture.capture(page)).rejects.toThrow(TimeoutError);
    });

    it('TimeoutError.partial contains whatever text was last captured', async () => {
      let i = 0;
      const page = {
        $eval: vi.fn().mockImplementation(async () => `text ${i++}`),
        isVisible: vi.fn().mockResolvedValue(true),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      const err = await capture.capture(page).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).partial).toBeDefined();
      expect(typeof (err as TimeoutError).partial).toBe('string');
    });

    it('TimeoutError.elapsedMs is a positive number', async () => {
      const page = {
        $eval: vi.fn().mockResolvedValue(''),
        isVisible: vi.fn().mockResolvedValue(true),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      const err = await capture.capture(page).catch((e: unknown) => e);
      expect((err as TimeoutError).elapsedMs).toBeGreaterThan(0);
    });

    it('per-call timeoutMs overrides stabilityTimeoutMs', async () => {
      const start = Date.now();
      let i = 0;
      const page = {
        $eval: vi.fn().mockImplementation(async () => `text ${i++}`),
        isVisible: vi.fn().mockResolvedValue(true),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await capture.capture(page, 200 /* override */).catch(() => { /* expected */ });
      // Should have timed out around 200ms, not the default 1000ms
      expect(Date.now() - start).toBeLessThan(800);
    });
  });

  // ── Error conditions ─────────────────────────────────────────────────────────

  describe('capture() — error conditions', () => {
    it('raises OutputCaptureError when output container element is not found', async () => {
      const page = {
        $eval: vi.fn().mockRejectedValue(new Error('element not found')),
        isVisible: vi.fn().mockResolvedValue(false),
        $: vi.fn().mockResolvedValue(null), // no output element
      } as unknown as Page;

      await expect(capture.capture(page)).rejects.toThrow(OutputCaptureError);
    });

    it('raises OutputCaptureError when captured text is an empty string', async () => {
      const page = {
        $eval: vi.fn().mockResolvedValue(''), // always empty — stability condition never satisfied
        isVisible: vi.fn().mockResolvedValue(false), // stop button already gone
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await expect(capture.capture(page)).rejects.toThrow(OutputCaptureError);
    });

    it('raises OutputCaptureError when captured text is whitespace only', async () => {
      const page = {
        $eval: vi.fn().mockResolvedValue('   \n\t   '),
        isVisible: vi.fn().mockResolvedValue(false),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await expect(capture.capture(page)).rejects.toThrow(OutputCaptureError);
    });
  });

  // ── Selector injection ───────────────────────────────────────────────────────

  describe('selector injection', () => {
    it('uses the injected outputContainer selector (not hardcoded)', async () => {
      const customSelectors: ProviderSelectors = {
        ...testSelectors,
        outputContainer: '[data-custom="response"]',
      };
      const customCapture = new OutputCapture(customSelectors, defaultConfig);

      const page = {
        $eval: vi.fn().mockResolvedValue('response text'),
        isVisible: vi.fn().mockResolvedValue(false),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await customCapture.capture(page).catch(() => { /* stub throws */ });

      // The mock should have been called with the custom selector
      const usedSelectors = ((page.$eval as ReturnType<typeof vi.fn>).mock.calls as Array<[string, ...unknown[]]>).map(([sel]) => sel);
      expect(usedSelectors.some(s => s.includes('data-custom'))).toBe(true);
    });

    it('uses the injected stopButton selector (not hardcoded)', async () => {
      const customSelectors: ProviderSelectors = {
        ...testSelectors,
        stopButton: '[data-custom="stop"]',
      };
      const customCapture = new OutputCapture(customSelectors, defaultConfig);

      const page = {
        $eval: vi.fn().mockResolvedValue('text'),
        isVisible: vi.fn().mockResolvedValue(false),
        $: vi.fn().mockResolvedValue({}),
      } as unknown as Page;

      await customCapture.capture(page).catch(() => { /* stub throws */ });

      const usedSelectors = ((page.isVisible as ReturnType<typeof vi.fn>).mock.calls as Array<[string, ...unknown[]]>).map(([sel]) => sel);
      expect(usedSelectors.some(s => s.includes('data-custom'))).toBe(true);
    });
  });
});
