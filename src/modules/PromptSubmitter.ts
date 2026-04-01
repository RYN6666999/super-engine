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
      // rich-textarea wraps a contenteditable .ql-editor div.
      // page.fill() only works on <input>/<textarea>/[contenteditable].
      // Strategy: click the wrapper to focus, then use insertText to type into
      // whatever inner contenteditable gains focus.
      await page.click(this.selectors.inputBox);
      // Clear any existing content first (Ctrl+A then Delete)
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      // insertText fires an input event, which rich-textarea / Quill handles correctly
      await page.keyboard.insertText(prompt);
      await page.keyboard.press('Enter');
    } catch (e: unknown) {
      if (e instanceof PageNotReadyError) throw e;
      throw new PromptSubmitError(
        `Failed to submit prompt: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
