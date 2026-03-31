import type {
  BrowserSessionConfig,
  CaptureConfig,
  DriverConfig,
  DriverHealth,
  DriverMode,
  GenerateInput,
  GenerateOutput,
  RecoveryResult,
  WebLLMDriver,
} from '../types/index';
import { AuthenticationRequiredError, DriverError, DriverNotInitializedError, TimeoutError } from '../errors/index';
import { BrowserSession } from '../modules/BrowserSession';
import { PageStateInspector } from '../modules/PageStateInspector';
import { PromptSubmitter } from '../modules/PromptSubmitter';
import { OutputCapture } from '../modules/OutputCapture';
import { RecoveryManager } from '../modules/RecoveryManager';
import { GeminiSelectors } from '../providers/gemini/selectors';
import { DriverLogger } from '../utils/logger';

/** Optional dependency injection — used in unit tests to inject mocked modules. */
export interface GeminiWebDriverDeps {
  session: BrowserSession;
  inspector: PageStateInspector;
  submitter: PromptSubmitter;
  capture: OutputCapture;
  recovery: RecoveryManager;
  /** Optional logger override — inject in tests to capture log events. */
  logger?: DriverLogger;
}

/**
 * Concrete implementation of WebLLMDriver for the Gemini Web provider.
 * Wires BrowserSession, PageStateInspector, PromptSubmitter, OutputCapture,
 * and RecoveryManager together. Contains no application or business logic.
 */
export class GeminiWebDriver implements WebLLMDriver {
  private _initialized = false;
  private _mode: DriverMode = 'idle';
  private _lastError: string | undefined = undefined;

  private readonly session: BrowserSession;
  private readonly inspector: PageStateInspector;
  private readonly submitter: PromptSubmitter;
  private readonly capture: OutputCapture;
  private readonly recovery: RecoveryManager;
  private readonly logger: DriverLogger;

  constructor(private readonly config: DriverConfig, deps?: GeminiWebDriverDeps) {
    const sessionConfig: BrowserSessionConfig = {
      providerUrl: config.providerUrl,
      ...(config.profileDir !== undefined ? { profileDir: config.profileDir } : {}),
      ...(config.headless !== undefined ? { headless: config.headless } : {}),
    };
    const captureConfig: CaptureConfig = {
      firstTokenTimeoutMs: config.firstTokenTimeoutMs ?? 30_000,
      stabilityTimeoutMs: config.stabilityTimeoutMs ?? 120_000,
      stabilityIntervalMs: config.stabilityIntervalMs ?? 1_500,
    };

    if (deps) {
      this.session = deps.session;
      this.inspector = deps.inspector;
      this.submitter = deps.submitter;
      this.capture = deps.capture;
      this.recovery = deps.recovery;
      this.logger = deps.logger ?? new DriverLogger(config.logLevel ?? 'silent');
    } else {
      this.session = new BrowserSession(sessionConfig);
      this.inspector = new PageStateInspector(GeminiSelectors);
      this.submitter = new PromptSubmitter(GeminiSelectors);
      this.capture = new OutputCapture(GeminiSelectors, captureConfig);
      this.recovery = new RecoveryManager(this.session, this.inspector, sessionConfig);
      this.logger = new DriverLogger(config.logLevel ?? 'silent');
    }
  }

  async init(): Promise<void> {
    const startMs = Date.now();
    this.logger.emit('info', { event: 'driver.init.started', sessionId: this.session.id });
    try {
      await this.session.launch();
      const page = await this.session.getPage();
      await page.goto(this.config.providerUrl);
      const mode = await this.inspector.detectMode(page);
      if (mode === 'unauthenticated' || mode === 'challenge') {
        this.logger.emit('warn', { event: 'driver.auth.required', sessionId: this.session.id });
        throw new AuthenticationRequiredError(
          'Provider page requires authentication — launch with a valid browser profile',
        );
      }
      this._initialized = true;
      this._lastError = undefined;
      this.logger.emit('info', {
        event: 'driver.init.succeeded',
        sessionId: this.session.id,
        durationMs: Date.now() - startMs,
      });
    } catch (e: unknown) {
      if (!(e instanceof AuthenticationRequiredError)) {
        const isDriverError = e instanceof DriverError;
        this.logger.emit('error', {
          event: 'driver.init.failed',
          sessionId: this.session.id,
          durationMs: Date.now() - startMs,
          ...(isDriverError ? { errorCode: e.code, recoverable: e.recoverable } : {}),
        });
      }
      throw e;
    }
  }

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (!this._initialized) {
      throw new DriverNotInitializedError('Call init() before generate()');
    }
    const startMs = Date.now();
    const requestId =
      typeof input.metadata?.['requestId'] === 'string'
        ? input.metadata['requestId']
        : undefined;
    this.logger.emit('info', {
      event: 'driver.generate.started',
      sessionId: this.session.id,
      ...(requestId !== undefined ? { requestId } : {}),
    });
    this._mode = 'generating';
    try {
      const page = await this.session.getPage();
      await this.submitter.submit(page, input.prompt, input.systemPrompt);
      const result = await this.capture.capture(page, input.timeoutMs);
      this._mode = 'idle';
      this.logger.emit('info', {
        event: 'driver.generate.succeeded',
        sessionId: this.session.id,
        durationMs: Date.now() - startMs,
        ...(requestId !== undefined ? { requestId } : {}),
      });
      return {
        text: result.text,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        provider: 'gemini-web',
        sessionId: this.session.id,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      };
    } catch (e: unknown) {
      this._mode = 'degraded';
      this._lastError = e instanceof Error ? e.message : String(e);
      if (e instanceof TimeoutError) {
        this.logger.emit('warn', {
          event: 'driver.capture.timeout',
          sessionId: this.session.id,
          durationMs: e.elapsedMs,
          errorCode: e.code,
          recoverable: e.recoverable,
          ...(requestId !== undefined ? { requestId } : {}),
        });
      } else {
        const isDriverError = e instanceof DriverError;
        this.logger.emit('error', {
          event: 'driver.generate.failed',
          sessionId: this.session.id,
          durationMs: Date.now() - startMs,
          ...(isDriverError ? { errorCode: e.code, recoverable: e.recoverable } : {}),
          ...(requestId !== undefined ? { requestId } : {}),
        });
      }
      throw e;
    }
  }

  async health(): Promise<DriverHealth> {
    try {
      const browserRunning = this.session.isRunning();
      let pageReady = false;
      let authenticated = false;

      if (browserRunning) {
        const page = await this.session.getPage().catch(() => null);
        if (page !== null) {
          const [ready, auth] = await Promise.all([
            this.inspector.isPageReady(page).catch(() => false),
            this.inspector.isLoggedIn(page).catch(() => false),
          ]);
          pageReady = ready;
          authenticated = auth;
        }
      }

      const ok = this._initialized && browserRunning && pageReady && authenticated;
      const result: DriverHealth = {
        ok,
        initialized: this._initialized,
        browserRunning,
        pageReady,
        authenticated,
        providerReachable: browserRunning,
        mode: this._mode,
        ...(this._lastError !== undefined ? { lastError: this._lastError } : {}),
      };
      this.logger.emit('debug', { event: 'driver.health.checked', sessionId: this.session.id });
      return result;
    } catch {
      // health() must never throw
      this.logger.emit('debug', { event: 'driver.health.checked', sessionId: this.session.id });
      return {
        ok: false,
        initialized: this._initialized,
        browserRunning: false,
        pageReady: false,
        authenticated: false,
        providerReachable: false,
        mode: this._mode,
      };
    }
  }

  async recover(reason?: string): Promise<RecoveryResult> {
    this.logger.emit('info', { event: 'driver.recover.started', sessionId: this.session.id });
    const h = await this.health();
    const result = await this.recovery.recover(h, reason);
    if (result.ok) {
      this.logger.emit('info', {
        event: 'driver.recover.succeeded',
        sessionId: this.session.id,
        action: result.action,
      });
    } else {
      this.logger.emit('info', {
        event: 'driver.recover.failed',
        sessionId: this.session.id,
        action: result.action,
      });
    }
    return result;
  }

  async shutdown(): Promise<void> {
    this.logger.emit('info', { event: 'driver.shutdown.started', sessionId: this.session.id });
    this._mode = 'shutdown';
    try {
      if (this._initialized) {
        await this.session.close().catch(() => { /* best-effort */ });
        this._initialized = false;
      }
      this.logger.emit('info', { event: 'driver.shutdown.succeeded', sessionId: this.session.id });
    } catch (e: unknown) {
      this.logger.emit('error', {
        event: 'driver.shutdown.failed',
        sessionId: this.session.id,
        ...(e instanceof DriverError ? { errorCode: e.code } : {}),
      });
      throw e;
    }
  }
}
