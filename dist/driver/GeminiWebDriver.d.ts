import type { DriverConfig, DriverHealth, GenerateInput, GenerateOutput, RecoveryResult, WebLLMDriver } from '../types/index';
import { BrowserSession } from '../modules/BrowserSession';
import { PageStateInspector } from '../modules/PageStateInspector';
import { PromptSubmitter } from '../modules/PromptSubmitter';
import { OutputCapture } from '../modules/OutputCapture';
import { RecoveryManager } from '../modules/RecoveryManager';
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
export declare class GeminiWebDriver implements WebLLMDriver {
    private readonly config;
    private _initialized;
    private _mode;
    private _lastError;
    private _lastErrorCode;
    private readonly session;
    private readonly inspector;
    private readonly submitter;
    private readonly capture;
    private readonly recovery;
    private readonly logger;
    constructor(config: DriverConfig, deps?: GeminiWebDriverDeps);
    init(): Promise<void>;
    generate(input: GenerateInput): Promise<GenerateOutput>;
    health(): Promise<DriverHealth>;
    recover(reason?: string): Promise<RecoveryResult>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=GeminiWebDriver.d.ts.map