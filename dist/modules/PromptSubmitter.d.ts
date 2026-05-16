import type { Page } from 'playwright';
import type { ProviderSelectors } from '../types/index';
/**
 * Locates the prompt input box, fills it, and submits.
 * Does NOT wait for output — submission only.
 */
export declare class PromptSubmitter {
    private readonly selectors;
    constructor(selectors: ProviderSelectors);
    /**
     * Fills the prompt (and optional system prompt) into the input box and submits.
     * @throws PageNotReadyError if input box is not found.
     * @throws PromptSubmitError if interaction with the input fails.
     */
    submit(page: Page, prompt: string): Promise<void>;
}
//# sourceMappingURL=PromptSubmitter.d.ts.map