import type { Page } from 'playwright';
import type { CaptureConfig, CaptureResult, ProviderSelectors } from '../types/index';
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
export declare class OutputCapture {
    private readonly selectors;
    private readonly config;
    constructor(selectors: ProviderSelectors, config: CaptureConfig);
    /**
     * Runs the capture pipeline.
     * @param page - Active Playwright page.
     * @param timeoutMs - Optional override for stabilityTimeoutMs.
     * @returns CaptureResult with complete text and timestamps.
     * @throws TimeoutError if first token never appears or output never stabilizes.
     * @throws OutputCaptureError if output element is missing or text is empty/whitespace.
     */
    capture(page: Page, timeoutMs?: number): Promise<CaptureResult>;
}
//# sourceMappingURL=OutputCapture.d.ts.map