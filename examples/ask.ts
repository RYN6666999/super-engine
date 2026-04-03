#!/usr/bin/env tsx
/// <reference types="node" />
/**
 * examples/ask.ts — minimal correct caller pattern for weblm-driver
 *
 * Demonstrates:
 *   1. outputKind gate — non-normal output is not treated as a valid model answer
 *   2. recover() only on generate() throw with recoverable === true
 *   3. newConversation explicitly controlled via --new-conversation flag
 *   4. Driver lifecycle: init once → generate / retry → shutdown in finally
 *
 * Usage:
 *   export SMOKE_PROFILE_DIR="/Users/$USER/Library/Application Support/Google/Chrome/Profile 1"
 *   export CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 *
 *   npm run ask -- "Reply only with OK"
 *   npm run ask -- "Summarize in one sentence" --new-conversation
 *   npm run ask -- "Reply only with READY" --headed
 */

import { GeminiWebDriver, DriverError } from '../src/index';

function parseArgs(argv: string[]): { prompt: string; newConversation: boolean; headed: boolean } {
  const args = [...argv];
  const newConversation = args.includes('--new-conversation');
  const headed = args.includes('--headed');

  const filtered = args.filter(
    (arg) => arg !== '--new-conversation' && arg !== '--headed',
  );

  const prompt = filtered.join(' ').trim();

  if (!prompt) {
    console.error('Usage: npm run ask -- "Your prompt here" [--new-conversation] [--headed]');
    process.exit(1);
  }

  return { prompt, newConversation, headed };
}

async function main(): Promise<void> {
  const { prompt, newConversation, headed } = parseArgs(process.argv.slice(2));

  const profileDir = process.env['SMOKE_PROFILE_DIR'];
  const executablePath = process.env['CHROME_EXECUTABLE'];

  if (!profileDir) {
    console.error('Missing required env: SMOKE_PROFILE_DIR');
    process.exit(1);
  }

  const driver = new GeminiWebDriver({
    providerUrl: 'https://gemini.google.com/app',
    profileDir,
    ...(executablePath !== undefined ? { executablePath } : {}),
    headless: !headed,
    firstTokenTimeoutMs: 30_000,
    stabilityTimeoutMs: 120_000,
    // Suppress Chrome restore/crash dialogs when using an existing local profile.
    args: ['--no-first-run', '--disable-session-crashed-bubble'],
  });

  try {
    console.log('→ init()');
    await driver.init();

    console.log('→ generate()');
    let result;

    try {
      result = await driver.generate({
        prompt,
        timeoutMs: 30_000,
        newConversation,
        metadata: { source: 'examples/ask.ts' },
      });
    } catch (error) {
      if (error instanceof DriverError && error.recoverable) {
        console.warn(`generate() failed with recoverable error: ${error.code} — trying recover() once`);

        const recovery = await driver.recover(error.code);
        console.log('→ recover()', { ok: recovery.ok, action: recovery.action, message: recovery.message });

        if (!recovery.ok) {
          console.error('Recovery did not succeed. Exiting.');
          process.exitCode = 1;
          return;
        }

        console.log('→ retry generate()');
        result = await driver.generate({
          prompt,
          timeoutMs: 30_000,
          newConversation,
          metadata: { source: 'examples/ask.ts', retryAfterRecover: true },
        });
      } else {
        throw error;
      }
    }

    console.log('→ outputKind:', result.outputKind);

    if (result.outputKind !== 'normal') {
      console.error('Non-normal output received; not treating as valid model answer.');
      console.error(result.text);
      process.exitCode = 1;
      return;
    }

    console.log('\n=== RESPONSE ===\n');
    console.log(result.text);
    console.log('\n================\n');
  } catch (error) {
    if (error instanceof DriverError) {
      console.error(`DriverError: ${error.code}`);
      console.error(`Recoverable: ${error.recoverable}`);
      console.error(error.message);
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  } finally {
    console.log('→ shutdown()');
    await driver.shutdown().catch((e) => {
      console.error('shutdown() failed:', e);
      process.exitCode = 1;
    });
  }
}

void main();
