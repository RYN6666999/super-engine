import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { BrowserSessionConfig } from '../types/index';
import { DriverNotInitializedError } from '../errors/index';

/**
 * Owns the lifecycle of the Playwright browser, browser context, and page.
 * Does not contain any business logic — pure infrastructure.
 */
export class BrowserSession {
  private _browser: Browser | undefined;
  private _context: BrowserContext | undefined;
  private _page: Page | undefined;
  private _running = false;
  private _id: string;

  constructor(private readonly config: BrowserSessionConfig) {
    this._id = `session-${Date.now()}`;
  }

  /** Unique identifier for this session instance. Refreshed on each launch. */
  get id(): string {
    return this._id;
  }

  async launch(): Promise<void> {
    if (this.config.profileDir) {
      // Persistent context — browser profile keeps session cookies/localStorage
      this._context = await chromium.launchPersistentContext(
        this.config.profileDir,
        { headless: this.config.headless ?? true },
      );
      const pages = this._context.pages();
      this._page = pages[0] ?? await this._context.newPage();
    } else {
      // Ephemeral context — used for smoke tests without a profile
      this._browser = await chromium.launch({ headless: this.config.headless ?? true });
      this._context = await this._browser.newContext();
      this._page = await this._context.newPage();
    }
    this._running = true;
    this._id = `session-${Date.now()}`;
  }

  async close(): Promise<void> {
    this._running = false;
    try {
      await this._context?.close();
    } finally {
      if (this._browser) {
        await this._browser.close().catch(() => { /* best-effort */ });
      }
      this._context = undefined;
      this._page = undefined;
      this._browser = undefined;
    }
  }

  /** Returns the active Page. Throws DriverNotInitializedError if not launched. */
  async getPage(): Promise<Page> {
    if (!this._page || !this._running) {
      throw new DriverNotInitializedError('BrowserSession not launched — call launch() first');
    }
    return this._page;
  }

  isRunning(): boolean {
    return this._running;
  }
}
