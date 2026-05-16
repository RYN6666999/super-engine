"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputCapture = void 0;
const index_1 = require("../errors/index");
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
class OutputCapture {
    selectors;
    config;
    constructor(selectors, config) {
        this.selectors = selectors;
        this.config = config;
    }
    /**
     * Runs the capture pipeline.
     * @param page - Active Playwright page.
     * @param timeoutMs - Optional override for stabilityTimeoutMs.
     * @returns CaptureResult with complete text and timestamps.
     * @throws TimeoutError if first token never appears or output never stabilizes.
     * @throws OutputCaptureError if output element is missing or text is empty/whitespace.
     */
    async capture(page, timeoutMs) {
        const overallTimeout = timeoutMs ?? this.config.stabilityTimeoutMs;
        const startedAt = new Date();
        const startMs = Date.now();
        // Helper: read text from the LAST matching container (newest response).
        // Returns '' if no elements found yet (new conversation, container not yet rendered).
        const readLastText = async () => {
            try {
                return await page.$$eval(this.selectors.outputContainer, (els) => (els[els.length - 1]?.textContent ?? ''));
            }
            catch {
                return '';
            }
        };
        let prevText = '';
        let firstTokenMs = null;
        // Track whether the stop button was ever seen — avoids false-positive "empty" errors
        // in the race window right after submit() before Gemini starts streaming.
        let stopWasSeen = false;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const currentText = await readLastText();
            const stopVisible = await page.isVisible(this.selectors.stopButton);
            if (stopVisible)
                stopWasSeen = true;
            const elapsed = Date.now() - startMs;
            // Generation completed (stop gone) but text is empty/whitespace.
            // Requires stopWasSeen (avoids race after submit()) AND firstTokenMs set (avoids false
            // positives from SPA page-transition flicker that makes stop button briefly appear
            // before actual generation begins — observed with newConversation:true).
            if (stopWasSeen && firstTokenMs !== null && !stopVisible && currentText.trim() === '') {
                throw new index_1.OutputCaptureError('Output is empty after generation completed');
            }
            // Track first token appearance (raw non-empty, not trimmed — whitespace content also
            // counts as a token appearing, distinguishing it from a genuinely empty response).
            if (firstTokenMs === null && currentText !== '') {
                firstTokenMs = elapsed;
            }
            // Stability: same text since last poll AND stop button absent
            if (currentText !== '' && currentText === prevText && !stopVisible) {
                return { text: currentText, startedAt, completedAt: new Date() };
            }
            prevText = currentText;
            // First-token timeout
            if (firstTokenMs === null && elapsed > this.config.firstTokenTimeoutMs) {
                throw new index_1.TimeoutError(`First output token did not appear within ${this.config.firstTokenTimeoutMs}ms`, elapsed);
            }
            // Stability timeout (or per-call override)
            if (elapsed > overallTimeout) {
                throw new index_1.TimeoutError(`Output did not stabilize within ${overallTimeout}ms`, elapsed, prevText !== '' ? prevText : undefined);
            }
            await new Promise((resolve) => setTimeout(resolve, this.config.stabilityIntervalMs));
        }
    }
}
exports.OutputCapture = OutputCapture;
//# sourceMappingURL=OutputCapture.js.map