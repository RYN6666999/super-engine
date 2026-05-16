"use strict";
// ─── Base Error ────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryFailedError = exports.ConcurrentGenerationError = exports.TimeoutError = exports.OutputCaptureError = exports.PromptSubmitError = exports.PageNotReadyError = exports.AuthenticationRequiredError = exports.DriverNotInitializedError = exports.DriverError = void 0;
class DriverError extends Error {
    timestamp;
    context;
    constructor(message, context) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        if (context !== undefined)
            this.context = context;
        // Maintain correct instanceof chain across transpilation boundaries.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.DriverError = DriverError;
// ─── Concrete Errors ───────────────────────────────────────────────────────────
/**
 * generate() / health() / recover() called before init() succeeded.
 */
class DriverNotInitializedError extends DriverError {
    code = 'DRIVER_NOT_INITIALIZED';
    recoverable = false;
}
exports.DriverNotInitializedError = DriverNotInitializedError;
/**
 * Provider page session has expired or is otherwise unauthenticated.
 */
class AuthenticationRequiredError extends DriverError {
    code = 'AUTH_REQUIRED';
    recoverable = true;
}
exports.AuthenticationRequiredError = AuthenticationRequiredError;
/**
 * Provider page is loaded but required interactive elements are absent.
 */
class PageNotReadyError extends DriverError {
    code = 'PAGE_NOT_READY';
    recoverable = true;
}
exports.PageNotReadyError = PageNotReadyError;
/**
 * Failed to locate or interact with the prompt input box.
 */
class PromptSubmitError extends DriverError {
    code = 'PROMPT_SUBMIT_FAILED';
    recoverable = true;
}
exports.PromptSubmitError = PromptSubmitError;
/**
 * Output capture pipeline failed (e.g. output element not found, empty output).
 */
class OutputCaptureError extends DriverError {
    code = 'OUTPUT_CAPTURE_FAILED';
    recoverable = true;
}
exports.OutputCaptureError = OutputCaptureError;
/**
 * An operation did not complete within its allotted time.
 * `partial` holds any text captured before the timeout, if available.
 */
class TimeoutError extends DriverError {
    code = 'TIMEOUT';
    recoverable = true;
    /** Text captured up to the point of timeout, if any. */
    partial;
    elapsedMs;
    constructor(message, elapsedMs, partial, context) {
        super(message, context);
        this.elapsedMs = elapsedMs;
        if (partial !== undefined)
            this.partial = partial;
    }
}
exports.TimeoutError = TimeoutError;
/**
 * generate() was called while a generation was already in progress.
 * The driver serialises output capture per session; callers must await the
 * first generate() before issuing a second one.
 */
class ConcurrentGenerationError extends DriverError {
    code = 'CONCURRENT_GENERATION';
    recoverable = false;
}
exports.ConcurrentGenerationError = ConcurrentGenerationError;
/**
 * All recovery actions were attempted and none restored driver health.
 */
class RecoveryFailedError extends DriverError {
    code = 'RECOVERY_FAILED';
    recoverable = false;
    /** Ordered log of each recovery action attempted and its outcome. */
    attemptsLog;
    constructor(message, attemptsLog, context) {
        super(message, context);
        this.attemptsLog = attemptsLog;
    }
}
exports.RecoveryFailedError = RecoveryFailedError;
//# sourceMappingURL=index.js.map