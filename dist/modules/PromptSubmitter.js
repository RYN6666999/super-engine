"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptSubmitter = void 0;
const index_1 = require("../errors/index");
/**
 * Locates the prompt input box, fills it, and submits.
 * Does NOT wait for output — submission only.
 */
class PromptSubmitter {
    selectors;
    constructor(selectors) {
        this.selectors = selectors;
    }
    /**
     * Fills the prompt (and optional system prompt) into the input box and submits.
     * @throws PageNotReadyError if input box is not found.
     * @throws PromptSubmitError if interaction with the input fails.
     */
    async submit(page, prompt) {
        try {
            const input = await page.$(this.selectors.inputBox);
            if (input == null) {
                throw new index_1.PageNotReadyError('Prompt input box not found in the DOM');
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
        }
        catch (e) {
            if (e instanceof index_1.PageNotReadyError)
                throw e;
            throw new index_1.PromptSubmitError(`Failed to submit prompt: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
exports.PromptSubmitter = PromptSubmitter;
//# sourceMappingURL=PromptSubmitter.js.map