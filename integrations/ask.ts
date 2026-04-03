import { GeminiWebDriver, DriverError } from '../src/index';

export interface AskOptions {
  /** Start a fresh conversation (page reload). Default: false. */
  newConversation?: boolean;
  /** Run browser in headed (visible) mode. Default: false (headless). */
  headed?: boolean;
  /** Max ms to wait for a complete response. Default: 30_000. */
  timeoutMs?: number;
}

/**
 * Minimal caller-friendly wrapper around GeminiWebDriver.
 *
 * Reads config from environment:
 *   SMOKE_PROFILE_DIR  — required. Path to a Chrome profile directory.
 *   CHROME_EXECUTABLE  — optional. Path to Chrome binary (needed when profile
 *                        format is incompatible with Playwright's bundled Chromium).
 *
 * Manages the full driver lifecycle (init → generate → shutdown) per call.
 * On a recoverable DriverError, attempts recover() + one retry before throwing.
 * Throws if outputKind !== 'normal'.
 *
 * @returns The model's response text.
 */
export async function ask(prompt: string, opts: AskOptions = {}): Promise<string> {
  const profileDir = process.env['SMOKE_PROFILE_DIR'];
  const executablePath = process.env['CHROME_EXECUTABLE'];

  if (!profileDir) {
    throw new Error(
      'Missing required environment variable: SMOKE_PROFILE_DIR\n' +
        'Set it to your Chrome profile directory, e.g.:\n' +
        '  export SMOKE_PROFILE_DIR="/Users/$USER/Library/Application Support/Google/Chrome/Profile 1"',
    );
  }

  const { newConversation = false, headed = false, timeoutMs = 30_000 } = opts;

  const driver = new GeminiWebDriver({
    providerUrl: 'https://gemini.google.com/app',
    profileDir,
    ...(executablePath !== undefined ? { executablePath } : {}),
    headless: !headed,
    firstTokenTimeoutMs: 30_000,
    stabilityTimeoutMs: 120_000,
    args: ['--no-first-run', '--disable-session-crashed-bubble'],
  });

  await driver.init();

  try {
    let result;

    try {
      result = await driver.generate({ prompt, timeoutMs, newConversation });
    } catch (err) {
      if (err instanceof DriverError && err.recoverable) {
        const recovery = await driver.recover(err.code);
        if (!recovery.ok) {
          throw new Error(`Gemini driver recovery failed (${err.code}): ${recovery.message}`);
        }
        result = await driver.generate({
          prompt,
          timeoutMs,
          newConversation,
          metadata: { retryAfterRecover: true },
        });
      } else {
        throw err;
      }
    }

    if (result.outputKind !== 'normal') {
      throw new Error(`Gemini returned non-normal output (${result.outputKind}): ${result.text}`);
    }

    return result.text;
  } finally {
    await driver.shutdown();
  }
}
