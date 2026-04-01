import type { OutputKind } from '../../types/index';

/**
 * Known Gemini UI-level error patterns.
 *
 * Each entry has a stable `name` used as a diagnostic label in log events,
 * and a `pattern` matched case-insensitively. Patterns are deliberately narrow
 * to avoid false positives on legitimate AI responses that discuss errors.
 *
 * Names are internal — not part of the public API surface.
 */
const PROVIDER_ERROR_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  // Generic Gemini UI error banner
  { name: 'generic-error',            pattern: /something went wrong/i },
  // Rate-limit / quota exhaustion
  { name: 'rate-limit',               pattern: /too many requests/i },
  { name: 'quota-reached',            pattern: /you've reached your limit/i },
  { name: 'quota-exceeded',           pattern: /quota exceeded/i },
  { name: 'daily-limit',              pattern: /daily limit/i },
  // Availability issues
  { name: 'service-unavailable',      pattern: /service (is )?unavailable/i },
  { name: 'temporarily-unavailable',  pattern: /temporarily unavailable/i },
  { name: 'try-again-later',          pattern: /try again later/i },
  // Auth / session expiry (UI-level, not model)
  { name: 'session-expired',          pattern: /session (has )?expired/i },
  // Short-form error codes that appear in Gemini error overlays
  { name: 'error-code',               pattern: /^error \d{3}$/i },
];

/**
 * Internal result of classifying a Gemini provider output.
 * NOT exported from the public package index.
 *
 * - `kind`           — the OutputKind classification.
 * - `matchedPattern` — the name of the first matching error pattern.
 *                      Present only when `kind === 'provider-error'`.
 */
export interface ClassifyResult {
  kind: OutputKind;
  matchedPattern?: string;
}

/**
 * Classifies raw output text from the Gemini provider.
 *
 * Returns `provider-error` only when the text is short (< 300 chars) AND
 * matches a known UI error pattern. Long text is always `normal` — a
 * substantive model response won't be flagged even if it discusses errors.
 *
 * @param text - The raw `.text` captured by OutputCapture.capture().
 * @returns ClassifyResult with `kind` and, on provider-error, `matchedPattern`.
 */
export function classifyGeminiOutput(text: string): ClassifyResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { kind: 'unknown' };
  }

  // Only run pattern matching on short strings — long responses are real output.
  if (trimmed.length < 300) {
    for (const { name, pattern } of PROVIDER_ERROR_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { kind: 'provider-error', matchedPattern: name };
      }
    }
  }

  return { kind: 'normal' };
}
