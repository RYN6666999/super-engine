"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserSession = void 0;
const playwright_1 = require("playwright");
const index_1 = require("../errors/index");
/**
 * Owns the lifecycle of the Playwright browser, browser context, and page.
 * Does not contain any business logic — pure infrastructure.
 */
class BrowserSession {
    config;
    _browser;
    _context;
    _page;
    _running = false;
    _id;
    constructor(config) {
        this.config = config;
        this._id = `session-${Date.now()}`;
    }
    /** Unique identifier for this session instance. Refreshed on each launch. */
    get id() {
        return this._id;
    }
    async launch() {
        const executablePath = this.config.executablePath;
        const args = this.config.args;
        if (this.config.profileDir) {
            // Persistent context — browser profile keeps session cookies/localStorage
            this._context = await playwright_1.chromium.launchPersistentContext(this.config.profileDir, {
                headless: this.config.headless ?? true,
                ...(executablePath !== undefined ? { executablePath } : {}),
                ...(args !== undefined ? { args } : {}),
            });
            const pages = this._context.pages();
            this._page = pages[0] ?? await this._context.newPage();
        }
        else {
            // Ephemeral context — used for smoke tests without a profile
            this._browser = await playwright_1.chromium.launch({
                headless: this.config.headless ?? true,
                ...(executablePath !== undefined ? { executablePath } : {}),
                ...(args !== undefined ? { args } : {}),
            });
            this._context = await this._browser.newContext();
            this._page = await this._context.newPage();
        }
        this._running = true;
        this._id = `session-${Date.now()}`;
    }
    async close() {
        this._running = false;
        try {
            await this._context?.close();
        }
        finally {
            if (this._browser) {
                await this._browser.close().catch(() => { });
            }
            this._context = undefined;
            this._page = undefined;
            this._browser = undefined;
        }
    }
    /** Returns the active Page. Throws DriverNotInitializedError if not launched. */
    async getPage() {
        if (!this._page || !this._running) {
            throw new index_1.DriverNotInitializedError('BrowserSession not launched — call launch() first');
        }
        return this._page;
    }
    isRunning() {
        return this._running;
    }
}
exports.BrowserSession = BrowserSession;
//# sourceMappingURL=BrowserSession.js.map