import type { Page } from 'playwright';
import type { ProviderSelectors } from '../types/index';
import { PageNotReadyError, PromptSubmitError } from '../errors/index';

/**
 * Locates the prompt input box, fills it, and submits.
 * Does NOT wait for output — submission only.
 */
export class PromptSubmitter {
  constructor(private readonly selectors: ProviderSelectors) {}

  /**
   * Fills the prompt (and optional system prompt) into the input box and submits.
   * @throws PageNotReadyError if input box is not found.
   * @throws PromptSubmitError if interaction with the input fails.
   */
  async submit(page: Page, prompt: string, _systemPrompt?: string): Promise<void> {
    try {
      const input = await page.$(this.selectors.inputBox);
      if (input == null) {
        throw new PageNotReadyError('Prompt input box not found in the DOM');
      }
      await page.fill(this.selectors.inputBox, prompt);
      await page.keyboard.press('Enter');
    } catch (e: unknown) {
      if (e instanceof PageNotReadyError) throw e;
      throw new PromptSubmitError(
        `Failed to submit prompt: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
