"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiSelectors = void 0;
exports.GeminiSelectors = {
    // Rich text input area where prompts are typed.
    // Fallbacks: data-testid attribute variant, generic contenteditable editor.
    inputBox: ':is(rich-textarea, [data-testid="prompt-textarea"], .ql-editor[contenteditable="true"])',
    // Submit button — Enter key is also used as primary submission path.
    // Fallbacks: aria-label variations observed in different locales/builds.
    submitButton: ':is(button[aria-label="Send message"], button[aria-label="Submit"], button[data-testid="send-button"])',
    // Container element holding the model's response text.
    // [class*="model-response"] targets model-response-text and siblings.
    // Fallbacks: markdown panel, generic response content container.
    outputContainer: ':is([class*="model-response"], .markdown-main-panel, .response-content)',
    // Button visible while the model is still generating output.
    // 停止回覆 = Chinese locale aria-label observed on gemini.google.com.
    // Fallbacks: English labels, data-testid variant.
    stopButton: ':is(button[aria-label="停止回覆"], button[aria-label="Stop generating"], button[aria-label="Stop response"], button[data-testid="stop-button"])',
    // Element present only when the user has an authenticated session.
    // Fallbacks: profile photo alt text, user avatar container.
    loginIndicator: ':is([data-test-id="user-menu"], img[alt*="profile photo"], img[alt*="個人資料相片"], .user-avatar, .user-icon)',
    // Shown during login-wall, CAPTCHA, or identity challenge flows.
    // Fallbacks: reCAPTCHA attribute, generic challenge container.
    challengeIndicator: ':is(#captcha-container, [data-recaptcha-challenge-type], .challenge-container)',
    // Pulsing cursor or spinner indicating active output streaming.
    // Fallbacks: aria-busy attribute, thinking/loading indicator classes.
    streamingIndicator: ':is(.loading-indicator, [aria-busy="true"], .thinking-indicator)',
    // "New chat" / compose button — used when GenerateInput.newConversation:true.
    // Fallbacks: pencil/compose icon variants, data-testid, aria-label across locales.
    newChatButton: ':is(button[aria-label="New chat"], button[aria-label="新對話"], a[aria-label="New chat"], [data-testid="new-chat-button"], .new-chat-button)',
};
//# sourceMappingURL=selectors.js.map