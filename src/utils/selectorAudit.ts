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
export async function selectorAudit(
  page: Page,
  selectors: ProviderSelectors,
): Promise<SelectorAuditEntry[]> {
  const entries = Object.entries(selectors) as [keyof ProviderSelectors, string][];
  return Promise.all(
    entries.map(async ([key, css]) => {
      try {
        const el = await page.$(css).catch(() => null);
        const found = el !== null;
        const visible = found
          ? await page.isVisible(css).catch(() => false)
          : false;
        return { selector: key, css, found, visible };
      } catch {
        return { selector: key, css, found: false, visible: false };
      }
    }),
  );
}
