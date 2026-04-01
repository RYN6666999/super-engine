import { describe, it, expect } from 'vitest';
import { classifyGeminiOutput } from '../../src/providers/gemini/outputClassifier';

// ─── outputClassifier ──────────────────────────────────────────────────────────

describe('classifyGeminiOutput', () => {
  // ── normal ──────────────────────────────────────────────────────────────────

  describe('normal outputs', () => {
    it('classifies a substantive response as normal', () => {
      expect(classifyGeminiOutput('The capital of France is Paris.')).toEqual({ kind: 'normal' });
    });

    it('classifies multi-sentence response as normal', () => {
      const text = 'TypeScript is a strongly typed superset of JavaScript. It compiles to plain JS.';
      expect(classifyGeminiOutput(text)).toEqual({ kind: 'normal' });
    });

    it('classifies long text as normal even if it contains error keywords', () => {
      // Long response discussing errors — should NOT be flagged as provider-error
      const long = 'a'.repeat(301) + ' something went wrong in the algorithm, here is how to fix it';
      expect(classifyGeminiOutput(long)).toEqual({ kind: 'normal' });
    });

    it('classifies text with "try again" in a long explanation as normal', () => {
      const long = 'When debugging, you should try again with different inputs. '.repeat(6);
      expect(classifyGeminiOutput(long)).toEqual({ kind: 'normal' });
    });

    it('does not include matchedPattern when kind is normal', () => {
      const result = classifyGeminiOutput('This is a normal response.');
      expect(result.matchedPattern).toBeUndefined();
    });
  });

  // ── provider-error ───────────────────────────────────────────────────────────

  describe('provider-error outputs', () => {
    it('classifies "Something went wrong" as provider-error with pattern "generic-error"', () => {
      expect(classifyGeminiOutput('Something went wrong')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'generic-error',
      });
    });

    it('classifies "Something went wrong. Please try again." as provider-error with pattern "generic-error"', () => {
      expect(classifyGeminiOutput('Something went wrong. Please try again.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'generic-error',
      });
    });

    it('classifies "Too many requests" as provider-error with pattern "rate-limit"', () => {
      expect(classifyGeminiOutput('Too many requests')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'rate-limit',
      });
    });

    it('classifies quota-reached message as provider-error with pattern "quota-reached"', () => {
      expect(classifyGeminiOutput("You've reached your limit for today.")).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'quota-reached',
      });
    });

    it('classifies quota exceeded message as provider-error with pattern "quota-exceeded"', () => {
      expect(classifyGeminiOutput('Quota exceeded for this model.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'quota-exceeded',
      });
    });

    it('classifies daily limit message as provider-error with pattern "daily-limit"', () => {
      expect(classifyGeminiOutput('You have reached the daily limit.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'daily-limit',
      });
    });

    it('classifies service unavailable message as provider-error with pattern "service-unavailable"', () => {
      expect(classifyGeminiOutput('Service is unavailable right now.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'service-unavailable',
      });
    });

    it('classifies temporarily unavailable message as provider-error with pattern "temporarily-unavailable"', () => {
      expect(classifyGeminiOutput('Gemini is temporarily unavailable.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'temporarily-unavailable',
      });
    });

    it('classifies try-again-later message as provider-error with pattern "try-again-later"', () => {
      expect(classifyGeminiOutput('Please try again later.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'try-again-later',
      });
    });

    it('classifies session expired message as provider-error with pattern "session-expired"', () => {
      expect(classifyGeminiOutput('Your session has expired.')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'session-expired',
      });
    });

    it('classifies short numeric error code as provider-error with pattern "error-code"', () => {
      expect(classifyGeminiOutput('Error 429')).toMatchObject({
        kind: 'provider-error',
        matchedPattern: 'error-code',
      });
    });

    it('is case-insensitive for error patterns', () => {
      expect(classifyGeminiOutput('SOMETHING WENT WRONG')).toMatchObject({ kind: 'provider-error' });
      expect(classifyGeminiOutput('too many requests')).toMatchObject({ kind: 'provider-error' });
    });

    it('always includes matchedPattern when kind is provider-error', () => {
      const result = classifyGeminiOutput('Something went wrong');
      expect(result.matchedPattern).toBeDefined();
      expect(typeof result.matchedPattern).toBe('string');
    });
  });

  // ── unknown ──────────────────────────────────────────────────────────────────

  describe('unknown outputs', () => {
    it('classifies empty string as unknown', () => {
      expect(classifyGeminiOutput('')).toEqual({ kind: 'unknown' });
    });

    it('classifies whitespace-only string as unknown', () => {
      expect(classifyGeminiOutput('   \n  ')).toEqual({ kind: 'unknown' });
    });

    it('does not include matchedPattern when kind is unknown', () => {
      const result = classifyGeminiOutput('');
      expect(result.matchedPattern).toBeUndefined();
    });
  });
});
