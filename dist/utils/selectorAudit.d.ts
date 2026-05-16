/**
 * selectorAudit — internal utility for pre-release selector verification.
 *
 * NOT exported from src/index.ts. Requires a live Playwright Page.
 *
 * Usage (run against a live Gemini session before each release):
 *
 *   import { selectorAudit } from './src/utils/selectorAudit';
 *   import { GeminiSelectors } from './src/providers/gemini/selectors';
 *
 *   const report = await selectorAudit(page, GeminiSelectors);
 *   report.forEach(r =>
 *     console.log(r.selector, r.found ? '✓' : '✗', r.visible ? 'visible' : 'hidden')
 *   );
 */
import type { Page } from 'playwright';
import type { ProviderSelectors } from '../types/index';
export interface SelectorAuditEntry {
    /** The ProviderSelectors key, e.g. "inputBox" */
    selector: keyof ProviderSelectors;
    /** The full CSS string value */
    css: string;
    /** Whether at least one element matched the selector */
    found: boolean;
    /** Whether the matched element is visible (only meaningful when found=true) */
    visible: boolean;
}
/**
 * Checks each selector in a ProviderSelectors map against the current page state.
 * Each check is independently timeout-bounded. Throws only if page is null.
 */
export declare function selectorAudit(page: Page, selectors: ProviderSelectors): Promise<SelectorAuditEntry[]>;
//# sourceMappingURL=selectorAudit.d.ts.map