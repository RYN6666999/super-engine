"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageStateInspector = void 0;
const PAGE_CHECK_TIMEOUT_MS = 5_000;
/** Race a promise against a deadline; resolves `undefined` on timeout. */
function withTimeout(p, ms) {
    return Promise.race([
        p,
        new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
    ]);
}
/**
 * Reads and classifies the current state of the provider page.
 * All methods are non-throwing and individually timeout-bounded at 5 000 ms.
 */
class PageStateInspector {
    selectors;
    constructor(selectors) {
        this.selectors = selectors;
    }
    /** Returns true if the login indicator element is present on the page. */
    async isLoggedIn(page) {
        try {
            const el = await withTimeout(page.$(this.selectors.loginIndicator), PAGE_CHECK_TIMEOUT_MS);
            return el != null;
        }
        catch {
            return false;
        }
    }
    /** Returns true if the prompt input box is visible and interactive. */
    async isPageReady(page) {
        try {
            const visible = await withTimeout(page.isVisible(this.selectors.inputBox), PAGE_CHECK_TIMEOUT_MS);
            return visible === true;
        }
        catch {
            return false;
        }
    }
    /** Returns true if a CAPTCHA or login-wall challenge indicator is present. */
    async hasChallenge(page) {
        try {
            const sel = this.selectors.challengeIndicator;
            if (!sel)
                return false;
            const el = await page.$(sel);
            return el != null;
        }
        catch {
            return false;
        }
    }
    /**
     * Returns the classified operational state of the page.
     * Calls all three page checks in parallel; returns 'error' if any throw.
     */
    async detectMode(page) {
        try {
            const challengeSel = this.selectors.challengeIndicator;
            const [loggedIn, ready, challenge] = await Promise.all([
                page.$(this.selectors.loginIndicator),
                page.isVisible(this.selectors.inputBox),
                challengeSel ? page.$(challengeSel) : Promise.resolve(null),
            ]);
            if (loggedIn != null && ready)
                return 'ready';
            if (challenge != null)
                return 'challenge';
            return 'unauthenticated';
        }
        catch {
            return 'error';
        }
    }
}
exports.PageStateInspector = PageStateInspector;
//# sourceMappingURL=PageStateInspector.js.map