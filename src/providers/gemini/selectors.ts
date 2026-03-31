/**
 * Gemini Web UI selectors — versioned here, never hardcoded in modules.
 *
 * These selectors target the Gemini web app as observed in early 2025.
 * They MUST be verified against the live UI before first production use,
 * as Google may change the DOM at any time.
 */
import type { ProviderSelectors } from '../../types/index';

export const GeminiSelectors: ProviderSelectors = {
  // The rich text editor where prompts are typed
  inputBox: 'rich-textarea',
  // Submit button (fallback if Enter key is not used)
  submitButton: 'button[aria-label="Send message"]',
  // Container that holds the model's response text
  outputContainer: '.model-response-text',
  // Button visible while the model is still generating
  stopButton: 'button[aria-label="Stop generating"]',
  // An element only present when the user is authenticated
  loginIndicator: '[data-test-id="user-menu"]',
  // Shown during login-wall or CAPTCHA challenge
  challengeIndicator: '#captcha-container',
  // Pulsing cursor or spinner during active streaming
  streamingIndicator: '.loading-indicator',
} as const;
