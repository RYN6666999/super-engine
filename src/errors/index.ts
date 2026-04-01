// ─── Base Error ────────────────────────────────────────────────────────────────

export abstract class DriverError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
  readonly timestamp: Date;
  readonly context?: Readonly<Record<string, unknown>>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    if (context !== undefined) this.context = context;
    // Maintain correct instanceof chain across transpilation boundaries.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Concrete Errors ───────────────────────────────────────────────────────────

/**
 * generate() / health() / recover() called before init() succeeded.
 */
export class DriverNotInitializedError extends DriverError {
  readonly code = 'DRIVER_NOT_INITIALIZED' as const;
  readonly recoverable = false as const;
}

/**
 * Provider page session has expired or is otherwise unauthenticated.
 */
export class AuthenticationRequiredError extends DriverError {
  readonly code = 'AUTH_REQUIRED' as const;
  readonly recoverable = true as const;
}

/**
 * Provider page is loaded but required interactive elements are absent.
 */
export class PageNotReadyError extends DriverError {
  readonly code = 'PAGE_NOT_READY' as const;
  readonly recoverable = true as const;
}

/**
 * Failed to locate or interact with the prompt input box.
 */
export class PromptSubmitError extends DriverError {
  readonly code = 'PROMPT_SUBMIT_FAILED' as const;
  readonly recoverable = true as const;
}

/**
 * Output capture pipeline failed (e.g. output element not found, empty output).
 */
export class OutputCaptureError extends DriverError {
  readonly code = 'OUTPUT_CAPTURE_FAILED' as const;
  readonly recoverable = true as const;
}

/**
 * An operation did not complete within its allotted time.
 * `partial` holds any text captured before the timeout, if available.
 */
export class TimeoutError extends DriverError {
  readonly code = 'TIMEOUT' as const;
  readonly recoverable = true as const;
  /** Text captured up to the point of timeout, if any. */
  readonly partial?: string;
  readonly elapsedMs: number;

  constructor(
    message: string,
    elapsedMs: number,
    partial?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, context);
    this.elapsedMs = elapsedMs;
    if (partial !== undefined) this.partial = partial;
  }
}

/**
 * generate() was called while a generation was already in progress.
 * The driver serialises output capture per session; callers must await the
 * first generate() before issuing a second one.
 */
export class ConcurrentGenerationError extends DriverError {
  readonly code = 'CONCURRENT_GENERATION' as const;
  readonly recoverable = false as const;
}

/**
 * All recovery actions were attempted and none restored driver health.
 */
export class RecoveryFailedError extends DriverError {
  readonly code = 'RECOVERY_FAILED' as const;
  readonly recoverable = false as const;
  /** Ordered log of each recovery action attempted and its outcome. */
  readonly attemptsLog: readonly string[];

  constructor(
    message: string,
    attemptsLog: string[],
    context?: Record<string, unknown>,
  ) {
    super(message, context);
    this.attemptsLog = attemptsLog;
  }
}
