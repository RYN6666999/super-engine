/**
 * Gemini Web UI selectors — versioned here, never hardcoded in modules.
 *
 * These selectors target the Gemini web app as observed in early 2025.
 * They MUST be verified against the live UI before first production use,
 * as Google may change the DOM at any time.
 *
 * Fallback strategy: CSS :is() pseudo-class lists multiple candidate selectors
 * per slot. The browser resolves the first matching alternative, giving
 * resilience without any module code changes.
 *
 * Criticality:
 *   inputBox, outputContainer, loginIndicator  → Critical (operation fails without them)
 *   submitButton, stopButton                   → High (Enter key fallback exists)
 *   challengeIndicator                         → Medium (challenge may be missed)
 *   streamingIndicator                         → Low (stability detection degrades gracefully)
 *
 * Run selectorAudit(page, GeminiSelectors) before each production release to verify.
 */
import type { ProviderSelectors } from '../../types/index';
export declare const GeminiSelectors: ProviderSelectors;
//# sourceMappingURL=selectors.d.ts.map