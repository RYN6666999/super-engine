export declare abstract class DriverError extends Error {
    abstract readonly code: string;
    abstract readonly recoverable: boolean;
    readonly timestamp: Date;
    readonly context?: Readonly<Record<string, unknown>>;
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * generate() / health() / recover() called before init() succeeded.
 */
export declare class DriverNotInitializedError extends DriverError {
    readonly code: "DRIVER_NOT_INITIALIZED";
    readonly recoverable: false;
}
/**
 * Provider page session has expired or is otherwise unauthenticated.
 */
export declare class AuthenticationRequiredError extends DriverError {
    readonly code: "AUTH_REQUIRED";
    readonly recoverable: true;
}
/**
 * Provider page is loaded but required interactive elements are absent.
 */
export declare class PageNotReadyError extends DriverError {
    readonly code: "PAGE_NOT_READY";
    readonly recoverable: true;
}
/**
 * Failed to locate or interact with the prompt input box.
 */
export declare class PromptSubmitError extends DriverError {
    readonly code: "PROMPT_SUBMIT_FAILED";
    readonly recoverable: true;
}
/**
 * Output capture pipeline failed (e.g. output element not found, empty output).
 */
export declare class OutputCaptureError extends DriverError {
    readonly code: "OUTPUT_CAPTURE_FAILED";
    readonly recoverable: true;
}
/**
 * An operation did not complete within its allotted time.
 * `partial` holds any text captured before the timeout, if available.
 */
export declare class TimeoutError extends DriverError {
    readonly code: "TIMEOUT";
    readonly recoverable: true;
    /** Text captured up to the point of timeout, if any. */
    readonly partial?: string;
    readonly elapsedMs: number;
    constructor(message: string, elapsedMs: number, partial?: string, context?: Record<string, unknown>);
}
/**
 * generate() was called while a generation was already in progress.
 * The driver serialises output capture per session; callers must await the
 * first generate() before issuing a second one.
 */
export declare class ConcurrentGenerationError extends DriverError {
    readonly code: "CONCURRENT_GENERATION";
    readonly recoverable: false;
}
/**
 * All recovery actions were attempted and none restored driver health.
 */
export declare class RecoveryFailedError extends DriverError {
    readonly code: "RECOVERY_FAILED";
    readonly recoverable: false;
    /** Ordered log of each recovery action attempted and its outcome. */
    readonly attemptsLog: readonly string[];
    constructor(message: string, attemptsLog: string[], context?: Record<string, unknown>);
}
//# sourceMappingURL=index.d.ts.map