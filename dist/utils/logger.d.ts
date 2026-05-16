/**
 * DriverLogger — minimal structured logger for the driver core.
 *
 * Internal utility. NOT exported from src/index.ts.
 * Emits JSON-Lines records to process.stderr (or an injected write function).
 *
 * Security: NEVER log prompt text, model output, cookies, auth tokens,
 * or file paths. See observability spec for the allowed field list.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
export interface DriverLogEvent {
    event: string;
    sessionId?: string;
    /** Echoed from GenerateInput.metadata.requestId when string-typed. */
    requestId?: string;
    durationMs?: number;
    errorCode?: string;
    recoverable?: boolean;
    action?: string;
    selectorName?: string;
    /** Classification of the generated output (present on driver.generate.succeeded). */
    outputKind?: string;
    /**
     * Name of the matched provider-error pattern (present on driver.generate.succeeded
     * only when outputKind === 'provider-error'). Internal diagnostic label.
     */
    matchedPattern?: string;
}
export interface LogRecord extends DriverLogEvent {
    timestamp: string;
    level: string;
}
export declare class DriverLogger {
    private readonly minLevel;
    readonly write: (record: LogRecord) => void;
    constructor(minLevel?: LogLevel, write?: (record: LogRecord) => void);
    emit(level: Exclude<LogLevel, 'silent'>, event: DriverLogEvent): void;
}
//# sourceMappingURL=logger.d.ts.map