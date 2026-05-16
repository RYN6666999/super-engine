import type { BrowserSessionConfig, DriverHealth, RecoveryResult } from '../types/index';
import type { BrowserSession } from './BrowserSession';
import type { PageStateInspector } from './PageStateInspector';
/**
 * Decides and executes recovery actions based on a DriverHealth snapshot.
 * Never throws — always returns RecoveryResult.
 *
 * Recovery escalation order (per spec decision matrix):
 *   none → refresh-page → reopen-page → restart-browser → rebuild-session
 *
 * Reason-aware extension (v0.1.1):
 *   When health.ok = true but reason indicates timeout/stuck/stale, a forced
 *   page refresh is executed to clear potentially stuck generation state.
 */
export declare class RecoveryManager {
    private readonly session;
    private readonly inspector;
    private readonly config;
    constructor(session: BrowserSession, inspector: PageStateInspector, config: BrowserSessionConfig);
    /**
     * Executes the appropriate recovery action based on the provided health snapshot.
     * @param health - Current DriverHealth at time of recovery request.
     * @param reason - Optional human-readable reason; 'timeout'/'capture-failed'/'stuck'/'stale'
     *                 triggers a force-refresh even when health.ok is true.
     * @returns RecoveryResult — never throws.
     */
    recover(health: DriverHealth, reason?: string): Promise<RecoveryResult>;
    private _restartBrowser;
    private _reopenPage;
    private _refreshPage;
}
//# sourceMappingURL=RecoveryManager.d.ts.map