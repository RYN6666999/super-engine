# Selector Resilience Spec — v0.1.1-driver-hardening delta

## What changes from v0.1.0

`v0.1.0` used single CSS selectors per slot. `v0.1.1` uses CSS `:is()` pseudo-class
to express multiple candidate selectors per slot, providing browser-native fallback
resolution without any module code changes.

---

## Fallback strategy

Each `ProviderSelectors` string value is upgraded to a CSS `:is()` expression:

```css
/* Before */
rich-textarea

/* After */
:is(rich-textarea, [data-testid="prompt-textarea"], .ql-editor[contenteditable="true"])
```

The browser resolves the first matching candidate. No module code changes are needed
because all Playwright selector APIs (`$`, `isVisible`, `fill`, `$eval`) accept CSS.

---

## Selector inventory — v0.1.1

| Slot | Primary | Fallbacks | Criticality |
|---|---|---|---|
| `inputBox` | `rich-textarea` | `[data-testid="prompt-textarea"]`, `.ql-editor[contenteditable="true"]` | **Critical** |
| `submitButton` | `button[aria-label="Send message"]` | `button[aria-label="Submit"]`, `button[data-testid="send-button"]` | High |
| `outputContainer` | `.model-response-text` | `[data-testid="response-text"]`, `.response-content` | **Critical** |
| `stopButton` | `button[aria-label="Stop generating"]` | `button[aria-label="Stop response"]`, `button[data-testid="stop-button"]` | High |
| `loginIndicator` | `[data-test-id="user-menu"]` | `img[alt*="profile photo"]`, `.user-avatar` | **Critical** |
| `challengeIndicator` | `#captcha-container` | `[data-recaptcha-challenge-type]`, `.challenge-container` | Medium |
| `streamingIndicator` | `.loading-indicator` | `[aria-busy="true"]`, `.thinking-indicator` | Low |

---

## Selector audit workflow

Before each release, run the selector audit utility against a live page:

```typescript
import { selectorAudit } from './src/utils/selectorAudit';
// Pass an initialized Playwright Page
const report = await selectorAudit(page, GeminiSelectors);
report.forEach(r => console.log(r.selector, r.found ? '✓' : '✗', r.visible ? 'visible' : 'hidden'));
```

Or use the manual checklist in `docs/smoke-test-guide.md`.

---

## Constraints

- `ProviderSelectors` type is **not changed** (string values only).
- Module code (`PromptSubmitter`, `OutputCapture`, `PageStateInspector`) is **not changed**.
- Selectors remain provider-specific and internal.
- Fallback candidates are clearly commented as "Gemini UI observed" with a date note.
- Google may change the DOM at any time — selectors MUST be re-verified before production use.
