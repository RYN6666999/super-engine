"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiWebDriver = exports.ConcurrentGenerationError = exports.RecoveryFailedError = exports.TimeoutError = exports.OutputCaptureError = exports.PromptSubmitError = exports.PageNotReadyError = exports.AuthenticationRequiredError = exports.DriverNotInitializedError = exports.DriverError = void 0;
// Typed errors (values — not type-only)
var index_1 = require("./errors/index");
Object.defineProperty(exports, "DriverError", { enumerable: true, get: function () { return index_1.DriverError; } });
Object.defineProperty(exports, "DriverNotInitializedError", { enumerable: true, get: function () { return index_1.DriverNotInitializedError; } });
Object.defineProperty(exports, "AuthenticationRequiredError", { enumerable: true, get: function () { return index_1.AuthenticationRequiredError; } });
Object.defineProperty(exports, "PageNotReadyError", { enumerable: true, get: function () { return index_1.PageNotReadyError; } });
Object.defineProperty(exports, "PromptSubmitError", { enumerable: true, get: function () { return index_1.PromptSubmitError; } });
Object.defineProperty(exports, "OutputCaptureError", { enumerable: true, get: function () { return index_1.OutputCaptureError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return index_1.TimeoutError; } });
Object.defineProperty(exports, "RecoveryFailedError", { enumerable: true, get: function () { return index_1.RecoveryFailedError; } });
Object.defineProperty(exports, "ConcurrentGenerationError", { enumerable: true, get: function () { return index_1.ConcurrentGenerationError; } });
// Concrete driver
var GeminiWebDriver_1 = require("./driver/GeminiWebDriver");
Object.defineProperty(exports, "GeminiWebDriver", { enumerable: true, get: function () { return GeminiWebDriver_1.GeminiWebDriver; } });
//# sourceMappingURL=index.js.map