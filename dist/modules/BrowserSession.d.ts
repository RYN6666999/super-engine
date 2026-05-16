import type { Page } from 'playwright';
import type { BrowserSessionConfig } from '../types/index';
/**
 * Owns the lifecycle of the Playwright browser, browser context, and page.
 * Does not contain any business logic — pure infrastructure.
 */
export declare class BrowserSession {
    private readonly config;
    private _browser;
    private _context;
    private _page;
    private _running;
    private _id;
    constructor(config: BrowserSessionConfig);
    /** Unique identifier for this session instance. Refreshed on each launch. */
    get id(): string;
    launch(): Promise<void>;
    close(): Promise<void>;
    /** Returns the active Page. Throws DriverNotInitializedError if not launched. */
    getPage(): Promise<Page>;
    isRunning(): boolean;
}
//# sourceMappingURL=BrowserSession.d.ts.map