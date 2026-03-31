import type { Page } from 'playwright';
import type { PageMode, ProviderSelectors } from '../types/index';

const PAGE_CHECK_TIMEOUT_MS = 5_000;

/** Race a promise against a deadline; resolves `undefined` on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    p,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

/**
 * Reads and classifies the current state of the provider page.
 * All methods are non-throwing and individually timeout-bounded at 5 000 ms.
 */
export class PageStateInspector {
  constructor(private readonly selectors: ProviderSelectors) {}

  /** Returns true if the login indicator element is present on the page. */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      const el = await withTimeout(
        page.$(this.selectors.loginIndicator),
        PAGE_CHECK_TIMEOUT_MS,
      );
      return el != null;
    } catch {
      return false;
    }
  }

  /** Returns true if the prompt input box is visible and interactive. */
  async isPageReady(page: Page): Promise<boolean> {
    try {
      const visible = await withTimeout(
        page.isVisible(this.selectors.inputBox),
        PAGE_CHECK_TIMEOUT_MS,
      );
      return visible === true;
    } catch {
      return false;
    }
  }

  /** Returns true if a CAPTCHA or login-wall challenge indicator is present. */
  async hasChallenge(page: Page): Promise<boolean> {
    try {
      const sel = this.selectors.challengeIndicator;
      if (!sel) return false;
      const el = await page.$(sel);
      return el != null;
    } catch {
      return false;
    }
  }

  /**
   * Returns the classified operational state of the page.
   * Calls all three page checks in parallel; returns 'error' if any throw.
   */
  async detectMode(page: Page): Promise<PageMode> {
    try {
      const challengeSel = this.selectors.challengeIndicator;
      const [loggedIn, ready, challenge] = await Promise.all([
        page.$(this.selectors.loginIndicator),
        page.isVisible(this.selectors.inputBox),
        challengeSel ? page.$(challengeSel) : Promise.resolve(null),
      ]);

      if (loggedIn != null && ready) return 'ready';
      if (challenge != null) return 'challenge';
      return 'unauthenticated';
    } catch {
      return 'error';
    }
  }
}
