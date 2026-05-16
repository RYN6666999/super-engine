import type { Page } from 'playwright';
import type { PageMode, ProviderSelectors } from '../types/index';
/**
 * Reads and classifies the current state of the provider page.
 * All methods are non-throwing and individually timeout-bounded at 5 000 ms.
 */
export declare class PageStateInspector {
    private readonly selectors;
    constructor(selectors: ProviderSelectors);
    /** Returns true if the login indicator element is present on the page. */
    isLoggedIn(page: Page): Promise<boolean>;
    /** Returns true if the prompt input box is visible and interactive. */
    isPageReady(page: Page): Promise<boolean>;
    /** Returns true if a CAPTCHA or login-wall challenge indicator is present. */
    hasChallenge(page: Page): Promise<boolean>;
    /**
     * Returns the classified operational state of the page.
     * Calls all three page checks in parallel; returns 'error' if any throw.
     */
    detectMode(page: Page): Promise<PageMode>;
}
//# sourceMappingURL=PageStateInspector.d.ts.map