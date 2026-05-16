import type { OutputKind } from '../../types/index';
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
export declare function classifyGeminiOutput(text: string): ClassifyResult;
//# sourceMappingURL=outputClassifier.d.ts.map