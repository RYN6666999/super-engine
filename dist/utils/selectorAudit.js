"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectorAudit = selectorAudit;
/**
 * Checks each selector in a ProviderSelectors map against the current page state.
 * Each check is independently timeout-bounded. Throws only if page is null.
 */
async function selectorAudit(page, selectors) {
    const entries = Object.entries(selectors);
    return Promise.all(entries.map(async ([key, css]) => {
        try {
            const el = await page.$(css).catch(() => null);
            const found = el !== null;
            const visible = found
                ? await page.isVisible(css).catch(() => false)
                : false;
            return { selector: key, css, found, visible };
        }
        catch {
            return { selector: key, css, found: false, visible: false };
        }
    }));
}
//# sourceMappingURL=selectorAudit.js.map