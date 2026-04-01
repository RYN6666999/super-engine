/**
 * Gemini Web UI selectors — versioned here, never hardcoded in modules.
 *
 * These selectors target the Gemini web app as observed in early 2025.
 * They MUST be verified against the live UI before first production use,
 * as Google may change the DOM at any time.
 *
 * Fallback strategy: CSS :is() pseudo-class lists multiple candidate selectors
 * per slot. The browser resolves the first matching alternative, giving
 * resilience without any module code changes.
 *
 * Criticality:
 *   inputBox, outputContainer, loginIndicator  → Critical (operation fails without them)
 *   submitButton, stopButton                   → High (Enter key fallback exists)
 *   challengeIndicator                         → Medium (challenge may be missed)
 *   streamingIndicator                         → Low (stability detection degrades gracefully)
 *
 * Run selectorAudit(page, GeminiSelectors) before each production release to verify.
 */
import type { ProviderSelectors } from '../../types/index';

export const GeminiSelectors: ProviderSelectors = {
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
} as const;

