# Compatibility Spec — weblm-driver v0.1.0-driver-core

## Runtime Requirements

| Requirement | Minimum | Tested |
|---|---|---|
| Node.js | 18 LTS | 20.18.3 |
| TypeScript | 5.0 | 5.9.3 |
| Playwright | 1.40 | 1.43.x |
| Vitest | 1.0 | 1.6.1 |

---

## Browser Engine

- **Chromium only** — launched via `playwright.chromium`
- No Firefox or WebKit support in v0.1.0
- Chromium revision is pinned by the installed `playwright` package version
- Run `npx playwright install chromium` after install to ensure the correct binary is present

---

## Operating System

| OS | Status |
|---|---|
| macOS (ARM/x86) | Tested |
| Linux (Ubuntu 22.04+) | Expected compatible — not verified |
| Windows | Not tested |

---

## TypeScript Compiler Options

The following non-default options are enabled and must remain compatible:

| Option | Value | Implication |
|---|---|---|
| `strict` | `true` | All strict sub-checks enabled |
| `exactOptionalPropertyTypes` | `true` | Optional fields cannot be assigned `undefined` explicitly |
| `noUncheckedIndexedAccess` | `true` | Array index returns `T \| undefined` |
| `noImplicitAny` | `true` | All types must be explicit |
| `strictNullChecks` | `true` | Null and undefined are not assignable to non-null types |
| `target` | `ES2022` | Requires Node ≥18 |
| `lib` | `["ES2022", "DOM"]` | DOM lib included for `setTimeout`, `clearTimeout` |

The DOM lib is included to provide `setTimeout`/`clearTimeout` type definitions. No browser DOM APIs are used at runtime — the package runs in Node.js only.

---

## Playwright Provider Compatibility

The Gemini selectors in `src/providers/gemini/selectors.ts` target the Gemini Web interface as observed in early 2025. Google may change the DOM structure at any time.

**Before each production deployment, verify:**

| Selector | Purpose | Verify by |
|---|---|---|
| `rich-textarea` | Prompt input | Open Gemini, inspect input element |
| `button[aria-label="Send message"]` | Submit button | Inspect send button |
| `.model-response-text` | Output container | Inspect a completed response |
| `button[aria-label="Stop generating"]` | Stop button | Inspect during active generation |
| `[data-test-id="user-menu"]` | Login indicator | Inspect top-right user menu |
| `#captcha-container` | Challenge indicator | Inspect if a CAPTCHA appears |
| `.loading-indicator` | Streaming cursor | Inspect during streaming |

If selectors drift, update `src/providers/gemini/selectors.ts`. No code changes elsewhere are required.

---

## ESLint Compatibility

- ESLint 8.x — v9 (flat config) not yet supported
- `@typescript-eslint` 7.x plugins
- TypeScript 5.9.x triggers an "unsupported TypeScript version" warning from `@typescript-eslint` — this is a warning only and does not block linting

---

## Module Format

- `main`: `dist/index.js` (CommonJS via `"module": "CommonJS"` in tsconfig)
- `types`: `dist/index.d.ts`
- ESM output is not provided in v0.1.0

---

## Breaking Change Policy

All types exported from `src/index.ts` are part of the **public API**. Changes to these types follow semantic versioning:

- Adding optional fields → minor version bump
- Removing fields or changing types → major version bump
- Internal types (`CaptureConfig`, `BrowserSessionConfig`, `PageMode`, `CaptureResult`) are **not exported** and may change without notice
