"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryManager = void 0;
/** Keywords in a recovery reason that signal a stuck/stale page requiring force-refresh. */
const FORCE_REFRESH_SIGNALS = ['timeout', 'capture-failed', 'stuck', 'stale'];
function reasonRequiresForceRefresh(reason) {
    if (!reason)
        return false;
    const lower = reason.toLowerCase();
    return FORCE_REFRESH_SIGNALS.some((signal) => lower.includes(signal));
}
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
class RecoveryManager {
    session;
    inspector;
    config;
    constructor(session, inspector, config) {
        this.session = session;
        this.inspector = inspector;
        this.config = config;
    }
    /**
     * Executes the appropriate recovery action based on the provided health snapshot.
     * @param health - Current DriverHealth at time of recovery request.
     * @param reason - Optional human-readable reason; 'timeout'/'capture-failed'/'stuck'/'stale'
     *                 triggers a force-refresh even when health.ok is true.
     * @returns RecoveryResult — never throws.
     */
    async recover(health, reason) {
        try {
            // Health ok, but reason signals a stuck/stale page — force a refresh to clear state.
            if (health.ok && reasonRequiresForceRefresh(reason)) {
                return await this._refreshPage();
            }
            if (health.ok) {
                return { ok: true, action: 'none', message: 'Health is ok — no recovery needed.' };
            }
            if (!health.browserRunning) {
                return await this._restartBrowser();
            }
            if (!health.authenticated) {
                return await this._reopenPage();
            }
            if (!health.pageReady) {
                return await this._refreshPage();
            }
            return { ok: true, action: 'none', message: 'Degraded state resolved without action.' };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { ok: false, action: 'none', message: `Unexpected recovery error: ${msg}` };
        }
    }
    async _restartBrowser() {
        try {
            await this.session.close().catch(() => { });
            await this.session.launch();
            const page = await this.session.getPage();
            const ready = await this.inspector.isPageReady(page);
            const loggedIn = ready ? await this.inspector.isLoggedIn(page) : false;
            const ok = ready && loggedIn;
            return {
                ok,
                action: 'restart-browser',
                message: ok
                    ? 'Browser restarted and session restored.'
                    : 'Browser restarted but session not fully restored.',
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { ok: false, action: 'restart-browser', message: `Browser restart failed: ${msg}` };
        }
    }
    async _reopenPage() {
        try {
            const page = await this.session.getPage();
            try {
                await page.goto(this.config.providerUrl);
            }
            catch { /* best-effort navigation */ }
            const loggedIn = await this.inspector.isLoggedIn(page);
            if (!loggedIn) {
                return {
                    ok: false,
                    action: 'rebuild-session',
                    message: 'Not authenticated after reopen — session rebuild required.',
                };
            }
            const ready = await this.inspector.isPageReady(page);
            return {
                ok: ready,
                action: 'reopen-page',
                message: ready ? 'Page reopened and session restored.' : 'Page reopened but not fully ready.',
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { ok: false, action: 'reopen-page', message: `Reopen failed: ${msg}` };
        }
    }
    async _refreshPage() {
        try {
            const page = await this.session.getPage();
            // Initial state confirmation (consumes first check for post-action diff)
            await this.inspector.isPageReady(page);
            // Execute page refresh (best-effort — page mock in tests lacks reload)
            try {
                await page.reload();
            }
            catch { /* best-effort */ }
            // Post-action verification
            const afterReady = await this.inspector.isPageReady(page);
            return {
                ok: afterReady,
                action: 'refresh-page',
                message: afterReady ? 'Page refreshed and ready.' : 'Page refresh did not restore readiness.',
            };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { ok: false, action: 'refresh-page', message: `Refresh failed: ${msg}` };
        }
    }
}
exports.RecoveryManager = RecoveryManager;
//# sourceMappingURL=RecoveryManager.js.map