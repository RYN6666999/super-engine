import type { Page } from 'playwright';
import type { CaptureConfig, CaptureResult, ProviderSelectors } from '../types/index';
import { OutputCaptureError, TimeoutError } from '../errors/index';

/**
 * Waits for LLM output to begin, stabilize, and then extracts the complete text.
 *
 * Stability requires BOTH conditions simultaneously:
 *   1. DOM text unchanged between two consecutive polls.
 *   2. Provider's "stop generating" indicator is absent.
 *
 * If the stop button is absent but text is empty/whitespace → OutputCaptureError.
 * If first token never arrives within firstTokenTimeoutMs → TimeoutError.
 * If output appears but never stabilizes within stabilityTimeoutMs → TimeoutError.
 */
export class OutputCapture {
  constructor(
    private readonly selectors: ProviderSelectors,
    private readonly config: CaptureConfig,
  ) {}

  /**
   * Runs the capture pipeline.
   * @param page - Active Playwright page.
   * @param timeoutMs - Optional override for stabilityTimeoutMs.
   * @returns CaptureResult with complete text and timestamps.
   * @throws TimeoutError if first token never appears or output never stabilizes.
   * @throws OutputCaptureError if output element is missing or text is empty/whitespace.
   */
  async capture(page: Page, timeoutMs?: number): Promise<CaptureResult> {
    const overallTimeout = timeoutMs ?? this.config.stabilityTimeoutMs;
    const startedAt = new Date();
    const startMs = Date.now();

    // Pre-flight: output container must exist
    const container = await page.$(this.selectors.outputContainer);
    if (container == null) {
      throw new OutputCaptureError('Output container element not found in the DOM');
    }

    let prevText = '';
    let firstTokenMs: number | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Read current output text
      let currentText: string;
      try {
        currentText = await page.$eval<string>(
          this.selectors.outputContainer,
          (el) => el.textContent ?? '',
        );
      } catch {
        throw new OutputCaptureError('Failed to read text from output container');
      }

      const stopVisible = await page.isVisible(this.selectors.stopButton);
      const elapsed = Date.now() - startMs;

      // Generation completed (stop gone) but text is empty/whitespace → capture error
      if (!stopVisible && currentText.trim() === '') {
        throw new OutputCaptureError('Output is empty after generation completed');
      }

      // Track first token appearance
      if (firstTokenMs === null && currentText.trim() !== '') {
        firstTokenMs = elapsed;
      }

      // Stability: same text since last poll AND stop button absent
      if (currentText !== '' && currentText === prevText && !stopVisible) {
        return { text: currentText, startedAt, completedAt: new Date() };
      }
      prevText = currentText;

      // First-token timeout
      if (firstTokenMs === null && elapsed > this.config.firstTokenTimeoutMs) {
        throw new TimeoutError(
          `First output token did not appear within ${this.config.firstTokenTimeoutMs}ms`,
          elapsed,
        );
      }

      // Stability timeout (or per-call override)
      if (elapsed > overallTimeout) {
        throw new TimeoutError(
          `Output did not stabilize within ${overallTimeout}ms`,
          elapsed,
          prevText !== '' ? prevText : undefined,
        );
      }

      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.config.stabilityIntervalMs),
      );
    }
  }
}
