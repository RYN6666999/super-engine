// Public interface
export type { WebLLMDriver } from './types/index';

// Core I/O types
export type {
  GenerateInput,
  GenerateOutput,
  DriverHealth,
  DriverMode,
  RecoveryResult,
  RecoveryAction,
  DriverConfig,
  ProviderSelectors,
} from './types/index';

// Typed errors (values — not type-only)
export {
  DriverError,
  DriverNotInitializedError,
  AuthenticationRequiredError,
  PageNotReadyError,
  PromptSubmitError,
  OutputCaptureError,
  TimeoutError,
  RecoveryFailedError,
} from './errors/index';

// Concrete driver
export { GeminiWebDriver } from './driver/GeminiWebDriver';
