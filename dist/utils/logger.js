"use strict";
/**
 * DriverLogger — minimal structured logger for the driver core.
 *
 * Internal utility. NOT exported from src/index.ts.
 * Emits JSON-Lines records to process.stderr (or an injected write function).
 *
 * Security: NEVER log prompt text, model output, cookies, auth tokens,
 * or file paths. See observability spec for the allowed field list.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverLogger = void 0;
const LEVEL_RANK = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};
class DriverLogger {
    minLevel;
    write;
    constructor(minLevel = 'silent', write = (r) => {
        console.error(JSON.stringify(r));
    }) {
        this.minLevel = minLevel;
        this.write = write;
    }
    emit(level, event) {
        if (LEVEL_RANK[this.minLevel] >= LEVEL_RANK[level]) {
            this.write({
                ...event,
                level,
                timestamp: new Date().toISOString(),
            });
        }
    }
}
exports.DriverLogger = DriverLogger;
//# sourceMappingURL=logger.js.map