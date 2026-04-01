// ─── Driver Config ─────────────────────────────────────────────────────────────

export interface DriverConfig {
  /** Target Web LLM provider page URL. Required. */
  providerUrl: string;
  /** Browser profile directory for persistent sessions. */
  profileDir?: string;
  /** Default: true */
  headless?: boolean;
  /** Max ms to wait for first output token. Default: 30000 */
  firstTokenTimeoutMs?: number;
  /** Max ms to wait for stable output. Default: 120000 */
  stabilityTimeoutMs?: number;
  /** Polling interval for stability check (ms). Default: 1500 */
  stabilityIntervalMs?: number;
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}

// ─── Generate ──────────────────────────────────────────────────────────────────

export interface GenerateInput {
  prompt: string;
  /** Overrides DriverConfig.stabilityTimeoutMs for this call. */
  timeoutMs?: number;
  /**
   * When true, the driver performs a **full page reload** to `DriverConfig.providerUrl`
   * before submitting the prompt, guaranteeing that no prior conversation context
   * is visible to the model.
   *
   * Implementation detail: uses `page.goto()` — not a UI "New chat" button click.
   * This adds latency (one extra navigation round-trip, up to ~15 s for networkidle).
   * A networkidle timeout does NOT cause generate() to fail; the page is still
   * considered usable once goto() returns.
   *
   * When false or omitted, the current conversation thread is preserved.
   * Default: false.
   */
  newConversation?: boolean;
  /**
   * Opaque caller-defined data. The driver NEVER reads, parses, or acts on
   * this field. It is echoed unchanged into GenerateOutput.metadata.
   */
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Classification of a provider's output text.
 * - `normal`         — substantive response text from the model.
 * - `provider-error` — the provider returned a UI-level error message
 *                      (e.g. "Something went wrong"). The driver detected this
 *                      via known patterns; text is still available in `.text`.
 * - `unknown`        — could not confidently classify the output.
 */
export type OutputKind = 'normal' | 'provider-error' | 'unknown';

export interface GenerateOutput {
  text: string;
  startedAt: Date;
  completedAt: Date;
  /** Provider identifier, e.g. "gemini-web". */
  provider: string;
  /** Browser session ID for this generation. */
  sessionId: string;
  /**
   * Classification of the output text.
   * Callers SHOULD check this before treating `.text` as a real model response.
   */
  outputKind: OutputKind;
  /**
   * Echoed from GenerateInput.metadata unchanged.
   * Undefined if caller did not supply metadata.
   */
  metadata?: Readonly<Record<string, unknown>>;
}

// ─── Health ────────────────────────────────────────────────────────────────────

export type DriverMode =
  | 'idle'
  | 'generating'
  | 'recovering'
  | 'degraded'
  | 'shutdown';

export interface DriverHealth {
  /** true only when all five critical dimensions are true. */
  ok: boolean;
  /** init() has completed successfully at least once. */
  initialized: boolean;
  /** Browser process is running and responsive. */
  browserRunning: boolean;
  /** Provider page is open and input box is visible. */
  pageReady: boolean;
  /** Provider page reflects a valid logged-in session. */
  authenticated: boolean;
  /** Provider domain is reachable at network level. */
  providerReachable: boolean;
  mode: DriverMode;
  /** Last known error message, if any. Cleared on successful recover()/init(). */
  lastError?: string;
  /**
   * Machine-readable code of the last known error, if any.
   * Present only when the error was a typed DriverError subclass.
   * Absent (undefined) for generic/non-typed errors or when no error has occurred.
   * Cleared on successful recover()/init().
   */
  lastErrorCode?: string;
}

// ─── Recovery ──────────────────────────────────────────────────────────────────

export type RecoveryAction =
  | 'none'
  | 'refresh-page'
  | 'reopen-page'
  | 'restart-browser'
  | 'rebuild-session';

export interface RecoveryResult {
  ok: boolean;
  action: RecoveryAction;
  message: string;
}

// ─── WebLLMDriver Interface ────────────────────────────────────────────────────

export interface WebLLMDriver {
  init(): Promise<void>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
  health(): Promise<DriverHealth>;
  recover(reason?: string): Promise<RecoveryResult>;
  shutdown(): Promise<void>;
}

// ─── Provider Selectors ────────────────────────────────────────────────────────

export interface ProviderSelectors {
  /** CSS selector for the prompt input box. */
  inputBox: string;
  /** CSS selector for the submit button (optional if Enter key is used). */
  submitButton?: string;
  /** CSS selector for the output text container. */
  outputContainer: string;
  /** CSS selector for the "stop generating" button. */
  stopButton: string;
  /** CSS selector that is present when the user is logged in. */
  loginIndicator: string;
  /** CSS selector that appears during CAPTCHA / auth challenge. */
  challengeIndicator?: string;
  /** CSS selector for any streaming cursor or spinner. */
  streamingIndicator?: string;
  /** CSS selector for the "New chat" / compose button. Used when newConversation:true. */
  newChatButton?: string;
}

// ─── Capture Config ────────────────────────────────────────────────────────────

export interface CaptureConfig {
  /** Max ms to wait for first output token. */
  firstTokenTimeoutMs: number;
  /** Max ms to wait for stable final output from submission start. */
  stabilityTimeoutMs: number;
  /** Polling interval for DOM stability comparison (ms). */
  stabilityIntervalMs: number;
}

// ─── Internal Capture Result ───────────────────────────────────────────────────

export interface CaptureResult {
  text: string;
  startedAt: Date;
  completedAt: Date;
  /** true only when returned as part of a TimeoutError — never on success path. */
  partial?: true;
}

// ─── Browser Session Config ────────────────────────────────────────────────────

export interface BrowserSessionConfig {
  providerUrl: string;
  profileDir?: string;
  headless?: boolean;
}

// ─── Page Mode ─────────────────────────────────────────────────────────────────

export type PageMode =
  | 'ready'
  | 'unauthenticated'
  | 'challenge'
  | 'error'
  | 'loading';
