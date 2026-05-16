"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiWebDriver = void 0;
const index_1 = require("../errors/index");
const outputClassifier_1 = require("../providers/gemini/outputClassifier");
const BrowserSession_1 = require("../modules/BrowserSession");
const PageStateInspector_1 = require("../modules/PageStateInspector");
const PromptSubmitter_1 = require("../modules/PromptSubmitter");
const OutputCapture_1 = require("../modules/OutputCapture");
const RecoveryManager_1 = require("../modules/RecoveryManager");
const selectors_1 = require("../providers/gemini/selectors");
const logger_1 = require("../utils/logger");
/**
 * Concrete implementation of WebLLMDriver for the Gemini Web provider.
 * Wires BrowserSession, PageStateInspector, PromptSubmitter, OutputCapture,
 * and RecoveryManager together. Contains no application or business logic.
 */
class GeminiWebDriver {
    config;
    _initialized = false;
    _mode = 'idle';
    _lastError = undefined;
    _lastErrorCode = undefined;
    session;
    inspector;
    submitter;
    capture;
    recovery;
    logger;
    constructor(config, deps) {
        this.config = config;
        const sessionConfig = {
            providerUrl: config.providerUrl,
            ...(config.profileDir !== undefined ? { profileDir: config.profileDir } : {}),
            ...(config.headless !== undefined ? { headless: config.headless } : {}),
            ...(config.executablePath !== undefined ? { executablePath: config.executablePath } : {}),
            ...(config.args !== undefined ? { args: config.args } : {}),
        };
        const captureConfig = {
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
            this.logger = deps.logger ?? new logger_1.DriverLogger(config.logLevel ?? 'silent');
        }
        else {
            this.session = new BrowserSession_1.BrowserSession(sessionConfig);
            this.inspector = new PageStateInspector_1.PageStateInspector(selectors_1.GeminiSelectors);
            this.submitter = new PromptSubmitter_1.PromptSubmitter(selectors_1.GeminiSelectors);
            this.capture = new OutputCapture_1.OutputCapture(selectors_1.GeminiSelectors, captureConfig);
            this.recovery = new RecoveryManager_1.RecoveryManager(this.session, this.inspector, sessionConfig);
            this.logger = new logger_1.DriverLogger(config.logLevel ?? 'silent');
        }
    }
    async init() {
        const startMs = Date.now();
        this.logger.emit('info', { event: 'driver.init.started', sessionId: this.session.id });
        try {
            await this.session.launch();
            const page = await this.session.getPage();
            await page.goto(this.config.providerUrl);
            // Wait for SPA (Angular) to hydrate before reading page state.
            // networkidle resolves once no network connections for 500ms.
            await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
            const mode = await this.inspector.detectMode(page);
            if (mode === 'unauthenticated' || mode === 'challenge') {
                this.logger.emit('warn', { event: 'driver.auth.required', sessionId: this.session.id });
                throw new index_1.AuthenticationRequiredError('Provider page requires authentication — launch with a valid browser profile');
            }
            this._initialized = true;
            this._lastError = undefined;
            this._lastErrorCode = undefined;
            this.logger.emit('info', {
                event: 'driver.init.succeeded',
                sessionId: this.session.id,
                durationMs: Date.now() - startMs,
            });
        }
        catch (e) {
            if (!(e instanceof index_1.AuthenticationRequiredError)) {
                const isDriverError = e instanceof index_1.DriverError;
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
    async generate(input) {
        if (!this._initialized) {
            throw new index_1.DriverNotInitializedError('Call init() before generate()');
        }
        if (this._mode === 'generating') {
            throw new index_1.ConcurrentGenerationError('A generation is already in progress. Await the current generate() call before issuing another.');
        }
        const startMs = Date.now();
        const requestId = typeof input.metadata?.['requestId'] === 'string'
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
            // Navigate to a fresh conversation when requested.
            if (input.newConversation === true) {
                await page.goto(this.config.providerUrl);
                // networkidle timeout is intentionally swallowed: the SPA may never reach
                // networkidle in some network conditions, but the page is still usable for
                // input submission.  A navigation failure would already have thrown inside
                // page.goto(); reaching here means the page loaded, even if not fully quiet.
                await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
                // Wait for the input box to be mounted before submitting.  This prevents a
                // race where the SPA is still hydrating (stop button selector briefly matches
                // during Angular component init) when capture starts polling.
                await page.waitForSelector(selectors_1.GeminiSelectors.inputBox, { timeout: 10_000 }).catch(() => { });
                this.logger.emit('debug', { event: 'driver.generate.new_conversation', sessionId: this.session.id });
            }
            await this.submitter.submit(page, input.prompt);
            const result = await this.capture.capture(page, input.timeoutMs);
            const { kind: outputKind, matchedPattern } = (0, outputClassifier_1.classifyGeminiOutput)(result.text);
            this._mode = 'idle';
            this.logger.emit('info', {
                event: 'driver.generate.succeeded',
                sessionId: this.session.id,
                durationMs: Date.now() - startMs,
                outputKind,
                ...(matchedPattern !== undefined ? { matchedPattern } : {}),
                ...(requestId !== undefined ? { requestId } : {}),
            });
            return {
                text: result.text,
                startedAt: result.startedAt,
                completedAt: result.completedAt,
                provider: 'gemini-web',
                sessionId: this.session.id,
                outputKind,
                ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            };
        }
        catch (e) {
            this._mode = 'degraded';
            this._lastError = e instanceof Error ? e.message : String(e);
            this._lastErrorCode = e instanceof index_1.DriverError ? e.code : undefined;
            if (e instanceof index_1.TimeoutError) {
                this.logger.emit('warn', {
                    event: 'driver.capture.timeout',
                    sessionId: this.session.id,
                    durationMs: e.elapsedMs,
                    errorCode: e.code,
                    recoverable: e.recoverable,
                    ...(requestId !== undefined ? { requestId } : {}),
                });
            }
            else {
                const isDriverError = e instanceof index_1.DriverError;
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
    async health() {
        const degradedReport = () => ({
            ok: false,
            initialized: this._initialized,
            browserRunning: false,
            pageReady: false,
            authenticated: false,
            providerReachable: false,
            mode: this._mode,
        });
        const check = async () => {
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
                const result = {
                    ok,
                    initialized: this._initialized,
                    browserRunning,
                    pageReady,
                    authenticated,
                    providerReachable: browserRunning,
                    mode: this._mode,
                    ...(this._lastError !== undefined ? { lastError: this._lastError } : {}),
                    ...(this._lastErrorCode !== undefined ? { lastErrorCode: this._lastErrorCode } : {}),
                };
                this.logger.emit('debug', { event: 'driver.health.checked', sessionId: this.session.id });
                return result;
            }
            catch {
                // health() must never throw
                this.logger.emit('debug', { event: 'driver.health.checked', sessionId: this.session.id });
                return degradedReport();
            }
        };
        const timeout = new Promise((resolve) => setTimeout(() => resolve(degradedReport()), 5_000));
        return Promise.race([check(), timeout]);
    }
    async recover(reason) {
        this.logger.emit('info', { event: 'driver.recover.started', sessionId: this.session.id });
        const h = await this.health();
        const result = await this.recovery.recover(h, reason);
        if (result.ok) {
            this._lastError = undefined;
            this._lastErrorCode = undefined;
            this.logger.emit('info', {
                event: 'driver.recover.succeeded',
                sessionId: this.session.id,
                action: result.action,
            });
        }
        else {
            this.logger.emit('info', {
                event: 'driver.recover.failed',
                sessionId: this.session.id,
                action: result.action,
            });
        }
        return result;
    }
    async shutdown() {
        this.logger.emit('info', { event: 'driver.shutdown.started', sessionId: this.session.id });
        this._mode = 'shutdown';
        try {
            if (this._initialized) {
                await this.session.close().catch(() => { });
                this._initialized = false;
            }
            this.logger.emit('info', { event: 'driver.shutdown.succeeded', sessionId: this.session.id });
        }
        catch (e) {
            this.logger.emit('error', {
                event: 'driver.shutdown.failed',
                sessionId: this.session.id,
                ...(e instanceof index_1.DriverError ? { errorCode: e.code } : {}),
            });
            throw e;
        }
    }
}
exports.GeminiWebDriver = GeminiWebDriver;
//# sourceMappingURL=GeminiWebDriver.js.map