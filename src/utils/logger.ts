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

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class DriverLogger {
  constructor(
    private readonly minLevel: LogLevel = 'silent',
    readonly write: (record: LogRecord) => void = (r) => {
      console.error(JSON.stringify(r));
    },
  ) {}

  emit(level: Exclude<LogLevel, 'silent'>, event: DriverLogEvent): void {
    if (LEVEL_RANK[this.minLevel] >= LEVEL_RANK[level]) {
      this.write({
        ...event,
        level,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
